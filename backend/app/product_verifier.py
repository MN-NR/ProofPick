"""Checks whether a product meets the request, using deterministic rules over evidence.

Prices and materials are decided here, never by model prose. Catalog text is
untrusted, so it is only ever matched against, not followed.
"""

import re
from decimal import Decimal

from .schemas import (
    Check,
    Evidence,
    Method,
    Product,
    ProductResult,
    ProductStatus,
    Requirements,
)

_FIBER_SYNONYMS = {
    "polyester": {"polyester", "poly", "pet", "recycled polyester"},
    "elastane": {"elastane", "spandex", "lycra"},
    "viscose": {"viscose", "rayon"},
    "wool": {"wool", "merino", "merino wool", "cashmere"},
}
_PART = re.compile(r"(\d{1,3}(?:\.\d+)?)\s*%\s*([a-zA-Z][a-zA-Z \-]*)")
_SCOPED = re.compile(r"\b(shell|outer|body|lining|trim|contrast)\s*:", re.I)

_SLEEVE_PATTERNS = [
    ("sleeveless", r"\bsleeveless\b"),
    ("three_quarter", r"\b(three[- ]quarter|3/4)[- ]?(length )?sleeve"),
    ("short", r"\bshort[- ]sleeve"),
    ("long", r"\b(long|full[- ]length)(?: long)?[- ]sleeve"),
]
_NECK_PATTERNS = [
    ("high", r"\b(turtle ?neck|mock[- ]neck|funnel[- ]neck|roll ?neck|high[- ]neck|stand-up high neck)\b"),
    ("crew", r"\bcrew[- ]?neck\b"),
    ("v_neck", r"\bv[- ]neck\b"),
    ("scoop", r"\bscoop[- ]?neck\b"),
    ("boat", r"\bboat[- ]?neck\b"),
    ("collared", r"\bcollar(ed)?\b"),
]


def parse_composition(text: str) -> tuple[dict[str, float], bool]:
    """Returns fiber percentages and whether they add up to a whole garment section."""
    parts: dict[str, float] = {}
    for pct, fiber in _PART.findall(text):
        name = re.split(r"\s+(?:and|with)\s+", fiber.strip().lower())[0].strip()
        parts[name] = parts.get(name, 0) + float(pct)
    return parts, abs(sum(parts.values()) - 100) < 0.01


def _matches_fiber(fiber: str, excluded: str) -> bool:
    excluded = excluded.strip().lower()
    names = _FIBER_SYNONYMS.get(excluded, {excluded})
    return fiber in names or any(re.search(rf"\b{re.escape(n)}\b", fiber) for n in names)


def _assess_composition(e: Evidence, excluded: str) -> tuple[str, str]:
    """Returns ("present" | "absent" | "unknown", reason) for one source."""
    text = e.quote or ""
    parts, complete = parse_composition(text)
    if any(_matches_fiber(f, excluded) for f in parts):
        return "present", f"lists {excluded}"
    if re.search(rf"\b{re.escape(excluded.lower())}\b", text.lower()):
        return "present", f"mentions {excluded}"
    if not parts:
        return "unknown", "gives no fiber percentages"
    if not complete:
        return "unknown", "percentages do not add up to 100%"
    scopes = {s.lower() for s in _SCOPED.findall(text)}
    if scopes and scopes.isdisjoint({"lining", "trim", "contrast"}):
        return "unknown", "describes only the shell, not any lining or trim"
    return "absent", f"complete composition without {excluded}"


def check_material(product: Product, excluded: str) -> Check:
    requirement = f"exclude_{excluded.strip().lower().replace(' ', '_')}"
    sources = product.evidence_for("composition")

    def make(status: ProductStatus, observed: str, ids: list[str], explanation: str) -> Check:
        action = {ProductStatus.MEETS: "keep", ProductStatus.CONFLICT: "exclude",
                  ProductStatus.INSUFFICIENT: "seek_or_disclose"}[status]
        return Check(product_id=product.id, requirement=requirement, status=status, observed=observed,
                     evidence_ids=ids, method=Method.MATERIAL_RULE, action=action, explanation=explanation)

    if not sources:
        return make(ProductStatus.INSUFFICIENT, "No composition information found", [],
                    "Neither a composition section nor a care label was available.")
    results = [(e, *_assess_composition(e, excluded)) for e in sources]
    observed = " | ".join(e.quote or "" for e, _, _ in results)
    ids = [e.id for e, _, _ in results]
    verdicts = {v for _, v, _ in results}
    if "present" in verdicts and "absent" in verdicts:
        return make(ProductStatus.INSUFFICIENT, observed, ids,
                    f"Sources disagree about {excluded}, so this cannot be established either way.")
    if "present" in verdicts:
        return make(ProductStatus.CONFLICT, observed, ids, f"The composition lists {excluded}.")
    if "absent" in verdicts:
        return make(ProductStatus.MEETS, observed, ids, f"The complete composition does not list {excluded}.")
    reason = next(r for _, v, r in results if v == "unknown")
    return make(ProductStatus.INSUFFICIENT, observed, ids, f"The composition {reason}, so {excluded} cannot be ruled out.")


def check_price(product: Product, req: Requirements) -> Check:
    limit = Decimal(str(req.max_price_usd))
    price = Decimal(str(product.price))
    ids = [e.id for e in product.evidence_for("price")]
    observed = f"{price:.2f} {product.currency}"
    bound = f"${limit:.2f} {'or less' if req.price_inclusive else 'limit (exclusive)'}, before shipping and tax"
    base = dict(product_id=product.id, requirement="budget", observed=observed, evidence_ids=ids, method=Method.PRICE_RULE)
    if product.currency != "USD":
        return Check(**base, status=ProductStatus.INSUFFICIENT, action="seek_or_disclose",
                     explanation=f"Listed in {product.currency}; ProofPick does not estimate exchange rates.")
    within = price <= limit if req.price_inclusive else price < limit
    if within:
        return Check(**base, status=ProductStatus.MEETS, action="keep", explanation=f"Within {bound}.")
    return Check(**base, status=ProductStatus.CONFLICT, action="exclude", explanation=f"Over {bound}.")


def extract_attribute(text: str, patterns: list[tuple[str, str]]) -> str | None:
    for value, pattern in patterns:
        if re.search(pattern, text, re.I):
            return value
    return None


def _check_attribute(product: Product, field: str, wanted: str, patterns: list[tuple[str, str]]) -> Check:
    found = [(e, extract_attribute(e.quote or "", patterns)) for e in product.evidence_for(field)]
    found = [(e, v) for e, v in found if v]
    base = dict(product_id=product.id, requirement=field, method=Method.SOURCE_TEXT)
    if not found:
        return Check(**base, status=ProductStatus.INSUFFICIENT, observed=f"{field.capitalize()} not stated",
                     action="seek_or_disclose", explanation=f"The product text does not state the {field}.")
    observed = " | ".join(e.quote or "" for e, _ in found)
    ids = [e.id for e, _ in found]
    values = {v for _, v in found}
    if len(values) > 1:
        return Check(**base, status=ProductStatus.INSUFFICIENT, observed=observed, evidence_ids=ids,
                     action="seek_or_disclose", explanation=f"Sources disagree about the {field}.")
    if wanted in values:
        return Check(**base, status=ProductStatus.MEETS, observed=observed, evidence_ids=ids, action="keep",
                     explanation=f"The product text supports the requested {field}.")
    return Check(**base, status=ProductStatus.CONFLICT, observed=observed, evidence_ids=ids, action="exclude",
                 explanation=f"The product text states a different {field}.")


def check_availability(product: Product) -> Check | None:
    """Only a documented out-of-stock result blocks; absent stock data is not a failed requirement."""
    records = product.evidence_for("availability")
    if not records:
        return None
    quote = records[0].quote or ""
    if re.search(r"out of stock|sold out|unavailable", quote, re.I):
        return Check(product_id=product.id, requirement="availability", status=ProductStatus.CONFLICT, observed=quote,
                     evidence_ids=[records[0].id], method=Method.LOOKUP, action="exclude",
                     explanation="Documented as unavailable.")
    if re.search(r"in stock", quote, re.I):
        return Check(product_id=product.id, requirement="availability", status=ProductStatus.MEETS, observed=quote,
                     evidence_ids=[records[0].id], method=Method.LOOKUP, action="keep",
                     explanation="Documented as available when the record was collected.")
    return None


def combine(checks: list[Check]) -> ProductStatus:
    statuses = {c.status for c in checks}
    if ProductStatus.CONFLICT in statuses:
        return ProductStatus.CONFLICT
    if ProductStatus.INSUFFICIENT in statuses:
        return ProductStatus.INSUFFICIENT
    return ProductStatus.MEETS


def verify_product(product: Product, req: Requirements) -> ProductResult:
    checks: list[Check] = []
    if req.max_price_usd is not None:
        checks.append(check_price(product, req))
    checks.extend(check_material(product, m) for m in req.excluded_materials)
    if req.sleeves:
        checks.append(_check_attribute(product, "sleeves", req.sleeves, _SLEEVE_PATTERNS))
    if req.neckline:
        checks.append(_check_attribute(product, "neckline", req.neckline, _NECK_PATTERNS))
    availability = check_availability(product)
    if availability:
        checks.append(availability)
    return ProductResult(product_id=product.id, status=combine(checks), checks=checks)

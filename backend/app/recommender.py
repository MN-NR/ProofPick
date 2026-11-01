"""Ranks already-eligible products by preference. It cannot change eligibility."""

import json

from pydantic import BaseModel

from .catalog import Catalog
from .llm import UNTRUSTED_NOTICE, ModelClient, ModelUnavailable
from .schemas import Product, ProductResult, RankedProduct, Ranking, Requirements

SYSTEM = f"""You rank clothing candidates that have already passed the shopper's requirement checks. Order them by fit with the shopper's preferences and explain each placement in one or two plain sentences, including tradeoffs.

Use only the provided product_id and evidence_id values. Do not claim anything about fit, comfort, opacity or exact color. Describe style fit as a judgment, not a verified fact. Include every candidate exactly once.

{UNTRUSTED_NOTICE}"""


class _ModelRanking(BaseModel):
    items: list[RankedProduct]


def _rule_score(product: Product, req: Requirements) -> int:
    wanted = " ".join(req.preferences).lower()
    score = sum(2 for tag in product.tags if tag in wanted)
    score += sum(1 for c in req.preferred_colors if c.lower() in product.color.lower()) * 3
    return score


def rank_with_rules(products: list[Product], results: dict[str, ProductResult], req: Requirements) -> Ranking:
    ordered = sorted(products, key=lambda p: (-_rule_score(p, req), p.price, p.id))
    items = []
    for p in ordered:
        matched = [t for t in p.tags if t in " ".join(req.preferences).lower()]
        if any(c.lower() in p.color.lower() for c in req.preferred_colors):
            matched.append(p.color)
        why = f"Matches your preferences: {', '.join(matched)}." if matched else "No stated preference separated this item, so it is ordered by price."
        ids = [i for c in results[p.id].checks for i in c.evidence_ids]
        items.append(RankedProduct(product_id=p.id, explanation=why, evidence_ids=ids))
    return Ranking(items=items, method="rules")


def validate_ranking(items: list[RankedProduct], products: list[Product], catalog: Catalog) -> list[RankedProduct] | None:
    """Rejects invented products and evidence, so the model can only reorder real candidates."""
    allowed = {p.id for p in products}
    seen: set[str] = set()
    clean = []
    for item in items:
        if item.product_id not in allowed or item.product_id in seen:
            return None
        seen.add(item.product_id)
        for evidence_id in item.evidence_ids:
            evidence = catalog.evidence(evidence_id)
            if evidence is None or evidence.product_id != item.product_id:
                return None
        clean.append(item)
    return clean if seen == allowed else None


async def rank_candidates(products: list[Product], results: dict[str, ProductResult], req: Requirements,
                          catalog: Catalog, model: ModelClient) -> Ranking:
    if len(products) <= 1:
        return rank_with_rules(products, results, req)
    data = [{
        "product_id": p.id, "name": p.name, "color": p.color, "price": p.price, "description": p.description, "tags": p.tags,
        "evidence": [{"evidence_id": e.id, "field": e.field, "quote": e.quote} for e in p.evidence if e.kind == "text"],
    } for p in products]
    prompt = (f"Shopper preferences: {json.dumps(req.preferences)}\nPreferred colors: {json.dumps(req.preferred_colors)}\n"
              f"<untrusted_product_data>{json.dumps(data)}</untrusted_product_data>")
    try:
        parsed = await model.structured(SYSTEM, prompt, _ModelRanking)
    except ModelUnavailable:
        return rank_with_rules(products, results, req)
    clean = validate_ranking(parsed.items, products, catalog)
    return Ranking(items=clean, method="model") if clean else rank_with_rules(products, results, req)

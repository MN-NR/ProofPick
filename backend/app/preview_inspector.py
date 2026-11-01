"""Compares an original garment image with its try-on. The overall result is derived in code."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from .llm import UNTRUSTED_NOTICE, ModelClient, ModelUnavailable, image_block
from .schemas import Check, FeatureObservation, Method, PreviewInspection, PreviewStatus, Product, ProductStatus

SYSTEM = f"""You compare a garment's original image (first) with a generated try-on preview (second). Report only on the garment.

For each of neckline, sleeves, pattern and details, choose:
- consistent: visible in the preview and matching the original.
- altered: visible in the preview and clearly different from the original.
- hidden: blocked by pose, hair, arms or cropping. A hidden feature is not altered.
- unclear: visible but too low in quality to compare.

Write one short factual sentence per feature. Do not comment on the person's body, attractiveness or how well the garment suits them, and do not assess fit, comfort, opacity or exact color. {UNTRUSTED_NOTICE}"""

VISUAL_SYSTEM = f"""You read one garment attribute from a product photo. Answer "not_visible" unless the attribute can be seen clearly. Do not guess. {UNTRUSTED_NOTICE}"""


class _ModelInspection(BaseModel):
    features: list[FeatureObservation]


class _Attribute(BaseModel):
    value: Literal["long", "three_quarter", "short", "sleeveless", "high", "crew", "v_neck", "scoop", "boat", "collared", "not_visible"]
    observation: str


def derive_status(features: list[FeatureObservation]) -> PreviewStatus:
    statuses = {f.status for f in features}
    if "altered" in statuses:
        return PreviewStatus.POSSIBLE_MISMATCH
    if "consistent" in statuses:
        return PreviewStatus.NO_MISMATCH
    return PreviewStatus.NOT_ASSESSABLE


def summarize(features: list[FeatureObservation]) -> str:
    return " ".join(f.observation for f in features if f.status != "consistent") or " ".join(f.observation for f in features)


async def inspect_preview(original: Path, preview: Path, model: ModelClient) -> PreviewInspection:
    content = [image_block(original), image_block(preview), "Compare the garment in these two images."]
    try:
        parsed = await model.structured(SYSTEM, content, _ModelInspection)
    except ModelUnavailable as exc:
        return PreviewInspection(status=PreviewStatus.NOT_ASSESSABLE, summary=f"The preview was not inspected: {exc}", method="unavailable")
    return PreviewInspection(status=derive_status(parsed.features), features=parsed.features, summary=summarize(parsed.features))


async def assess_attribute(product: Product, field: str, wanted: str, original: Path, model: ModelClient) -> Check | None:
    """Fills a gap in the product text from the original photo. Returns None if it stays unknown."""
    allowed = {"sleeves": "long, three_quarter, short or sleeveless", "neckline": "high, crew, v_neck, scoop, boat or collared"}[field]
    content = [image_block(original), f"What is this garment's {field}? Use one of: {allowed}, or not_visible."]
    try:
        parsed = await model.structured(VISUAL_SYSTEM, content, _Attribute, effort="low")
    except ModelUnavailable:
        return None
    if parsed.value == "not_visible":
        return None
    evidence_ids = [e.id for e in product.evidence_for("image")]
    meets = parsed.value == wanted
    return Check(
        product_id=product.id, requirement=field, observed=parsed.observation, evidence_ids=evidence_ids, method=Method.VISUAL,
        status=ProductStatus.MEETS if meets else ProductStatus.CONFLICT, action="keep" if meets else "exclude",
        explanation=f"AI-assisted reading of the original product photo: {parsed.value.replace('_', ' ')}. The product text does not state this.",
    )

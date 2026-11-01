"""Shared records. Evidence is kept separate from the conclusions drawn from it."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

Sleeve = Literal["long", "three_quarter", "short", "sleeveless"]
Neckline = Literal["high", "crew", "v_neck", "scoop", "boat", "collared"]


class ProductStatus(StrEnum):
    MEETS = "meets_documented_requirements"
    CONFLICT = "conflicts_with_requirement"
    INSUFFICIENT = "insufficient_evidence"


class PreviewStatus(StrEnum):
    NO_MISMATCH = "no_visible_mismatch_detected"
    POSSIBLE_MISMATCH = "possible_mismatch"
    NOT_ASSESSABLE = "not_assessable"


class Method(StrEnum):
    PRICE_RULE = "price_comparison"
    MATERIAL_RULE = "material_rule"
    SOURCE_TEXT = "source_text_rule"
    VISUAL = "visual_assessment"
    LOOKUP = "exact_lookup"


class Requirements(BaseModel):
    """Non-negotiable fields are constraints; `preferences` may only affect ranking."""

    product: Literal["top"] = "top"
    max_price_usd: float | None = Field(default=None, ge=0)
    price_inclusive: bool = False
    sleeves: Sleeve | None = None
    neckline: Neckline | None = None
    excluded_materials: list[str] = Field(default_factory=list)
    preferences: list[str] = Field(default_factory=list)
    preferred_colors: list[str] = Field(default_factory=list)


class ParsedRequirements(BaseModel):
    requirements: Requirements
    parser: Literal["model", "rules"]
    notes: list[str] = Field(default_factory=list)


class Evidence(BaseModel):
    id: str
    product_id: str
    field: Literal["price", "composition", "sleeves", "neckline", "availability", "image"]
    kind: Literal["text", "image"] = "text"
    source: str
    quote: str | None = None
    image: str | None = None
    collected_at: str
    is_generated: bool = False


class Product(BaseModel):
    id: str
    name: str
    brand: str
    variant: str
    color: str
    price: float
    currency: str
    description: str
    tags: list[str] = Field(default_factory=list)
    image: str
    source_url: str | None = None
    collected_at: str
    data_label: str
    evidence: list[Evidence]

    def evidence_for(self, field: str) -> list[Evidence]:
        return [e for e in self.evidence if e.field == field]


class Check(BaseModel):
    product_id: str
    requirement: str
    status: ProductStatus
    observed: str
    evidence_ids: list[str] = Field(default_factory=list)
    method: Method
    action: Literal["keep", "exclude", "seek_or_disclose"]
    explanation: str


class ProductResult(BaseModel):
    product_id: str
    status: ProductStatus
    checks: list[Check]


class RankedProduct(BaseModel):
    product_id: str
    explanation: str
    evidence_ids: list[str] = Field(default_factory=list)


class Ranking(BaseModel):
    items: list[RankedProduct]
    method: Literal["model", "rules"]


class FeatureObservation(BaseModel):
    feature: Literal["neckline", "sleeves", "pattern", "details"]
    status: Literal["consistent", "altered", "hidden", "unclear"]
    observation: str


class PreviewInspection(BaseModel):
    status: PreviewStatus
    features: list[FeatureObservation] = Field(default_factory=list)
    summary: str
    method: Literal["model", "unavailable"] = "model"


class PhotoOut(BaseModel):
    photo_id: str
    width: int
    height: int
    is_sample: bool = False


class RecommendationRequest(BaseModel):
    original_text: str = Field(default="", max_length=2000)
    requirements: Requirements
    photo_id: str | None = None


class ParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class RetryRequest(BaseModel):
    product_id: str

import asyncio
from pathlib import Path

from app.catalog import Catalog
from app.config import get_settings
from app.llm import ModelClient
from app.preview_inspector import _ModelInspection, derive_status, inspect_preview
from app.product_verifier import verify_product
from app.recommender import _ModelRanking, rank_candidates
from app.requirements_parser import drop_unstated, parse_requirements, parse_with_rules
from app.schemas import FeatureObservation, PreviewStatus, RankedProduct, Requirements

settings = get_settings()
catalog = Catalog.load(settings.catalog_path, settings.catalog_images_dir)
SPEC = "I need a long-sleeved, high-neck top under $60, without polyester. I prefer something suitable for work."
NO_MODEL = ModelClient("", "m")


class FakeModel:
    configured = True

    def __init__(self, output):
        self.output = output

    async def structured(self, system, content, schema, effort="medium"):
        return self.output


def obs(feature, status):
    return FeatureObservation(feature=feature, status=status, observation=f"{feature} {status}")


def test_rule_parser_reads_spec_request():
    req = parse_with_rules(SPEC)
    assert req.max_price_usd == 60 and req.price_inclusive is False
    assert req.sleeves == "long" and req.neckline == "high"
    assert req.excluded_materials == ["polyester"]
    assert req.preferences == ["work-appropriate"]


def test_rule_parser_adds_nothing_unstated():
    assert parse_with_rules("a nice top") == Requirements()


def test_parser_falls_back_and_says_so():
    parsed = asyncio.run(parse_requirements(SPEC, NO_MODEL))
    assert parsed.parser == "rules" and parsed.notes


def test_model_additions_are_removed():
    req, notes = drop_unstated("a work top", Requirements(max_price_usd=50, excluded_materials=["polyester"]))
    assert req.max_price_usd is None and req.excluded_materials == [] and len(notes) == 2


def _eligible():
    req = parse_with_rules(SPEC)
    products = [catalog.get("top_001"), catalog.get("top_002")]
    return products, {p.id: verify_product(p, req) for p in products}, req


def test_ranking_rejects_invented_evidence_and_products():
    products, results, req = _eligible()
    for bad in (
        [RankedProduct(product_id="top_999", explanation="x"), RankedProduct(product_id="top_001", explanation="x")],
        [RankedProduct(product_id="top_001", explanation="x", evidence_ids=["made_up"]), RankedProduct(product_id="top_002", explanation="x")],
        [RankedProduct(product_id="top_001", explanation="x", evidence_ids=["top_002_price"]), RankedProduct(product_id="top_002", explanation="x")],
    ):
        ranking = asyncio.run(rank_candidates(products, results, req, catalog, FakeModel(_ModelRanking(items=bad))))
        assert ranking.method == "rules"
        assert {i.product_id for i in ranking.items} == {"top_001", "top_002"}


def test_ranking_accepts_valid_order():
    products, results, req = _eligible()
    items = [RankedProduct(product_id="top_002", explanation="a", evidence_ids=["top_002_price"]),
             RankedProduct(product_id="top_001", explanation="b")]
    ranking = asyncio.run(rank_candidates(products, results, req, catalog, FakeModel(_ModelRanking(items=items))))
    assert ranking.method == "model" and ranking.items[0].product_id == "top_002"


def test_hidden_feature_is_not_a_mismatch():
    assert derive_status([obs("neckline", "consistent"), obs("sleeves", "hidden")]) == PreviewStatus.NO_MISMATCH
    assert derive_status([obs("neckline", "hidden"), obs("sleeves", "unclear")]) == PreviewStatus.NOT_ASSESSABLE
    assert derive_status([obs("pattern", "altered"), obs("neckline", "consistent")]) == PreviewStatus.POSSIBLE_MISMATCH


def test_inspection_without_model_is_not_assessable():
    image = Path(settings.catalog_images_dir) / "top_001.png"
    result = asyncio.run(inspect_preview(image, image, NO_MODEL))
    assert result.status == PreviewStatus.NOT_ASSESSABLE and result.method == "unavailable"


def test_inspection_uses_derived_status():
    image = Path(settings.catalog_images_dir) / "top_001.png"
    model = FakeModel(_ModelInspection(features=[obs("pattern", "altered")]))
    assert asyncio.run(inspect_preview(image, image, model)).status == PreviewStatus.POSSIBLE_MISMATCH

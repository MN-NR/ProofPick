import pytest

from app.catalog import Catalog
from app.config import get_settings
from app.product_verifier import parse_composition, verify_product
from app.schemas import ProductStatus as S
from app.schemas import Requirements

settings = get_settings()
catalog = Catalog.load(settings.catalog_path, settings.catalog_images_dir)
SPEC_REQ = Requirements(max_price_usd=60, sleeves="long", neckline="high", excluded_materials=["polyester"])


def result(pid, req=SPEC_REQ):
    return verify_product(catalog.get(pid), req)


def check(pid, name, req=SPEC_REQ):
    return next(c for c in result(pid, req).checks if c.requirement == name)


@pytest.mark.parametrize("pid,expected", [
    ("top_001", S.MEETS),         # complete composition
    ("top_002", S.MEETS),         # blend without polyester
    ("top_003", S.CONFLICT),      # 35% polyester
    ("top_004", S.MEETS),
    ("top_005", S.INSUFFICIENT),  # no composition at all
    ("top_006", S.MEETS),         # label is the only composition source
    ("top_007", S.INSUFFICIENT),  # "cotton blend" does not rule out polyester
    ("top_008", S.INSUFFICIENT),  # shell only, lining unknown
    ("top_009", S.INSUFFICIENT),  # composition and label disagree
    ("top_010", S.CONFLICT),      # exactly $60 with "under $60"
    ("top_011", S.CONFLICT),      # short sleeves, crew neck
    ("top_012", S.CONFLICT),      # v-neck
    ("top_013", S.CONFLICT),      # three-quarter sleeves
    ("top_014", S.CONFLICT),      # $88
    ("top_015", S.INSUFFICIENT),  # sleeves and neckline not in text
    ("top_016", S.CONFLICT),      # description lies; composition rules
])
def test_spec_request_outcomes(pid, expected):
    assert result(pid).status == expected


def test_price_boundary_respects_inclusive_flag():
    req = SPEC_REQ.model_copy(update={"price_inclusive": True})
    assert check("top_010", "budget", req).status == S.MEETS
    assert check("top_010", "budget").status == S.CONFLICT


def test_material_check_cites_evidence():
    c = check("top_003", "exclude_polyester")
    assert c.observed == "65% cotton, 35% polyester"
    assert c.evidence_ids == ["top_003_composition"]
    assert c.action == "exclude"


def test_polyamide_is_not_polyester():
    product = catalog.get("top_001").model_copy(deep=True)
    product.evidence_for("composition")[0].quote = "60% cotton, 40% polyamide"
    assert verify_product(product, Requirements(excluded_materials=["polyester"])).status == S.MEETS


def test_non_usd_price_is_not_converted():
    product = catalog.get("top_001").model_copy(update={"currency": "EUR"})
    assert verify_product(product, Requirements(max_price_usd=60)).checks[0].status == S.INSUFFICIENT


def test_incomplete_percentages_stay_unknown():
    product = catalog.get("top_001").model_copy(deep=True)
    product.evidence_for("composition")[0].quote = "60% cotton"
    assert verify_product(product, Requirements(excluded_materials=["polyester"])).status == S.INSUFFICIENT


def test_parse_composition():
    assert parse_composition("65% cotton, 35% polyester") == ({"cotton": 65, "polyester": 35}, True)

import json
from pathlib import Path

from .schemas import Evidence, Product


class Catalog:
    def __init__(self, products: list[Product], images_dir: Path):
        self.products = products
        self.images_dir = images_dir
        self._by_id = {p.id: p for p in products}
        self._evidence = {e.id: e for p in products for e in p.evidence}

    @classmethod
    def load(cls, path: Path, images_dir: Path) -> "Catalog":
        return cls([Product.model_validate(p) for p in json.loads(path.read_text())], images_dir)

    def get(self, product_id: str) -> Product | None:
        return self._by_id.get(product_id)

    def evidence(self, evidence_id: str) -> Evidence | None:
        return self._evidence.get(evidence_id)

    def image_path(self, product: Product) -> Path:
        return self.images_dir / product.image

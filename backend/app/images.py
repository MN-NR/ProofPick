"""Upload validation. Re-encoding drops EXIF and other metadata from user photos."""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 10 * 1024 * 1024
MAX_SIDE = 2048
MIN_LONG, MIN_SHORT = 512, 384


class InvalidImage(ValueError):
    pass


def sanitize_photo(data: bytes) -> tuple[bytes, int, int]:
    if len(data) > MAX_BYTES:
        raise InvalidImage("Photo must be smaller than 10 MB.")
    try:
        probe = Image.open(io.BytesIO(data))
        if probe.format not in ("JPEG", "PNG"):
            raise InvalidImage("Photo must be a JPEG or PNG.")
        probe.verify()
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as exc:
        raise InvalidImage("That file could not be read as an image.") from exc
    if max(image.size) < MIN_LONG or min(image.size) < MIN_SHORT:
        raise InvalidImage(f"Photo must be at least {MIN_LONG}×{MIN_SHORT} pixels.")
    image = image.convert("RGB")
    image.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    image.save(out, "JPEG", quality=92)
    return out.getvalue(), image.width, image.height

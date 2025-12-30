"""Render cropped PDF regions to compressed WebP assets."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List

import fitz  # type: ignore
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

DEFAULT_SCALE = 2.3
MAX_WIDTH = 1400

TARGETS: List[Dict[str, Any]] = [
    # Hero / overview visuals
    {"file": "pastries.pdf", "page": 5, "name": "pastries-cover", "rect": [73.5, 583.3, 287.8, 743.4], "scale": 2.6},
    {"file": "slitti-yoyo.pdf", "page": 3, "name": "slitti-cover", "rect": [420.4, 323.4, 554.7, 457.7], "scale": 2.4},
    {"file": "slitti-yoyo.pdf", "page": 10, "name": "yoyo-display", "rect": [72.0, 210.9, 238.9, 433.3], "scale": 2.8},
    {"file": "gelato.pdf", "page": 2, "name": "gelato-cover", "rect": [208.1, 167.6, 399.4, 299.7], "scale": 2.4},
    {"file": "gelato.pdf", "page": 6, "name": "gelato-display", "rect": [215.1, 28.3, 380.3, 308.1], "scale": 2.2},
    {"file": "christmas and churro.pdf", "page": 2, "name": "churro-cover", "rect": [184.9, 296.8, 410.5, 474.4], "scale": 2.6},
    {"file": "christmas and churro.pdf", "page": 6, "name": "panettone", "rect": [78.8, 171.8, 271.9, 429.4], "scale": 2.5},
    {"file": "christmas and churro.pdf", "page": 6, "name": "pandoro", "rect": [300.0, 171.5, 493.1, 429.2], "scale": 2.5},

    # Pastry Lab details
    {"file": "pastries.pdf", "page": 2, "name": "pastry-cake", "rect": [244.5, 575.6, 361.1, 643.4], "scale": 2.6},
    {"file": "pastries.pdf", "page": 2, "name": "pastry-brownie", "rect": [404.2, 575.6, 499.1, 635.6], "scale": 2.6},
    {"file": "pastries.pdf", "page": 2, "name": "pastry-loaf", "rect": [90.8, 587.9, 186.0, 639.8], "scale": 2.6},
    {"file": "pastries.pdf", "page": 3, "name": "pastry-croissant", "rect": [420.8, 203.4, 547.9, 278.3], "scale": 2.5},
    {"file": "pastries.pdf", "page": 4, "name": "pastry-scone", "rect": [180.8, 555.7, 342.0, 726.7], "scale": 2.4},
    {"file": "pastries.pdf", "page": 5, "name": "pastry-display", "rect": [299.2, 530.3, 513.8, 817.0], "scale": 2.3},

    # Gelato Lab details
    {"file": "gelato.pdf", "page": 2, "name": "gelato-cups", "rect": [330.0, 181.0, 498.8, 297.9], "scale": 2.4},
    {"file": "gelato.pdf", "page": 3, "name": "gelato-cones", "rect": [338.1, 486.5, 491.3, 703.7], "scale": 2.3},
    {"file": "gelato.pdf", "page": 5, "name": "gelato-box", "rect": [72.0, 105.1, 171.1, 252.8], "scale": 2.5},
    {"file": "gelato.pdf", "page": 5, "name": "gelato-coppa", "rect": [377.0, 70.4, 504.1, 252.8], "scale": 2.5},
    {"file": "gelato.pdf", "page": 6, "name": "gelato-treats", "rect": [215.1, 28.3, 380.3, 308.1], "scale": 2.2},
    {"file": "gelato.pdf", "page": 6, "name": "gelato-scampoli", "rect": [261.0, 488.9, 334.3, 562.1], "scale": 2.6},

    # Slitti & Yo-Yo details
    {"file": "slitti-yoyo.pdf", "page": 3, "name": "slitti-bars", "rect": [399.8, 59.5, 561.8, 220.8], "scale": 2.4},
    {"file": "slitti-yoyo.pdf", "page": 5, "name": "slitti-minicake", "rect": [403.5, 190.1, 553.1, 339.7], "scale": 2.4},
    {"file": "slitti-yoyo.pdf", "page": 6, "name": "slitti-praline", "rect": [420.8, 470.2, 558.2, 607.5], "scale": 2.3},
    {"file": "slitti-yoyo.pdf", "page": 6, "name": "slitti-creme", "rect": [419.2, 151.1, 588.0, 319.9], "scale": 2.3},
    {"file": "slitti-yoyo.pdf", "page": 7, "name": "slitti-dragee", "rect": [414.0, 431.0, 567.9, 584.9], "scale": 2.4},
    {"file": "slitti-yoyo.pdf", "page": 10, "name": "yoyo-tool", "rect": [72.0, 456.4, 238.1, 678.5], "scale": 2.8},

    # Festive line details
    {"file": "christmas and churro.pdf", "page": 2, "name": "festive-churros", "rect": [184.9, 296.8, 410.5, 474.4], "scale": 2.6},
    {"file": "christmas and churro.pdf", "page": 6, "name": "festive-mini-pan", "rect": [78.0, 482.0, 273.4, 742.6], "scale": 2.4},
    {"file": "christmas and churro.pdf", "page": 6, "name": "festive-mini-plate", "rect": [291.0, 481.6, 487.1, 742.8], "scale": 2.4},
    {"file": "christmas and churro.pdf", "page": 7, "name": "festive-pack", "rect": [224.5, 141.7, 370.9, 337.2], "scale": 2.4},
    {"file": "christmas and churro.pdf", "page": 7, "name": "festive-delivery", "rect": [209.9, 392.1, 418.9, 670.7], "scale": 2.4},
    {"file": "christmas and churro.pdf", "page": 8, "name": "festive-mulled-setup", "rect": [108.0, 108.6, 286.1, 241.7], "scale": 2.5},
    {"file": "christmas and churro.pdf", "page": 8, "name": "festive-mulled-service", "rect": [308.2, 493.4, 497.5, 635.9], "scale": 2.4},
    {"file": "christmas and churro.pdf", "page": 8, "name": "festive-mulled-cup", "rect": [94.9, 493.4, 285.0, 635.7], "scale": 2.4},

    # Caffè rituals
    {"file": "Training caffe.pdf", "page": 0, "name": "caffe-cover", "rect": [121.6, 137.5, 473.7, 273.2], "scale": 2.5},
    {"file": "Training caffe.pdf", "page": 1, "name": "caffe-espresso", "rect": [40.8, 560.1, 230.1, 832.1], "scale": 2.5},
    {"file": "Training caffe.pdf", "page": 1, "name": "caffe-macchiato", "rect": [321.8, 626.2, 448.5, 807.9], "scale": 2.5},
    {"file": "Training caffe.pdf", "page": 2, "name": "caffe-flatwhite", "rect": [369.7, 477.4, 599.4, 807.0], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 2, "name": "caffe-latte", "rect": [262.1, 571.7, 428.9, 811.3], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 4, "name": "caffe-cappuccino", "rect": [172.5, 531.2, 299.5, 712.2], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 6, "name": "caffe-americano", "rect": [213.0, 320.8, 377.5, 555.6], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 7, "name": "caffe-mocha", "rect": [162.6, 260.0, 310.4, 471.7], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 8, "name": "caffe-hot-chocolate", "rect": [295.1, 253.4, 427.2, 442.9], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 9, "name": "caffe-affogato", "rect": [285.8, 198.5, 466.2, 455.2], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 10, "name": "caffe-whipped", "rect": [200.3, 165.9, 374.8, 416.5], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 11, "name": "caffe-chai", "rect": [233.1, 159.8, 361.8, 344.1], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 12, "name": "caffe-iced-americano", "rect": [257.0, 86.1, 411.1, 306.4], "scale": 2.5},
    {"file": "Training caffe.pdf", "page": 13, "name": "caffe-iced-latte", "rect": [258.5, 42.0, 385.1, 225.3], "scale": 2.5},
    {"file": "Training caffe.pdf", "page": 14, "name": "caffe-pistachio-iced", "rect": [280.9, 583.3, 450.7, 827.4], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 17, "name": "caffe-pistachio-hot", "rect": [267.0, 444.3, 365.0, 567.1], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 15, "name": "caffe-tea", "rect": [235.8, 375.1, 359.1, 497.8], "scale": 2.4},
    {"file": "Training caffe.pdf", "page": 16, "name": "caffe-cioccolata", "rect": [486.0, 46.6, 576.6, 176.1], "scale": 2.6},

    # Sweet Treat Atelier
    {"file": "Training Sweet Treats.pdf", "page": 0, "name": "sweet-cover", "rect": [121.6, 137.5, 473.7, 273.2], "scale": 2.5},
    {"file": "Training Sweet Treats.pdf", "page": 3, "name": "sweet-crepe-base", "rect": [72.0, 137.7, 271.6, 328.1], "scale": 2.5},
    {"file": "Training Sweet Treats.pdf", "page": 3, "name": "sweet-crepe-buontalenti", "rect": [274.9, 114.6, 486.8, 328.1], "scale": 2.4},
    {"file": "Training Sweet Treats.pdf", "page": 4, "name": "sweet-crepe-italiana", "rect": [98.2, 108.9, 280.2, 282.7], "scale": 2.5},
    {"file": "Training Sweet Treats.pdf", "page": 5, "name": "sweet-crepe-prosciutto", "rect": [293.5, 28.3, 512.8, 221.7], "scale": 2.4},
    {"file": "Training Sweet Treats.pdf", "page": 6, "name": "sweet-crepe-beet", "rect": [304.5, -61.8, 547.5, 261.4], "scale": 2.4},
    {"file": "Training Sweet Treats.pdf", "page": 7, "name": "sweet-waffle", "rect": [165.4, 28.3, 429.8, 226.3], "scale": 2.5},
    {"file": "Training Sweet Treats.pdf", "page": 8, "name": "sweet-gelato-burger", "rect": [72.0, 48.6, 296.9, 232.0], "scale": 2.5},
    {"file": "Training Sweet Treats.pdf", "page": 8, "name": "sweet-gelato-croissant", "rect": [296.9, 28.3, 475.9, 232.0], "scale": 2.4},
    {"file": "Training Sweet Treats.pdf", "page": 9, "name": "sweet-mini-stack", "rect": [248.5, 264.5, 382.9, 398.9], "scale": 2.4},
    {"file": "Training Sweet Treats.pdf", "page": 10, "name": "sweet-pancake", "rect": [205.6, 445.8, 389.8, 720.8], "scale": 2.3},
    {"file": "Training Sweet Treats.pdf", "page": 11, "name": "sweet-porridge", "rect": [238.4, 290.9, 356.5, 408.8], "scale": 2.4},
    {"file": "Training Sweet Treats.pdf", "page": 14, "name": "sweet-afternoon-tea-a", "rect": [72.0, 368.5, 202.1, 541.7], "scale": 2.4},
    {"file": "Training Sweet Treats.pdf", "page": 14, "name": "sweet-afternoon-tea-b", "rect": [202.1, 369.9, 330.8, 541.7], "scale": 2.4},
]


def render_entry(entry: Dict[str, Any]) -> Image.Image | None:
    pdf_path = ROOT / entry["file"]
    if not pdf_path.exists():
        print(f"Missing {pdf_path.name}, skipping {entry['name']}")
        return None
    doc = fitz.open(pdf_path)
    page = doc.load_page(entry["page"])
    scale = entry.get("scale", DEFAULT_SCALE)
    matrix = fitz.Matrix(scale, scale)
    clip_rect = fitz.Rect(entry["rect"]) if entry.get("rect") else None
    pix = page.get_pixmap(matrix=matrix, clip=clip_rect)
    doc.close()
    image = Image.open(BytesIO(pix.tobytes("png"))).convert("RGB")
    return image


def save_webp(image: Image.Image, out_path: Path, max_width: int = MAX_WIDTH) -> None:
    if image.width > max_width:
        ratio = max_width / image.width
        new_size = (max_width, int(image.height * ratio))
        image = image.resize(new_size, Image.LANCZOS)
    image.save(out_path, format="WEBP", quality=80)


def main() -> None:
    for entry in TARGETS:
        image = render_entry(entry)
        if image is None:
            continue
        out_path = ASSETS / f"{entry['name']}.webp"
        save_webp(image, out_path, entry.get("max_width", MAX_WIDTH))
        print(
            f"Rendered {entry['file']} page {entry['page']} -> {out_path.name}"
        )


if __name__ == "__main__":
    main()

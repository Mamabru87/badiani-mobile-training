"""Generate placeholder images for missing asset files.

This project is a static site that references images directly from the assets/ folder.
When we rename card images to unique filenames, the site will show broken images until
those files exist.

This script reads `notes/assets-to-generate.md`, extracts `assets/...` paths, and
creates placeholder JPG/WEBP images for any that are missing.

Usage (PowerShell):
  python scripts/generate_placeholder_assets.py
  python scripts/generate_placeholder_assets.py --force

Placeholders are meant to be temporary and should be replaced with real exports.
"""

from __future__ import annotations

import argparse
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Size:
    w: int
    h: int


CARD_SIZE = Size(1600, 1067)  # ~3:2 landscape, good default for cards
STORY_SIZE = Size(1920, 1080)  # 16:9 hero/panels


def _project_root() -> Path:
    # scripts/ -> project root
    return Path(__file__).resolve().parents[1]


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


_ASSET_RE = re.compile(r"`(assets/(?:story/)?[^`\s]+\.(?:jpg|jpeg|webp|png))`", re.IGNORECASE)


def _extract_asset_paths_from_md(md_text: str) -> list[str]:
    # Keep order, dedupe.
    found: list[str] = []
    seen = set()
    for match in _ASSET_RE.finditer(md_text):
        p = match.group(1)
        norm = p.replace("\\", "/")
        if norm not in seen:
            found.append(norm)
            seen.add(norm)
    return found


def _pick_size_for_asset(asset_rel: str) -> Size:
    if asset_rel.lower().startswith("assets/story/"):
        return STORY_SIZE
    return CARD_SIZE


def _ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _draw_placeholder(img, filename: str) -> None:
    # Pillow drawing is optional (we fall back to plain background if ImageDraw missing)
    try:
        from PIL import ImageDraw, ImageFont

        draw = ImageDraw.Draw(img)

        # Subtle diagonal stripes
        w, h = img.size
        stripe_color = (255, 255, 255, 22)
        for x in range(-h, w, 48):
            draw.line([(x, 0), (x + h, h)], fill=stripe_color, width=18)

        # Text block
        font = ImageFont.load_default()
        lines = [
            "PLACEHOLDER",
            filename,
            "(sostituisci con export Midjourney)",
        ]

        # Compute line sizes (best-effort; load_default is monospaced-ish)
        line_sizes = [draw.textbbox((0, 0), line, font=font) for line in lines]
        line_widths = [b[2] - b[0] for b in line_sizes]
        line_heights = [b[3] - b[1] for b in line_sizes]

        block_w = max(line_widths)
        block_h = sum(line_heights) + 12 * (len(lines) - 1)

        x0 = (w - block_w) // 2
        y0 = (h - block_h) // 2

        # Semi-transparent panel behind text
        pad_x, pad_y = 24, 18
        panel = [x0 - pad_x, y0 - pad_y, x0 + block_w + pad_x, y0 + block_h + pad_y]
        draw.rounded_rectangle(panel, radius=14, fill=(15, 25, 45, 170), outline=(255, 255, 255, 60), width=2)

        y = y0
        for i, line in enumerate(lines):
            draw.text((x0, y), line, font=font, fill=(255, 255, 255, 235))
            y += line_heights[i] + 12
    except Exception:
        # If Pillow drawing APIs aren't available, silently skip text.
        pass


def _make_base_image(size: Size):
    from PIL import Image

    # Dark navy gradient-ish base (simple two-tone for speed)
    img = Image.new("RGBA", (size.w, size.h), (10, 18, 35, 255))
    # Add a simple overlay rectangle to hint depth
    try:
        from PIL import ImageDraw

        draw = ImageDraw.Draw(img)
        draw.rectangle([0, 0, size.w, int(size.h * 0.55)], fill=(18, 35, 66, 255))
        draw.rectangle([0, int(size.h * 0.55), size.w, size.h], fill=(10, 18, 35, 255))
    except Exception:
        pass

    return img


def _save_image(img, out_path: Path) -> None:
    suffix = out_path.suffix.lower()
    if suffix in (".jpg", ".jpeg"):
        img = img.convert("RGB")
        img.save(out_path, quality=86, optimize=True, progressive=True)
        return
    if suffix == ".webp":
        img.save(out_path, quality=82, method=6)
        return
    # Fallback
    img.save(out_path)


def generate_placeholders(asset_rel_paths: Iterable[str], force: bool) -> tuple[int, int]:
    root = _project_root()
    created = 0
    skipped = 0

    for asset_rel in asset_rel_paths:
        out_path = root / Path(asset_rel)
        if out_path.exists() and not force:
            skipped += 1
            continue

        _ensure_parent_dir(out_path)
        size = _pick_size_for_asset(asset_rel)

        img = _make_base_image(size)
        _draw_placeholder(img, filename=os.path.basename(asset_rel))
        _save_image(img, out_path)
        created += 1

    return created, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate placeholder images for missing assets.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    parser.add_argument(
        "--source",
        default="notes/assets-to-generate.md",
        help="Markdown file containing backticked asset paths (default: notes/assets-to-generate.md)",
    )
    args = parser.parse_args()

    root = _project_root()
    source_path = root / args.source
    if not source_path.exists():
        raise SystemExit(f"Source file not found: {source_path}")

    md = _read_text(source_path)
    assets = _extract_asset_paths_from_md(md)

    if not assets:
        print("No asset paths found in source markdown. Nothing to do.")
        return 0

    created, skipped = generate_placeholders(assets, force=args.force)

    print(f"Placeholders created: {created}")
    print(f"Skipped (already existed): {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

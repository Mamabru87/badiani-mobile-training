"""Convert .jpg/.jpeg images to .webp for this static site.

Why:
- Many pages use <picture> with a WEBP <source> first, then JPG fallback.
- If you replace only the JPG with a new Midjourney export but keep the old WEBP,
  the browser will still show the old image.

This script scans a folder (default: assets/) and for every .jpg/.jpeg it:
- creates/updates the matching .webp (same basename)
- only overwrites when the JPG is newer, unless --force

Usage (PowerShell):
  python scripts/convert_jpg_to_webp.py
  python scripts/convert_jpg_to_webp.py --dir assets --quality 82
  python scripts/convert_jpg_to_webp.py --dir assets/story --force
"""

from __future__ import annotations

import argparse
from pathlib import Path


def _project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _should_convert(src: Path, dst: Path, force: bool) -> bool:
    if force:
        return True
    if not dst.exists():
        return True
    try:
        return src.stat().st_mtime > dst.stat().st_mtime
    except OSError:
        return True


def convert_folder(folder: Path, *, force: bool, quality: int, method: int) -> tuple[int, int]:
    from PIL import Image

    converted = 0
    skipped = 0

    for src in folder.rglob("*"):
        if not src.is_file():
            continue
        if src.suffix.lower() not in {".jpg", ".jpeg"}:
            continue

        dst = src.with_suffix(".webp")
        if not _should_convert(src, dst, force):
            skipped += 1
            continue

        try:
            with Image.open(src) as im:
                # Convert to RGB to avoid WEBP alpha surprises for JPEG sources
                if im.mode not in ("RGB", "RGBA"):
                    im = im.convert("RGB")
                elif im.mode == "RGBA":
                    # Keep alpha if present (rare for jpg, but just in case)
                    pass

                dst.parent.mkdir(parents=True, exist_ok=True)
                im.save(dst, format="WEBP", quality=quality, method=method)
                converted += 1
        except Exception as exc:
            print(f"[WARN] Failed: {src} -> {dst} ({exc})")

    return converted, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert JPG/JPEG to WEBP.")
    parser.add_argument("--dir", default="assets", help="Folder to scan (relative to project root).")
    parser.add_argument("--force", action="store_true", help="Overwrite WEBP even if newer.")
    parser.add_argument("--quality", type=int, default=82, help="WEBP quality (0-100).")
    parser.add_argument("--method", type=int, default=6, help="WEBP method (0-6).")
    args = parser.parse_args()

    root = _project_root()
    folder = (root / args.dir).resolve()
    if not folder.exists():
        raise SystemExit(f"Folder not found: {folder}")

    converted, skipped = convert_folder(folder, force=args.force, quality=args.quality, method=args.method)
    print(f"WEBP converted/updated: {converted}")
    print(f"Skipped (up-to-date): {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

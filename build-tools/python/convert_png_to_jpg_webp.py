"""Convert PNG exports to JPG + WEBP for this static site.

Useful when an image generator saves PNGs but the HTML expects:
- <img src="...jpg"> fallback
- <source type="image/webp" srcset="...webp"> preferred

This script scans a folder (default: assets/) recursively.
For every *.png it will create:
- same basename .jpg
- same basename .webp

It overwrites outputs only when the PNG is newer, unless --force.

Usage:
  .\.venv\Scripts\python.exe scripts\convert_png_to_jpg_webp.py
  .\.venv\Scripts\python.exe scripts\convert_png_to_jpg_webp.py --dir assets --force
"""

from __future__ import annotations

import argparse
from pathlib import Path


def _project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _is_newer(src: Path, dst: Path) -> bool:
    if not dst.exists():
        return True
    try:
        return src.stat().st_mtime > dst.stat().st_mtime
    except OSError:
        return True


def convert_folder(folder: Path, *, force: bool, jpg_quality: int, webp_quality: int, webp_method: int) -> tuple[int, int, int]:
    from PIL import Image

    made_jpg = 0
    made_webp = 0
    skipped = 0

    for src in folder.rglob("*.png"):
        if not src.is_file():
            continue

        dst_jpg = src.with_suffix(".jpg")
        dst_webp = src.with_suffix(".webp")

        do_jpg = force or _is_newer(src, dst_jpg)
        do_webp = force or _is_newer(src, dst_webp)

        if not do_jpg and not do_webp:
            skipped += 1
            continue

        try:
            with Image.open(src) as im:
                # Flatten alpha onto white for JPG; keep alpha for WEBP if present
                if do_jpg:
                    if im.mode in ("RGBA", "LA"):
                        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
                        bg.alpha_composite(im.convert("RGBA"))
                        out = bg.convert("RGB")
                    else:
                        out = im.convert("RGB")

                    dst_jpg.parent.mkdir(parents=True, exist_ok=True)
                    out.save(dst_jpg, format="JPEG", quality=jpg_quality, optimize=True, progressive=True)
                    made_jpg += 1

                if do_webp:
                    out_webp = im
                    if out_webp.mode not in ("RGB", "RGBA"):
                        out_webp = out_webp.convert("RGBA" if "A" in out_webp.getbands() else "RGB")

                    dst_webp.parent.mkdir(parents=True, exist_ok=True)
                    out_webp.save(dst_webp, format="WEBP", quality=webp_quality, method=webp_method)
                    made_webp += 1

        except Exception as exc:
            print(f"[WARN] Failed converting {src}: {exc}")

    return made_jpg, made_webp, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert PNG images to JPG + WEBP.")
    parser.add_argument("--dir", default="assets", help="Folder to scan (relative to project root).")
    parser.add_argument("--force", action="store_true", help="Overwrite outputs even if newer.")
    parser.add_argument("--jpg-quality", type=int, default=88, help="JPEG quality (0-100).")
    parser.add_argument("--webp-quality", type=int, default=82, help="WEBP quality (0-100).")
    parser.add_argument("--webp-method", type=int, default=6, help="WEBP method (0-6).")
    args = parser.parse_args()

    folder = (_project_root() / args.dir).resolve()
    if not folder.exists():
        raise SystemExit(f"Folder not found: {folder}")

    made_jpg, made_webp, skipped = convert_folder(
        folder,
        force=args.force,
        jpg_quality=args.jpg_quality,
        webp_quality=args.webp_quality,
        webp_method=args.webp_method,
    )

    print(f"JPG created/updated: {made_jpg}")
    print(f"WEBP created/updated: {made_webp}")
    print(f"Skipped (up-to-date): {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

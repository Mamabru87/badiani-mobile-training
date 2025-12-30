"""Import generated images into the project with the exact filenames expected by HTML.

Problem this solves
- The site references images directly (assets/... and assets/story/...).
- If you generate images with Prompt2Image (or any generator), you must:
  1) save them with the correct filenames
  2) ensure both JPG + WEBP exist (because <picture> prefers WEBP)

This script automates that:
- Reads the target list from notes/assets-to-generate.md
- Takes images from an "inbox" folder (your downloads/exports)
- For each target "item" it consumes one inbox image and writes:
  - assets/<name>.jpg AND assets/<name>.webp  (most cards)
  - assets/story/<name>.webp                 (story items)

It is intentionally dumb-but-safe:
- It assigns images in alphabetical order of inbox files (or natural filesystem order).
- You can resume by providing --start.

Usage (PowerShell)
    # Recommended: export Prompt2Image results into: assets/_inbox/
    .\.venv\Scripts\python.exe scripts\import_generated_images.py

    # Or point to another folder (Downloads etc.)
    .\.venv\Scripts\python.exe scripts\import_generated_images.py --inbox "C:\Users\Mamabru\Downloads\prompt2image"

    # dry-run preview
    .\.venv\Scripts\python.exe scripts\import_generated_images.py --dry-run

    # resume from Nth target (0-based)
    .\.venv\Scripts\python.exe scripts\import_generated_images.py --start 10

Notes
- If your generator outputs PNG, that's fine; we convert to JPG/WEBP.
- For JPG targets, we flatten transparency to white.
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple


_ASSET_RE = re.compile(r"`(assets/(?:story/)?[^`\s]+\.(?:jpg|jpeg|webp|png))`", re.IGNORECASE)


@dataclass(frozen=True)
class TargetItem:
    # e.g. assets/festive-churro-plate
    base_rel: str
    # set of extensions to write: {".jpg", ".webp"}
    exts: Tuple[str, ...]


def _project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _extract_asset_paths_from_md(md_text: str) -> List[str]:
    found: List[str] = []
    seen = set()
    for match in _ASSET_RE.finditer(md_text):
        p = match.group(1).replace("\\", "/")
        if p not in seen:
            found.append(p)
            seen.add(p)
    return found


def _group_targets(asset_rel_paths: Iterable[str]) -> List[TargetItem]:
    # Group by base path without extension.
    groups: Dict[str, Set[str]] = {}
    for rel in asset_rel_paths:
        rel_path = Path(rel)
        base = str(rel_path.with_suffix("")).replace("\\", "/")
        ext = rel_path.suffix.lower()
        groups.setdefault(base, set()).add(ext)

    # Convert to list, stable order by base name
    items: List[TargetItem] = []
    for base in sorted(groups.keys()):
        exts = tuple(sorted(groups[base]))
        items.append(TargetItem(base_rel=base, exts=exts))
    return items


def _list_inbox_images(inbox: Path) -> List[Path]:
    allowed = {".png", ".jpg", ".jpeg", ".webp"}
    files = [p for p in inbox.rglob("*") if p.is_file() and p.suffix.lower() in allowed]
    # Sort by name for predictability
    files.sort(key=lambda p: p.name.lower())
    return files


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _write_outputs(src: Path, dst_base: Path, exts: Tuple[str, ...], *, jpg_quality: int, webp_quality: int, webp_method: int, dry_run: bool) -> None:
    from PIL import Image

    if dry_run:
        return

    with Image.open(src) as im:
        # Normalize orientation is out-of-scope; keep as-is.

        for ext in exts:
            out_path = dst_base.with_suffix(ext)
            _ensure_parent(out_path)

            if ext in (".jpg", ".jpeg"):
                # Flatten alpha onto white.
                if im.mode in ("RGBA", "LA"):
                    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
                    bg.alpha_composite(im.convert("RGBA"))
                    out = bg.convert("RGB")
                else:
                    out = im.convert("RGB")

                out.save(out_path, format="JPEG", quality=jpg_quality, optimize=True, progressive=True)

            elif ext == ".webp":
                out_webp = im
                if out_webp.mode not in ("RGB", "RGBA"):
                    # If it has alpha channels, Pillow will keep them in RGBA.
                    out_webp = out_webp.convert("RGBA" if "A" in out_webp.getbands() else "RGB")

                out_webp.save(out_path, format="WEBP", quality=webp_quality, method=webp_method)

            else:
                # Shouldn't happen with our parser.
                out_webp = im
                out_webp.save(out_path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import generated images and write the expected JPG/WEBP assets.")
    parser.add_argument(
        "--inbox",
        default="assets/_inbox",
        help="Folder containing generated images (png/jpg/webp). Default: assets/_inbox",
    )
    parser.add_argument("--source", default="notes/assets-to-generate.md", help="Markdown file listing expected assets.")
    parser.add_argument("--start", type=int, default=0, help="Start index for target list (0-based).")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen, but don't write files.")
    parser.add_argument("--jpg-quality", type=int, default=88)
    parser.add_argument("--webp-quality", type=int, default=82)
    parser.add_argument("--webp-method", type=int, default=6)
    args = parser.parse_args()

    root = _project_root()
    inbox = Path(args.inbox).expanduser().resolve()
    if not inbox.exists():
        raise SystemExit(f"Inbox folder not found: {inbox}")

    source_path = (root / args.source).resolve()
    if not source_path.exists():
        raise SystemExit(f"Source file not found: {source_path}")

    asset_rel_paths = _extract_asset_paths_from_md(_read_text(source_path))
    targets = _group_targets(asset_rel_paths)

    if not targets:
        print("No targets found in source markdown.")
        return 0

    inbox_files = _list_inbox_images(inbox)
    if not inbox_files:
        print("No images found in inbox folder.")
        return 0

    # Apply start offset
    if args.start < 0 or args.start >= len(targets):
        raise SystemExit(f"--start must be between 0 and {len(targets) - 1}")

    targets_slice = targets[args.start :]

    needed = len(targets_slice)
    available = len(inbox_files)

    if available < needed:
        print(f"[WARN] Not enough inbox files: need {needed}, have {available}.")
        print("       We'll import as many as possible.")

    count = min(needed, available)

    for i in range(count):
        target = targets_slice[i]
        src = inbox_files[i]

        dst_base = root / Path(target.base_rel)

        # Log mapping
        rel_outs = ", ".join([f"{target.base_rel}{ext}" for ext in target.exts])
        print(f"[{args.start + i:03d}] {src.name}  ->  {rel_outs}")

        _write_outputs(
            src,
            dst_base,
            target.exts,
            jpg_quality=args.jpg_quality,
            webp_quality=args.webp_quality,
            webp_method=args.webp_method,
            dry_run=args.dry_run,
        )

    print("Done.")
    if args.dry_run:
        print("(dry-run: no files written)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

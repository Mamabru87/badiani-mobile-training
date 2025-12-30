import argparse
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets"

SCAN_EXTS = {".html", ".css", ".js"}

# Regexes for common asset references.
# We capture both absolute-ish "assets/..." and css "../assets/...".
RE_PATTERNS = [
    re.compile(r"(?P<q>['\"])(?P<path>(?:\.\./)?assets/[^'\"\)\s>]+)(?P=q)", re.IGNORECASE),
    re.compile(r"url\((?P<q>['\"]?)(?P<path>(?:\.\./)?assets/[^'\"\)]+)(?P=q)\)", re.IGNORECASE),
]


def to_rel_asset(p: str) -> str:
    p = p.strip()
    p = p.replace("\\", "/")
    # decode %20 etc.
    p = unquote(p)
    # normalize css ../assets
    if p.startswith("../assets/"):
        p = p[3:]
    # drop leading ./
    if p.startswith("./"):
        p = p[2:]
    return p


def gather_references() -> set[str]:
    refs: set[str] = set()
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in SCAN_EXTS:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for rx in RE_PATTERNS:
            for m in rx.finditer(text):
                rel = to_rel_asset(m.group("path"))
                if rel.startswith("assets/"):
                    refs.add(rel)
    return refs


def list_assets() -> list[str]:
    out: list[str] = []
    if not ASSETS_DIR.exists():
        return out
    for f in ASSETS_DIR.rglob("*"):
        if f.is_file():
            out.append("assets/" + str(f.relative_to(ASSETS_DIR)).replace("\\", "/"))
    return sorted(out)


def _bytes(n: int) -> str:
    # small, readable formatting
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def _default_prune_dir() -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return ASSETS_DIR / f"_pruned_{stamp}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Scan .html/.css/.js for asset references, report unused files under assets/, "
            "and optionally move/delete unused files."
        )
    )
    parser.add_argument(
        "--delete-unused",
        action="store_true",
        help="Delete unused asset files (irreversible).",
    )
    parser.add_argument(
        "--move-unused-to",
        type=str,
        default=None,
        help=(
            "Move unused asset files into the given directory. If relative, it's resolved from the workspace root. "
            "Subfolders are preserved."
        ),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Proceed even if there are missing references (referenced assets not found on disk).",
    )
    args = parser.parse_args(argv)

    if args.delete_unused and args.move_unused_to:
        print("ERROR: Choose only one of --delete-unused or --move-unused-to", file=sys.stderr)
        return 2

    assets = list_assets()
    refs = gather_references()

    # Also count references that point to directories or missing files.
    missing = sorted([r for r in refs if (ROOT / r).is_file() is False])

    used = sorted([a for a in assets if a in refs])
    unused = sorted([a for a in assets if a not in refs])

    print(f"Workspace: {ROOT}")
    print(f"Assets files: {len(assets)}")
    print(f"Referenced paths (raw matches): {len(refs)}")
    print(f"Used assets: {len(used)}")
    print(f"Unused assets: {len(unused)}")
    print("")

    if missing:
        print("REFERENCES THAT DO NOT EXIST ON DISK:")
        for m in missing:
            print("  -", m)
        print("")

    if unused:
        print("UNUSED ASSET FILES:")
        for u in unused:
            print("  -", u)
        print("")

    # Heuristic: report likely duplicates by identical size.
    sizes: dict[int, list[str]] = {}
    for a in assets:
        try:
            size = (ROOT / a).stat().st_size
        except Exception:
            continue
        sizes.setdefault(size, []).append(a)

    dup_groups = [v for v in sizes.values() if len(v) > 1]
    dup_groups.sort(key=len, reverse=True)

    if dup_groups:
        print("POTENTIAL DUPLICATES (same file size):")
        for grp in dup_groups[:25]:
            print(f"  size={ (ROOT / grp[0]).stat().st_size } bytes")
            for item in grp:
                print("    -", item)
        if len(dup_groups) > 25:
            print(f"  (and {len(dup_groups)-25} more groups)")

    # Optional pruning actions
    wants_prune = args.delete_unused or args.move_unused_to
    if wants_prune:
        if missing and not args.force:
            print(
                "\nRefusing to prune because there are missing references. "
                "Fix the missing assets first or rerun with --force.",
                file=sys.stderr,
            )
            return 3

        if not unused:
            print("\nNo unused assets to prune.")
            return 0

        total_bytes = 0
        if args.delete_unused:
            print("\nDeleting unused assets...")
            for rel in unused:
                p = ROOT / rel
                try:
                    total_bytes += p.stat().st_size
                except Exception:
                    pass
                try:
                    p.unlink()
                except Exception as e:
                    print(f"  FAILED: {rel} ({e})", file=sys.stderr)
            print(f"Deleted {len(unused)} files, approx freed {_bytes(total_bytes)}")
        else:
            dest_raw = args.move_unused_to
            dest = Path(dest_raw)
            if not dest.is_absolute():
                dest = ROOT / dest
            if str(dest).startswith(str(ASSETS_DIR)):
                # OK if it's inside assets (default style) but ensure it's not a file.
                pass
            dest.mkdir(parents=True, exist_ok=True)
            print(f"\nMoving unused assets to: {dest}")
            for rel in unused:
                src = ROOT / rel
                rel_under_assets = Path(rel).relative_to("assets")
                dst = dest / rel_under_assets
                dst.parent.mkdir(parents=True, exist_ok=True)
                try:
                    total_bytes += src.stat().st_size
                except Exception:
                    pass
                try:
                    shutil.move(str(src), str(dst))
                except Exception as e:
                    print(f"  FAILED: {rel} ({e})", file=sys.stderr)
            print(f"Moved {len(unused)} files, approx {_bytes(total_bytes)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

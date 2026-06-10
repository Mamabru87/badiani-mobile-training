#!/usr/bin/env python3
"""Bump asset cache-busting version across Badiani Training Orbit.

- Replaces every `?v=YYYYMMDD_NN` occurrence in the root HTML files
  with a fresh version (today's date; NN incremented if same date).
- Updates the service worker cache name `badiani-v2-YYYYMMDD-NN` in sw.js.

Usage:
    python build_tools/bump_version.py [--dry-run] [--root PATH]
"""

import argparse
import datetime
import re
import sys
from pathlib import Path

HTML_VERSION_RE = re.compile(r"\?v=(\d{8}_\d{2})")
SW_VERSION_RE = re.compile(r"badiani-v2-(\d{8})-(\d{2})")


def write_text(path: Path, text: str):
    """Write preserving the file's own line endings (no newline translation)."""
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)


def find_current_version(root: Path, html_files):
    """Return the highest YYYYMMDD_NN version found in the HTML files."""
    versions = set()
    for f in html_files:
        versions.update(HTML_VERSION_RE.findall(f.read_text(encoding="utf-8")))
    sw = root / "sw.js"
    if sw.exists():
        for m in SW_VERSION_RE.finditer(sw.read_text(encoding="utf-8")):
            versions.add(f"{m.group(1)}_{m.group(2)}")
    if not versions:
        return None
    return max(versions)


def compute_new_version(current: str, today: str) -> str:
    if current and current.startswith(today):
        nn = int(current.split("_")[1]) + 1
    else:
        nn = 1
    if nn > 99:
        raise SystemExit("Error: NN counter exceeded 99 for today; aborting.")
    return f"{today}_{nn:02d}"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Bump ?v= cache-busting version.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would change without writing files.")
    parser.add_argument("--root", type=Path, default=None,
                        help="Project root (default: parent of this script's folder).")
    args = parser.parse_args(argv)

    root = (args.root or Path(__file__).resolve().parent.parent).resolve()
    html_files = sorted(root.glob("*.html"))
    if not html_files:
        print(f"No HTML files found in {root}", file=sys.stderr)
        return 1

    today = datetime.date.today().strftime("%Y%m%d")
    current = find_current_version(root, html_files)
    new_version = compute_new_version(current, today)

    print(f"Root: {root}")
    print(f"Version: {current or '(none)'} -> {new_version}")
    if args.dry_run:
        print("(dry-run: no files will be modified)")

    total = 0
    for f in html_files:
        text = f.read_text(encoding="utf-8")
        new_text, n = HTML_VERSION_RE.subn(f"?v={new_version}", text)
        total += n
        print(f"  {f.name}: {n} replacement(s)")
        if n and not args.dry_run:
            write_text(f, new_text)

    sw = root / "sw.js"
    if sw.exists():
        text = sw.read_text(encoding="utf-8")
        sw_version = f"badiani-v2-{new_version.replace('_', '-')}"
        new_text, n = SW_VERSION_RE.subn(sw_version, text)
        total += n
        print(f"  sw.js: {n} replacement(s) (cache name -> {sw_version})")
        if n and not args.dry_run:
            write_text(sw, new_text)
    else:
        print("  sw.js: not found, skipped")

    print(f"Total replacements: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Rename asset files with spaces / '&' / uppercase to clean lowercase-hyphen names,
then rewrite references across HTML/JS/CSS/MD/JSON.

Strategy:
- Walk assets/ recursively. For each file whose name contains space, '&', or uppercase,
  compute a clean name: lowercase, replace '&' with 'and', collapse non [a-z0-9.] to '-',
  collapse multiple '-', strip leading/trailing '-' from the stem.
- If destination already exists -> skip and log conflict.
- Build mapping {old_basename: new_basename} keyed by the *file name only* (not path),
  but we still record full old path -> full new path for the actual rename.
- For source code rewrite: search for the old basename (raw) AND its URL-encoded form
  (spaces -> %20, '&' -> %26) and replace with the new basename. Match basename only
  (not full path) so any directory prefix is preserved.

Run:  python build-tools/rename_assets_clean.py            (dry-run, prints plan)
      python build-tools/rename_assets_clean.py --apply    (renames + rewrites)
"""
from __future__ import annotations
import os
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'

SOURCE_EXTS = {'.html', '.htm', '.js', '.mjs', '.css', '.json', '.md', '.txt', '.svg'}
SKIP_DIRS = {'.git', 'node_modules', '_moj_backup_20260509', 'da-revisionare', 'berny video', 'build-tools'}


def clean_stem(stem: str) -> str:
    s = stem.lower()
    s = s.replace('&', ' and ')
    s = re.sub(r"[^a-z0-9]+", '-', s)
    s = re.sub(r'-+', '-', s).strip('-')
    return s


def needs_rename(name: str) -> bool:
    return (' ' in name) or ('&' in name) or any(c.isupper() for c in name)


def build_plan() -> tuple[list[tuple[Path, Path]], dict[str, str], list[str]]:
    """Return (rename_pairs, basename_map, conflicts)."""
    pairs: list[tuple[Path, Path]] = []
    basename_map: dict[str, str] = {}
    conflicts: list[str] = []
    seen_targets: dict[Path, Path] = {}

    for p in ASSETS.rglob('*'):
        if not p.is_file():
            continue
        old_name = p.name
        if not needs_rename(old_name):
            continue
        stem, ext = os.path.splitext(old_name)
        new_stem = clean_stem(stem)
        new_name = new_stem + ext.lower()
        if new_name == old_name:
            continue
        new_path = p.with_name(new_name)

        # conflict: target exists already and is a different file
        if new_path.exists() and new_path.resolve() != p.resolve():
            conflicts.append(f"CONFLICT: {p.relative_to(ROOT)} -> {new_path.relative_to(ROOT)} (target exists)")
            continue
        # conflict: two different sources collapse to same target
        if new_path in seen_targets and seen_targets[new_path] != p:
            conflicts.append(f"COLLISION: {p.relative_to(ROOT)} and {seen_targets[new_path].relative_to(ROOT)} both map to {new_path.relative_to(ROOT)}")
            continue
        seen_targets[new_path] = p

        pairs.append((p, new_path))
        # basename mapping: same old basename should always map to same new basename
        if old_name in basename_map and basename_map[old_name] != new_name:
            conflicts.append(f"BASENAME-AMBIGUITY: {old_name} maps to both {basename_map[old_name]} and {new_name}")
        basename_map[old_name] = new_name
    return pairs, basename_map, conflicts


def iter_source_files():
    for p in ROOT.rglob('*'):
        if not p.is_file():
            continue
        if p.suffix.lower() not in SOURCE_EXTS:
            continue
        rel_parts = p.relative_to(ROOT).parts
        if any(part in SKIP_DIRS for part in rel_parts):
            continue
        yield p


def rewrite_sources(basename_map: dict[str, str], apply: bool) -> tuple[int, int]:
    """Replace old basenames (raw + URL-encoded) with new basenames in source files."""
    # Pre-build list of (old, new) variants. Sort longest-first to avoid partial overlap.
    variants: list[tuple[str, str]] = []
    for old, new in basename_map.items():
        if old == new:
            continue
        variants.append((old, new))
        # URL-encoded variant (spaces -> %20, & -> %26 etc.). quote() with safe=''
        old_enc = urllib.parse.quote(old, safe='')
        new_enc = urllib.parse.quote(new, safe='')
        if old_enc != old:
            variants.append((old_enc, new_enc))
        # space-as-plus rare but include
        old_plus = old.replace(' ', '+')
        if old_plus != old and old_plus != old_enc:
            variants.append((old_plus, new))
    variants.sort(key=lambda x: -len(x[0]))

    files_changed = 0
    total_replacements = 0
    for f in iter_source_files():
        try:
            text = f.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        new_text = text
        local_repl = 0
        for old, new in variants:
            if old in new_text:
                count = new_text.count(old)
                if count:
                    new_text = new_text.replace(old, new)
                    local_repl += count
        if local_repl and new_text != text:
            files_changed += 1
            total_replacements += local_repl
            if apply:
                f.write_text(new_text, encoding='utf-8')
            print(f"  {'WROTE' if apply else 'PLAN'} {f.relative_to(ROOT)}  ({local_repl} repl)")
    return files_changed, total_replacements


def main():
    apply = '--apply' in sys.argv
    pairs, bmap, conflicts = build_plan()

    print(f"Found {len(pairs)} files to rename, {len(bmap)} unique basenames.")
    if conflicts:
        print(f"\n{len(conflicts)} CONFLICTS (will be skipped):")
        for c in conflicts:
            print(' ', c)

    print("\n--- Rename plan (first 20) ---")
    for old, new in pairs[:20]:
        print(f"  {old.relative_to(ROOT)}  ->  {new.name}")
    if len(pairs) > 20:
        print(f"  ... and {len(pairs) - 20} more")

    print("\n--- Rewriting source references ---")
    files_changed, repls = rewrite_sources(bmap, apply)
    print(f"\nSource files {'modified' if apply else 'to modify'}: {files_changed}  total replacements: {repls}")

    if apply:
        print("\n--- Performing renames ---")
        ok = 0
        for old, new in pairs:
            try:
                old.rename(new)
                ok += 1
            except Exception as e:
                print(f"  FAILED {old.relative_to(ROOT)}: {e}")
        print(f"Renamed {ok}/{len(pairs)} files")
    else:
        print("\n(dry-run -- pass --apply to perform changes)")


if __name__ == '__main__':
    raise SystemExit(main())

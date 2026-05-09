#!/usr/bin/env python3
"""Bulk-rename assets/ files (lowercase, hyphens, no spaces/&).

Pass --apply to actually rename files via `git mv` and update references in source files.
Without --apply, runs as a dry run reporting impact.
"""
from __future__ import annotations
import json, re, sys, subprocess
from pathlib import Path
from urllib.parse import quote
from collections import Counter

ROOT = Path('.')
SKIP_EXT = {'.md', '.psb', '.psd'}
SOURCE_EXT = {'.html', '.htm', '.js', '.mjs', '.css', '.json', '.txt', '.md', '.py'}
SOURCE_DIRS_SKIP = {'.git', 'node_modules', '_moj_backup_20260509'}

def slug(name: str) -> str:
    stem = Path(name).stem
    ext = Path(name).suffix
    s = stem.lower().replace('&', ' and ')
    s = re.sub(r"[^a-z0-9]+", '-', s).strip('-')
    return s + ext.lower()

def build_rename_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for p in (ROOT / 'assets').rglob('*'):
        if not p.is_file():
            continue
        if p.suffix.lower() in SKIP_EXT:
            continue
        new_name = slug(p.name)
        if new_name == p.name:
            continue
        mapping[p.as_posix()] = p.with_name(new_name).as_posix()
    return mapping

def iter_source_files():
    for p in ROOT.rglob('*'):
        if not p.is_file():
            continue
        if any(part in SOURCE_DIRS_SKIP for part in p.parts):
            continue
        if p.suffix.lower() in SOURCE_EXT:
            yield p

def reference_variants(old: str, new: str):
    """Yield (old_str, new_str) variants to replace in source: raw and URL-encoded forms,
    both with and without leading './' or '/'."""
    variants = []
    for o, n in [(old, new), (quote(old), quote(new))]:
        variants.append((o, n))
    # Also unencoded vs encoded mixed: replace just file basename in case path differs
    return variants

def count_refs(mapping: dict[str, str]) -> dict[str, int]:
    counts: Counter = Counter()
    files_touched: set[str] = set()
    for src in iter_source_files():
        try:
            text = src.read_text(encoding='utf-8', errors='replace')
        except Exception:
            continue
        for old, new in mapping.items():
            for o, _ in reference_variants(old, new):
                if o in text:
                    counts[old] += text.count(o)
                    files_touched.add(src.as_posix())
    return counts, files_touched

def do_replace(mapping: dict[str, str]) -> int:
    total = 0
    for src in iter_source_files():
        try:
            text = src.read_text(encoding='utf-8')
        except Exception:
            continue
        new_text = text
        for old, new in mapping.items():
            for o, n in reference_variants(old, new):
                if o in new_text:
                    new_text = new_text.replace(o, n)
        if new_text != text:
            src.write_text(new_text, encoding='utf-8')
            diff = sum(1 for _ in re.finditer('|'.join(re.escape(o) for o in mapping.keys()), text))
            total += 1
            print(f'  updated refs in {src.as_posix()}')
    return total

def git_mv(old: str, new: str) -> bool:
    # case-only renames need 2-step on Windows
    if old.lower() == new.lower() and old != new:
        tmp = old + '.__tmp__'
        try:
            subprocess.run(['git', 'mv', old, tmp], check=True, capture_output=True)
            subprocess.run(['git', 'mv', tmp, new], check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f'  ! git mv failed for {old}: {e.stderr.decode(errors="replace")}')
            return False
    try:
        subprocess.run(['git', 'mv', old, new], check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f'  ! git mv failed for {old}: {e.stderr.decode(errors="replace")}')
        return False

def main(argv):
    apply = '--apply' in argv
    mapping = build_rename_map()
    print(f'Files to rename: {len(mapping)}')
    counts, files = count_refs(mapping)
    print(f'References found: {sum(counts.values())} across {len(files)} source files')
    print(f'Files with no references found ({sum(1 for k in mapping if k not in counts)}):')
    for k in mapping:
        if k not in counts:
            print(f'  (no refs) {k}')
    print('Top 10 referenced:')
    for k, v in counts.most_common(10):
        print(f'  {v:4d}  {k}')

    if not apply:
        print('\n(dry-run -- pass --apply to perform rename + update refs)')
        return 0

    print('\nApplying rename via git mv ...')
    renamed = 0
    for old, new in mapping.items():
        # ensure dest dir exists
        Path(new).parent.mkdir(parents=True, exist_ok=True)
        if git_mv(old, new):
            renamed += 1
    print(f'Renamed: {renamed}/{len(mapping)}')

    print('\nUpdating references in source files ...')
    do_replace(mapping)
    print('Done.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))

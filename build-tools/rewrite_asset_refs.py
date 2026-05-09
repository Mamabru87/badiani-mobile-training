"""Rewrite asset references in HTML/JS/CSS/MD/JSON: convert spaces and %20 inside
filename to hyphens (matching the cleaned filesystem). Verify the result file exists.
"""
from __future__ import annotations
import re, sys, urllib.parse
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'
SRC_EXTS = {'.html','.htm','.js','.mjs','.css','.json','.md','.svg','.txt'}
SKIP_EXACT = {'.git','node_modules','build-tools','da-revisionare','berny video'}
SKIP_PREFIX = ('_moj_backup_', '_mojibake_backup_')

# Capture asset-relative path that has a space or %20 in the filename
PAT = re.compile(r'(assets/[A-Za-z0-9_\-./%]*?)(?P<dirty>[A-Za-z0-9_\-]+(?:[ ]|%20|%26)[A-Za-z0-9_%\- ]*?)(\.(?:png|jpg|jpeg|webp|svg|gif|mp3|mp4|wav|json))', re.I)

def clean_token(tok: str) -> str:
    # Decode any percent-encoding then collapse non-alnum to hyphen
    decoded = urllib.parse.unquote(tok)
    s = decoded.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = re.sub(r'-+', '-', s).strip('-')
    return s

def rewrite_text(text: str):
    changes = []
    def repl(m):
        prefix, dirty, ext = m.group(1), m.group('dirty'), m.group(3)
        cleaned = clean_token(dirty) + ext.lower()
        new_full = prefix + cleaned
        old_full = prefix + dirty + ext
        changes.append((old_full, new_full))
        return new_full
    new_text = PAT.sub(repl, text)
    return new_text, changes

def iter_sources():
    for p in ROOT.rglob('*'):
        if not p.is_file(): continue
        if p.suffix.lower() not in SRC_EXTS: continue
        if any(x in p.parts for x in SKIP_EXACT): continue
        if any(part.startswith(SKIP_PREFIX) for part in p.parts): continue
        yield p

def main():
    apply = '--apply' in sys.argv
    total_changes = 0
    files_touched = 0
    missing = Counter()
    for p in iter_sources():
        try:
            text = p.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        new_text, changes = rewrite_text(text)
        if not changes:
            continue
        files_touched += 1
        total_changes += len(changes)
        # Verify each new ref points to existing file
        for old, new in changes:
            target = ROOT / new
            if not target.exists():
                missing[new] += 1
        print(f"  {'WROTE' if apply else 'PLAN'} {p.relative_to(ROOT)}  ({len(changes)} changes)")
        if apply:
            p.write_text(new_text, encoding='utf-8')
    print(f"\nTotal: {total_changes} changes across {files_touched} files")
    if missing:
        print(f"\n!! {len(missing)} unique asset paths DO NOT EXIST after cleanup:")
        for path, n in missing.most_common(40):
            print(f"  ({n}x) MISSING: {path}")
    if not apply:
        print("\n(dry-run -- pass --apply to write)")

if __name__ == '__main__':
    raise SystemExit(main())

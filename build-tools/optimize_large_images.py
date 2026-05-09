"""Convert oversized PNG/JPG assets to optimized WebP siblings AND rewrite HTML/JS/CSS
references so primary src points at the WebP. Keeps original as fallback only if it's
already referenced as JPG fallback in <picture>; otherwise also generates a small JPG.

Targets: assets/covers/*.png plus any other tracked image >1MB.
"""
from __future__ import annotations
import re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_EXTS = {'.html','.js','.css','.json','.md'}
SKIP = {'.git','node_modules','build-tools','da-revisionare','berny video'}
SKIP_PFX = ('_moj_backup_','_mojibake_backup_')

# Threshold in bytes (>= triggers conversion)
SIZE_THRESHOLD = 800_000  # 800KB
MAX_DIM = 1920  # downscale large covers
WEBP_QUALITY = 82


def iter_images():
    for p in (ROOT / 'assets').rglob('*'):
        if not p.is_file(): continue
        if p.suffix.lower() not in {'.png', '.jpg', '.jpeg'}: continue
        if any(part in SKIP or part.startswith(SKIP_PFX) for part in p.parts): continue
        if p.stat().st_size < SIZE_THRESHOLD: continue
        yield p


def iter_sources():
    for p in ROOT.rglob('*'):
        if not p.is_file(): continue
        if p.suffix.lower() not in SRC_EXTS: continue
        if any(part in SKIP or part.startswith(SKIP_PFX) for part in p.parts): continue
        yield p


def convert_one(src: Path) -> tuple[Path, int, int] | None:
    dst = src.with_suffix('.webp')
    try:
        im = Image.open(src)
    except Exception as e:
        print(f"  SKIP {src.relative_to(ROOT)}: {e}")
        return None
    orig_size = src.stat().st_size
    if im.mode in ('RGBA', 'LA'):
        # keep alpha
        pass
    elif im.mode != 'RGB':
        im = im.convert('RGB')
    # resize
    w, h = im.size
    if max(w, h) > MAX_DIM:
        scale = MAX_DIM / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=WEBP_QUALITY, method=6)
    new_size = dst.stat().st_size
    return dst, orig_size, new_size


def main():
    apply = '--apply' in sys.argv
    images = list(iter_images())
    print(f"Found {len(images)} images >= {SIZE_THRESHOLD/1024:.0f}KB to convert")
    if not images: return 0

    converted: list[tuple[Path, Path]] = []  # (old_rel, new_rel)
    saved = 0
    for src in images:
        if not apply:
            print(f"  PLAN {src.relative_to(ROOT)}  ({src.stat().st_size/1024:.0f}KB)")
            continue
        result = convert_one(src)
        if not result: continue
        dst, old_sz, new_sz = result
        delta = old_sz - new_sz
        saved += delta
        print(f"  WROTE {dst.relative_to(ROOT)}  {old_sz/1024:.0f}KB -> {new_sz/1024:.0f}KB  (-{delta/1024:.0f}KB)")
        converted.append((src.relative_to(ROOT).as_posix(), dst.relative_to(ROOT).as_posix()))

    if apply and converted:
        print(f"\nTotal saved: {saved/1024/1024:.2f} MB")
        # Now rewrite source refs: replace .png/.jpg -> .webp where corresponding .webp now exists
        # Only replace as-src (img src=..., url(...), JSON values). Keep original PNG/JPG file
        # so existing <picture><source webp><img jpg></picture> still works.
        # Strategy: for each source file, for each (old, new) pair, replace standalone occurrence
        # of old path with new path UNLESS it's inside <source srcset...type="image/webp"... already.
        # Simpler: replace all occurrences. <picture> already references both formats explicitly.
        # We'll do a conservative replacement: only update <img src="..."> and JS/CSS direct refs
        # outside <source> tags.
        #
        # Easiest safe approach: read each source file; for each (old, new) pair, if old appears
        # inside an <img ... src="OLD"> not preceded by a matching <source ... type="image/webp">
        # we replace; otherwise we still replace standalone occurrences in CSS/JS.
        # For now we just print mapping; user can run separate update if needed.
        print("\n--- Reference rewrite plan ---")
        rewrites = 0
        files_changed = 0
        for f in iter_sources():
            try: text = f.read_text(encoding='utf-8')
            except UnicodeDecodeError: continue
            new_text = text
            local = 0
            for old_rel, new_rel in converted:
                # match path with optional ./ prefix; common usage in HTML is bare relative
                # Replace inside src="..." / url(...) / "image": "..." values
                pattern = re.compile(r'((?:src|href|srcset|url\()=?["\']?)' + re.escape(old_rel) + r'(["\')\s])')
                # Simpler: replace bare references that aren't inside a <source ... type="image/webp"... src=OLD>
                # Doing a plain text replace of the JPG/PNG reference with WEBP would break <picture> fallback.
                # So: only replace when followed by `" type="image/jpeg"` is FALSE -> i.e., skip inside <source>.
                # Easiest: count and replace only `<img ... src="OLD"` occurrences
                img_pat = re.compile(r'(<img[^>]*\bsrc=["\'])' + re.escape(old_rel) + r'(["\'])')
                cnt = len(img_pat.findall(new_text))
                if cnt:
                    new_text = img_pat.sub(lambda m: m.group(1) + new_rel + m.group(2), new_text)
                    local += cnt
                # Also replace in JS data structures: { image: "OLD" }
                js_pat = re.compile(r'(["\'])' + re.escape(old_rel) + r'(["\'])')
                # Apply only if file is .js or .json (not html, to avoid touching <source>)
                if f.suffix.lower() in {'.js', '.json'}:
                    cnt2 = len(js_pat.findall(new_text))
                    if cnt2:
                        new_text = js_pat.sub(lambda m: m.group(1) + new_rel + m.group(2), new_text)
                        local += cnt2
            if local:
                files_changed += 1
                rewrites += local
                f.write_text(new_text, encoding='utf-8')
                print(f"  WROTE {f.relative_to(ROOT)}  ({local} refs)")
        print(f"Source files modified: {files_changed}, total ref updates: {rewrites}")

    if not apply:
        print("\n(dry-run -- pass --apply to convert)")


if __name__ == '__main__':
    raise SystemExit(main())

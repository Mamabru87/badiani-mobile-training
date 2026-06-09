"""Safely apply Bar -> Coffee rename and cache-bust to all HTML files.
Uses explicit UTF-8 (no BOM) to avoid mojibake corruption.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
files = sorted(ROOT.glob("*.html"))

CACHE_OLD_PATTERNS = [
    "v=20260429_1",
    "v=20260509_1",
    "v=20260509_2",
    "v=20260509_3",
    "v=20260509_4",
]
CACHE_NEW = "v=20260509_5"

BAR_LABELS = {
    "Bar & Drinks ´┐¢ 2025": "Coffee & Drinks ´┐¢ 2025",
    ">Bar & Drinks<": ">Coffee & Drinks<",
    ">Bar & Drinks ": ">Coffee & Drinks ",
    "<title>Bar & Drinks ": "<title>Coffee & Drinks ",
    "Guida formativa Bar & Drinks": "Guida formativa Coffee & Drinks",
    '"Bar & Drinks"': '"Coffee & Drinks"',
    'data-i18n="caffe.hero.title">Bar & Drinks': 'data-i18n="caffe.hero.title">Coffee & Drinks',
    'data-i18n="caffe.footer.title">Bar & Drinks': 'data-i18n="caffe.footer.title">Coffee & Drinks',
    'data-i18n="menu.link.caffe">Bar & Drinks': 'data-i18n="menu.link.caffe">Coffee & Drinks',
}

# Deprecated one-off image replacements from the old PNG fallback phase.
# Current app assets are WebP-only (except tiny PWA icons), so keep this no-op to avoid reintroducing stale PNG references.
CAFFE_PHOTO_FIXES = []


def process(path: pathlib.Path) -> bool:
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    text = raw.decode("utf-8")
    original = text

    # Cache-bust
    for old in CACHE_OLD_PATTERNS:
        text = text.replace(old, CACHE_NEW)

    # Bar -> Coffee
    for k, v in BAR_LABELS.items():
        text = text.replace(k, v)

    # Caffe-only image fixes
    if path.name == "caffe.html":
        for k, v in CAFFE_PHOTO_FIXES:
            text = text.replace(k, v)

    if text != original:
        path.write_bytes(text.encode("utf-8"))
        return True
    return False


for p in files:
    changed = process(p)
    print(f"{'CHG' if changed else 'OK '} {p.name}")

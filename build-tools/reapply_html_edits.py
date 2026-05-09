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

# Smoothie / juice photo path updates for caffe.html only
CAFFE_PHOTO_FIXES = [
    # Add webp source above png for smoothies
    (
        '<picture>\n                <source srcset="assets/products/smoothie%20giallo%20passion.png" type="image/png" />',
        '<picture>\n                <source srcset="assets/products/smoothie%20giallo%20passion.webp" type="image/webp" />\n                <source srcset="assets/products/smoothie%20giallo%20passion.png" type="image/png" />',
    ),
    (
        '<picture>\n                <source srcset="assets/products/smoothie%20rosso%20berry.png" type="image/png" />',
        '<picture>\n                <source srcset="assets/products/smoothie%20rosso%20berry.webp" type="image/webp" />\n                <source srcset="assets/products/smoothie%20rosso%20berry.png" type="image/png" />',
    ),
    (
        '<picture>\n                <source srcset="assets/products/smoothie%20verde%20boost.png" type="image/png" />',
        '<picture>\n                <source srcset="assets/products/smoothie%20verde%20boost.webp" type="image/webp" />\n                <source srcset="assets/products/smoothie%20verde%20boost.png" type="image/png" />',
    ),
    # Energy Booster: replace placeholder smoothie-rosso-berry with real energy-booster
    (
        '<source srcset="assets/products/smoothie-rosso-berry.png" type="image/png" />\n                <img decoding="async" src="assets/products/smoothie-rosso-berry.png" alt="Energy Booster juice"',
        '<source srcset="assets/products/energy-booster.webp" type="image/webp" />\n                <source srcset="assets/products/energy-booster.png" type="image/png" />\n                <img decoding="async" src="assets/products/energy-booster.png" alt="Energy Booster juice"',
    ),
    # Sweet Beet: replace placeholder
    (
        '<source srcset="assets/products/smoothie-rosso-berry.png" type="image/png" />\n                <img decoding="async" src="assets/products/smoothie-rosso-berry.png" alt="Sweet Beet juice"',
        '<source srcset="assets/products/sweet-beet.webp" type="image/webp" />\n                <source srcset="assets/products/sweet-beet.png" type="image/png" />\n                <img decoding="async" src="assets/products/sweet-beet.png" alt="Sweet Beet juice"',
    ),
    # Get Clean: replace placeholder smoothie-verde-boost
    (
        '<source srcset="assets/products/smoothie-verde-boost.png" type="image/png" />\n                <img decoding="async" src="assets/products/smoothie-verde-boost.png" alt="Get Clean juice"',
        '<source srcset="assets/products/get-clean.webp" type="image/webp" />\n                <source srcset="assets/products/get-clean.png" type="image/png" />\n                <img decoding="async" src="assets/products/get-clean.png" alt="Get Clean juice"',
    ),
]


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

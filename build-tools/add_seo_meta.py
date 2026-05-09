"""Add Open Graph + Twitter Card meta tags to each page after the existing
<meta name="description" content="..."> line. Idempotent: skips pages that already
contain og:title.

Page-specific metadata derived from <title> and existing description.
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = [
    ('index.html',         'index',         'assets/covers/sweet-treat-atelier.webp'),
    ('caffe.html',         'caffe',         'assets/covers/bar-and-drinks.webp'),
    ('festive.html',       'festive',       'assets/covers/festive.webp'),
    ('gelato-lab.html',    'gelato-lab',    'assets/covers/gelato-lab.webp'),
    ('operations.html',    'operations',    'assets/covers/operation-e-setup.webp'),
    ('pastries.html',      'pastries',      'assets/covers/pastry-lab.webp'),
    ('story-orbit.html',   'story-orbit',   'assets/covers/story-orbit.webp'),
    ('sweet-treats.html',  'sweet-treats',  'assets/covers/sweet-treat-atelier.webp'),
]
SITE_URL = 'https://training.badiani.it'  # placeholder; harmless if not deployed there

def build_block(title: str, description: str, image: str, url: str) -> str:
    safe_title = title.replace('"', '&quot;')
    safe_desc = description.replace('"', '&quot;')
    return (
        f'    <meta property="og:type" content="website" />\n'
        f'    <meta property="og:site_name" content="Badiani Training Orbit" />\n'
        f'    <meta property="og:title" content="{safe_title}" />\n'
        f'    <meta property="og:description" content="{safe_desc}" />\n'
        f'    <meta property="og:image" content="{url}/{image}" />\n'
        f'    <meta property="og:url" content="{url}/" />\n'
        f'    <meta property="og:locale" content="it_IT" />\n'
        f'    <meta name="twitter:card" content="summary_large_image" />\n'
        f'    <meta name="twitter:title" content="{safe_title}" />\n'
        f'    <meta name="twitter:description" content="{safe_desc}" />\n'
        f'    <meta name="twitter:image" content="{url}/{image}" />\n'
        f'    <meta name="robots" content="noindex, nofollow" />\n'
    )

def jsonld_block(title: str, description: str) -> str:
    return (
        '    <script type="application/ld+json">\n'
        '    {\n'
        '      "@context": "https://schema.org",\n'
        '      "@type": "Organization",\n'
        '      "name": "Badiani Gelato",\n'
        f'      "url": "{SITE_URL}",\n'
        f'      "logo": "{SITE_URL}/assets/brand/logo-b-blue.webp",\n'
        f'      "description": "{description}"\n'
        '    }\n'
        '    </script>\n'
    )

def main():
    for fname, slug, image in PAGES:
        p = ROOT / fname
        if not p.exists():
            print(f"  SKIP {fname}: missing")
            continue
        text = p.read_text(encoding='utf-8')
        if 'og:title' in text:
            print(f"  SKIP {fname}: already has og:title")
            continue
        m = re.search(r'<title>(.+?)</title>', text)
        title = (m.group(1) if m else 'Badiani Training').strip()
        m2 = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', text)
        description = (m2.group(1) if m2 else 'Badiani Training Orbit - formazione interattiva').strip()
        block = build_block(title, description, image, SITE_URL)
        ld = jsonld_block(title, description) if fname == 'index.html' else ''
        # Insert right after the description meta
        anchor = m2.group(0) if m2 else m.group(0)
        replacement = anchor + '\n' + block + ld.rstrip('\n')
        new_text = text.replace(anchor, replacement, 1)
        p.write_text(new_text, encoding='utf-8')
        print(f"  WROTE {fname}  ({title})")

if __name__ == '__main__':
    main()

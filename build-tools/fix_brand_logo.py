"""Repair the brand-avatar img tag broken by the earlier optimize_imgs.py.
Pattern: ` data-alt-  alt=...  ... src="assets/brand/logo-b-blue.png">`
Fix:    ` data-alt-src="assets/brand/logo-b-blue.png" alt=...`  (single src)
"""
import pathlib, re

FILES = [
    'caffe.html', 'festive.html', 'gelato-lab.html', 'index.html',
    'operations.html', 'pastries.html', 'story-orbit.html', 'sweet-treats.html',
]

ROOT = pathlib.Path('.')

# Match a brand-avatar img with the bug. Capture everything in between.
pat = re.compile(
    r'(<img[^>]*?class="brand-avatar"[^>]*?)\s+src="(assets/brand/logo-b-blue\.png)"\s*/?>',
    re.IGNORECASE,
)

def repair(html: str) -> str:
    def _fix(m):
        head = m.group(1)
        alt_src = m.group(2)
        # Remove any orphan "data-alt-" token (no =) so we can re-add proper attribute
        head = re.sub(r'\s+data-alt-(?=\s)', '', head)
        # Drop the extra src="logo-badiani.jpg" leftover -- keep only one src
        # Actually we want the visible (non-scrolled) logo to be the wordmark,
        # so keep data-default-src as the primary src. Remove existing src="..." in head.
        head = re.sub(r'\s+src="[^"]*"', '', head)
        # Pull data-default-src value to use as src
        ddef = re.search(r'data-default-src="([^"]+)"', head)
        default_src = ddef.group(1) if ddef else 'assets/brand/logo-badiani.jpg'
        return f'{head} src="{default_src}" data-alt-src="{alt_src}">'
    return pat.sub(_fix, html)

changed = 0
for name in FILES:
    p = ROOT / name
    if not p.exists(): continue
    raw = p.read_text(encoding='utf-8')
    fixed = repair(raw)
    if fixed != raw:
        p.write_text(fixed, encoding='utf-8')
        changed += 1
        print(f'FIXED {name}')
    else:
        print(f'SKIP {name}')
print(f'\nTotal fixed: {changed}')

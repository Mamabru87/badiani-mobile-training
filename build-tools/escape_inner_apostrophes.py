"""Escape apostrophes between letters via regex.

JS code never has legitimate `letter'letter` outside strings/comments
(an apostrophe always opens/closes a string). Inside double-quoted strings,
backticks, or comments, escaping is harmless. So a global regex pass is safe.
"""
from pathlib import Path
import re

PATTERN = re.compile(r"(?<=[A-Za-z\u00C0-\u00FF])'(?=[A-Za-z\u00C0-\u00FF])")

for fp in ['scripts/site.js', 'scripts/berny-super-knowledge.js']:
    p = Path(fp)
    if not p.exists():
        continue
    src = p.read_text(encoding='utf-8')
    matches = PATTERN.findall(src)
    new = PATTERN.sub(r"\\'", src)
    if new != src:
        p.write_text(new, encoding='utf-8')
    print(f"{fp}: escaped {len(matches)} apostrophes")

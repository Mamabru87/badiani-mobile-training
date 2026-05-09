from pathlib import Path
import re
n = 0
for p in Path('.').glob('*.html'):
    s = p.read_text(encoding='utf-8')
    new = re.sub(r'(<meta name="robots"[^>]*?/>)\s*\r?\n\s*/>\s*\r?\n', r'\1\n', s)
    if new != s:
        p.write_text(new, encoding='utf-8')
        n += 1
        print(f'fixed: {p.name}')
print(f'Total: {n}')

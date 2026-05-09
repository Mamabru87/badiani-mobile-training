from pathlib import Path
import re
remaining = [p for p in Path('assets').rglob('*') if p.is_file() and p.suffix.lower() not in {'.md','.psb','.psd'} and (' ' in p.name or '&' in p.name or any(c.isupper() for c in p.name))]
print('files still bad:', len(remaining))
for p in remaining[:20]:
    print(' ', p.as_posix())
pat1 = re.compile(r'assets/[^"\'<>]*[ &][^"\'<>]*\.(?:png|webp|jpg|jpeg|svg|json)', re.I)
pat2 = re.compile(r'assets/[^"\'<>]*%20[^"\'<>]*\.(?:png|webp|jpg|jpeg|svg|json)', re.I)
broken = []
for p in Path('.').glob('*.html'):
    txt = p.read_text(encoding='utf-8')
    for pat in (pat1, pat2):
        for m in pat.finditer(txt):
            broken.append((p.name, m.group()))
print('broken refs in HTML:', len(broken))
for f,r in broken[:10]:
    print(f'  {f}: {r}')

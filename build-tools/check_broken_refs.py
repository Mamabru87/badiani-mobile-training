import re
from pathlib import Path
SKIP = {'.git','node_modules','build-tools','da-revisionare','berny video','notes'}
SKIP_PFX = ('_moj_backup_','_mojibake_backup_')
broken = {}
for p in Path('.').rglob('*'):
    if not p.is_file() or p.suffix.lower() not in {'.html','.js','.css'}: continue
    if any(part in SKIP or part.startswith(SKIP_PFX) for part in p.parts): continue
    try: t = p.read_text(encoding='utf-8')
    except: continue
    for m in re.finditer(r'(assets/[A-Za-z0-9_\-./%]+\.(?:png|jpg|jpeg|webp|svg))', t):
        a = m.group(1)
        if not (Path('.') / a).exists():
            broken.setdefault(a, set()).add(p.name)
for a, files in sorted(broken.items()):
    print(f"  {a}  ({','.join(files)})")
print(f"TOTAL broken (excluding notes/): {len(broken)}")

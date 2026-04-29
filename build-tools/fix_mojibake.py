"""Fix UTF-8 mojibake by re-interpreting each character.
Walks char-by-char; if a 2/3/4-char sequence in [\u0080..\u00FF] decodes
as valid UTF-8 via latin1 round-trip, replaces it. Strips BOM.
"""
import pathlib, shutil, datetime

FILES = [
    'caffe.html', 'festive.html', 'gelato-lab.html', 'index.html',
    'operations.html', 'pastries.html', 'story-orbit.html', 'sweet-treats.html',
]

# Build a forgiving cp1252 -> byte map. cp1252 covers most "smart" chars
# (curly quotes, em-dash, U+0178, etc.). For the 5 undefined slots, fall back
# to latin1 identity (those bytes were probably never written anyway).
_CP1252_TO_BYTE = {}
for b in range(256):
    try:
        ch = bytes([b]).decode('cp1252')
        _CP1252_TO_BYTE[ch] = b
    except UnicodeDecodeError:
        pass
# latin1 identity for any char in 0..255 not already covered
for b in range(256):
    ch = chr(b)
    _CP1252_TO_BYTE.setdefault(ch, b)

def _to_byte(ch: str):
    return _CP1252_TO_BYTE.get(ch)

def fix_text(s: str) -> str:
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        b0 = _to_byte(c)
        if b0 is not None and 0xC0 <= b0 <= 0xF7:
            if b0 <= 0xDF: ln = 2
            elif b0 <= 0xEF: ln = 3
            else: ln = 4
            chunk = s[i:i+ln]
            if len(chunk) == ln:
                bs = [_to_byte(x) for x in chunk]
                if all(x is not None for x in bs):
                    try:
                        decoded = bytes(bs).decode('utf-8', errors='strict')
                        out.append(decoded)
                        i += ln
                        continue
                    except UnicodeDecodeError:
                        pass
        out.append(c)
        i += 1
    return ''.join(out)

ROOT = pathlib.Path('.')
backup_dir = ROOT / f'_mojibake_backup_{datetime.datetime.now():%Y%m%d_%H%M%S}'
backup_dir.mkdir(exist_ok=True)

for name in FILES:
    p = ROOT / name
    if not p.exists():
        print(f'SKIP {name}: not found'); continue
    raw_bytes = p.read_bytes()
    had_bom = raw_bytes.startswith(b'\xef\xbb\xbf')
    if had_bom:
        raw_bytes = raw_bytes[3:]
    text = raw_bytes.decode('utf-8', errors='strict')
    fixed = fix_text(text)
    if fixed == text and not had_bom:
        print(f'SKIP {name}: no change')
        continue
    shutil.copy2(p, backup_dir / name)
    p.write_bytes(fixed.encode('utf-8'))
    print(f'FIXED {name}: {len(text)} -> {len(fixed)} chars, BOM stripped={had_bom}')

print(f'\nBackups in: {backup_dir}')

from pathlib import Path
import re
import sys

contexts = {}
for p in sorted(Path(".").glob("*.html")):
    txt = p.read_text(encoding="utf-8", errors="replace")
    for m in re.finditer("\ufffd", txt):
        i = m.start()
        ctx = txt[max(0, i - 20):i] + "<?>" + txt[i + 1:i + 20]
        ctx = ctx.replace("\n", " ").replace("\r", "")
        contexts[ctx] = contexts.get(ctx, 0) + 1

out = []
for ctx, cnt in sorted(contexts.items(), key=lambda x: -x[1]):
    out.append(f"{cnt:4d}  {ctx}")
out.append(f"TOTAL UNIQUE: {len(contexts)}")
sys.stdout.buffer.write(("\n".join(out)).encode("utf-8"))

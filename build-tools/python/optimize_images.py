from PIL import Image
import os
files = [
    "assets/afternoon_routine_coffee.png",
    "assets/afternoon_routine_gelato.png",
    "assets/afternoon_routine_pastries.png",
    "assets/closing_routine_coffee.png",
    "assets/closing_routine_gelato.png",
    "assets/closing_routine_pastries.png",
    "assets/products/energy-booster.png",
    "assets/products/get-clean.png",
    "assets/products/sweet-beet.png",
    "assets/products/smoothie giallo passion.png",
    "assets/products/smoothie rosso berry.png",
    "assets/products/smoothie verde boost.png",
]
MAX_W = 1600
for f in files:
    img = Image.open(f).convert("RGBA")
    if img.width > MAX_W:
        ratio = MAX_W / img.width
        img = img.resize((MAX_W, int(img.height * ratio)), Image.LANCZOS)
    out = os.path.splitext(f)[0] + ".webp"
    img.save(out, "WEBP", quality=82, method=6)
    in_kb = os.path.getsize(f) / 1024
    out_kb = os.path.getsize(out) / 1024
    print(f"{f} -> {out_kb:.0f}KB (was {in_kb:.0f}KB, -{(1-out_kb/in_kb)*100:.0f}%)")

from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = root / "notes" / "pdf_text"
dst_root = root / "notes" / "kb"
files = {
    "gelato.txt": "gelato.txt",
    "Sweet Treats.txt": "sweet-treats.txt",
    "pastries.txt": "pastries.txt",
    "christmas and churro.txt": "churros-christmas.txt",
    "slitti-yoyo.txt": "slitti-yoyo.txt",
    "freshdrink-macha-cocktails.txt": "drinks.txt",
    "caffe.txt": "caffe.txt",
}
langs = ["en", "it", "es", "fr"]

def main():
    for lang in langs:
        (dst_root / lang).mkdir(parents=True, exist_ok=True)
    for src_name, dst_name in files.items():
        src_path = src / src_name
        if not src_path.exists():
            print(f"missing {src_path}")
            continue
        content = src_path.read_text(encoding="utf-8", errors="ignore")
        for lang in langs:
            dst_path = dst_root / lang / dst_name
            dst_path.write_text(content, encoding="utf-8")
    print(f"Copied {len(files)} files to langs {langs}")

if __name__ == "__main__":
    main()

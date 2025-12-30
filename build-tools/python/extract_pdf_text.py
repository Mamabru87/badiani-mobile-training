from pathlib import Path
from PyPDF2 import PdfReader

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "training_caffe": ROOT / "Training caffe.pdf",
    "training_sweet_treats": ROOT / "Training Sweet Treats.pdf",
    "pastries": ROOT / "pastries.pdf",
    "slitti_yoyo": ROOT / "slitti-yoyo.pdf",
    "gelato": ROOT / "gelato.pdf",
    "christmas_churro": ROOT / "christmas and churro.pdf",
}

def main() -> None:
    for key, path in FILES.items():
        reader = PdfReader(str(path))
        text_parts = []
        for page in reader.pages:
            text_parts.append(page.extract_text() or "")
        out_path = ROOT / f"{key}.txt"
        out_path.write_text("\n".join(text_parts), encoding="utf-8")
        print(f"Extracted {path.name} -> {out_path.name} ({len(reader.pages)} pages)")


if __name__ == "__main__":
    main()

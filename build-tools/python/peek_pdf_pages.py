"""Print first lines of each PDF page to map topics."""
from __future__ import annotations

from pathlib import Path

import fitz  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
PDFS = [
    "pastries.pdf",
    "slitti-yoyo.pdf",
    "gelato.pdf",
    "christmas and churro.pdf",
]


def main() -> None:
    for pdf_name in PDFS:
        path = ROOT / pdf_name
        if not path.exists():
            continue
        doc = fitz.open(path)
        print(f"\n{pdf_name}")
        for idx, page in enumerate(doc):
            text = page.get_text().strip().splitlines()
            preview = " | ".join(text[:3])
            print(f"  page {idx}: {preview}")
        doc.close()


if __name__ == "__main__":
    main()

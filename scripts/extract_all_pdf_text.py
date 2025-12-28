from __future__ import annotations

from pathlib import Path

from PyPDF2 import PdfReader


def extract_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    parts: list[str] = []
    total = len(reader.pages)
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        parts.append(f"\n\n===== PAGE {i} / {total} =====\n{text}")
    return "\n".join(parts).strip() + "\n"


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    outdir = root / "notes" / "pdf_text"
    outdir.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(root.glob("*.pdf"))
    print(f"PDF trovati: {len(pdfs)}")

    for pdf in pdfs:
        out_path = outdir / f"{pdf.stem}.txt"
        out_path.write_text(extract_pdf_text(pdf), encoding="utf-8")
        reader = PdfReader(str(pdf))
        print(f"Estratto {pdf.name} -> {out_path.name} ({len(reader.pages)} pagine)")


if __name__ == "__main__":
    main()

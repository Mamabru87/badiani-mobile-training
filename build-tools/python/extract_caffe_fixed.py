"""Extract text from caffe.pdf with proper UTF-8 encoding"""
from pathlib import Path

try:
    from PyPDF2 import PdfReader
except ImportError:
    try:
        from pypdf import PdfReader
    except ImportError:
        print("❌ No PDF library found. Install with: pip install pypdf")
        exit(1)

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "caffe.pdf"
OUTPUT_PATH = ROOT / "notes" / "pdf_text" / "caffe.txt"

def main():
    if not PDF_PATH.exists():
        print(f"❌ PDF not found: {PDF_PATH}")
        return
    
    print(f"📄 Reading {PDF_PATH.name}...")
    reader = PdfReader(str(PDF_PATH))
    
    pages_text = []
    for i, page in enumerate(reader.pages, 1):
        page_text = page.extract_text() or ""
        pages_text.append(f"===== PAGE {i} / {len(reader.pages)} =====\n{page_text}")
    
    full_text = "\n\n\n".join(pages_text)
    
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(full_text, encoding="utf-8")
    
    print(f"✅ Extracted {len(reader.pages)} pages")
    print(f"✅ Saved to {OUTPUT_PATH.relative_to(ROOT)}")
    print(f"📊 Total characters: {len(full_text)}")

if __name__ == "__main__":
    main()

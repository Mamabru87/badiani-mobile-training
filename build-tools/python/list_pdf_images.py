"""Print embedded image info for selected PDF files."""
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
            print(f"Missing {pdf_name}")
            continue
        doc = fitz.open(path)
        print(f"{pdf_name} ({doc.page_count} pages)")
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            images = page.get_images(full=True)
            if not images:
                continue
            print(f"  page {page_index}: {len(images)} images")
            rect_data = []
            for idx, img in enumerate(images):
                xref = img[0]
                width = img[2]
                height = img[3]
                bpc = img[4]
                colorspace = img[5]
                rects = page.get_image_rects(xref)
                for rect in rects:
                    area = rect.width * rect.height
                    rect_data.append((area, idx, xref, width, height, bpc, colorspace, rect))
            rect_data.sort(key=lambda entry: entry[0], reverse=True)
            for area, idx, xref, width, height, bpc, colorspace, rect in rect_data[:6]:
                print(
                    "    rect area={:.0f} imgIdx={} xref={} size={}x{} bpc={} space={} bbox=({:.1f},{:.1f},{:.1f},{:.1f})".format(
                        area,
                        idx,
                        xref,
                        width,
                        height,
                        bpc,
                        colorspace,
                        rect.x0,
                        rect.y0,
                        rect.x1,
                        rect.y1,
                    )
                )
        doc.close()


if __name__ == "__main__":
    main()

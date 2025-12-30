"""Create JPEG fallbacks for existing WebP assets."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


def convert() -> None:
    for webp in ASSETS.glob("*.webp"):
        jpg_path = webp.with_suffix(".jpg")
        if jpg_path.exists():
            print(f"Skipped {jpg_path.name} (already exists)")
            continue

        image = Image.open(webp).convert("RGB")
        image.save(jpg_path, format="JPEG", quality=85)
        print(f"Saved {jpg_path.name}")


if __name__ == "__main__":
    convert()

import os
import json
import re
from psd_tools import PSDImage
from PIL import Image

PSD_PATH = r"assets/progetto avatar berny.psb"
OUTPUT_DIR = r"assets/avatars/parts"
MANIFEST_PATH = r"scripts/avatar-manifest.js"

# Canvas scale factor (0.5 = 50% size)
SCALE = 0.5

def sanitize(name):
    return re.sub(r'[^a-zA-Z0-9]', '_', name.lower())

def extract_layers():
    if not os.path.exists(PSD_PATH):
        print(f"Error: {PSD_PATH} not found.")
        return

    print(f"Loading {PSD_PATH}...")
    psd = PSDImage.open(PSD_PATH)
    print(f"Original Canvas Size: {psd.size}")
    
    target_size = (int(psd.size[0] * SCALE), int(psd.size[1] * SCALE))
    print(f"Target Size: {target_size}")

    manifest = {}

    for layer in psd:
        if layer.is_group():
            category = sanitize(layer.name)
            
            # Map PSD categories to logical Z-Index order if possible, or just use list
            # We will use this in JS to determine stack order
            
            print(f"Processing category: {category}")
            manifest[category] = []
            
            cat_dir = os.path.join(OUTPUT_DIR, category)
            os.makedirs(cat_dir, exist_ok=True)
            
            for item in layer:
                if item.is_visible(): 
                    item_name = sanitize(item.name)
                    filename = f"{item_name}.png"
                    file_path = os.path.join(cat_dir, filename)
                    
                    print(f"  Exporting {item.name} -> {filename}")
                    
                    # Get layer content
                    layer_image = item.composite()
                    
                    if layer_image:
                        # Create full canvas representation
                        full_img = Image.new('RGBA', psd.size, (0, 0, 0, 0))
                        # Paste layer at its offset
                        full_img.paste(layer_image, item.offset)
                        
                        # Resize
                        full_img = full_img.resize(target_size, Image.Resampling.LANCZOS)
                        
                        full_img.save(file_path)
                        manifest[category].append(filename)
        else:
            print(f"Skipping top-level layer: {layer.name} (not a group)")

    # Write manifest
    # Also include z-index hint? or we handle in JS
    js_content = f"const AVATAR_MANIFEST = {json.dumps(manifest, indent=2)};\n"
    with open(MANIFEST_PATH, 'w') as f:
        f.write(js_content)
    
    print(f"Manifest written to {MANIFEST_PATH}")

if __name__ == "__main__":
    extract_layers()

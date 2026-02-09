#!/usr/bin/env python3
"""Make black background in logo.png transparent."""
from PIL import Image
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
logo_path = os.path.join(script_dir, "..", "public", "assets", "logo.png")

img = Image.open(logo_path).convert("RGBA")
pixels = img.load()
w, h = img.size

# Treat pixels that are very dark (black background) as transparent
threshold = 40  # R, G, B all below this -> transparent
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if r <= threshold and g <= threshold and b <= threshold:
            pixels[x, y] = (r, g, b, 0)

img.save(logo_path, "PNG")
print("Saved transparent logo to", logo_path)

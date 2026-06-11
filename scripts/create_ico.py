"""
Create a proper multi-resolution ICO file from the existing PNG app icon.
Windows requires 16x16, 32x32, 48x48, and 256x256 sizes for proper taskbar display.
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Run: pip install Pillow")
    sys.exit(1)

# Paths
project_root = Path(__file__).parent.parent
png_src = project_root / "dist" / "web_front" / "assets" / "icons" / "app-icon.png"
ico_dest = project_root / "dist" / "web_front" / "assets" / "icons" / "app-icon.ico"

if not png_src.exists():
    print(f"Source PNG not found: {png_src}")
    sys.exit(1)

print(f"Loading source: {png_src}")
img = Image.open(png_src).convert("RGBA")
print(f"Original size: {img.size}")

# Sizes required for proper Windows ICO (taskbar, file explorer, etc.)
sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

frames = []
for size in sizes:
    resized = img.resize(size, Image.LANCZOS)
    frames.append(resized)
    print(f"  Created {size[0]}x{size[1]} frame")

# Save as proper multi-resolution ICO
ico_dest.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(
    ico_dest,
    format="ICO",
    sizes=sizes,
    append_images=frames[1:]
)

file_size = ico_dest.stat().st_size
print(f"\nSaved ICO: {ico_dest}")
print(f"ICO size: {file_size:,} bytes ({file_size // 1024} KB)")
print("Done! The ICO now contains multiple resolutions for proper Windows taskbar display.")

from PIL import Image, ImageDraw, ImageFont
import os

# Create 1024x1024 image
width, height = 1024, 1024
image = Image.new('RGBA', (width, height), (10, 10, 30, 255))
draw = ImageDraw.Draw(image)

# Colors
CYAN = (0, 255, 255, 200)
MAGENTA = (255, 0, 255, 200)
DARK_CYAN = (0, 100, 100, 200)
DARK_MAGENTA = (100, 0, 100, 200)
LIGHT_GRAY = (200, 200, 200, 100)

# Background - Cyberpunk grid
draw.rectangle([0, 0, width, height], fill=(10, 10, 30, 255))

# Draw floor grid
for i in range(0, width, 128):
    draw.line([(i, 0), (i, height)], fill=DARK_CYAN, width=1)
for i in range(0, height, 128):
    draw.line([(0, i), (width, i)], fill=DARK_CYAN, width=1)

# Draw main grid lines (thicker)
for i in range(0, width, 512):
    draw.line([(i, 0), (i, height)], fill=CYAN, width=2)
for i in range(0, height, 512):
    draw.line([(0, i), (width, i)], fill=CYAN, width=2)

# Draw hologram cubes (placeholders for Timo's scene)
def draw_hologram(cx, cy, color, size=120):
    half = size // 2
    draw.rectangle([(cx - half, cy - half), (cx + half, cy + half)], outline=color, width=3)
    draw.line([(cx - half, cy - half), (cx + half, cy + half)], fill=color, width=2)
    draw.line([(cx + half, cy - half), (cx - half, cy + half)], fill=color, width=2)
    draw.ellipse([(cx - 20, cy - 20), (cx + 20, cy + 20)], outline=color, width=2)

# Draw 4 holograms
draw_hologram(width // 4, height // 4, CYAN)
draw_hologram(3 * width // 4, height // 4, MAGENTA)
draw_hologram(width // 4, 3 * height // 4, CYAN)
draw_hologram(3 * width // 4, 3 * height // 4, MAGENTA)

# Draw "Cyberpunk" text
try:
    font = ImageFont.truetype("arial.ttf", 48)
except:
    font = ImageFont.load_default()

text = "CYBERPUNK"
text_width = draw.textlength(text, font=font)
text_x = (width - text_width) // 2
text_y = height - 150

draw.text((text_x, text_y), text, fill=CYAN, font=font)

# Save
output_path = r"C:\Users\Guilherme\Documents\tmhub\public\scenes\cyberpunk.webp"
os.makedirs(os.path.dirname(output_path), exist_ok=True)
image.save(output_path, 'WEBP', quality=85)

print(f"✅ Cyberpunk scene placeholder created: {output_path}")

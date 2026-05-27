"""Generate a flower image using Python PIL/Pillow and save to C:\flower.png"""
from PIL import Image, ImageDraw
import math, os

# Canvas
W, H = 800, 800
img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
draw = ImageDraw.Draw(img)

cx, cy = W // 2, H // 2 - 40  # center

# Helper: draw a petal
def draw_petal(draw, cx, cy, angle, length, width, color):
    """Draw a petal as an ellipse rotated around center."""
    points = []
    for t in range(0, 181, 2):
        rad = math.radians(t)
        # ellipse radius varies
        r = length * math.sin(math.radians(t))
        x = r * math.cos(rad)
        y = r * math.sin(rad) * 0.6  # flatten slightly
        # rotate
        ang = math.radians(angle)
        rx = x * math.cos(ang) - y * math.sin(ang)
        ry = x * math.sin(ang) + y * math.cos(ang)
        points.append((cx + rx, cy + ry))
    if len(points) > 2:
        draw.polygon(points, fill=color, outline=(0,0,0,40))

# Petal colors - gradient from center out
petal_colors = [
    (255, 80, 80, 240),    # red
    (255, 120, 80, 240),   # orange-red
    (255, 180, 80, 240),   # orange
    (255, 100, 130, 230),  # pink
]

# Draw petals in concentric layers
for layer, color in enumerate(petal_colors):
    petal_len = 180 - layer * 15
    petal_w = 55 - layer * 5
    n_petals = 8 + layer * 2
    for i in range(n_petals):
        angle = (360 / n_petals) * i + layer * 8
        draw_petal(draw, cx, cy, angle, petal_len, petal_w, color)

# Inner small petals (lighter)
for i in range(12):
    angle = (360 / 12) * i
    draw_petal(draw, cx, cy, angle, 60, 25, (255, 200, 150, 220))

# Center of flower
for r in range(40, 10, -3):
    shade = 180 - r * 2
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(shade, shade, 100, 255))

# Highlights on center
draw.ellipse([cx-15, cy-15, cx+15, cy+15], fill=(255, 255, 200, 200))
draw.ellipse([cx-8, cy-8, cx+8, cy+8], fill=(255, 255, 240, 220))

# Stem
stem_x = cx + 20
for y in range(cy + 60, H - 50, 2):
    sway = math.sin((y - cy) * 0.03) * 15
    draw.ellipse([stem_x + sway - 5, y - 3, stem_x + sway + 5, y + 3], fill=(50, 160, 50, 220))

# Leaves
def draw_leaf(draw, x, y, angle, size, color):
    pts = []
    for t in range(0, 181, 3):
        rad = math.radians(t)
        r = size * math.sin(rad)
        px = r * math.cos(rad)
        py = r * math.sin(rad) * 0.4
        ang = math.radians(angle)
        rx = px * math.cos(ang) - py * math.sin(ang)
        ry = px * math.sin(ang) + py * math.cos(ang)
        pts.append((x + rx, y + ry))
    if len(pts) > 2:
        draw.polygon(pts, fill=color, outline=(30, 120, 30, 100))

for leaf_angle, leaf_size in [(-30, 90), (210, 80)]:
    ly = cy + 180
    lx = stem_x + math.sin((ly - cy) * 0.03) * 15
    draw_leaf(draw, lx, ly, leaf_angle, leaf_size, (60, 180, 60, 220))
    # vein
    end_x = lx + leaf_size * math.cos(math.radians(leaf_angle)) * 0.9
    end_y = ly + leaf_size * math.sin(math.radians(leaf_angle)) * 0.4
    draw.line([lx, ly, end_x, end_y], fill=(30, 130, 30, 150), width=2)

# Ground / grass
for i in range(0, W, 8):
    gh = 20 + int(math.sin(i * 0.1) * 10)
    draw.ellipse([i-3, H-40-gh, i+3, H-40], fill=(40, 160, 40, 200))
    # small grass blades
    for j in range(3):
        bx = i + j * 3 - 3
        bh = gh - 10 + int(math.sin(i * 0.2 + j) * 8)
    y0 = min(H-40-bh, H-40); y1 = max(H-40-bh, H-40); draw.ellipse([bx-2, y0, bx+2, y1], fill=(50, 180, 50, 180))

# Save to C:\
output_path = r"C:\flower.png"
img.save(output_path, "PNG")
print(f"Saved to {output_path}")
print(f"Size: {img.size}")

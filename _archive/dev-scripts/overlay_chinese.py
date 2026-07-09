"""
Overlay Chinese brand name text on logo images using PIL.
SDXL/Star-3 Alpha cannot generate correct Chinese characters,
so we add them as an overlay after generation.

Usage: python overlay_chinese.py <company_name> <input_png_path> <output_png_path>
Or via stdin/stdout for base64:
  echo BASE64_DATA | python overlay_chinese.py <company_name> -
"""

import sys
import os
import base64
import io
from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\simkai.ttf",
    r"C:\Windows\Fonts\kaiu.ttf",
    r"D:\disk\HermesDisk\bb-clean\public\fonts\NotoSerifSC-Regular-sub.otf",
]


def find_font():
    for fp in FONT_CANDIDATES:
        if os.path.exists(fp):
            return fp
    return None


def overlay_text(image: Image.Image, text: str, font_path: str) -> Image.Image:
    """Overlay Chinese text at the bottom of the logo image."""
    w, h = image.size
    font_size = max(int(h * 0.12), 24)  # ~12% of image height
    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        font = ImageFont.load_default()

    # Measure text
    draw = ImageDraw.Draw(image)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    # Position: centered at bottom with margin
    margin_y = int(h * 0.05)
    text_x = (w - tw) // 2
    text_y = h - th - margin_y - int(h * 0.03)

    # Semi-transparent dark background for readability
    bg_pad = int(h * 0.02)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle(
        [text_x - bg_pad, text_y - bg_pad, text_x + tw + bg_pad, text_y + th + bg_pad],
        fill=(0, 0, 0, 160),
    )
    image = Image.alpha_composite(image.convert("RGBA"), overlay)

    # Draw text in light color
    draw = ImageDraw.Draw(image)
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 240), font=font)

    return image


def process_base64(company_name: str):
    """Read base64 image from stdin, overlay text, output base64 to stdout."""
    data = sys.stdin.buffer.read()
    # Handle data URL prefix
    if data.startswith(b"data:"):
        # Find the base64 part after the comma
        comma_idx = data.index(b",")
        mime_part = data[:comma_idx].decode()
        b64_part = data[comma_idx + 1:]
    else:
        b64_part = data
        # Default to PNG
        mime_part = "data:image/png"

    image_bytes = base64.b64decode(b64_part)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")

    font_path = find_font()
    if not font_path:
        print("ERROR: No Chinese font found", file=sys.stderr)
        sys.stdout.buffer.write(data)
        return

    result = overlay_text(image, company_name, font_path)

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    b64_out = base64.b64encode(buf.getvalue()).decode()

    # Strip any existing ;base64 suffix from mime_part
    if mime_part.endswith(";base64"):
        mime_part = mime_part[:-7]
    sys.stdout.buffer.write(f"{mime_part};base64,{b64_out}".encode())


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python overlay_chinese.py <company_name>", file=sys.stderr)
        sys.exit(1)
    company_name = sys.argv[1]
    process_base64(company_name)
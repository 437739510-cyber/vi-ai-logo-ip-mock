#!/usr/bin/env python3
"""Combine generated VI manual page images into a single PDF."""
import os, sys, json
from PIL import Image

project_dir = r"C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock"
generated_dir = os.path.join(project_dir, "public", "generated")
mock_dir = os.path.join(project_dir, "public", "mock")

if len(sys.argv) < 2:
    print("Usage: gen_pdf.py <projectId>")
    sys.exit(1)

project_id = sys.argv[1]

# Load page order from runtime JSON
pages_file = os.path.join(mock_dir, f"manual-pages-{project_id}.json")
if not os.path.exists(pages_file):
    print(f"ERROR: No pages data found for {project_id}")
    sys.exit(1)

with open(pages_file, "r", encoding="utf-8") as f:
    pages_data = json.load(f)

if not pages_data.get("pages"):
    print("ERROR: No generated pages found")
    sys.exit(1)

# New 11-page order matching the 2026-05-29 template
page_order = [
    "cover", "brand-philosophy", "logo-interpretation", "brand-colors",
    "typography", "basic-spec", "stationery", "packaging", "marketing",
    "summary", "closing"
]

images = []
for page_id in page_order:
    for p in pages_data["pages"]:
        if p["pageId"] == page_id:
            filepath = os.path.join(project_dir, "public", p["url"].lstrip("/"))
            if os.path.exists(filepath):
                img = Image.open(filepath).convert("RGB")
                images.append(img)
                print(f"  + {page_id}: {filepath}")
            else:
                print(f"  - {page_id}: file not found ({filepath})")
            break

if not images:
    print("ERROR: No valid images found")
    sys.exit(1)

output_pdf = os.path.join(generated_dir, f"manual-{project_id}.pdf")
if len(images) == 1:
    images[0].save(output_pdf, "PDF", resolution=150, save_all=False)
else:
    images[0].save(output_pdf, "PDF", resolution=150, save_all=True, append_images=images[1:])

print(f"\nPDF saved: {output_pdf}")
print(f"Total pages: {len(images)}")
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

with open(pages_file, 'r', encoding='utf-8') as f:
    pages_data = json.load(f)

if not pages_data.get("pages"):
    print("ERROR: No generated pages found")
    sys.exit(1)

# Collect images in page order
page_order = ["cover", "brand-colors", "typography", "logo-usage", "logo-variants", 
              "auxiliary", "business-card", "letterhead", "ppt-template", "signage", "closing"]

images = []
for page_id in page_order:
    # Find the page in results
    for p in pages_data["pages"]:
        if p["pageId"] == page_id:
            filepath = os.path.join(project_dir, "public", p["url"].lstrip("/"))
            if os.path.exists(filepath):
                img = Image.open(filepath).convert("RGB")
                images.append(img)
                print(f"  Added: {p['label']} ({filepath})")
            break

if not images:
    print("ERROR: No image files found on disk")
    sys.exit(1)

# Save as multipage PDF
pdf_path = os.path.join(generated_dir, f"manual-{project_id}.pdf")
images[0].save(pdf_path, "PDF", save_all=True, append_images=images[1:])
print(f"PDF saved: {pdf_path}")
print(f"Pages: {len(images)}")

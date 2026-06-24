#!/usr/bin/env python3
"""Check if PPTX exists in Supabase for a project"""
import json, urllib.request, re, sys

project_id = sys.argv[1] if len(sys.argv) > 1 else "VI-20260624-PD41"

# Check progress page
url = f"https://brandbrain.zeabur.app/progress?id={project_id}&pwd=2222&phone=13800138001"
resp = urllib.request.urlopen(url, timeout=15)
html = resp.read().decode()

# Find supabase storage URLs
supabase_urls = re.findall(r'https?://[a-zA-Z0-9._-]+supabase[^\s<>\"\']*', html)
print(f"Found {len(supabase_urls)} Supabase URLs")
for u in supabase_urls[:5]:
    print(f"  {u[:120]}...")

# Find any pptx references
if "pptx" in html.lower() or ".ppt" in html.lower():
    print("PPTX reference found in page")
else:
    print("No PPTX reference in page")

#!/usr/bin/env python3
"""Add maxPages support to the backend route."""
import re

filepath = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-manual-pages-stream\route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add maxPages to destructuring
c = c.replace(
    'const { projectId, clientInfo, brandColors, logoUrl, mascotUrl } = await req.json();',
    'const { projectId, clientInfo, brandColors, logoUrl, mascotUrl, maxPages } = await req.json();\n  const totalToGenerate = maxPages || PAGE_DEFS.length;'
)

# 2. Use totalToGenerate in the loop
c = c.replace(
    'for (let i = 0; i < PAGE_DEFS.length; i++) {',
    'for (let i = 0; i < totalToGenerate; i++) {'
)

# 3. Update progress
c = c.replace(
    'sse(controller, "page:start", { pageId: page.id, label: page.label, index: i, total: PAGE_DEFS.length });',
    'sse(controller, "page:start", { pageId: page.id, label: page.label, index: i, total: totalToGenerate });'
)

# 4. Update done event
c = c.replace(
    'sse(controller, "done", { totalPages: results.length, failedPages: errors.length });',
    'sse(controller, "done", { totalPages: results.length, failedPages: errors.length, totalToGenerate: totalToGenerate });'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)

print('Backend updated OK')
print('File size:', len(c), 'bytes')

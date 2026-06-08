#!/usr/bin/env python3
"""Remove reference image from API call, keep only text + consistency params"""
filepath = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-manual-pages-stream\route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

old = """      // Build content with prompt text + reference images (IP + LOGO)
      const contentList: any[] = [{ text: prompt }];
      if (mascotUrl) {
        contentList.push({ image: mascotUrl });
      }
      if (logoUrl) {
        contentList.push({ image: logoUrl });
      }
      const body: any = {
        model: "wan2.7-image-pro",
        input: {
          messages: [{
            role: "user",
            content: contentList
          }]
        },
        parameters:"""

new = """      const body: any = {
        model: "wan2.7-image-pro",
        input: {
          messages: [{
            role: "user",
            content: [{ text: prompt }]
          }]
        },
        parameters:"""

c = c.replace(old, new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)

print('Fixed!')
print('Has contentList:', 'contentList' in c)
print('Has consistency_level:', 'consistency_level' in c)
print('Has role_consistency:', 'role_consistency' in c)
print('Has prompt_relevance:', 'prompt_relevance' in c)
print('Has negative_prompt:', 'negative_prompt' in c)

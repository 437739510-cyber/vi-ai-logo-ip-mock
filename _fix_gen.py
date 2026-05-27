#!/usr/bin/env python3
"""Fix generateSingleImage - remove image content from API call (t2i does not support it)"""
import re

filepath = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-manual-pages-stream\route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Remove image content from generateSingleImage function
# Find the function and clean it
old_func = """async function generateSingleImage(
  prompt: string,
  apiKey: string,
  logoUrl?: string,
  mascotUrl?: string
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Build multimodal content: text + optional reference images (following guide's multi-image fusion)
      const content: any[] = [{ text: prompt }];
      if (mascotUrl) {
        const url = mascotUrl.startsWith("http") ? mascotUrl : "http://localhost:3000" + mascotUrl;
        content.push({ image: url });
      }
      if (logoUrl) {
        const url = logoUrl.startsWith("http") ? logoUrl : "http://localhost:3000" + logoUrl;
        content.push({ image: url });
      }

      const body: any = {
        model: "wan2.6-t2i",
        input: { messages: [{ role: "user", content }] },
        parameters: {
          size: "1024*1024",
          n: 1,
          seed: Math.floor(Math.random() * 999999),
          negative_prompt: NEGATIVE_PROMPT,
        },
      };"""

new_func = """async function generateSingleImage(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body: any = {
        model: "wan2.6-t2i",
        input: {
          messages: [{
            role: "user",
            content: [{ text: prompt }]
          }]
        },
        parameters: {
          size: "1024*1024",
          n: 1,
          seed: Math.floor(Math.random() * 999999),
          negative_prompt: NEGATIVE_PROMPT,
        },
      };"""

c = c.replace(old_func, new_func)

# 2. Fix the call site
c = c.replace(
    'imageUrl = await generateSingleImage(pagePrompt, dashscopeKey, logoUrl, mascotUrl);',
    'imageUrl = await generateSingleImage(pagePrompt, dashscopeKey);'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)

print('Fixed!')
# Verify
print('Has image content in gen func:', '{ image:' in c.split('function generateSingleImage')[1].split('function compositeImages')[0])
print('Call site fixed:', ', logoUrl, mascotUrl' not in c[c.find('generateSingleImage(pagePrompt'):c.find('generateSingleImage(pagePrompt')+80])

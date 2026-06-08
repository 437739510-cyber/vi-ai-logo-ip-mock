#!/usr/bin/env python3
"""Upgrade route.ts to use wan2.7-image-pro with enterprise consistency"""
import re

filepath = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-manual-pages-stream\route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Model name
c = c.replace('"wan2.6-t2i"', '"wan2.7-image-pro"')

# 2. generateSingleImage: add consistency params and reference images
old_body = '''      const body: any = {
        model: "wan2.7-image-pro",
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
      };'''

new_body = '''      // Build content with prompt text + reference images (IP + LOGO)
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
        parameters: {
          size: "1024*1024",
          n: 1,
          seed: Math.floor(Math.random() * 999999),
          negative_prompt: NEGATIVE_PROMPT,
          prompt_relevance: 0.98,
          role_consistency: true,
          consistency_level: "commercial",
        },
      };'''

c = c.replace(old_body, new_body)

# 3. Update function signature
old_sig = 'async function generateSingleImage(\n  prompt: string,\n  apiKey: string\n): Promise<string | null> {'
new_sig = 'async function generateSingleImage(\n  prompt: string,\n  apiKey: string,\n  logoUrl?: string,\n  mascotUrl?: string\n): Promise<string | null> {'
c = c.replace(old_sig, new_sig)

# 4. Fix call site
c = c.replace(
    'imageUrl = await generateSingleImage(pagePrompt, dashscopeKey);',
    'imageUrl = await generateSingleImage(pagePrompt, dashscopeKey, logoUrl, mascotUrl);'
)

# 5. Add IP constraint to DeepSeek instruction
old_get = '''  const hasLogo = clientInfo?.logoAssets?.length > 0;
  const hasMascot = clientInfo?.mascotAssets?.length > 0;
  const companyName = clientInfo?.companyName || "\u54c1\u724c\u540d\u79f0";

  let instruction = "\u8bf7\u4e3a\u4e00\u4e2aVI\u624b\u518c\u7684" + pageDef.label + "\u9875\u751f\u6210\u901a\u4e49\u4e07\u76f8\u6587\u751f\u56fe\u63d0\u793a\u8bcd"'''
new_get = '''  const hasLogo = clientInfo?.logoAssets?.length > 0;
  const hasMascot = clientInfo?.mascotAssets?.length > 0;
  const mascotName = clientInfo?.mascotAssets?.[0]?.name || "";
  const mascotDesc = hasMascot ? "\uff0c\u4ee5\u53c2\u8003\u56fe\u7684IP\u5f62\u8c61\u4e3a\u4e3b\u4f53\uff0c\u7981\u6b62\u4fee\u6539\u4e94\u5b98\u3001\u9020\u578b\u3001\u6750\u8d28\u3001\u914d\u8272\uff0cIP\u540d\u79f0\uff1a" + mascotName : "";
  const companyName = clientInfo?.companyName || "\u54c1\u724c\u540d\u79f0";

  let instruction = "\u8bf7\u4e3a\u4e00\u4e2aVI\u624b\u518c\u7684" + pageDef.label + "\u9875\u751f\u6210\u901a\u4e49\u4e07\u76f8\u6587\u751f\u56fe\u63d0\u793a\u8bcd"'''
c = c.replace(old_get, new_get)

# 6. Add mascotDesc to instruction
old_use = 'instruction += "\u9875\u9762\u7528\u9014\uff1a" + pageDef.desc + "\\n\\n";'
new_use = 'instruction += "\u9875\u9762\u7528\u9014\uff1a" + pageDef.desc + mascotDesc + "\\n\\n";'
c = c.replace(old_use, new_use)

# 7. Update fallback prompt to include IP constraint
old_fb = 'const dna = ipDnaPrompt ? ipDnaPrompt + "\uff0c" : "";\n            const fbMascotDesc = clientInfo?.mascotAssets?.length > 0 ? "\uff0c\u4ee5\u53c2\u8003\u56fe\u7684IP\u5f62\u8c61\u4e3a\u4e3b\u4f53\uff0c\u7981\u6b62\u4fee\u6539\u4e94\u5b98\u3001\u9020\u578b\u3001\u6750\u8d28\u3001\u914d\u8272" : "";\n            pagePrompt = dna +\n              (logoUrl ? "\u5de6\u4e0a\u89d2\u653e\u7f6e\u4f01\u4e1aLOGO\uff0c\u900f\u660e\u5e95\uff0c" : "") +\n              "\u4f01\u4e1aVI\u98ce\u683c\uff0c" + page.label + "\u4e3b\u9898\uff0c" +\n              "\u4e3b\u8272" + (brandColors?.primary?.hex || "#1A73E8") +\n              "\uff0c\u767d\u8272\u80cc\u666f\uff0c\u5e72\u51c0\u7b80\u6d01\uff0c\u77e2\u91cf\u8d28\u611f" + fbMascotDesc;'

# This might have already been replaced, check first
if old_fb not in c:
    old_fb2 = 'const dna = ipDnaPrompt ? ipDnaPrompt + "\uff0c" : "";\n            pagePrompt = dna +\n              (logoUrl ? "\u5de6\u4e0a\u89d2\u653e\u7f6e\u4f01\u4e1aLOGO\uff0c\u900f\u660e\u5e95\uff0c" : "") +\n              "\u4f01\u4e1aVI\u98ce\u683c\uff0c" + page.label + "\u4e3b\u9898\uff0c" +\n              "\u4e3b\u8272" + (brandColors?.primary?.hex || "#1A73E8") +\n              "\uff0c\u767d\u8272\u80cc\u666f\uff0c\u5e72\u51c0\u7b80\u6d01\uff0c\u77e2\u91cf\u8d28\u611f";'
    new_fb2 = 'const dna = ipDnaPrompt ? ipDnaPrompt + "\uff0c" : "";\n            const fbMascotDesc = clientInfo?.mascotAssets?.length > 0 ? "\uff0c\u4ee5\u53c2\u8003\u56fe\u7684IP\u5f62\u8c61\u4e3a\u4e3b\u4f53\uff0c\u7981\u6b62\u4fee\u6539\u4e94\u5b98\u3001\u9020\u578b\u3001\u6750\u8d28\u3001\u914d\u8272" : "";\n            pagePrompt = dna +\n              (logoUrl ? "\u5de6\u4e0a\u89d2\u653e\u7f6e\u4f01\u4e1aLOGO\uff0c\u900f\u660e\u5e95\uff0c" : "") +\n              "\u4f01\u4e1aVI\u98ce\u683c\uff0c" + page.label + "\u4e3b\u9898\uff0c" +\n              "\u4e3b\u8272" + (brandColors?.primary?.hex || "#1A73E8") +\n              "\uff0c\u767d\u8272\u80cc\u666f\uff0c\u5e72\u51c0\u7b80\u6d01\uff0c\u77e2\u91cf\u8d28\u611f" + fbMascotDesc;'
    c = c.replace(old_fb2, new_fb2)
    print('Replaced fallback v2')
else:
    c = c.replace(old_fb, new_fb)
    print('Replaced fallback v1')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)

print()
print('Verification:')
print('  Model wan2.7-image-pro:', 'wan2.7-image-pro' in c)
print('  consistency_level:', 'consistency_level' in c)
print('  role_consistency:', 'role_consistency' in c)
print('  prompt_relevance:', 'prompt_relevance' in c)
print('  contentList reference img:', 'contentList.push({ image:' in c)
print('  mascotDesc in prompt:', 'mascotDesc' in c)

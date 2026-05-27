# fix script
import re

p = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-manual-pages\route.ts'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

# Simple approach: replace "return null;" at end of generatePageImage
# with a string that includes the error
c = c.replace(
    '} catch { await new Promise((r) => setTimeout(r, 3000)); }',
    '} catch (e) { const m = e instanceof Error ? e.message : "unknown"; console.error("[gen-img]", m); await new Promise((r) => setTimeout(r, 3000)); }'
)

c = c.replace(
    'return taskData.output?.results?.[0]?.image_url || null;',
    'const u = taskData.output?.results?.[0]?.image_url; if (u) return u;'
)

# Also fix the saveImage function to handle null/undefined
c = c.replace(
    'async function saveImage(imageUrl: string, filePath: string): Promise<boolean> {',
    'async function saveImage(imageUrl: string | undefined | null, filePath: string): Promise<boolean> {'
)
c = c.replace(
    'if (imageUrl.startsWith("http")) {',
    'if (imageUrl && imageUrl.startsWith("http")) {'
)
c = c.replace(
    'const base64Data = imageUrl.replace(',
    'const base64Data = (imageUrl || "").replace('
)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('Fix applied')

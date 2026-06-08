# Add X-DashScope-Async header to API routes
files = [
    r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-image\route.ts',
    r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-manual-pages\route.ts',
]

for fp in files:
    with open(fp, 'r', encoding='utf-8') as f:
        c = f.read()
    
    # Find Authorization header and add X-DashScope-Async after it
    idx = c.find('Authorization: `Bearer ${apiKey}` },')
    if idx >= 0:
        before = c[:idx]
        after = c[idx:]
        after = after.replace(
            'Authorization: `Bearer ${apiKey}` },',
            'Authorization: `Bearer ${apiKey}` },\n      "X-DashScope-Async": "enable",',
            1  # only first occurrence
        )
        c = before + after
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f'Fixed: {fp}')
    else:
        print(f'Not found in {fp}')

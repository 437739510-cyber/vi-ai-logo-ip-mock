# Fix duplicate Download import
p = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\admin\manual-pages\[projectId]\page.tsx'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

# Remove duplicate Download references
import re
c = re.sub(r', Download, Download', ', Download', c)
c = re.sub(r'Download, Download', 'Download', c)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed duplicate Download import')

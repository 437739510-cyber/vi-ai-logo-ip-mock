import os
base = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock'
f = open(os.path.join(base, 'src', 'app', 'layout.tsx'), 'rb')
content = f.read()
f.close()
# Find the metadata section
idx = content.find(b'export const metadata')
print(f'Metadata at byte {idx}')
# Show the next 200 bytes
print(content[idx:idx+200])

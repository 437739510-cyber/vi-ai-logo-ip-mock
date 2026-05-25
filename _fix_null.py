with open(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\admin\projects\[id]\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

old = '  const handleDelete = async () => {\n    if (!window.confirm'
new = '  const handleDelete = async () => {\n    if (!project) return;\n    if (!window.confirm'

c = c.replace(old, new)

with open(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\admin\projects\[id]\page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed')

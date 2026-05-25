import os

base = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock'
csspath = os.path.join(base, 'src', 'app', 'globals.css')

with open(csspath, 'r', encoding='utf-8') as f:
    data = f.read()

# Find second @import
first = data.find('@import url')
second = data.find('@import url', first + 1)
if second >= 0:
    end = data.find(';', second) + 1
    # Find newline before second @import
    nl = data.rfind('\n', 0, second)
    data = data[:nl] + data[end:]
    print('Removed duplicate @import')

with open(csspath, 'w', encoding='utf-8') as f:
    f.write(data)

# Also clean up temp files
for fn in ['_fix_files.py', '_fix2.py', '_fix3.py', '_fix4.py', 'fix_dashboard.py']:
    fp = os.path.join(base, fn)
    if os.path.exists(fp):
        os.remove(fp)
        print(f'Cleaned: {fn}')

print('All done!')

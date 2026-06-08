#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re

filepath = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\admin\manual-pages\[projectId]\page.tsx'
with open(filepath, 'rb') as f:
    raw = f.read()

def replace_literal_escape(m):
    code_point = int(m.group(1), 16)
    return chr(code_point).encode('utf-8')

# Replace literal backslash-u-XXXX with actual UTF-8 Chinese
fixed = re.sub(rb'\\(u[0-9a-fA-F]{4})', replace_literal_escape, raw)
fixed = fixed.replace(b'\\n', b'\n')

with open(filepath, 'wb') as f:
    f.write(fixed)

# Verify
with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

checks = ['\u8fd4\u56de\u9879\u76ee', '\u624b\u52a8\u9010\u5f20', '\u81ea\u52a8\u5168\u90e8', '\u9879\u76ee', '\u5c01\u9762']
for check in checks:
    print(f'  {check}: {check in c}')

leftover = re.search(r'(?<!\\)\\u[0-9a-fA-F]{4}', c)
if leftover:
    print(f'WARNING: {leftover.group()}')
else:
    print('All OK')

#!/usr/bin/env python3
import re

filepath = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\admin\manual-pages\[projectId]\page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

# Find all .split("...") patterns and fix line breaks inside
# The problem: \\n became real newline inside JS strings

# Fix 1: .split("\n") -> .split("\\n")
c = c.replace('buffer.split("\n")', 'buffer.split("\\n")')

# Fix 2: Check for any other broken string lines
# Replace literal newlines inside strings (between quotes)
lines = c.split('\n')
fixed_lines = []
for line in lines:
    # If a line is just "); and the previous line ended with .split("
    if line.strip() == '");' and fixed_lines and fixed_lines[-1].rstrip().endswith('.split("'):
        # Merge: remove the newline and quote break
        fixed_lines[-1] = fixed_lines[-1].rstrip() + '\\n");'
        continue  # skip this line, already merged
    fixed_lines.append(line)

c = '\n'.join(fixed_lines)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)

# Verify
idx = c.find('.split(')
if idx >= 0:
    end = c.find('\n', idx)
    print('Split line:', repr(c[idx:end+1]))
    
# Check no more syntax errors at line 135
lines2 = c.split('\n')
for i, line in enumerate(lines2):
    if 130 <= i+1 <= 140:
        print(f'L{i+1}: {repr(line[:60])}')

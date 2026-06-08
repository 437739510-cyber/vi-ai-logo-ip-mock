#!/usr/bin/env python3
import json

with open(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\lib\mock\submissions.json', 'r', encoding='utf-8') as f:
    subs = json.load(f)

for s in subs:
    name = s.get('companyName', s.get('clientName', ''))
    if '海南' in name or '华亿' in name or '华粤' in name:
        print(f'Submission: {s["id"]}')
        print(f'  Company: {name}')
        print(f'  Client: {s.get("clientName","")}')
        print()

# Find matching project
with open(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\lib\mock\projects.json', 'r', encoding='utf-8') as f:
    projs = json.load(f)

sub_ids = [s['id'] for s in subs if '海南' in s.get('companyName','') or '华亿' in s.get('companyName','') or '华粤' in s.get('companyName','')]
for p in projs:
    if p['submissionId'] in sub_ids:
        print(f'Project: {p["id"]} (submission: {p["submissionId"]})')

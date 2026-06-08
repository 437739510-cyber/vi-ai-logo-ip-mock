#!/usr/bin/env python3
import json

# Read projects
with open(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\lib\mock\projects.json', 'r', encoding='utf-8') as f:
    projs = json.load(f)

print('Projects:')
for p in projs:
    sub_id = p.get('submissionId', '?')
    pid = p['id']
    print(f'  {pid} -> submission {sub_id}')

print()

# Read submissions
with open(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\lib\mock\submissions.json', 'r', encoding='utf-8') as f:
    subs = json.load(f)

print('Submissions:')
for s in subs:
    sid = s['id']
    cname = s.get('companyName', '?')
    clname = s.get('clientName', '?')
    print(f'  {sid}: company={cname}, client={clname}')

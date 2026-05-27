#!/usr/bin/env python3
import requests, json, base64

img_path = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\public\generated\VI-20260525-22WV-cover.png'
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('utf-8')

url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-1337d8b2d6944fd792f0650c004aa43a'
}

body = {
    'model': 'qwen-vl-plus-latest',
    'messages': [{
        'role': 'user',
        'content': [
            {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{img_b64}'}},
            {'type': 'text', 'text': '请分析这张企业VI封面图，从以下维度评价并给出具体改进建议：\n1. IP形象是否一致\n2. LOGO是否清晰、位置是否正确\n3. 整体设计是否专业VI风格\n4. 颜色使用是否合理\n5. 最需要改进的三个问题'}
        ]
    }]
}

resp = requests.post(url, headers=headers, json=body, timeout=60)
d = resp.json()
if resp.status_code == 200:
    content = d['choices'][0]['message']['content']
    print(content)
else:
    print('Error:', json.dumps(d, ensure_ascii=False)[:300])

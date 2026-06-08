#!/usr/bin/env python3
import requests, json, base64, sys

# Test base64 image with wan2.7-image-pro
img_resp = requests.get(
    'https://dashscope-a717.oss-accelerate.aliyuncs.com/1d/75/20260526/8b9c8876/80038576-nRWiS6jf_db0018ea6c1c.png',
    timeout=10
)
img_b64 = base64.b64encode(img_resp.content).decode('utf-8')

url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-1337d8b2d6944fd792f0650c004aa43a'
}

body = {
    'model': 'wan2.7-image-pro',
    'input': {
        'messages': [{
            'role': 'user',
            'content': [
                {'text': 'test with base64 image, white background'},
                {'image': 'data:image/png;base64,' + img_b64}
            ]
        }]
    },
    'parameters': {
        'size': '1024*1024',
        'n': 1,
        'seed': 42,
        'prompt_relevance': 0.98,
        'role_consistency': True,
        'consistency_level': 'commercial',
    }
}

resp = requests.post(url, headers=headers, json=body, timeout=60)
print('Status:', resp.status_code)
d = resp.json()
if resp.status_code == 200:
    print('OK - base64 works!')
else:
    print('Error:', json.dumps(d, ensure_ascii=False)[:300])

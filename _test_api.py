#!/usr/bin/env python3
"""Test different API endpoints for wan2.7 compatibility"""
import requests, json

headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer sk-1337d8b2d6944fd792f0650c004aa43a'}

test_cases = [
    {
        'name': 'V1 image-synthesis',
        'url': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
        'body': {'model': 'wan2.6-t2i', 'input': {'prompt': 'test'}, 'parameters': {'size': '1024*1024', 'n': 1}}
    },
    {
        'name': 'V1 image-synthesis with wan2.7',
        'url': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
        'body': {'model': 'wan2.7-image-pro', 'input': {'prompt': 'test'}, 'parameters': {'size': '1024*1024', 'n': 1}}
    },
    {
        'name': 'wan2.6 with consistency params on multimodal',
        'url': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        'body': {
            'model': 'wan2.6-t2i',
            'input': {'messages': [{'role': 'user', 'content': [{'text': 'test'}]}]},
            'parameters': {'size': '1024*1024', 'n': 1, 'seed': 42, 'negative_prompt': 'bad', 'prompt_relevance': 0.98, 'role_consistency': True, 'consistency_level': 'commercial'}
        }
    },
]

for tc in test_cases:
    try:
        resp = requests.post(tc['url'], headers=headers, json=tc['body'], timeout=10)
        data = resp.json()
        msg = data.get('message', data.get('code', ''))[:100]
        print(f'{tc[\"name\"]}: {resp.status_code} - {msg}')
    except Exception as e:
        print(f'{tc[\"name\"]}: Error - {e}')

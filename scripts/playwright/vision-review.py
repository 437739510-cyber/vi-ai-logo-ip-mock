"""
BrandBrain Vision Tool — call vision models to analyze UI screenshots
Supports: Google Gemini 2.0 Flash (free), Doubao ARK Vision (free)
Usage:   python scripts/playwright/vision-review.py <image_path>
Proxy:   Set HTTPS_PROXY=http://127.0.0.1:22307 for Gemini
"""

import sys, base64, json, os
import requests

GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
ARK_KEY = os.environ.get("ARK_API_KEY", "")
ARK_MODEL = "ep-m-20260623111410-8r69x"  # doubao-1.5-vision-pro

PROMPT = (
    "请详细描述这个网页截图：页面布局、可见文字、UI元素、颜色方案、"
    "任何可见问题（错位、乱码、空白、重叠、样式异常）。用中文回答。"
)

def gemini_review(img_b64: str) -> str:
    body = {
        "contents": [{"parts": [
            {"text": PROMPT},
            {"inline_data": {"mime_type": "image/png", "data": img_b64}}
        ]}]
    }
    proxies = {"https": os.environ.get("HTTPS_PROXY", "http://127.0.0.1:22307"),
               "http": os.environ.get("HTTP_PROXY", "http://127.0.0.1:22307")}
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}",
        json=body, proxies=proxies, timeout=30)
    data = resp.json()
    return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", json.dumps(data, indent=2, ensure_ascii=False))

def ark_review(img_b64: str) -> str:
    body = {
        "model": ARK_MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
        ]}]
    }
    resp = requests.post(
        "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {ARK_KEY}"},
        json=body, timeout=60)
    data = resp.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python vision-review.py <image_path> [gemini|ark]")
        sys.exit(1)

    img_path = sys.argv[1]
    provider = sys.argv[2] if len(sys.argv) > 2 else "gemini"

    with open(img_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    print(f"[VISION] Analyzing {img_path} via {provider}...")
    result = gemini_review(img_b64) if provider == "gemini" else ark_review(img_b64)
    print(result)


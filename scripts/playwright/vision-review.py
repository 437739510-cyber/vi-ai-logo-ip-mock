""" 
BrandBrain Vision Tool — call vision models to analyze UI screenshots 
Supports: Google Gemini 2.0 Flash (free), Doubao ARK Vision (free), Tencent TokenHub Vision (working)
Usage:   python scripts/playwright/vision-review.py <image_path> [gemini|ark|tokenhub]
Proxy:   Set HTTPS_PROXY=http://127.0.0.1:22307 for Gemini
"""

import sys, base64, json, os
import requests
import urllib.request, urllib.error

GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
ARK_KEY = os.environ.get("ARK_API_KEY", "")
TOKENHUB_KEY = os.environ.get("TOKENHUB_API_KEY", "sk-HHEvdLIC8KQEU8Dhk4X335k4RsQra6Pc0w1NruoKGEYNJfUv")
TOKENHUB_MODEL = "hy-vision-2.0-instruct"
TOKENHUB_URL = "https://tokenhub.tencentmaas.com/v1/chat/completions"

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
        "model": os.environ.get("ARK_MODEL", "ep-m-20260623111410-8r69x"),
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

def tokenhub_review(img_b64: str) -> str:
    body = {
        "model": TOKENHUB_MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
        ]}]
    }
    resp = requests.post(
        TOKENHUB_URL,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKENHUB_KEY}"},
        json=body, timeout=60)
    data = resp.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python vision-review.py <image_path> [gemini|ark|tokenhub]")
        sys.exit(1)

    img_path = sys.argv[1]
    provider = sys.argv[2] if len(sys.argv) > 2 else "gemini"

    with open(img_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    print(f"[VISION] Analyzing {img_path} via {provider}...")
    if provider == "gemini":
        result = gemini_review(img_b64)
    elif provider == "ark":
        result = ark_review(img_b64)
    elif provider == "tokenhub":
        result = tokenhub_review(img_b64)
    else:
        print(f"Unknown provider: {provider}. Use gemini, ark, or tokenhub.")
        sys.exit(1)

    # Write result to file instead of printing (avoid GBK encoding issues)
    out_path = os.path.splitext(img_path)[0] + "_vision.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(result)
    print(f"[VISION] Result saved to {out_path}")
    # Also print a preview that won't trigger GBK errors
    print(f"[VISION] Preview: {result[:200]}...")
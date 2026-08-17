"""
BrandBrain Vision Tool — call TokenHub (Tencent) vision model to analyze UI screenshots / logo / assets
Default: TokenHub (Tengxin, working). Gemini available if API key renewed.
Usage:   python scripts/playwright/vision-review.py <image_path> [tokenhub|gemini]
Proxy:   Set HTTPS_PROXY=http://127.0.0.1:22307 for Gemini
"""

import sys, base64, json, os
import requests

def _load_env_file(path: str) -> None:
    """Load KEY=VALUE lines from a local env file without overriding existing vars."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip()
                if key and not os.environ.get(key):
                    os.environ[key] = val
    except OSError:
        pass

_load_env_file(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"))
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
TOKENHUB_KEY = os.environ.get("TOKENHUB_API_KEY", "")
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
        print("Usage: python vision-review.py <image_path> [tokenhub|gemini]")
        sys.exit(1)

    img_path = sys.argv[1]
    provider = sys.argv[2] if len(sys.argv) > 2 else "tokenhub"

    if provider == "tokenhub" and not TOKENHUB_KEY:
        print("[VISION] TOKENHUB_API_KEY 未配置：请确认 .env.local 中存在 TOKENHUB_API_KEY（工具会自动从 .env.local 加载）。")
        sys.exit(2)
    if provider == "gemini" and not GEMINI_KEY:
        print("[VISION] GEMINI_API_KEY 未配置：请确认 .env.local 中存在 GEMINI_API_KEY。")
        sys.exit(2)

    with open(img_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    print(f"[VISION] Analyzing {img_path} via {provider}...")
    if provider == "tokenhub":
        result = tokenhub_review(img_b64)
    elif provider == "gemini":
        result = gemini_review(img_b64)
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

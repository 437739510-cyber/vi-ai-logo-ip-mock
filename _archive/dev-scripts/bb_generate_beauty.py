#!/usr/bin/env python3
"""Create beauty salon project and trigger manual generation"""
import json, urllib.request, time, sys

BASE = "https://brandbrain.zeabur.app"

# Login
data = json.dumps({"phone":"13413049752","password":"2alxjjdu"}).encode("utf-8")
req = urllib.request.Request(f"{BASE}/api/admin/login", data=data,
    headers={"Content-Type":"application/json"}, method="POST")
resp = urllib.request.urlopen(req, timeout=15)
cookie = "; ".join(c.split(";")[0] for c in (resp.headers.get_all("Set-Cookie") or []) if c.strip())

# Submit project
payload = {
    "clientName": "花颜美容院", "companyName": "花颜美容院", "phone": "13800138001",
    "industry": "丽人:美容SPA", "province": "广东", "city": "深圳",
    "businessForm": "门店/商铺", "businessYears": 5,
    "mainProducts": "面部护理、身体SPA、抗衰老项目",
    "brandVision": "让每一位女性绽放自信之美",
    "coreValues": "专业、温暖、匠心",
    "targetMarket": "25-45岁注重生活品质的都市女性",
    "brandPersonality": "亲民温馨、高端奢华",
    "logoStyle": "文字+图标组合",
    "logoPhilosophy": "以绽放的花朵为灵感，花瓣线条柔美优雅",
    "description": "深圳南山高端美容院，5年经营历史",
    "storePhotos": [], "mascotItems": [], "logoFiles": [],
    "referenceFile": None, "referenceEnabled": False
}
data2 = json.dumps(payload, ensure_ascii=False).encode("utf-8")
req2 = urllib.request.Request(f"{BASE}/api/submit", data=data2,
    headers={"Content-Type":"application/json"})
resp2 = urllib.request.urlopen(req2, timeout=30)
r = json.loads(resp2.read().decode())
pid = r.get("projectId")
sys.stdout.reconfigure(encoding='utf-8')
print(f"Project: {pid}")

# Trigger manual gen
gen_payload = {
    "projectId": pid, "format": "pptx", "force": True,
    "clientInfo": {
        "companyName": "花颜美容院", "industry": "丽人:美容SPA",
        "province": "广东", "city": "深圳",
        "brandVision": "让每一位女性绽放自信之美",
        "coreValues": "专业、温暖、匠心",
        "targetMarket": "25-45岁注重生活品质的都市女性",
        "mainProducts": "面部护理、身体SPA、抗衰老项目",
        "description": "深圳南山高端美容院，5年经营历史",
        "logoPhilosophy": "以绽放的花朵为灵感，花瓣线条柔美优雅"
    },
    "brandColors": {"primary": "#E8576C", "secondary": "#9B72CF", "accent": "#F0D5A8"}
}
data3 = json.dumps(gen_payload, ensure_ascii=False).encode("utf-8")
req3 = urllib.request.Request(f"{BASE}/api/ai/generate-manual-pptx",
    data=data3, headers={"Content-Type":"application/json","Cookie":cookie}, method="POST")
try:
    resp3 = urllib.request.urlopen(req3, timeout=30)
    print(f"Gen started")
except Exception as e:
    print(f"Gen error: {e}")
    sys.exit(1)

# Poll for completion
for i in range(12):
    time.sleep(20)
    try:
        req4 = urllib.request.Request(f"{BASE}/api/ai/get-project-status?projectId={pid}",
            headers={"Cookie": cookie})
        resp4 = urllib.request.urlopen(req4, timeout=10)
        s = json.loads(resp4.read().decode())
        status = s.get("status","")
        msg = s.get("statusMessage","")
        bp = s.get("details",{}).get("brandProfile",{})
        manual_url = s.get("details",{}).get("manualUrl","") or s.get("details",{}).get("pptxUrl","")
        analysis_ok = bool(bp and bp.get("logoDesignSuggestions"))
        print(f"[{i*20}s] {status}: {msg} analysis={analysis_ok}")
        if status == "completed":
            print(f"analysis_ok={analysis_ok} url={manual_url[:80]}")
            break
    except Exception as e:
        print(f"[{i*20}s] poll: {e}")

#!/usr/bin/env python3
"""Create new project, analyze brand, wait, then generate manual"""
import json, urllib.request, time, sys

BASE = "https://brandbrain.zeabur.app"

# Login
data = json.dumps({"phone":"13413049752","password":"2alxjjdu"}).encode("utf-8")
req = urllib.request.Request(f"{BASE}/api/admin/login", data=data,
    headers={"Content-Type":"application/json"}, method="POST")
resp = urllib.request.urlopen(req, timeout=15)
cookie = "; ".join(c.split(";")[0] for c in (resp.headers.get_all("Set-Cookie") or []) if c.strip())

# Submit fresh project
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
    "logoPhilosophy": "以绽放的花朵为灵感，花瓣线条柔美优雅，传递女性自信之美",
    "description": "深圳南山高端美容院，5年经营历史",
    "storePhotos": [], "mascotItems": [], "logoFiles": [],
}
data2 = json.dumps(payload, ensure_ascii=False).encode("utf-8")
req2 = urllib.request.Request(f"{BASE}/api/submit", data=data2,
    headers={"Content-Type":"application/json"})
resp2 = urllib.request.urlopen(req2, timeout=30)
r = json.loads(resp2.read().decode())
pid = r.get("projectId")
print(f"NEW PROJECT: {pid}", flush=True)

# Step 1: Trigger brand analysis
analysis_payload = {
    "projectId": pid,
    "clientInfo": {
        "companyName": "花颜美容院", "industry": "丽人:美容SPA",
        "province": "广东", "city": "深圳",
        "brandVision": "让每一位女性绽放自信之美",
        "coreValues": "专业、温暖、匠心",
        "targetMarket": "25-45岁都市女性",
        "mainProducts": "面部护理、身体SPA",
        "description": "深圳南山高端美容院",
        "logoPhilosophy": "以绽放的花朵为灵感"
    }
}
data3 = json.dumps(analysis_payload, ensure_ascii=False).encode("utf-8")
req3 = urllib.request.Request(f"{BASE}/api/ai/analyze-brand",
    data=data3, headers={"Content-Type":"application/json","Cookie":cookie}, method="POST")
resp3 = urllib.request.urlopen(req3, timeout=120)
print("Analysis triggered", flush=True)

# Step 2: Wait for DeepSeek to complete (brand-analysis saves to DB itself)
# Poll until brandProfile has content
for i in range(12):
    time.sleep(20)
    try:
        req4 = urllib.request.Request(f"{BASE}/api/ai/get-project-status?projectId={pid}",
            headers={"Cookie": cookie})
        resp4 = urllib.request.urlopen(req4, timeout=10)
        s = json.loads(resp4.read().decode())
        bp = s.get("details",{}).get("brandProfile",{})
        status = s.get("status","")
        analysis_ok = bool(bp and bp.get("brandToneKeywords") and len(bp.get("brandToneKeywords",[])) > 0)
        print(f"[{i*20}s] status={status} bp={bool(bp)} analysis_ok={analysis_ok}", flush=True)
        if analysis_ok:
            print(f"  keywords: {bp.get('brandToneKeywords',[])}", flush=True)
            print(f"  scenes: {len(bp.get('sceneImageSuggestions',[]) or [])}", flush=True)
            break
    except Exception as e:
        print(f"[{i*20}s] poll error: {e}", flush=True)

# Step 3: Generate manual
print("Generating manual...", flush=True)
gen_payload = {
    "projectId": pid, "format": "pptx", "force": True,
    "clientInfo": {
        "companyName": "花颜美容院", "industry": "丽人:美容SPA",
        "brandVision": "让每一位女性绽放自信之美",
        "logoPhilosophy": "以绽放的花朵为灵感"
    },
    "brandColors": {"primary":"#E8576C","secondary":"#9B72CF","accent":"#F0D5A8"}
}
data5 = json.dumps(gen_payload, ensure_ascii=False).encode("utf-8")
req5 = urllib.request.Request(f"{BASE}/api/ai/generate-manual-pptx",
    data=data5, headers={"Content-Type":"application/json","Cookie":cookie}, method="POST")
resp5 = urllib.request.urlopen(req5, timeout=30)
print("Generation started", flush=True)

# Step 4: Wait for completion
for i in range(15):
    time.sleep(20)
    try:
        req6 = urllib.request.Request(f"{BASE}/api/ai/get-project-status?projectId={pid}",
            headers={"Cookie": cookie})
        resp6 = urllib.request.urlopen(req6, timeout=10)
        s = json.loads(resp6.read().decode())
        st = s.get("status","")
        msg = s.get("statusMessage","")
        url = s.get("details",{}).get("manualUrl","") or s.get("details",{}).get("pptxUrl","")
        print(f"[{i*20}s] {st}: {msg} url={url[:60]}", flush=True)
        if st == "completed":
            if url:
                print(f"\\n✅ PPTX READY: {url}", flush=True)
            else:
                print("\\n⚠️ Completed but no URL - check admin panel", flush=True)
            break
    except Exception as e:
        print(f"[{i*20}s] poll: {e}", flush=True)

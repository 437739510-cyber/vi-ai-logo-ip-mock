#!/usr/bin/env python3
"""BrandBrain 巡检脚本 — 查待处理订单，供 cron 调用

配置文件: scripts/.patrol_config.json (gitignored)
{
  "phone": "13413049752",
  "password": "你的admin密码"
}
"""

import json
import os
import sys
from urllib.request import Request, urlopen, HTTPError
from urllib.parse import urlencode

BASE = "https://brandbrain.zeabur.app"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, ".patrol_config.json")
COOKIE_FILE = os.path.join(SCRIPT_DIR, ".admin_jar.txt")
SEEN_FILE = os.path.join(SCRIPT_DIR, ".seen_orders.json")


def load_seen():
    try:
        with open(SEEN_FILE) as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_seen(ids):
    with open(SEEN_FILE, "w") as f:
        json.dump(list(ids), f)


def load_config():
    try:
        with open(CONFIG_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def login():
    cfg = load_config()
    if not cfg:
        return False
    data = json.dumps({"phone": cfg["phone"], "password": cfg["password"]}).encode()
    req = Request(f"{BASE}/api/admin/login", data=data,
                  headers={"Content-Type": "application/json"},
                  method="POST")
    try:
        resp = urlopen(req, timeout=15)
        cookies = resp.headers.get_all("Set-Cookie") or []
        cookie_str = "; ".join(c.split(";")[0] for c in cookies if c.strip())
        with open(COOKIE_FILE, "w") as f:
            f.write(cookie_str)
        return True
    except HTTPError:
        return False


def get_cookie_header():
    try:
        with open(COOKIE_FILE) as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def check_orders():
    cookie = get_cookie_header()
    if not cookie:
        if not login():
            return []
        cookie = get_cookie_header()

    req = Request(f"{BASE}/api/admin/pending-orders",
                  headers={"Cookie": cookie})
    try:
        resp = urlopen(req, timeout=15)
        data = json.loads(resp.read().decode())
    except HTTPError as e:
        if e.code == 401:
            if login():
                return check_orders()
        return []

    if not data.get("success"):
        return []

    orders = data.get("orders", [])
    seen = load_seen()
    new_orders = [o for o in orders if o["projectId"] not in seen]

    if new_orders:
        seen.update(o["projectId"] for o in new_orders)
        save_seen(seen)

    return new_orders


def format_report(orders):
    lines = ["🔔 **BrandBrain 新待处理订单**\n"]
    for o in orders:
        lines.append(f"━━━━━━━━━━━━━━━━━━━")
        lines.append(f"📋 **{o['companyName'] or '未命名'}**  ({o['projectId']})")
        lines.append(f"📱 {o['phone'] or '无电话'}")
        lines.append(f"📌 状态: {o['status']}")
        if o['needsPhotoAnalysis']:
            lines.append(f"📸 店内照片: {o['storePhotoCount']} 张 → 需要我看图分析")
            for url in o['storePhotos'][:3]:
                lines.append(f"   └ {url}")
        if o['needsPaymentConfirm']:
            lines.append(f"💰 付款截图已上传 → 需要确认收款")
            if o['paymentScreenshot']:
                lines.append(f"   └ {o['paymentScreenshot']}")
        if o['description']:
            lines.append(f"📝 {o['description'][:100]}")
    lines.append("")
    lines.append(f"共 {len(orders)} 个新订单待处理")
    return "\n".join(lines)


def main():
    new_orders = check_orders()
    if new_orders:
        print(format_report(new_orders))


if __name__ == "__main__":
    main()

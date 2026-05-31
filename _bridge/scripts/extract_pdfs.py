#!/usr/bin/env python3
"""Extract text from all course/reference PDFs for knowledge documentation."""

import sys
sys.stdout.reconfigure(encoding='utf-8')

from pypdf import PdfReader
import os
import json

PDFS = [
    ("课件一_VI品牌手册", r"C:\Users\Administrator\Documents\Codex\2026-05-25\new-chat\课件一：如何用AI做企业级VI品牌手册(1).pdf"),
    ("课件二_行业AI专家", r"C:\Users\Administrator\Documents\Codex\2026-05-25\new-chat\课件二：让每位企业家都拥有自己的行业AI专家（openclaw、hermes、知识中台）(6)(1).pdf"),
    ("课件三_产品思维", r"C:\Users\Administrator\Documents\Codex\2026-05-25\new-chat\AI_产品思维：从工具使用到业务增长_智方增长雷光晨(1).pdf"),
    ("课件四_行业案例", r"C:\Users\Administrator\Documents\Codex\2026-05-25\new-chat\AI重塑的五个垂直行业落地案例剖析(1).pdf"),
    ("参考_坤灵VI", r"C:\Users\Administrator\Documents\Codex\2026-05-25\new-chat\新建文件夹\坤灵Guidelinev（内部资料 请勿对外）(1).pdf"),
    ("参考_智方VI", r"C:\Users\Administrator\Documents\Codex\2026-05-25\new-chat\新建文件夹\智方增长科技品牌视觉识别VI规范手册（内部资料 请勿对外）(1).pdf"),
    ("参考_智方IP", r"C:\Users\Administrator\Documents\Codex\2026-05-25\new-chat\新建文件夹\智方增长视觉IP手册（内部资料 请勿对外）.pdf"),
    ("反面案例1", r"C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\docs\knowledge\反面案例\反面案例1-小智猫IP视觉手册.pdf"),
    ("反面案例2", r"C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\docs\knowledge\反面案例\反面案例2-小智猫IP视觉手册.pdf"),
]

OUTPUT_DIR = r"C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\docs\knowledge\_extracted"

os.makedirs(OUTPUT_DIR, exist_ok=True)

for label, path in PDFS:
    if not os.path.exists(path):
        print(f"  [SKIP] {label}: file not found at {path}")
        continue
    
    try:
        reader = PdfReader(path)
        text = ""
        page_count = len(reader.pages)
        
        for i, page in enumerate(reader.pages):
            t = page.extract_text() or ""
            text += t + "\n"
        
        out_path = os.path.join(OUTPUT_DIR, f"{label}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        print(f"  [OK] {label}: {page_count} pages, {len(text)} chars -> {out_path}")
    except Exception as e:
        print(f"  [ERR] {label}: {e}")

print("\nDone!")

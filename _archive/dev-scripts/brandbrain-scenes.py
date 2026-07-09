#!/usr/bin/env python3
"""BrandBrain ComfyUI 场景图批量生成脚本

用法:
  python scripts/brandbrain-scenes.py [workflow_dir] [--seed N]

默认提交 comfyui-workflows/ 下的3个vi场景工作流到本地ComfyUI。
每个workflow的seed会自动替换，确保3张图不同。
"""

import json
import os
import sys
import urllib.request
import urllib.error
import time

COMFYUI_URL = "http://127.0.0.1:8188"
WORKFLOW_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "comfyui-workflows")


def submit_workflow(workflow: dict, seed: int = None) -> str:
    """提交工作流到 ComfyUI，返回 prompt_id"""
    # 找到 KSampler 节点，替换 seed
    for node_id, node in workflow.get("nodes", {}).items():
        if node.get("class_type") == "KSampler":
            if seed is not None:
                node["inputs"]["seed"] = seed
            # 用实际 seed 更新写入
            break

    prompt = workflow["nodes"]
    data = json.dumps({"prompt": prompt}).encode("utf-8")
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data,
                                 headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read().decode())
        prompt_id = result.get("prompt_id", "")
        print(f"  ✅ 已提交, prompt_id={prompt_id}", flush=True)
        return prompt_id
    except urllib.error.HTTPError as e:
        print(f"  ❌ HTTP {e.code}: {e.read().decode()[:300]}", flush=True)
        return ""
    except Exception as e:
        print(f"  ❌ {e}", flush=True)
        return ""


def wait_for_completion(prompt_id: str, timeout: int = 60) -> bool:
    """等待 ComfyUI 完成生成"""
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(f"{COMFYUI_URL}/history/{prompt_id}")
            resp = urllib.request.urlopen(req, timeout=5)
            history = json.loads(resp.read().decode())
            if prompt_id in history:
                status = history[prompt_id].get("status", {})
                if status.get("completed"):
                    print(f"  ✅ 完成 ({time.time()-start:.0f}s)", flush=True)
                    return True
                if status.get("error"):
                    print(f"  ❌ 出错", flush=True)
                    return False
        except Exception:
            pass
        time.sleep(2)
    print(f"  ⏰ 超时 ({timeout}s)", flush=True)
    return False


def main():
    seed = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[1] == "--seed" else None
    base_seed = seed or 42

    if not os.path.isdir(WORKFLOW_DIR):
        print(f"工作流目录不存在: {WORKFLOW_DIR}")
        sys.exit(1)

    workflows = sorted([f for f in os.listdir(WORKFLOW_DIR) if f.endswith(".json")])
    if not workflows:
        print("没有找到工作流 JSON 文件")
        sys.exit(1)

    print(f"找到 {len(workflows)} 个工作流:")
    for i, wf in enumerate(workflows):
        print(f"  {i+1}. {wf}")

    print(f"\n开始提交 ({base_seed=})...")
    for i, wf_name in enumerate(workflows):
        path = os.path.join(WORKFLOW_DIR, wf_name)
        with open(path) as f:
            workflow = json.load(f)
        print(f"\n[{i+1}/{len(workflows)}] {wf_name}")
        pid = submit_workflow(workflow, seed=base_seed + i)
        if pid:
            ok = wait_for_completion(pid, timeout=120)
            if ok:
                print(f"  → 图片已保存到 ComfyUI output/ 目录")
            # 间隔避免过热
            if i < len(workflows) - 1:
                time.sleep(5)

    print("\n全部完成！图片在 ComfyUI output/ 目录下。")


if __name__ == "__main__":
    main()

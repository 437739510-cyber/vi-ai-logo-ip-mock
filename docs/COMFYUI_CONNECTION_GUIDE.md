# BrandBrain 平台连接 ComfyUI 使用说明

> 更新时间：2026-07-31
> 适用范围：本地平台完整链路；线上平台（Zeabur）的订单同样由本机 Worker 桥接本地 ComfyUI。

---

## 一、链路总览

```
浏览器 / 前端
  → Next.js 平台（本地 dev :3000，线上 Zeabur）
  → Supabase（projects.client_info.generationStatus 写入待办状态）
  → 本机 Worker（scripts/worker.mjs，每 10 秒轮询）
  → ComfyUI（http://127.0.0.1:8188，本地免费生图）
  → 图片 / PPTX 上传 Supabase Storage
  → 前端轮询 get-project-status 展示进度
```

线上平台不部署 ComfyUI。线上订单与本地订单写入同一个 Supabase，
本机 Worker 看到 `pending_logo` / `mascot_generating` / `mascot_full_generating` /
`pending_manual` 状态后，用本机 ComfyUI 完成生成，再把结果写回 Supabase。
所以「线上也接本地 ComfyUI」的前提就是：本机 ComfyUI + Worker 保持运行。

---

## 二、三个必须启动的进程

| 进程 | 启动命令 | 地址 / 端口 | 2026-07-31 状态 |
|------|----------|-------------|-----------------|
| ComfyUI | `cd /d D:\ComfyUI-backup && python main.py --lowvram --reserve-vram 2 --disable-smart-memory` | `http://127.0.0.1:8188` | 运行中（PID 5600） |
| 平台 dev | `cd /d D:\disk\HermesDisk\bb-clean && npm run dev` | `http://localhost:3000` | 运行中（PID 14344） |
| Worker | 双击 `D:\disk\HermesDisk\bb-clean\scripts\worker-start-v2.bat` | 无端口，轮询 Supabase | 未运行 |

建议启动顺序：先 ComfyUI，再 dev，最后 Worker。

---

## 三、详细启动步骤

### 3.1 启动 ComfyUI

方式一（推荐，双击）：

```text
D:\ComfyUI-backup\run-zimage-stable.bat
```

方式二（手动）：

```bat
cd /d D:\ComfyUI-backup
python main.py --lowvram --reserve-vram 2 --disable-smart-memory
```

说明：

- 当前机器的 Python 是 `D:\disk\CODEX\python312\python.exe`，已在 PATH 中，直接 `python` 即可。
- 默认端口 8188，不需要额外指定 `--port`。
- 12GB 显存机器建议保持 `--lowvram --reserve-vram 2`，防止显存打满蓝屏。
- 验证：浏览器打开 `http://127.0.0.1:8188`，或执行：

```powershell
curl.exe http://127.0.0.1:8188
```

### 3.2 启动平台 dev

```bat
cd /d D:\disk\HermesDisk\bb-clean
npm run dev
```

说明：

- 默认地址 `http://localhost:3000`。
- 需要换端口时：`npx next dev -p 3001`。
- 平台连接 ComfyUI 的关键环境变量在 `.env.local`：
  - `IMAGE_PROVIDER=comfyui`（当前已配置）
  - `COMFYUI_BASE_URL`（可选，默认 `http://127.0.0.1:8188`）
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 验证：浏览器打开 `http://localhost:3000`。

### 3.3 启动 Worker

方式一（推荐，双击）：

```text
D:\disk\HermesDisk\bb-clean\scripts\worker-start-v2.bat
```

这个 bat 会自动：

1. 检测 ComfyUI 是否在 8188 端口。
2. 未启动则自动拉起 ComfyUI。
3. 加载 `.env.local` 到当前进程。
4. 执行 `npx tsx scripts/worker.mjs`。

方式二（手动）：

```bat
cd /d D:\disk\HermesDisk\bb-clean
npx tsx scripts/worker.mjs
```

手动方式必须保证环境变量已加载，至少需要：

```text
SUPABASE_SERVICE_KEY
DEEPSEEK_API_KEY
```

验证 Worker 是否正常：

- 日志文件：`D:\disk\HermesDisk\bb-clean\logs\worker-YYYY-MM-DD.log`
- 启动日志应出现：

```text
===== Brand Brain Automation Worker Started =====
ComfyUI available: true
```

- Worker 每 10 秒向 Supabase `worker_heartbeat` 表写心跳，`comfyui_available` 字段实时反映 ComfyUI 状态。

---

## 四、Worker 处理的状态机

| Supabase 状态 | Worker 动作 | 完成后状态 |
|---------------|-------------|------------|
| `pending_logo` | DeepSeek 品牌分析（无 prompts 时）→ ComfyUI 生成 4 张 Logo → 上传 Storage | `logo_generated` |
| `mascot_generating` | ComfyUI 生成 4 张公仔样稿 → 上传 | `mascot_samples_ready` |
| `mascot_full_generating` | ComfyUI 生成 3 视图 + 6 表情 + 6 场景 → 上传 | `pending_manual` |
| `pending_manual` | ComfyUI 生成 5 张场景图 → planPages → renderPptxToBuffer → 上传 PPTX | `completed` |

轮询间隔：10 秒；ComfyUI 单张最大等待：480 秒。

---

## 五、代码侧连接点

| 文件 | 作用 |
|------|------|
| `src/lib/ip/ip-image-provider/comfyui-provider.ts` | ComfyUI REST 对接：`POST /prompt` 提交 workflow、`GET /history/{prompt_id}` 轮询结果、`GET /view` 取图转 base64 |
| `src/lib/ip/ip-image-provider/provider.ts` | 按 `IMAGE_PROVIDER` 选择优先级；`comfyui` 模式为 comfyui(10) → liblibai(5) → ark(3) → mock(0) |
| `scripts/worker.mjs` | 本机自动化 Worker：轮询 Supabase、调 ComfyUI、上传图片/PPTX |
| `scripts/worker-start-v2.bat` | Worker 一键启动脚本（含 ComfyUI 自启和 `.env.local` 加载） |
| `src/app/api/submit/route.ts` | 下单时写入 `generationStatus: "pending_logo"` |
| `src/app/api/ai/select-logo/route.ts` | 选标后写入 `generationStatus: "pending_manual"` |

ComfyUI 当前主 workflow：

- 模型：`z-image-turbo-Q4_K_M.gguf`（UnetLoaderGGUF）
- CLIP：`qwen_3_4b_fp8_mixed.safetensors`
- VAE：`ae.safetensors`
- 参数：4 steps、euler、simple scheduler、1024x1024
- 中文支持：已验证，中文质量 90/100

---

## 六、环境变量清单

| 变量 | 用途 | 当前值 |
|------|------|--------|
| `IMAGE_PROVIDER` | 生图引擎选择 | `comfyui` |
| `COMFYUI_BASE_URL` | ComfyUI 地址（可选） | 默认 `http://127.0.0.1:8188` |
| `SUPABASE_SERVICE_KEY` | Worker 读写 Supabase | `.env.local` 中 |
| `DEEPSEEK_API_KEY` | Worker 品牌分析/文案 | `.env.local` 中 |
| `NEXT_PUBLIC_SUPABASE_URL` | 平台连接 Supabase | `.env.local` 中 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 平台前端 Supabase | `.env.local` 中 |

注意：Worker 不依赖 `NEXT_PUBLIC_USE_MOCK`，它直接使用 `SUPABASE_SERVICE_KEY` 操作生产数据库。

---

## 七、启动检查清单

1. ComfyUI 可访问：`curl.exe http://127.0.0.1:8188`
2. dev 可访问：`curl.exe http://localhost:3000`
3. Worker 日志出现 `ComfyUI available: true`
4. 提交一个测试单，Worker 日志出现 `[LOGO] Processing project: ...`
5. 页面进度从 `logo_generating` 走到 `logo_generated`
6. 确认 `logs/worker-YYYY-MM-DD.log` 没有 `[ERROR]` / `[FATAL]`

---

## 八、常见问题

| 问题 | 原因 | 处理 |
|------|------|------|
| Worker 日志 `ComfyUI available: false` | ComfyUI 没启动或端口不对 | 启动 ComfyUI；确认 8188 端口 |
| Worker 报缺环境变量 | 手动启动时没加载 `.env.local` | 改用 `worker-start-v2.bat`，或先加载 `SUPABASE_SERVICE_KEY`、`DEEPSEEK_API_KEY` |
| dev 端口 3000 被占用 | 其他进程占用 | `npx next dev -p 3001` |
| ComfyUI 8188 被占用 | 已有一个实例 | 不要重复启动，直接复用 |
| 生成中途超时 | 单张超过 480 秒 | 检查显存/模型加载；`--lowvram` 保持开启 |
| 中文 Prompt 乱码 | PowerShell/编码问题 | 用 `worker-start-v2.bat`（内部 `chcp 65001`）；脚本文件保持 UTF-8 无 BOM |
| 显存不足 / 蓝屏风险 | 同时跑多个大模型 | 同一时间只跑一个模型，显存超过 11GB 立即停止任务 |

---

## 九、关键路径速查

| 项目 | 路径 |
|------|------|
| 平台代码 | `D:\disk\HermesDisk\bb-clean` |
| ComfyUI | `D:\ComfyUI-backup` |
| ComfyUI 一键启动 | `D:\ComfyUI-backup\run-zimage-stable.bat` |
| Worker 一键启动 | `D:\disk\HermesDisk\bb-clean\scripts\worker-start-v2.bat` |
| Worker 源码 | `D:\disk\HermesDisk\bb-clean\scripts\worker.mjs` |
| Worker 日志 | `D:\disk\HermesDisk\bb-clean\logs\worker-YYYY-MM-DD.log` |
| ComfyUI Provider | `D:\disk\HermesDisk\bb-clean\src\lib\ip\ip-image-provider\comfyui-provider.ts` |
| 环境变量 | `D:\disk\HermesDisk\bb-clean\.env.local` |


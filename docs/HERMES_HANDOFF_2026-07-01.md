# HERMES Handoff — 2026-07-01

> 开新窗时先读这个文件，再接下面的任务。

---

## 一、项目概况

| 项目 | 内容 |
|------|------|
| **Brand Brain** | VI手册自动生成平台 |
| **代码路径** | `D:\disk\HermesDisk\bb-clean` |
| **GitHub** | `437739510-cyber/vi-ai-logo-ip-mock` (master) |
| **线上** | https://brandbrain.zeabur.app |
| **管理后台** | https://brandbrain.zeabur.app/admin (13413049752 / 2alxjjdu) |
| **View选标页** | https://brandbrain.zeabur.app/view |
| **分支** | master（已所有修改都推上去了） |
| **编译** | `npx tsc --noEmit` 通过（之前download-pptx编码损坏已修好） |

---

## 二、当前运行状态

### Worker（本地轮询）
- **启动方式**：双击 `D:\disk\HermesDisk\bb-clean\scripts\worker-start.bat`
- **日志位置**：`D:\disk\HermesDisk\bb-clean\logs\worker-YYYY-MM-DD.log`
- **功能**：每10秒轮询Supabase → 发现 `pending_logo` 或 `pending_manual` → 调本地ComfyUI生图 → 上传
- **坑**：`.env.local` 的 BOM 已经去除。不能用 `Start-Process` 或 `background=true`（会走WSL）。
- **当前状态**：✅ 运行中（有命令行窗口开着，里面实时打印日志）

### ComfyUI
- **端口**：http://127.0.0.1:8188
- **主模型**：`dreamshaperXL_alpha2Xl10.safetensors` (6.46GB, SDXL)
- **备用**：`Juggernaut-XL_v9_RunDiffusionPhoto_v2` (写实场景更佳)
- **已损坏不用**：`z_image_turbo_bf16` (metadata不完整)
- **输出目录**：`E:/ComfyUI/output`
- **注意**：Provider代码里路径已改为正斜杠 `E:/ComfyUI/output`

---

## 三、自动化全链路（已跑通验证）

```
客户下单 → submit API (线上Zeabur)
  → generationStatus: "pending_logo"
  → Worker发现 → DeepSeek品牌分析 → ComfyUI 4个Logo → 上传Supabase
  → 客户在 /view 选标 → select-logo API
  → generationStatus: "pending_manual"
  → Worker发现 → ComfyUI 5场景图 → planPages → renderPptxToBuffer → 上传PPTX
  → status: "completed"
```

**已验证两次：** 老王煎饼（成功出手册）、潮味海鲜大排档（成功出手册）

---

## 四、豆包给的优化方案（核心新方向）

豆包（https://www.doubao.com/thread/xa2ec1a3db02e89d9af38ca90d2ab4e62）提供了完整的 VI 生成优化方案，核心改造点：

### 4.1 DeepSeek System Prompt 升级
现有 `deepseek-dna.ts` 的 prompt 要替换为豆包的版本（包含行业规则、4款Logo结构、8张场景图分类、强制JSON输出）。已验证通过的代码在：
- `scripts/doubao_deepseek_pipeline.py` — 独立的 Python 验证脚本

### 4.2 生成参数优化（ComfyUI provider 中改）
| 项目 | 当前 | 豆包建议 |
|:----|:---:|:--------:|
| Logo Steps | 20 | 28 |
| Logo CFG | 3.5 | 5.5 |
| Logo Sampler | euler | DPM++ 2M Karras |
| 场景Steps | 20 | 25 |
| 场景CFG | 3.5 | 6 |
| 场景模型 | dreamshaperXL | Juggernaut-XL (写实更好) |

### 4.3 行业模板库
9个行业的详细模板数据（Logo映射包+场景图清单+ControlNet配置）来自豆包，需要扩展到18个行业。
现有18个行业类型定义在：`src/lib/brand/industry-types.ts`

### 4.4 CODEX/HERMES 分工
- CODEX：后端引擎（DeepSeek封装、模板变量替换、生图对接、任务队列）
- HERMES：System Prompt编写、行业模板内容维护、前端交互、质检润色

---

## 五、待处理任务（按优先级）

### P0 — 当前最紧急

| 任务 | 说明 |
|:----|:-----|
| **008 DeepSeek提示词引擎集成** | 把豆包的System Prompt整合进 `deepseek-dna.ts`，修颜色约束问题，启用 `response_format: json_object` |
| **Worker 环境变量修复** | `.env.local` BOM已去除，worker-start.bat 双击即可正常启动 |

### P1 — 重要

| 任务 | 说明 |
|:----|:-----|
| **007 VI手册P1P2整改** | 文案深度、字体统一、规范细节补充 |
| **009 全行业场景模板库** | 创建 `industry-templates.json`，18个行业各配Logo映射包+场景图清单 |
| **006 VI手册质量整改P0** | 目录排序、布局、场景图、色彩规范（Codex说P0已完成，待验证） |

### P2 — 后续

| 任务 | 说明 |
|:----|:-----|
| 支付接入 | 微信/支付宝 |
| 创业基地项目简介 | 文档 |
| ComfyUI 参数调优 | 按豆包建议改 Steps/CFG/Sampler |

---

## 六、已知陷阱（每次开窗必读）

1. **WSL劫持后台进程** — `background=true` 一定走 WSL bash。Windows原生进程用VBScript启动
2. **write_file 不落盘** — 写文件后用 `Test-Path` 验证，不可信工具返回
3. **DeepSeek模型名** — 必须用 `deepseek-chat`，`deepseek-v4-flash` 无效
4. **coreValues 必须是string** — 传给 renderPptxToBuffer 时如果是array会崩
5. **BOM陷阱** — `.env.local` 第一行曾有 BOM，已去除。如果后续修改重新生成，注意 strip
6. **路径反斜杠** — ComfyUI provider 中输出目录用正斜杠 `E:/ComfyUI/output`，Windows也认
7. **编译阻塞** — 之前 `download-pptx/[filename]/route.ts` 有编码损坏导致build失败，已修复

---

## 七、测试账号

| 项目 | 手机号 | 密码 | 说明 |
|:----|:------|:----|:-----|
| 老王煎饼 VI-20260701-3380 | 13900139001 | 5555 | 全流程测试，已有手册 |
| 潮味海鲜 VI-20260701-I08O | 13700137001 | 8888 | 全流程测试，已有手册 |
| 管理后台 | 13413049752 | 2alxjjdu | 管理员 |

---

## 八、当前任务看板

```
📥 待处理              🔄 进行中            ✅ 已完成
─────────────────────────────────────────────────────
008 DeepSeek引擎集成    Worker守护中        自动化全链路跑通
009 行业模板库                               005 view按钮修复
007 VI手册P1P2                               006 P0整改
支付接入                                      003/004 worker+logo
创业基地简介                                  002 CMYK/字体
```

---

## 九、开新窗后续操作

1. 读这个文件了解全貌
2. 检查 Worker 窗口是否开着（`D:\disk\HermesDisk\bb-clean\logs\` 有最新日志）
3. 检查 MESSAGE 目录看 Codex 有没有新交工
4. 按优先级处理任务
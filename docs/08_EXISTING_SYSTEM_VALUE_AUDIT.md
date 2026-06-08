# 08 — Existing System Value Audit

> 目的：评估现有 Brand Brain 代码和模块，哪些保留、冻结、废弃、改造
> 评审人：ChatGPT
> 日期：2026-06-01

---

## 一、保留模块

以下模块经过架构评审确认，未来 100% 保留。无需重写，仅需维护或轻度改造。

### 1.1 Next.js 15 架构

| 项目 | 状态 |
|------|------|
| App Router | 保留 |
| Server Components / API Routes | 保留 |
| Tailwind CSS v4 | 保留 |
| Turbopack dev 模式 | 保留 |

**理由**：Next.js 15 是成熟稳定的元框架。App Router 的目录结构（`(client)` / `admin` / `api` 分层）清晰合理，不需要变更。后续所有新页面和 API 仍在此基础上扩展。

### 1.2 Supabase 基础设施

| 项目 | 状态 |
|------|------|
| Supabase Storage（文件存储） | 保留 |
| Supabase PostgreSQL（数据库） | 保留 |
| supabaseAdmin + supabase（anon）双客户端模式 | 保留 |
| Storage RLS Policy | 保留 |

**理由**：EROFS / 413 / RLS 问题已全部修复。Supabase Storage 作为生产环境文件存储已验证稳定。数据库 schema（submissions / projects / vi_manuals）虽然未来可能需要扩展，但框架正确。

### 1.3 管理后台

| 页面 | 状态 |
|------|------|
| /admin/login | 保留 |
| /admin/dashboard | 保留（需轻度适配） |
| /admin/projects | 保留 |
| /admin/projects/[id] | 保留 |
| /admin/clients | 保留 |
| /admin/billing | 保留 |
| /admin/favorites | 保留 |
| /admin/templates | 保留 |

**理由**：管理后台的价值独立于生成流程。项目管理、客户管理、计费概览在 Brand Brain + Manus 架构下仍然需要。页面交互逻辑不变，仅需调整数据源对接方式。

### 1.4 文件上传

| 端点 | 状态 |
|------|------|
| POST /api/upload | 保留 |
| Supabase Storage 直接上传流程 | 保留 |
| 本地开发 fallback | 保留 |

**理由**：上传流程已验证兼容 Vercel Serverless。后续 Interview 阶段客户上传 Logo / 参考手册仍然需要此能力。

### 1.5 PDF 导出

| 模块 | 状态 |
|------|------|
| /api/ai/export-pdf | 保留 |
| pdf-lib 渲染引擎 | 保留 |
| Supabase Storage 缓存 | 保留 |

**理由**：PDF 导出是 VI 手册交付的核心出口。已修复的 500 错误、Supabase Service Key 依赖移除都已验证。无论生成层是 Layout Engine 还是 Manus，PDF 导出链路不变。

### 1.6 Billing 系统

| 模块 | 状态 |
|------|------|
| 余额管理（balance.ts） | 保留 |
| 消费记录（usage-log.ts） | 保留 |
| 费用预估（cost-estimator.ts） | 保留 |
| API 查询（/api/billing/*） | 保留 |

**理由**：Billing 系统是纯本地逻辑（JSON 文件存储），不依赖任何外部服务。数据模型（AccountBalance / UsageLog / CostEstimate）设计合理，可继续使用。未来如果需要对接支付，改造点最小。

### 1.7 Memory 系统

| 模块 | 状态 |
|------|------|
| ClientMemory 数据结构 | 保留 |
| ProjectMemory 数据结构 | 保留 |
| IndustryMemory 数据结构 | 保留 |
| JsonMemoryAdapter | 保留（开发环境） |
| SupabaseMemoryAdapter | 保留（生产环境） |
| 适配器工厂（getMemoryAdapter） | 保留 |

**理由**：Memory 系统是整个 Brand Brain 的知识持久化层。ClientMemory 在 Brand Interview 场景下尤为重要——系统需要记住客户历史访谈记录，避免重复提问。IndustryMemory 未来可作为 Knowledge Hub 的本地数据源。

### 1.8 IP Image Provider 框架

| 模块 | 状态 |
|------|------|
| WanxiangProvider | 保留 |
| MidjourneyProvider（占位） | 保留 |
| FluxProvider（占位） | 保留 |
| MockProvider | 保留 |
| Provider 抽象接口 | 保留 |

**理由**：Provider 模式（接口+多实现）是正确的抽象。虽然当前生成流程可能交由 Manus 执行，但 Brand Brain 自身仍然需要小规模图片生成能力（如 Interview 阶段的视觉参考、分析报告配图）。

---

## 二、冻结模块

以下模块当前保留代码但不继续开发。冻结原因：架构假设已变更。

### 2.1 当前 VI 生成流程

| 模块 | 冻结原因 |
|------|---------|
| POST /api/ai/generate-manual | 该流程假设 Brand Brain 自己生成 VI 手册。新架构下生成交由 Manus 执行。 |
| POST /api/ai/generate-manual-pages | 同上。DeepSeek 生成手册 JSON → 通义万相画图 → pdf-lib 合成 PDF 的链路需要重新评估。 |
| POST /api/ai/generate-manual-pages-stream | 流式进度推送在 Manus 执行模式下不适用。 |
| POST /api/ai/generate-image | 图片生成由 Manus 或下游 Provider 负责。 |
| POST /api/ai/save-manual | 保存逻辑依赖当前 JSON 结构，新架构下 brief 格式不同。 |
| POST /api/ai/save-plans | 同上。 |
| POST /api/ai/plan-layout | Layout Engine 待重新设计。 |
| POST /api/ai/reprocess-image | 依赖当前生成流程。 |
| 前端：/admin/projects/[id]/generate | 生成页面逻辑需要按新架构重写。 |

### 2.2 当前 Agent Pipeline

| Agent | 冻结原因 |
|-------|---------|
| Orchestrator 完整流水线（6 个 agent 串联） | 当前 pipeline 设计为"提交→全自动生成"。新架构改为"访谈→Brief→Manus"。pipeline 需要重新设计。 |
| manual-composer agent | 负责调用通义万相生成图片，新架构下不适用。 |
| brand-planner agent（作为生成 pipeline 的一部分） | module-planning 逻辑有价值的，但执行时机和输出格式需要调整。 |
| mascot-designer agent（作为生成 pipeline 的一部分） | 逻辑有价值（判断是否需要 IP），但应该在 Interview 阶段引用，而非生成阶段。 |

**注意**：冻结不等于删除。这些代码是经过验证的逻辑，未来改造时可以参考甚至复用。

### 2.3 当前 Prompt 体系

| 模块 | 冻结原因 |
|------|---------|
| generate-manual 的 DeepSeek prompt | 该 prompt 设计为直接生成 VI 手册 JSON。新架构下 prompt 应设计为生成 Brand Brief。 |
| mascot-prompt-strategy.ts | 逻辑有价值，但调用时机不对。应在 Discovery 阶段使用。 |

### 2.4 Layout Engine V1

| 模块 | 冻结原因 |
|------|---------|
| ai-layout-planner.ts | 设计的 AI 动态布局在当前模板系统之上，但 VI 生成流程已变更。 |
| page-planner.ts | 同上。 |
| module-to-page.ts | 同上。 |
| render-blueprint.ts | 同上。 |

---

## 三、废弃模块

以下代码和文件应安排清理。不保留。

### 3.1 根目录临时调试脚本

约 80+ 个 `_fix*.py`、`_check*.py`、`_fix*.js`、`_gen*.py` 等临时文件。

包括但不限于：
- `_fix_chinese.py`（已修复的中文字体问题）
- `_fix_cover.py` / `_fix_cover_live.py`（已修复的封面问题）
- `_fix_pdf_button.py`（已修复的 PDF 导出问题）
- `_fix_route*.py` 系列
- `_check*.py` 调试脚本
- `_gen_flower.py` / `_gen_pdf.py`（一次性工具）

**清理方式**：全部删除。历史记录在 git 中可回溯。

### 3.2 _bridge 目录

`_bridge/` 是之前 Codex 的交接产物，包括：
- `_bridge/to-codex/`（旧交接文档）
- `_bridge/to-chatgpt/`（给 ChatGPT 的旧交付件）
- `_bridge/handover/` 等

**清理方式**：在新架构稳定前可保留，后续删除。

### 3.3 _patch_temp 目录

`_patch_temp/` 是之前的补丁暂存区，代码已被当前版本覆盖。

**清理方式**：删除。

### 3.4 旧的规划文档

以下文件内容已被新路线取代：

| 文件 | 取代者 |
|------|--------|
| `PRODUCT-PLAN.md` | 新路线规划 |
| `PROGRESS.md` | 已过期 |
| `TASK_PLAN.md` | 已过期 |
| `TASK_SPLIT.md` | 已过期 |
| `PROJECT_CONTEXT.md` | 已过期 |
| `agents.md` | 新 Agent 架构 |

**清理方式**：可归档到 `docs/archived/` 子目录，便于历史回溯。

### 3.5 部分 mock 数据

`public/mock/` 中的部分静态 mock 文件（如 `mock/manual/` 下的占位图）如果新架构不使用前端模板预览，可清理。

**清理方式**：暂保留，不影响运行。

---

## 四、可改造模块

以下模块可以改造，适配 Brand Brain + Manus 架构。

### 4.1 Brand Analyzer → Brand Discovery Core

| 现有能力 | 改造方向 |
|---------|---------|
| analyzeBrand() 函数 | 核心分析引擎保留。将输入源从"表单提交"改为"Interview 结构数据"。 |
| BrandProfile 数据结构 | 保留并扩展。BrandType、BrandPersona、BrandArchetype、BrandVoice 这些维度在新架构下仍然需要。 |
| brand-dictionary.ts | 保留。作为 Knowledge Hub 的本地词典引擎，Interview 阶段可用于实时关键词识别。 |

**改造成本**：低。核心逻辑不变，接口适配即可。

### 4.2 Industry Knowledge → Knowledge Hub

| 现有能力 | 改造方向 |
|---------|---------|
| industry-knowledge.ts | IndustryProfile 数据结构保留。扩展为 Knowledge Hub 的核心数据层。 |
| 行业设计特征 / 色系倾向 / 字体系列 | 保留。Interview 阶段可用于引导 AI 提出更有行业针对性的问题。 |

**改造成本**：低。数据结构不变，扩展查询接口。

### 4.3 Module Planner → Chapter Engine 基础

| 现有能力 | 改造方向 |
|---------|---------|
| planModules() 函数 | RecommendedModule 数据模型（id / label / priority / score / estimatedPages）设计合理。在未来 Chapter Engine 中可作为模块推荐逻辑的基础。 |
| manual-packages.ts | PackageRecommendation 逻辑保留。Interview 完成后可以根据 Brand Brief 推荐合适的 VI 手册套餐。 |

**改造成本**：中。需要增加 Interview 输出到 Module Plan 的映射逻辑。

### 4.4 Asset Guardian → Brand Asset Protection

| 现有能力 | 改造方向 |
|---------|---------|
| extractProtectedAssets() | 保留。Interview 阶段识别客户已有品牌资产（Logo / IP）。 |
| 资产保护策略 | 保留。后续生成阶段（无论是 Manus 还是自研生成）都需要此能力。 |

**改造成本**：低。纯逻辑模块，无需改动。

### 4.5 Consultation Schema → Brand Brief Schema

| 现有能力 | 改造方向 |
|---------|---------|
| consultation-schema.ts | Zod schema 保留作为参考。Brand Brief 的输出格式可以在此基础上扩展。 |

**改造成本**：低。

### 4.6 Memory System → 知识持久化

| 现有能力 | 改造方向 |
|---------|---------|
| ClientMemory | Interview 场景核心——系统需要记住客户。 |
| IndustryMemory | Interview 阶段参考。 |
| ProjectMemory | Interview 结果存储。 |

**改造成本**：低。数据结构基本适配。

---

## 五、总结

| 分类 | 模块数 | 工作量评估 |
|------|--------|-----------|
| 保留 | ~12 个大模块 | 无需开发，仅维护 |
| 冻结 | ~10 个模块 | 代码保留，停止开发 |
| 废弃 | ~100+ 个文件 | 可清理，非阻塞 |
| 改造 | ~6 个模块 | 低到中成本 |

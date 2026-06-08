# Brand Brain — 项目总架构评审汇报

> 提交对象：ChatGPT（项目总监 / 品牌总监 / 系统架构师）
> 提交时间：2026-06-01
> 当前状态：PRODUCTION VERIFIED — Lead Capture PASS

---

## 一、项目现状总览

| 项目 | 值 |
|------|-----|
| **项目名称** | Brand Brain AI品牌资产生成平台 |
| **当前 Git 分支** | `master` |
| **最新 commit** | `1aad52d` — fix: use anon key supabase instead of supabaseAdmin in list-generated route |
| **Production 部署** | Vercel Production — `vi-ai-logo-ip-mock.vercel.app` |
| **Production 已验证** | Lead Capture PASS（项目 VI-20260531-16C4 成功提交） |
| **当前阶段** | Brand Brain v1.0 CLOSED → COMMERCIAL-VALIDATION-001 ACTIVE |
| **技术栈** | Next.js 15.5.18 / TypeScript / Supabase / DeepSeek / 通义万相 / Sharp / pdf-lib |
| **Node 版本** | 22.14.0 LTS |

### 已关闭的 Production Smoke

| Issue | 状态 |
|-------|------|
| PROD-SMOKE-001 EROFS (/api/upload) | ✅ CLOSED |
| PROD-SMOKE-002 413 Payload Too Large | ✅ CLOSED |
| PROD-SMOKE-003 Supabase Storage RLS | ✅ CLOSED |
| PROD-SMOKE-004 EROFS (/api/submit) | ✅ CLOSED |

---

## 二、系统架构图

### 用户端

```
访客
  ↓
ConsultationForm.tsx（上传 Logo + IP + 参考 PDF）
  ↓ 浏览器直接上传到
Supabase Storage（brand-brain-generated bucket）
  ↓
/api/submit（存储提交信息 → Supabase 表）
  ↓
项目进入后台
```

### 管理端 — VI 手册生成

```
/admin/projects → 项目列表
  ↓
/admin/projects/[id] → 项目详情（参考 PDF 上传 / 分析 / 历史记录）
  ↓ 点击「AI 生成手册页面」
/admin/manual-pages/[projectId] → 完整生成流程
  ↓
Step 1: Brand Analyzer（/api/brand/analyze）
  ↓ DeepSeek
品牌类型 / 行业 / 视觉方向 / 色彩体系 / IP 策略
  ↓
Step 2: Business Profile（前端本地）
业务阶段 / 目标 / 预算
  ↓
Step 3: IP Strategy（前端本地）
generateMascotPromptSet() — IP 角色设定 / 风格 / 延展策略
  ↓
Step 4: Module Planner（前端本地）
planModules() — 推荐 VI 套餐模块
  ↓
Step 5: 确认生成（前端展示余额 & 费用估算）
  ↓ 点击「确认生成」
/api/ai/generate-manual-pages-stream
  ↓
生成流程（Vercel Serverless Function）:
  for each page (11 pages):
    1. DeepSeek → 生成页面背景描述提示词
    2. 通义万相 → 根据提示词生成背景图（可选）
    3. assemblePage() → 合成 SVG（布局 + Logo + 文字 + 背景）
    4. Sharp → SVG 渲染为 PNG
    5. 上传 PNG 到 Supabase Storage
  ↓
vi_manuals 表写入（pages[] + generated_at）
  ↓
PDF 导出（/api/ai/export-pdf）:
    pdf-lib → 读取 PNG → 合成 PDF → 上传 Supabase Storage
  ↓
用户预览 / 下载 PDF
```

### 核心数据流

```
Supabase DB:
  submissions → 客户提交信息
  projects → 项目记录
  vi_manuals → 已生成手册（pages[], pdf_url）
  memory_clients → 客户记忆
  memory_industries → 行业知识
  memory_projects → 项目分析历史

Supabase Storage:
  brand-brain-generated/uploads/form-assets/ → 上传素材
  brand-brain-generated/{projectId}/ → 生成页面 PNG
  brand-brain-generated/manuals/ → PDF 文件
```

---

## 三、核心模块清单

### 模块一：品牌分析 (Brand Analyzer)

| 属性 | 值 |
|------|-----|
| **作用** | 分析客户资料，输出品牌类型、行业、视觉方向、色彩体系、IP 策略 |
| **位置** | `src/lib/brand-analyzer.ts` + `/api/brand/analyze` |
| **调用 AI** | DeepSeek（文本分析，无图像生成） |
| **完成度** | 90% |
| **是否稳定** | 稳定 |
| **是否保留** | **保留** — 核心差异化能力 |

### 模块二：商业信息 (Business Profile)

| 属性 | 值 |
|------|-----|
| **作用** | 前端表单：业务阶段 / 目标 / 预算选择 |
| **位置** | 前端 `manual-pages/[projectId]/page.tsx` |
| **调用 AI** | 无 |
| **完成度** | 100% |
| **是否稳定** | 稳定 |
| **是否保留** | **保留** |

### 模块三：IP 策略 (Mascot Strategy)

| 属性 | 值 |
|------|-----|
| **作用** | 根据品牌分析结果判断是否需要 IP / IP 角色设定 |
| **位置** | `src/lib/mascot-prompt-strategy.ts` |
| **调用 AI** | 无（纯逻辑判断） |
| **完成度** | 80% |
| **是否稳定** | 稳定（已修复 null guard） |
| **是否保留** | **保留** |

### 模块四：模块规划 (Module Planner)

| 属性 | 值 |
|------|-----|
| **作用** | 根据品牌和商业信息推荐 VI 套餐模块 |
| **位置** | `src/lib/module-planner.ts` + `src/lib/module-to-page.ts` |
| **调用 AI** | 无（规则引擎） |
| **完成度** | 85% |
| **是否稳定** | 稳定 |
| **是否保留** | **保留但需增强** |

### 模块五：页面生成器 (Page Generator / VI 手册核心)

| 属性 | 值 |
|------|-----|
| **作用** | 生成 VI 手册 11 页 PNG |
| **位置** | `/api/ai/generate-manual-pages-stream` + `src/lib/render-blueprint.ts` |
| **调用 AI** | DeepSeek（背景描述）+ 通义万相（背景图生成） |
| **完成度** | 70% |
| **是否稳定** | ⚠️ 功能可运行，但质量未达专业水准 |
| **是否保留** | **建议局部重构** |

### 模块六：PDF 导出 (PDF Export)

| 属性 | 值 |
|------|-----|
| **作用** | 将 11 页 PNG 合成为可下载 PDF |
| **位置** | `/api/ai/export-pdf`（使用 pdf-lib） |
| **调用 AI** | 无 |
| **完成度** | 90% |
| **是否稳定** | 稳定 |
| **是否保留** | **保留** |

### 模块七：存储系统 (Supabase Storage & DB)

| 属性 | 值 |
|------|-----|
| **作用** | 文件存储 + 数据持久化 |
| **位置** | `src/lib/supabase.ts` + `src/lib/supabase-service.ts` |
| **调用 AI** | 无 |
| **完成度** | 95% |
| **是否稳定** | 稳定 |
| **是否保留** | **保留** |

### 模块八：内存系统 (Memory System)

| 属性 | 值 |
|------|-----|
| **作用** | 客户记忆 / 行业知识 / 项目历史 |
| **位置** | `src/lib/memory/`（Supabase Adapter + JSON Adapter） |
| **调用 AI** | 无 |
| **完成度** | 60%（Schema 已建，写入逻辑完成，读取优化未全部实现） |
| **是否稳定** | 基本稳定 |
| **是否保留** | **保留** |

### 模块九：质量评分 (Quality Score)

| 属性 | 值 |
|------|-----|
| **作用** | 生成质量评估 + 资产保护检查 |
| **位置** | `src/lib/manual-quality-score.ts` + `src/lib/asset-guardian.ts` |
| **调用 AI** | 无 |
| **完成度** | 50%（Logging Only 阶段） |
| **是否稳定** | 未全面启用 |
| **是否保留** | **保留** |

### 模块十：计费系统 (Billing)

| 属性 | 值 |
|------|-----|
| **作用** | 显示 DeepSeek / 通义万相余额 + 费用估算 |
| **位置** | `src/lib/billing/` + `/api/billing/dashscope-balance` + `/api/billing/deepseek-balance` |
| **调用 AI** | 无 |
| **完成度** | 85% |
| **是否稳定** | 稳定 |
| **是否保留** | **保留** |

---

## 四、数据库结构

### Supabase 主要数据表

#### submissions（客户提交信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 提交 ID |
| company_name | TEXT | 公司名称 |
| client_name | TEXT | 联系人 |
| phone | TEXT | 电话 |
| industry | TEXT | 行业 |
| logo_assets | JSONB | Logo 上传文件 URL 数组 |
| mascot_assets | JSONB | IP 上传文件 URL 数组 |
| reference_files | JSONB | 参考 PDF URL |
| brand_colors | JSONB | 品牌色彩信息 |
| status | TEXT | 状态 |
| created_at | TIMESTAMPTZ | 创建时间 |

**当前问题：** 字段结构基本稳定，无重大问题。

#### projects（项目记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 项目 ID（如 VI-20260528-NDKW） |
| submission_id | TEXT FK | 关联提交 |
| status | TEXT | 项目状态 |
| timeline | JSONB | 时间线记录 |
| created_at | TIMESTAMPTZ | 创建时间 |

**当前问题：** 无重大问题。

#### vi_manuals（已生成手册）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 记录 ID |
| project_id | TEXT | 项目 ID |
| pages | JSONB | 页面数组 [{pageId, label, url}] |
| generated_at | TIMESTAMPTZ | 生成时间 |
| pdf_url | TEXT | PDF 下载 URL |

**当前问题：** 无重大问题。

#### 内存系统表（memory_clients / memory_industries / memory_projects）

这些表已建 Schema，Supabase Adapter 已实现写入。当前处于"写入但不主动查询"阶段。

---

## 五、AI 调用链

### DeepSeek

| 属性 | 值 |
|------|-----|
| **调用位置** | `/api/brand/analyze` + `/api/ai/generate-manual-pages-stream` |
| **用途** | 品牌文本分析 + 页面背景描述生成 |
| **模型** | `deepseek-chat` |
| **输入** | 品牌资料 + 行业知识 prompt |
| **输出** | 结构化品牌分析 JSON / 背景描述文本 |
| **耗时** | 品牌分析 ~10-15s / 背景描述 ~3-5s |
| **费用** | 极低（文本 token） |
| **成功率** | >95% |
| **API Key** | `DEEPSEEK_API_KEY`（Vercel 环境变量） |

### 通义万相 (DashScope / Tongyi Wanxiang)

| 属性 | 值 |
|------|-----|
| **调用位置** | `/api/ai/generate-manual-pages-stream` |
| **用途** | 背景图生成（无文字无 Logo） |
| **模型** | 通义万相（图像生成） |
| **输入** | DeepSeek 生成的中文背景描述 |
| **输出** | PNG 图像（异步任务，轮询结果） |
| **耗时** | ~15-30s 每张图 |
| **费用** | ¥0.08~0.16/张（依赖尺寸） |
| **成功率** | ~85%（偶发超时） |
| **API Key** | `ALIYUN_API_KEY`（Vercel 环境变量） |

### 页面渲染 (Sharp)

| 属性 | 值 |
|------|-----|
| **位置** | `assemblePage()` 函数 |
| **流程** | 布局模板 → 填充内容（Logo / 标题 / 正文） → 合成 SVG → Sharp 渲染 PNG |
| **耗时** | ~1-2s 每页 |
| **问题** | SVG 中 font-family 指定中文时触发 Fontconfig 超时（已用 sans-serif 绕过） |

---

## 六、VI 手册生成系统（完整流程）

### Step 1: 品牌分析（/api/brand/analyze）

```
输入: 客户提交资料（公司名、行业、描述、Logo、IP）
调用: DeepSeek
输出: {
  brandType,          // 品牌类型
  industryProfile,    // 行业画像
  visualDirection,    // 视觉方向
  colorSystem,        // 色彩体系
  typographyDirection,// 字体方向
  mascotProfile,      // IP 策略（可选）
  confidence          // 置信度
}
状态: ✅ 稳定，Quality Score 90
```

### Step 2: 商业信息（前端本地）

```
输入: 客户选择
  - 业务阶段（初创 / 成长 / 连锁 / 企业级）
  - 主要目标（品牌基础 / 包装 / 加盟 / 营销）
  - 预算范围（轻量 12-18页 / 标准 18-30页 / 高级 30-50页）
输出: businessProfile object
状态: ✅ 稳定
```

### Step 3: IP 策略（前端本地 — generateMascotPromptSet）

```
输入: brandAnalysis.mascotProfile
逻辑:
  - 如果 mascotProfile 不存在 → 标记为 not_needed
  - 如果存在 → 生成角色设定 / 视觉风格 / 延展策略 / 使用场景
输出: MascotPromptSet { mode, strategyPrompt, imagePrompt, ... }
状态: ✅ 已修复，不再崩溃
```

### Step 4: 模块推荐（前端本地 — planModules + modulePlanToPages）

```
输入: BrandProfile + BusinessProfile
逻辑: 规则引擎，根据行业/预算推荐 ModulePlan
输出: 11 页的 PageGenerationPlan
  - cover（封面）
  - brand-philosophy（品牌核心理念）
  - logo-interpretation（标识诠释）
  - brand-colors（标准色彩规范）
  - typography（字体系统）
  - basic-spec（基础规范）
  - stationery（办公应用系统）
  - packaging（产品包装系统）
  - marketing（营销展示系统）
  - summary（总结）
  - closing（感谢观看）
状态: ✅ 稳定
```

### Step 5: 确认生成

```
显示:
  - DeepSeek 余额 / 通义万相余额
  - 本次费用估算
  - 生成计划摘要
操作: 用户点击确认 → 调用 /api/ai/generate-manual-pages-stream
状态: ✅ 功能正常
```

### 生成管线

```
/api/ai/generate-manual-pages-stream (SSE Stream)
  for each page (11 pages):
    1. DeepSeek call → 根据页面类型 + 品牌信息生成中文背景描述
    2. 通义万相 call → 根据描述生成背景 PNG（异步任务，轮询）
    3. 从 Supabase Storage 获取 Logo / IP 图片
    4. assemblePage() → 合成 SVG:
       - 使用预定义页面模板（render-blueprint.ts）
       - 插入 Logo 图片
       - 插入背景图片
       - 插入标题/正文文本
       - 设置 font-family: sans-serif
    5. Sharp → SVG 渲染为 PNG
    6. 上传 PNG 到 Supabase Storage（brand-brain-generated/{projectId}/）
    7. SSE 推送进度
  完成后:
    - 写入 vi_manuals 表（pages array + generated_at）
    - 前端更新 Viewer

PDF 导出:
  /api/ai/export-pdf
  1. 从 vi_manuals 读取 pages[] 的 URL
  2. fetch 每个 PNG
  3. pdf-lib 嵌入图片到 PDF 页面
  4. 上传 PDF 到 Supabase Storage（brand-brain-generated/manuals/）
  5. 更新 vi_manuals.pdf_url
  6. 返回 download URL
```

---

## 七、当前已知问题

### P0 — 紧急

| 问题 | 状态 |
|------|------|
| 暂无 P0 级别的阻断性 Bug | ✅ Lead Capture 已通过 |

### P1 — 高优先级

| 问题 | 影响 | 状态 |
|------|------|------|
| **中文字体缺失** | 页面 P5（字体系统）文字显示为方块。已用 sans-serif 绕过，但视觉质量差 | 已绕过，未修复 |
| **页面排版僵硬** | 11 页使用固定模板，布局单一，无设计师级排版 | 架构限制 |
| **生成页面同质化严重** | 不同品牌生成的页面视觉风格区分度低 | 架构限制 |
| **通义万相背景图可用性不稳定** | 偶发超时或失败，当前未做 fallback | 需增强 |

### P2 — 中优先级

| 问题 | 影响 |
|------|------|
| **缺少参考 VI 手册时降级处理** | 已修复，但 Dashboard 页面仍有 404 警告 |
| **Memory 系统读取未充分利用** | 数据已写入但查询逻辑未全部实现 |
| **Quality Score 仅 logging** | 未真正阻止低质量输出 |
| **SSE 连接可靠性** | 长时间生成可能断连 |
| **后台管理页面状态恢复** | 已修复，但仍有少数边界情况 |

### P3 — 低优先级

| 问题 | 影响 |
|------|------|
| `/favicon.ico` 404 | Console 错误但无功能影响 |
| 页面未做 SEO | 管理后台，非必需 |
| 无移动端适配 | 管理后台，非必需 |
| 无用户鉴权系统 | 当前用 ADMIN_PASSWORD 简单保护 |

---

## 八、哪些模块最需要重构

### 1. VI 页面生成器（最高优先级）

**当前状态：** 模板拼接模式。`render-blueprint.ts` 中定义了固定布局模板，assemblePage 函数将品牌素材填充进模板，Sharp 渲染为 PNG。

**问题：**
- 模板数量有限（~5-6 种布局）
- 所有品牌用同一套模板，缺乏差异化
- 文字排版依赖 SVG text 元素，字体支持差
- 中文字体在 Vercel 环境无法正常加载
- 生成的页面"看起来像 AI 做的"——缺乏专业设计感

**建议重构方向：**
- 引入更多布局变体（至少每页类型 2-3 种）
- 增加设计规则引擎（根据品牌行业/风格自动选择布局）
- 字体问题需要内置 Noto Sans SC / 思源黑体
- 考虑使用 HTML/CSS 渲染方案替代 SVG + Sharp（更灵活的排版）

### 2. 品牌分析提示词质量（中等优先级）

**当前状态：** DeepSeek 调用能输出结构化分析，但分析深度和专业性有提升空间。提示词基于教师课件提炼，但尚未达到资深品牌顾问水平。

**建议方向：**
- 丰富行业知识库（memory_industries 表已有 Schema 但内容不完整）
- 增加更多品牌案例参考
- 引入多轮分析（先粗分析，再深度追问）

### 3. Memory 系统读取利用（低优先级）

**当前状态：** 写入路径完整，但读取路径只在少数场景使用。

**建议方向：**
- 在品牌分析时先查 memory_clients 历史记录
- 在模块推荐时参考 memory_industries 最佳实践
- 在质量评分时对比历史项目数据

---

## 九、哪些模块绝对不要动（Freeze Zone）

| 模块 | 原因 |
|------|------|
| **Supabase 存储系统** | 已验证稳定，Lead Capture 已打通 |
| **Supabase 数据库表结构** | submissions / projects / vi_manuals 表结构已验证 |
| **Billing 系统** | 余额显示 + 费用估算已验证稳定 |
| **Lead Capture 表单** | 上传→提交→入库链路已打通 |
| **管理员登录（ADMIN_PASSWORD）** | 简单但够用 |
| **Asset Guardian** | 品牌资产保护逻辑已设计好，需要但不紧急 |
| **项目 / 提交 API** | /api/submit 已验证稳定 |

---

## 十、如果从零重新设计

### 保留

| 模块 | 理由 |
|------|------|
| Lead Capture 表单 | 已验证，用户体验可接受 |
| Supabase 存储 + DB | 架构选择合理 |
| Brand Analyzer 品牌分析 | 核心差异化能力，方向正确 |
| 五步决策流程（Step 1-5） | 产品逻辑正确，先判断再生成 |
| Memory 系统 Schema | 数据模型设计合理 |
| Billing 系统 | 余额展示 + 费用估算设计合理 |

### 重写

| 模块 | 理由 |
|------|------|
| **VI 页面生成器** | 模板拼接模式无法达到专业水准，需要重新设计布局引擎 |
| **页面渲染方案** | SVG + Sharp 在字体和排版灵活性上受限，考虑 HTML/CSS → Puppeteer/Playwright 渲染 |
| **Font 处理** | 当前无中文字体方案，需要内置或使用浏览器级字体渲染 |

### 新增

| 模块 | 理由 |
|------|------|
| **布局设计引擎** | 品牌风格驱动的自适应布局系统，而非固定模板 |
| **AI 排版助手** | 基于品牌分析的自动排版建议 |
| **多版本生成 + A/B 比较** | 每次生成多版，用户选择 |
| **客户反馈回路** | 将客户修改意见反馈到生成模型 |

### 不改的方向

- 架构从"Next.js 全栈"改为"微服务"——当前阶段不需要
- 替换 DeepSeek 或通义万相——当前模型够用
- 引入实时协作——当前阶段不需要

---

## 十一、接入 Manus 的建议

### 推荐位置：C — 内容生成层

**具体接入点：** `/api/ai/generate-manual-pages-stream` 中的背景描述生成 + 页面内容生成阶段。

**理由：**

| 位置 | 评估 |
|------|------|
| A — 品牌分析层 | ❌ 品牌分析需要高度专业+可控，当前 DeepSeek 已够用 |
| B — 行业研究层 | ❌ 行业知识应来自 Memory 系统沉淀，而非外部 Agent |
| **C — 内容生成层** | **✅ 最佳接入点** — Manus 的长文本生成 + 多步骤推理能力可以提升 VI 内容质量 |
| D — 页面排版层 | ❌ 排版是规则+设计系统问题，不是 AI Agent 问题 |
| E — 全部 | ❌ 过度耦合，风险高 |

**具体方案：**

```
当前:
  DeepSeek → 页面背景描述
  ↓
  通义万相 → 背景图
  ↓
  模板 → SVG → PNG

接入 Manus 后:
  DeepSeek → 品牌分析
  Manus → 页面内容生成（文案/描述/故事）
  ↓
  通义万相 → 背景图
  ↓
  布局引擎（重构后）→ HTML/CSS → PDF
```

**Manus 在内容生成层的优势：**

1. 多轮推理能生成更有深度的品牌文案
2. 可以结合品牌分析结果做定制化内容
3. 长上下文窗口适合整本手册的内容规划
4. 比直接 prompt DeepSeek 更灵活可控

---

## 十二、最终结论

### 选择：B — 局部重构

### 理由

**不支持 A（继续现有架构迭代）：**
- VI 页面生成器的质量问题不会随迭代改善
- 模板拼接模式有上限，不是调 prompt 能解决的

**不支持 C（大规模重构）：**
- Lead Capture 链路已验证通过
- 核心模块（品牌分析、存储、计费）稳定
- 商业验证阶段不应大规模改动已稳定部分

**不支持 D（推倒重来）：**
- 项目已通过 Production 验证
- 真实客户已可以提交需求
- 没有必要重来

### 建议的执行顺序

```
Phase 1 (当前 — 商业验证期):
  修复 P1 问题（字体、排版、背景图稳定性）
  Freeze Zone 不动
  收集真实客户反馈

Phase 2 (0-1 个月):
  重构 VI 页面生成器
  └ 引入 HTML/CSS 渲染方案
  └ 内置中文字体
  └ 增加布局变体
  接入 Manus 到内容生成层
  └ Manus 负责页面文案 + 描述生成
  └ 通义万相仍负责背景图
  完善 Memory 系统读取

Phase 3 (1-3 个月):
  增强品牌分析提示词
  启动 Quality Score 全面生效
  客户反馈回路
```

### 总体评估

Brand Brain 的**架构方向正确**——先分析判断再生成、五步决策流程、Memory 系统、Asset Guardian，这些都是 AI 品牌顾问系统的正确设计选择。

当前最弱的一环是 **VI 手册的视觉呈现质量**。这来自于模板拼接模式的上限，不是架构缺陷。只要把页面生成器从"模板填充"升级为"智能布局引擎"，整体系统就可以达到商用水平。

当前最不该做的事：**动 Freeze Zone**、**推倒重来**、**大规模架构变更**。

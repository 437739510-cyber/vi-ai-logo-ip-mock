# Brand Brain — 项目状态报告

> 提交对象：ChatGPT（创始人合伙人 + 产品总监 + 首席架构师）
> 提交者：Codex（CTO）
> 日期：2026-06-01
> 说明：客观描述当前真实系统状态，不做理想化假设

---

## 第一部分：当前真实系统状态

### 已上线可用（Production 验证通过）

| 功能 | 说明 | 验证方式 |
|------|------|---------|
| **Lead Capture** | 访客上传素材 → 提交表单 → 入库 | 真实提交 VI-20260531-16C4 成功 |
| **Supabase 文件上传** | 浏览器直传 Supabase Storage，绕过 Vercel 4.5MB 限制 | 8MB Logo 上传通过 |
| **品牌分析** | /api/brand/analyze → DeepSeek 输出结构化分析 | 多次测试 200，Quality Score 90 |
| **商业信息/模块推荐** | 前端本地 Step 2/4，纯规则引擎 | 稳定 |
| **IP 策略** | 前端 generateMascotPromptSet | 已修复 null guard，稳定 |
| **后台管理** | 项目列表/详情/删除 | 稳定 |
| **Billing 余额显示** | DeepSeek ¥54.71 / 通义万相 ¥153.84 | 稳定 |
| **11 页 VI 手册生成** | 通义万相背景图 + SVG 合成 + Sharp PNG 渲染 | 已生成 11 页成功 |
| **PDF 导出** | pdf-lib 合成 + Supabase Storage 上传 | 已修复，待生产验证 |

### 已开发未验证

| 功能 | 说明 | 原因 |
|------|------|------|
| **Memory 系统写入** | memory_clients / memory_projects 写入路径代码完成 | 未在生产场景下验证读取 |
| **Quality Score** | manual-quality-score.ts 已实现 | 当前为 logging only，未实际拦截低质量输出 |
| **Asset Guardian** | asset-guardian.ts 已实现 | 逻辑正确但未强制生效 |
| **PDF 导出修复** | commit 3972091 | 刚推送，Vercel 部署中，未生产验证 |
| **项目管理编辑** | 删除项目 | 已实现但未全面测试 |

### 设计阶段

| 功能 | 说明 |
|------|------|
| **Layout Engine V1** | 设计文档已完成（10 项规则 + 5 种布局模式） |
| **Layout Engine V1.1** | 四引擎设计已完成（Brand DNA / Industry / Brand Level / Chapter） |
| **Brand Interview Engine** | 未开始 |
| **知识中台** | Schema 已建（memory_industries），内容未填充 |
| **Pattern Library 扩展** | 当前仅 11 页模板，未扩展到 20 页 |

---

## 第二部分：核心模块完成度

| 模块 | 完成度 | 理由 |
|------|--------|------|
| **Brand Interview Engine** | **0%** | 未开始。当前靠 ConsultationForm 收集信息，不是 Interview |
| **Brand DNA Engine** | **0%** | 未开始。设计文档已出，代码一行没写 |
| **Industry Engine** | **5%** | Schema（memory_industries）已建，但内容为空，无推理逻辑 |
| **Brand Maturity Engine** | **0%** | 未开始。设计文档已出 |
| **Asset Completeness Engine** | **0%** | 未开始。当前靠人工判断素材是否完整 |
| **Chapter Engine** | **0%** | 未开始。当前 11 页是平铺结构，没有章节概念 |
| **Layout Engine** | **20%** | 设计文档完成。当前实际用的是旧模板拼接（render-blueprint.ts），不是真正的 Layout Engine |
| **Pattern Library** | **30%** | 现有 5 种布局模式设计完成，但实际代码中只有约 5-6 种固定模板 |
| **Knowledge Hub** | **10%** | 教师课件已提炼为 6 份知识文档，但未整合进系统。memory_industries 表已建但未填充 |

**硬事实：** 当前生产环境下真正在跑的引擎只有一个——**模板拼接引擎**（assemblePage + Sharp）。所有新引擎（Brand DNA、Industry、Chapter 等）目前都只停留在设计文档阶段。

---

## 第三部分：当前真实架构

以下是当前实际运行的调用链，不含任何规划中内容：

```
用户（浏览器）
  ↓
ConsultationForm.tsx — 上传 Logo / IP / 参考 PDF（直传 Supabase Storage）
  ↓
/api/submit → 写入 submissions 表 + projects 表
  ↓
管理员
  ↓
/admin/projects — 项目列表（读 projects + submissions 表）
  ↓
/admin/projects/[id] — 项目详情（参考 PDF 上传/分析）
  ↓ 点击「AI 生成手册页面」
/admin/manual-pages/[projectId] — 五步生成流程
  ↓
Step 1: /api/brand/analyze → DeepSeek 调用 → 返回结构化分析 JSON
  ↓
Step 2: 前端表单 — 用户选择业务阶段/目标/预算
  ↓
Step 3: 前端 generateMascotPromptSet() — IP 策略判断（纯逻辑，无 AI）
  ↓
Step 4: 前端 planModules() — 模块推荐（规则引擎，无 AI）
  ↓
Step 5: 前端显示余额 + 费用估算 → 用户点击确认
  ↓
/api/ai/generate-manual-pages-stream（SSE Stream）
  for each of 11 pages:
    1. fetch DeepSeek API → 页面背景描述
    2. fetch 通义万相 API → 生成背景图（异步轮询）
    3. 从 Supabase Storage fetch Logo/IP 图片
    4. assemblePage() → 固定模板填充 → SVG 字符串
    5. Sharp → SVG → PNG buffer
    6. 上传 PNG 到 Supabase Storage（brand-brain-generated/{projectId}/）
  ↓
写入 vi_manuals 表（pages[{pageId, label, url}]）
  ↓
前端显示「已生成 11 页，失败 0 页」
  ↓
用户点击「下载 PDF」
  ↓
/api/ai/export-pdf
  1. 从 vi_manuals 读 pages[] URLs
  2. fetch 每张 PNG
  3. pdf-lib 合成 PDF
  4. 上传 Supabase Storage
  5. 返回下载 URL
```

**关键观察：**
- **每一步都是串行的** — 生成 11 页，每页等 DeepSeek → 等通义万相 → 等 Sharp → 上传，没有并行
- **生成的页面不经过任何品牌理解** — 没有 Brand DNA、没有行业适配、没有等级区分
- **当前通义万相生成是可选特性** — 经常超时，没有 fallback 策略

---

## 第四部分：技术债清单

### P1 — 必须修

| 问题 | 说明 |
|------|------|
| **中文字体缺失** | Vercel Linux 环境无中文字体，Sharp 渲染 SVG 时 fontconfig 超时。当前用 `font-family: sans-serif` 绕过，中文显示为方块 |
| **通义万相无 fallback** | 背景图生成超时时，整个页面生成链卡住，没有降级为纯色背景 |
| **生成流程全串行** | 11 页一页一页等，总耗时可能超过 Vercel 10 分钟超时限制（300s 已出现过） |
| **PDF 修复未验收** | 3972091 刚推送，还没在生产环境验证 |

### P2 — 应该修

| 问题 | 说明 |
|------|------|
| **页面模板硬编码** | render-blueprint.ts 中布局固定，增加新布局需要改代码 |
| **supabaseAdmin null 防护未统一** | 部分路由仍可能使用 supabaseAdmin，没有统一 null 处理 |
| **Memory 系统写入但不读取** | 数据写入了 Supabase，但品牌分析时从不查历史记录 |
| **Quality Score 只记录不生效** | 评分跑完了，但低分页面照样输出 |
| **SSE 断连无重试** | generate-manual-pages-stream 用 SSE，连接断了不会自动重连 |

### P3 — 有空再修

| 问题 | 说明 |
|------|------|
| /favicon.ico 404 | Console 报错，无功能影响 |
| 后台管理无用户鉴权 | 目前靠 ADMIN_PASSWORD 简单保护 |
| 部分 API 缺少 TypeScript 类型定义 | any 类型泛滥 |
| Build 有 warnings | LF/CRLF 警告，不影响运行 |

---

## 第五部分：成本分析

### 一次完整生成（11 页）

| 项目 | 成本 | 说明 |
|------|------|------|
| **DeepSeek** | ~¥0.05-0.10 | 每页一次短文本生成（背景描述），约 100-200 tokens/次 |
| **通义万相** | ~¥0.88-1.76 | 每张背景图约 ¥0.08-0.16（按 1024×1024），11 页全部成功时 |
| **Sharp 渲染** | ~¥0 | 本地计算，无 API 费用 |
| **Supabase Storage** | ~¥0 | 免费额度内（1GB 存储 + 每天 10 万请求） |
| **PDF 合成** | ~¥0 | pdf-lib 本地执行 |
| **Vercel 函数执行** | ~¥0 | 免费 Hobby 计划（每月 100h 函数执行时间） |
| **总计（成功）** | **~¥0.93-1.86** | 约 1-2 元人民币 |

### 成本失控风险

| 风险 | 等级 | 说明 |
|------|------|------|
| **通义万相大图生成** | 🟡 中 | 如果生成 A4 全尺寸（2480×3508），成本可能翻 3-5 倍 |
| **DeepSeek 大量调用** | 🟢 低 | 文本生成本身便宜，除非彻底重写每一页文案 |
| **Vercel Pro 费用** | 🟡 中 | 如果流量增长到每月超过 100h 函数执行，需要升级 Pro（$20/月） |
| **Supabase 超出免费额度** | 🟢 低 | 1GB 存储够放数百本手册，10 万请求/天远超当前流量 |
| **多用户并发生成** | 🟡 中 | 并发多次生成时，通义万相配额可能成为瓶颈 |

---

## 第六部分：CTO 建议 — 未来 30 天 3 件事

如果只能做 3 件事：

### 第 1 件事：Brand DNA Engine 实现（优先级 S）

**为什么：**
- 这是所有引擎的入口
- 没有 Brand DNA，Industry Engine、Brand Level Engine、Layout Engine 都缺乏决策依据
- 当前生成没有品牌理解，所有品牌都输出一样的模板风格
- 这是从「模板生成器」到「品牌顾问系统」的分水岭

**怎么做：**
- 实现 12 品牌原型识别（从品牌分析结果中提取 archetype）
- 实现气质标签提取
- 输出 DesignDirection 供 Layout Engine 使用
- 规则引擎 + DeepSeek 辅助，不需要 Manus

### 第 2 件事：修复字体 + 通义万相 fallback（优先级 A）

**为什么：**
- 当前 11 页虽能生成，但中文全是方块，给客户看不了
- 通义万相超时会导致整次生成失败
- 这两个是 P1 阻塞，不修的话客户体验不可接受

**怎么做：**
- 内置 Noto Sans SC（Bold + Regular）字体文件
- 通义万相超时时降级为纯色/渐变背景
- 预计工作量：2-3 天

### 第 3 件事：完善 Pattern Library + 页面扩展到 20 页（优先级 B）

**为什么：**
- 当前 11 页太少，不像一本完整 VI 手册
- 模板不够多，所有品牌看起来一样
- 这是客户能直观感受到的改进

**怎么做：**
- 在 Brand DNA Engine 输出 DesignDirection 的基础上，为每个页面类型增加 2-3 种布局变体
- 按品牌等级（L1-L5）决定页面数量（8→50 页范围）
- 新增 9 页：品牌故事、品牌口号、品牌使命、Logo 制图、Logo 安全空间、Logo 错误使用、IP 基础、IP 表情、IP 场景

### 为什么排除的项目

| 项目 | 为什么不优先 |
|------|------------|
| Brand Interview Engine | 当前 ConsultationForm 够用，Interview 需要完整的对话系统，30 天做不完 |
| Knowledge Hub | 需要持续积累，不是 30 天能见效的 |
| 界面优化 | 核心引擎没做好之前优化界面是贴标签 |
| PDF 体验 | 已可用，后续再打磨 |

---

## 第七部分：最大风险

### 风险 1：产品风险 — 生成质量达不到客户预期

**担心的原因：**
- 当前生成的页面排版僵硬，缺少专业设计感
- 中文字体方块问题让客户第一印象极差
- 客户对比的是人工设计的 VI 手册，不是 AI 生成的模板
- Layout Engine 即使实现后，质量也需要反复调优

**缓解方式：**
- 先从低门槛客户（L1-L2 传统小店/区域品牌）开始验证
- 不要一上来就给大品牌交付
- 主动管理客户预期（"AI 辅助生成，您来确认和调整"）

### 风险 2：架构风险 — 引擎定义过早固化

**担心的原因：**
- 当前 Brand DNA / Industry / Brand Level / Chapter Engine 都是设计阶段
- 一旦开始编码实现，修改成本会快速上升
- 如果四引擎之间的接口定义不合理，后续重构会很痛苦

**缓解方式：**
- V1 实现保持简单规则引擎，不引入复杂 AI 推理
- 接口留出扩展字段
- 先跑通 1-2 个品牌的全流程，再考虑通用化

### 风险 3：资源风险 — 单点依赖

**担心的原因：**
- 通义万相可用性不稳定（已有多次超时记录）
- DeepSeek API 偶尔也会限流
- 如果 CEO 或 ChatGPT 长期不可用，Codex 无法独立决策方向
- 目前项目的全部上下文在两个 AI 的对话历史中

**缓解方式：**
- 项目交接包已经建立（docs/project-handoff/ + CODEX_HANDOFF.md）
- 生成流程增加更多 fallback 策略（通义万相超时 → 纯色背景）
- 核心业务逻辑不依赖单一 AI 模型
- 文档持续更新，降低上下文丢失的风险

---

## 总结

Brand Brain 当前处于一个关键节点：**Lead Capture 已验证通过，但核心品牌理解引擎尚未实现。**

用一句话概括现状：

```
前端能跑了
后端能生了
但生成的还不是品牌顾问该有的质量
```

下一阶段的核心命题不是"加更多功能"，而是**让系统真正理解品牌**——从 Brand DNA Engine 开始。这是从「AI 工具」到「AI 顾问」的唯一路径。

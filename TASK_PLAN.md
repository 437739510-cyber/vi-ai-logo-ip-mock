# 执行计划 (TASK_PLAN)

> 本文件按 AGENTS.md 规则，在执行任何代码改动前输出完整的分步计划。
> 请逐条审阅，确认后我开始执行第一步。

---

## 总览

基于 PRD.md，整个项目拟分 **8 个大 Step** 执行，每个 Step 包含 2–4 个子任务。
预计总改动文件数：~80 个（含初始化和 Mock 资源）。

### 依赖关系

```
Step 1 (脚手架)
  └── Step 2 (基础设施)
        ├── Step 3 (客户端页面)
        │     └── Step 4 (客户端增强)
        └── Step 5 (管理端框架)
              ├── Step 6 (AI 与编辑器)
              └── Step 7 (交付与客户管理)
                    └── Step 8 (集成收尾)
```

---

## Step 1：项目脚手架初始化

**目标**：搭建 Next.js 15 项目，安装所有依赖，配置 TypeScript / Tailwind / ESLint，创建目录结构，配置环境变量模板。

| 子任务 | 说明 |
|---|---|
| 1.1 | `npx create-next-app@latest` 初始化，选 App Router + TypeScript + Tailwind |
| 1.2 | 安装依赖：shadcn/ui、zustand、react-hook-form、zod、react-dropzone、framer-motion、react-colorful、lucide-react |
| 1.3 | 初始化 shadcn/ui（`npx shadcn@latest init`），安装首批组件：Button, Input, Card, Dialog, Sheet, Tabs, Form, Select, Toast |
| 1.4 | 创建目录结构（见 PRD §9.4） |
| 1.5 | 创建 `.env.example`（含 NEXT_PUBLIC_USE_MOCK=true 等占位变量） |
| 1.6 | 创建 `.gitignore`（确保 .env.local 在其中） |
| 1.7 | 配置 `next.config.ts`（图片域名白名单） |

**预计改动文件**：

| 操作 | 文件 |
|---|---|
| 初始化生成 | `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx` |
| 修改 | 上述各配置文件 |
| 新增 | `.env.example`, `.env.local` |
| 新增目录 | `src/components/ui/`, `src/components/client/`, `src/components/admin/`, `src/components/shared/`, `src/lib/mock/`, `src/types/`, `src/hooks/`, `src/app/(client)/`, `src/app/(admin)/`, `public/mock/` |

**验证命令**：

```bash
npm run build    # 确保构建通过
npm run dev      # 启动后访问 localhost:3000 确认页面正常
```

**风险**：

- shadcn/ui 可能依赖特定 Next.js 版本，需确认兼容性
- Tailwind CSS v4 配置方式与 v3 有差异，需确认 create-next-app 生成的版本

---

## Step 2：基础设施 — 类型定义 + Mock 数据 + 共享组件

**目标**：建立全项目共享的类型系统、Mock 数据加载层、通用 UI 组件，为后续页面开发提供基础。

| 子任务 | 说明 |
|---|---|
| 2.1 | 定义 TypeScript 类型：`Submission`, `Project`, `AiPlan`, `ViManual`, `Favorite`, `Employee` 及枚举状态 |
| 2.2 | 创建 Mock 数据文件：`submissions.json`, `projects.json`, `ai-plans.json`, `vi-manuals.json`, `favorites.json`, `employees.json` |
| 2.3 | 创建 Mock 数据加载层：`src/lib/mock/index.ts`（根据 `NEXT_PUBLIC_USE_MOCK` 环境变量切换真实的 Loader） |
| 2.4 | 将 PRD 中定义的 6 个核心 JSON 写入 Mock 文件 |
| 2.5 | 创建共享组件：`FileUpload`（拖拽上传）、`StatusBadge`（项目状态标签）、`EmptyState`（空状态）、`ErrorState`（错误状态） |
| 2.6 | 创建共享布局：`ClientLayout`（客户端布局组件，含导航栏和底部）、`AdminLayout`（管理端布局组件，含侧边栏和顶栏） |
| 2.7 | 创建路由守卫或权限占位：`(client)` 和 `(admin)` 路由组的基础布局 |

**预计改动文件**（约 15 个）：

| 操作 | 文件 |
|---|---|
| 新增 | `src/types/index.ts` |
| 新增 | `src/lib/mock/submissions.json`, `projects.json`, `ai-plans.json`, `vi-manuals.json`, `favorites.json`, `employees.json` |
| 新增 | `src/lib/mock/index.ts` |
| 新增 | `src/components/shared/FileUpload.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `StatusBadge.tsx` |
| 新增 | `src/components/shared/ClientLayout.tsx`, `AdminLayout.tsx` |
| 修改 | `src/app/(client)/layout.tsx`, `src/app/(admin)/layout.tsx` |

**验证命令**：

```bash
npm run build    # TypeScript 类型校验 + 构建通过
```

**风险**：

- Mock JSON 文件结构与 TypeScript 类型需严格对齐，否则运行时报错
- 布局文件冲突（`app/layout.tsx` 与 `(client)/layout.tsx` 层级关系需正确）

---

## Step 3：客户端核心页面

**目标**：实现客户端所有页面，含主页、咨询留资表单、提交确认页、进度查询页。

**先决条件**：建议先提交 Git 变更（Step 2 完成后）。

| 子任务 | 说明 |
|---|---|
| 3.1 | **首页** — Hero 区、服务流程（3步）、案例轮播、服务优势卡片、FAQ、底部 CTA |
| 3.2 | **咨询留资页** — 完整表单（姓名/公司/电话/微信/行业/预算/需求描述） + 文件上传区（Logo / IP / 参考手册） + 表单校验（React Hook Form + Zod） |
| 3.3 | **提交确认页** — 成功标识、项目编号、提交摘要、后续说明 |
| 3.4 | **进度查询页** — 输入项目编号+手机号 → 展示状态节点图 |

**每个页面需覆盖的状态**：加载态（Skeleton）、空态（表单初始/无结果）、错误态（校验失败/查询无结果）、边界情况（超大文件、超长文本）。

**预计改动文件**（约 12 个）：

| 操作 | 文件 |
|---|---|
| 新增 | `src/app/(client)/page.tsx`（首页，替换默认页） |
| 新增 | `src/components/client/HeroSection.tsx`, `ProcessSection.tsx`, `CaseCarousel.tsx`, `AdvantageCards.tsx`, `FaqSection.tsx` |
| 新增 | `src/app/(client)/consultation/page.tsx` |
| 新增 | `src/components/client/ConsultationForm.tsx`, `FileUploadArea.tsx` |
| 新增 | `src/app/(client)/confirm/page.tsx` |
| 新增 | `src/app/(client)/progress/page.tsx` |
| 新增 | `src/components/client/ProgressTimeline.tsx` |

**验证命令**：

```bash
npm run build
npm run dev    # 然后访问：
# http://localhost:3000           (首页)
# http://localhost:3000/consultation  (咨询留资)
# http://localhost:3000/confirm       (确认页，需带参数)
# http://localhost:3000/progress      (进度查询)
```

**风险**：

- 文件上传组件（react-dropzone）需要处理多种文件类型的校验和预览
- 表单项多，Zod schema 定义需严谨
- 确认页需要从 URL 参数或状态管理获取提交数据

---

## Step 4：客户端增强 — 参考手册上传 + 进度查询

**目标**：完善客户端侧参考 VI 手册上传的 UI 细节，实现进度查询的真实数据联动。

| 子任务 | 说明 |
|---|---|
| 4.1 | 参考手册上传 UI 细化：PDF 页数识别、参考模式勾选框样式、上传后摘要展示 |
| 4.2 | 进度查询与 Mock 数据打通：根据项目号+手机号匹配 Mock 数据 |
| 4.3 | 移动端适配：检查客户端所有页面在 375px 视口下的展示效果 |

**预计改动文件**（约 4 个）：

| 操作 | 文件 |
|---|---|
| 修改 | `src/components/client/FileUploadArea.tsx` |
| 修改 | `src/app/(client)/progress/page.tsx` |
| 修改 | `src/components/shared/ClientLayout.tsx`（响应式 nav） |
| 新增 | `src/hooks/useProjectProgress.ts` |

**验证命令**：

```bash
npm run dev    # 移动端模式检查所有页面
```

**风险**：

- 无风险，纯 UI 增强

---

## Step 5：管理端框架 — 工作台 + 项目管理 + 详情

**目标**：搭建管理端核心框架，实现工作台看板、项目列表、项目详情页。

**先决条件**：建议先提交 Git 变更（Step 3 完成后）。

| 子任务 | 说明 |
|---|---|
| 5.1 | **工作台** — 统计卡片（待处理/进行中/本月交付数） + 最近动态列表 |
| 5.2 | **项目列表** — 状态筛选（标签式） + 搜索 + 排序 + 分页 |
| 5.3 | **项目详情** — 展示客户提交全部信息 + 素材预览/下载 + 参考手册预览 + 项目时间线 |

**预计改动文件**（约 10 个）：

| 操作 | 文件 |
|---|---|
| 新增 | `src/app/(admin)/dashboard/page.tsx` |
| 新增 | `src/components/admin/StatCard.tsx`, `RecentActivityList.tsx` |
| 新增 | `src/app/(admin)/projects/page.tsx` |
| 新增 | `src/components/admin/ProjectFilters.tsx`, `ProjectTable.tsx` |
| 新增 | `src/app/(admin)/projects/[id]/page.tsx` |
| 新增 | `src/components/admin/ProjectDetail.tsx`, `AssetPreview.tsx`, `Timeline.tsx` |
| 新增 | `src/app/(admin)/page.tsx`（管理端首页重定向到 dashboard） |

**验证命令**：

```bash
npm run build
npm run dev    # 访问：
# http://localhost:3000/admin/dashboard   (工作台)
# http://localhost:3000/admin/projects    (项目列表)
# http://localhost:3000/admin/projects/PRJ-20260523-0001 (项目详情)
```

**风险**：

- 项目详情页的数据层级深（submission → assets → plans），数据结构需设计清晰
- 分页 + 搜索 + 筛选的组合状态管理需考虑

---

## Step 6：AI 方案生成 + 收藏

**目标**：实现 AI 方案生成页面（含参考模式选择）和收藏功能。

**先决条件**：建议先提交 Git 变更（Step 5 完成后）。

| 子任务 | 说明 |
|---|---|
| 6.1 | **AI 方案生成页** — 生成参数配置面板 + 生成按钮 + 进度动画 + 结果卡片网格 + 对比模式 |
| 6.2 | 参考模式选择器（强参考 / 弱参考 / 不参考） |
| 6.3 | **收藏功能** — 方案卡片星标按钮 + 收藏列表页 + 筛选/搜索 + 批量管理 |
| 6.4 | 收藏数据的 Mock 增删改逻辑 |

**预计改动文件**（约 10 个）：

| 操作 | 文件 |
|---|---|
| 新增 | `src/app/(admin)/projects/[id]/generate/page.tsx` |
| 新增 | `src/components/admin/GenerationPanel.tsx`, `PlanCard.tsx`, `PlanCompare.tsx`, `ReferenceModeSelector.tsx` |
| 新增 | `src/app/(admin)/favorites/page.tsx` |
| 新增 | `src/components/admin/FavoriteList.tsx`, `FavoriteFilters.tsx` |
| 新增 | `src/hooks/useFavorites.ts` |
| 修改 | `src/lib/mock/ai-plans.json`（确保有收藏状态字段） |

**验证命令**：

```bash
npm run build
npm run dev    # 访问：
# http://localhost:3000/admin/projects/PRJ-20260523-0001/generate
# http://localhost:3000/admin/favorites
```

**风险**：

- AI 生成进度的动画和状态管理较复杂（模拟异步流程）
- 收藏数据需要跨会话持久化（目前用 Mock 内存存储，需设计好接口抽象以便后续接入真实 API）

---

## Step 7：VI 编辑器 + 手册预览 + 导出交付 + 客户管理

**目标**：实现编辑器、手册预览、导出、客户列表。

**先决条件**：建议先提交 Git 变更（Step 6 完成后）。

| 子任务 | 说明 |
|---|---|
| 7.1 | **VI 编辑器** — 色板编辑（HEX 输入+取色器）+ 字体选择 + 实时 A4 预览 |
| 7.2 | **AI 对话助手** — 浮动面板 + 输入框 + 模拟对话响应 |
| 7.3 | **手册预览** — 翻页预览（react-pdf 或图片序列翻页） |
| 7.4 | **导出工作台** — PDF / PPT / Web 链接 / ZIP 四种导出入口 + 导出进度 |
| 7.5 | **客户管理** — 客户列表（关联项目、历史咨询、跟进状态） |

**预计改动文件**（约 15 个）：

| 操作 | 文件 |
|---|---|
| 新增 | `src/app/(admin)/editor/[projectId]/page.tsx` |
| 新增 | `src/components/admin/editor/ColorPalette.tsx`, `FontSelector.tsx`, `CanvasPreview.tsx`, `AIChatPanel.tsx`, `EditorToolbar.tsx` |
| 新增 | `src/app/(admin)/preview/[projectId]/page.tsx` |
| 新增 | `src/components/admin/ManualPreview.tsx`, `ManualPage.tsx` |
| 新增 | `src/app/(admin)/export/[projectId]/page.tsx` |
| 新增 | `src/components/admin/ExportPanel.tsx`, `ExportProgress.tsx` |
| 新增 | `src/app/(admin)/clients/page.tsx` |
| 新增 | `src/components/admin/ClientTable.tsx`, `ClientDetail.tsx` |

**验证命令**：

```bash
npm run build
npm run dev    # 访问：
# http://localhost:3000/admin/editor/PRJ-20260523-0001
# http://localhost:3000/admin/preview/PRJ-20260523-0001
# http://localhost:3000/admin/export/PRJ-20260523-0001
# http://localhost:3000/admin/clients
```

**风险**：

- VI 编辑器复杂度高（多层状态联动），需拆分子组件避免单文件过大
- PDF 预览在浏览器端使用 react-pdf 需配置 worker
- 导出功能目前为 UI 占位，真正 PDF 生成需后端支持
- AI 对话助手目前为模拟响应（需要你确认是否先做模拟还是直接接 AI API）

---

## Step 8：集成收尾 + 非功能验收

**目标**：构建验证、环境变量安全检查、Mock 开关测试、响应式验收、README 补充。

**先决条件**：建议先提交 Git 变更（Step 7 完成后）。

| 子任务 | 说明 |
|---|---|
| 8.1 | 全量 `npm run build`，修复所有 TypeScript / ESLint 错误 |
| 8.2 | grep 搜索硬编码 Key 关键字（`sk-`, `api_key`, `secret` 等） |
| 8.3 | 切换 `NEXT_PUBLIC_USE_MOCK=false` 确认页面降级行为 |
| 8.4 | 快速移动端验收（客户端核心流程） |
| 8.5 | 补充 README.md：项目简介、启动方式、Mock 数据说明 |
| 8.6 | 提交最终 Git 变更 |

**预计改动文件**（约 3 个）：

| 操作 | 文件 |
|---|---|
| 修改 | 各文件修复构建错误 |
| 新增 | `README.md` |

**验证命令**：

```bash
npm run build
# 全量构建通过即视为验收通过
```

**风险**：

- 构建错误可能来自未使用的导入、类型不匹配等，需逐项修复
- 如果之前步骤引入了硬编码 Key，此处会检出

---

## 需要你确认的问题

在开始执行前，请确认以下几点：

### Q1：MVP 范围确认

PRD 中功能分为 P0 / P1 / P2 三级。**首批实现是否只覆盖 P0 + P1，P2 留到后续迭代？** 具体分布：

| 优先级 | 涵盖功能 |
|---|---|
| P0（阻塞） | 首页、咨询表单、Logo/IP 上传、确认页、工作台、项目列表/详情、AI 方案生成、VI 编辑器（色板/字体）、手册预览、PDF 导出、项目筛选搜索 |
| P1（高） | 参考手册上传、收藏、AI 对话助手、PPT 导出、参考模式选择、移动端适配 |
| P2（中） | 进度查询、内部素材库、批注、Web 链接导出、批量管理收藏 |

### Q2：Mock 策略

PRD 提出通过 `NEXT_PUBLIC_USE_MOCK=true` 切换 Mock / 真实 API。**前期开发是否全部基于 Mock 数据，API 集成放到后续迭代？**

### Q3：AI 对话助手的策略

VI 编辑器中的 AI 对话助手（自然语言修改指令），**第一期先做模拟响应（预设回复），还是直接预留 AI API 接口？**

### Q4：编辑器实现的简化方案

VI 编辑器涉及色板、字体、版式、辅助图形等多个维度，第一期建议聚焦 **色板编辑 + 字体选择 + 实时预览** 三项核心能力，版式和辅助图形放在 P2。**是否同意这个裁剪？**

### Q5：PDF 导出方案

真正的高质量 PDF 导出需要后端（Puppeteer / wkhtmltopdf）支持。**第一期先做 PDF 导出的 UI 流程（按钮 + 进度 + 下载模拟文件），后端对接放到后续？**

---

## 确认后执行顺序

1. 你回复确认上述 5 个问题
2. 我从 **Step 1** 开始，每一步开始前在 commentary 中发出计划摘要
3. 每个 Step 完成后，我附上验证命令结果截图描述
4. 涉及 Step 3/5/6/7 开始时，按 AGENTS.md 规则二提醒你提交 Git

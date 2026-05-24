# PROJECT_CONTEXT.md

> 项目交接摘要 — 新会话阅读此文档后可继续开发

---

## 项目概要

- **名称**：线上代客生成企业VI手册
- **定位**：B2B 代运营服务。客户通过极简界面提交品牌素材与需求，我方团队借助 AI 辅助完成 VI 手册的设计与交付
- **项目目录**：`C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock`
- **技术栈**：Next.js 15 (App Router) + Tailwind CSS 4 + TypeScript + shadcn/ui

---

## 启动命令

```bash
cd C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock
npm run dev      # 开发服务器（默认 http://localhost:3000）
npm run build    # 生产构建
```

---

## 系统架构

```
┌──────────────────────────┐      ┌──────────────────────────┐
│   客户端 (Client Portal)   │      │   管理端 (Admin Console)   │
│                          │      │                          │
│  /                       │      │  /admin/dashboard         │
│  /consultation           │      │  /admin/projects          │
│  /confirm                │      │  /admin/projects/[id]     │
│  /progress               │      │  /admin/projects/[id]/gen │
│                          │      │  /admin/favorites         │
│  客户只看到这 4 个页面     │      │  /admin/editor/[id]       │
│                          │      │  /admin/preview/[id]      │
│                          │      │  /admin/export/[id]       │
│                          │      │  /admin/clients           │
└──────────────────────────┘      └──────────────────────────┘
```

---

## 已完成功能（按窗口）

### 窗口 A — 客户端
| 路由 | 功能 | 组件 |
|---|---|---|
| `/` | 首页 | HeroSection, ProcessSection, AdvantageCards, CaseCarousel, FaqSection |
| `/consultation` | 咨询留资 | ConsultationForm (react-hook-form + zod), FileUploadArea (Logo / IP / 参考手册) |
| `/confirm` | 提交确认 | 显示项目编号 |
| `/progress` | 进度查询 | 输入编号+手机号，展示时间线 |

### 窗口 B — 管理端框架
| 路由 | 功能 | 组件 |
|---|---|---|
| `/admin/dashboard` | 工作台 | StatCard, RecentActivityList |
| `/admin/projects` | 项目列表 | ProjectFiltersBar, ProjectTable |
| `/admin/projects/[id]` | 项目详情 | AssetPreview, 时间线, AI 方案列表 |

### 窗口 C — AI 生成 + 收藏
| 路由 | 功能 | 组件 |
|---|---|---|
| `/admin/projects/[id]/generate` | AI 方案生成 | GenerationPanel, ReferenceModeSelector, PlanCard |
| `/admin/favorites` | 收藏管理 | FavoriteFilters, FavoriteList |

### 窗口 D — 编辑器 + 预览 + 导出 + 客户
| 路由 | 功能 | 组件 |
|---|---|---|
| `/admin/editor/[projectId]` | VI 编辑器 | ColorPalette (取色器), FontSelector, CanvasPreview (A4), AIChatPanel |
| `/admin/preview/[projectId]` | 手册预览 | 翻页浏览（11 页） |
| `/admin/export/[projectId]` | 导出工作台 | PDF / PPT / Web / ZIP 四种格式 |
| `/admin/clients` | 客户管理 | 客户列表 + 关联项目跳转 |

---

## 关键文件索引

| 文件 | 说明 |
|---|---|
| `src/types/index.ts` | 所有 TypeScript 类型定义（Submission, Project, ViManual, Favorite 等） |
| `src/lib/mock/` | Mock 数据（6 个 JSON + index.ts 加载层） |
| `src/lib/consultation-schema.ts` | 表单校验规则（Zod schema） |
| `src/lib/utils.ts` | 通用工具（cn 函数） |
| `src/components/shared/` | 共享组件（FileUpload, StatusBadge, EmptyState, ErrorState, ClientLayout, AdminLayout） |
| `src/components/client/` | 客户端专用组件（HeroSection, ConsultationForm 等 7 个） |
| `src/components/admin/` | 管理端专用组件（9 个）+ editor/ 子目录（4 个） |
| `src/app/` | 所有页面路由 |
| `.env.local` | 环境变量（当前仅 `NEXT_PUBLIC_USE_MOCK=true`） |
| `.env.example` | 环境变量模板 |
| `AGENTS.md` | AI 协作规则 |
| `PRD.md` | 产品需求文档 |
| `TASK_PLAN.md` | 执行计划（8 Steps） |
| `TASK_SPLIT.md` | 窗口拆分计划（A/B/C/D） |

---

## 数据流说明

当前全部使用 **Mock 数据**，通过 `NEXT_PUBLIC_USE_MOCK=true` 控制。
Mock 数据加载层在 `src/lib/mock/index.ts`，后续接入真实 API 时只需替换这里的函数实现。

**Mock 数据文件**（6 个 JSON）：
| 文件 | 数据量 |
|---|---|
| `submissions.json` | 3 条客户提交 |
| `projects.json` | 3 个内部项目 |
| `ai-plans.json` | 4 套 AI 方案 |
| `vi-manuals.json` | 2 份 VI 手册 |
| `favorites.json` | 2 条收藏 |
| `employees.json` | 4 名员工 |

---

## 环境变量

| 变量 | 当前值 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | `true` | `true`=使用本地 Mock，`false`=连接真实 API |
| `OPENAI_API_KEY` | （空白） | 后续接入 AI API 时填写 |
| `NEXT_PUBLIC_SUPABASE_URL` | （空白） | 后续接入数据库时填写 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | （空白） | 后续接入数据库时填写 |

---

## 待办 / 可扩展方向

1. **视觉调优** — 打开页面截图，根据反馈调整样式
2. **接入真实 AI API** — 将 AI 方案生成从 Mock 替换为实际 GPT-4o/Claude 调用
3. **PDF 真实导出** — 当前为 UI 流程，需对接 Puppeteer 或后端生成
4. **GitHub + Vercel 上线** — 部署到公网
5. **Supabase 数据库** — 收藏和咨询数据持久化
6. **商标近似检测** — Phase 3 功能
7. **印刷下单直连** — Phase 3 功能

---

## 常见问题

| 问题 | 解决 |
|---|---|
| `npm run build` 报错 | 检查 TypeScript 类型，检查 import 路径 |
| 页面 404 | 确认路由在 `src/app/` 下的路径是否正确 |
| Git 权限错误 | 运行 `takeown /f .git /r /d y` 后再操作 |
| 想改 Mock 数据 | 编辑 `src/lib/mock/` 下对应的 JSON 文件 |

# VI AI Logo IP Mock

线上代客生成企业 VI 手册的 B2B 服务平台 MVP。
客户通过极简界面提交品牌素材与需求，运营团队借助 AI 辅助完成 VI 手册的设计与交付。

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Next.js 15 (React 19, App Router) |
| 语言 | TypeScript (strict mode) |
| 样式 | Tailwind CSS 4 |
| UI 组件 | shadcn/ui (基于 Radix) |
| 表单 | React Hook Form + Zod |
| 状态管理 | Zustand |
| 文件上传 | react-dropzone |
| 动画 | Framer Motion |
| 图标 | Lucide React |

## 快速启动

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

> 端口被占用时可指定：`npx next dev -p 3005` 或 `npx next start -p 3005`

## Mock 模式

项目默认运行在 Mock 模式（`NEXT_PUBLIC_USE_MOCK=true`），所有数据来自本地 JSON 文件，无需外部 API。

| 环境变量 | 说明 | 默认值 |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | Mock 开关 | `true` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（留空则继续使用 Mock） | （空） |

切换为 `NEXT_PUBLIC_USE_MOCK=false` 可接入真实 API（需自行实现后端）。

## 路由一览

### 客户端

| 路径 | 页面 |
|---|---|
| `/` | 首页（Hero / 服务流程 / 案例 / FAQ） |
| `/consultation` | 咨询留资表单 |
| `/confirm` | 提交确认页 |
| `/progress` | 项目进度查询 |

### 管理端

| 路径 | 页面 |
|---|---|
| `/admin/dashboard` | 工作台统计 |
| `/admin/projects` | 项目列表（筛选/搜索/分页） |
| `/admin/projects/[id]` | 项目详情 |
| `/admin/projects/[id]/generate` | AI 方案生成 |
| `/admin/editor/[projectId]` | VI 编辑器（色板/字体/预览） |
| `/admin/preview/[projectId]` | 手册预览 |
| `/admin/export/[projectId]` | 导出（PDF/PPT/Web） |
| `/admin/favorites` | 收藏列表 |
| `/admin/clients` | 客户管理 |

### API（Mock）

| 路径 | 功能 |
|---|---|
| `/api/ai/analyze-logo` | Logo 分析 |
| `/api/ai/generate-scheme` | 方案生成 |

## Mock 数据

JSON 文件位于 `public/mock/`：

| 文件 | 内容 |
|---|---|
| `submissions.json` | 客户提交记录 |
| `projects.json` | 内部项目列表 |
| `ai-plans.json` | AI 生成方案 |
| `vi-manuals.json` | VI 手册数据 |
| `favorites.json` | 收藏记录 |
| `employees.json` | 员工数据 |

图片资源位于 `public/mock/uploads/`、`plans/`、`mockups/`、`manual/`，包含 Logo 示例、方案预览图、应用 Mockup 和手册页面图，共 62 张。

## 项目结构

```
src/
├── app/
│   ├── (client)/       # 客户端页面
│   ├── (admin)/        # 管理端页面
│   └── api/            # API 路由
├── components/
│   ├── ui/             # 基础 UI 组件
│   ├── client/         # 客户端专用组件
│   ├── admin/          # 管理端专用组件
│   │   └── editor/     # VI 编辑器组件
│   └── shared/         # 通用业务组件
├── lib/
│   ├── mock/           # Mock 数据加载层
│   └── api/            # API 客户端
├── types/              # TypeScript 类型定义
└── hooks/              # 自定义 Hooks
```

## 许可证

MIT

# VI AI Logo IP Mock

线上代客生成企业 VI 手册的 B2B 服务平台 MVP。
客户通过极简界面提交品牌素材与需求，运营团队借助 AI 辅助完成 VI 手册的设计与交付。

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Next.js 15 (React 19, App Router) |
| 语言 | TypeScript (strict mode) |
| 样式 | Tailwind CSS 4 |
| 表单 | React Hook Form + Zod |
| 状态管理 | Zustand |
| 文件上传 | react-dropzone |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| AI 图像 | 通义万相 wan2.6/wan2.7（阿里云 DashScope） |
| AI 文本 | DeepSeek Chat（生成提示词） |

## 快速启动

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev

# 指定端口
npx next dev -p 3001

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 环境变量

项目默认可运行在纯 Mock 模式，接入 AI 生成需配置 API Key。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | Mock 开关（`true`=本地 JSON，`false`=连接真实 API） | `true` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（生成手册每页的提示词） | （空） |
| `ALIYUN_API_KEY` | 阿里云 DashScope Key（通义万相文生图） | （空） |
| `ADMIN_PASSWORD` | 管理后台登录密码 | （空） |
| `RESEND_API_KEY` | Resend 邮件服务（未启用） | （空） |

所有 API Key 只通过 `.env.local` 注入，不硬编码在代码中。

## 管理后台

访问 `/admin/login`，输入密码进入。

支持以下功能页面：

| 路径 | 页面 |
|---|---|
| `/admin/dashboard` | 工作台统计 |
| `/admin/projects` | 项目列表（筛选/搜索/分页） |
| `/admin/projects/[id]` | 项目详情 |
| `/admin/projects/[id]/generate` | AI 方案生成 |
| `/admin/editor/[projectId]` | VI 编辑器（色板/字体/预览） |
| `/admin/preview/[projectId]` | 手册预览 |
| `/admin/manual-pages/[projectId]` | AI 逐张生成手册页面（流式） |
| `/admin/export/[projectId]` | 导出（PDF/PPT/Web） |
| `/admin/favorites` | 收藏列表 |
| `/admin/clients` | 客户管理 |

## 客户端

| 路径 | 页面 |
|---|---|
| `/` | 首页（Hero / 服务流程 / 案例 / FAQ） |
| `/consultation` | 咨询留资表单（含 Logo/IP/参考手册上传） |
| `/confirm` | 提交确认页 |
| `/progress` | 项目进度查询 |

## API 路由

### AI 生成

| 路径 | 功能 |
|---|---|
| `/api/ai/generate-image` | 通义万相文生图（单张） |
| `/api/ai/generate-manual-pages` | 批量生成 VI 手册 11 页 |
| `/api/ai/generate-manual-pages-stream` | 流式逐张生成手册页面（SSE，生成一页显示一页） |
| `/api/ai/generate-scheme` | AI 方案生成 |
| `/api/ai/generate-manual` | 生成 VI 手册数据 |
| `/api/ai/analyze-logo` | Logo 分析 |
| `/api/ai/analyze-manual` | 分析参考手册 |
| `/api/ai/chat` | AI 对话助手 |
| `/api/ai/save-plans` | 保存方案 |
| `/api/ai/save-manual` | 保存手册 |
| `/api/ai/export-pdf` | 导出 PDF |
| `/api/ai/clear-generated` | 清理生成文件 |

### 业务

| 路径 | 功能 |
|---|---|
| `/api/submit` | 提交咨询留资 |
| `/api/upload` | 文件上传 |
| `/api/login` | 管理端登录校验 |
| `/api/delete-project` | 删除项目 |
| `/api/debug` | 调试接口 |

## AI 生成流程

1. 管理端进入项目详情 → 点击 **生成手册页（通义万相）**
2. 选择两种模式：
   - **自动模式** — 一键流式生成全部 11 页，逐张展示
   - **手动模式** — 每生成一页后确认，再继续下一页
3. 每页经 DeepSeek 生成针对性提示词 → 通义万相文生图 → 自动叠加 Logo/IP → 保存到 `public/generated/`
4. 生成结果存为 `public/mock/manual-pages-{projectId}.json`

生成流程保证 IP 公仔的 DNA 特征（面部/比例/配色）在全部页面中保持一致。

## Mock 模式

设置 `NEXT_PUBLIC_USE_MOCK=true`（默认）时，所有数据来自本地 JSON 文件，页面可直接浏览，适合开发调试和演示。

Mock 数据文件位于 `public/mock/`：

| 文件 | 内容 |
|---|---|
| `submissions.json` | 客户提交记录 |
| `projects.json` | 内部项目列表 |
| `ai-plans.json` | AI 生成方案 |
| `ai-plans-runtime.json` | 运行时方案缓存 |
| `vi-manuals.json` | VI 手册数据 |
| `vi-manuals-runtime.json` | 运行时手册缓存 |
| `favorites.json` | 收藏记录 |
| `employees.json` | 员工数据 |

图片资源位于 `public/mock/uploads/`、`plans/`、`mockups/`、`manual/`，包含 Logo 示例、方案预览图、应用 Mockup 和手册页面图，共 60+ 张。

## 公网访问（ngrok）

项目通过 ngrok 暴露到公网，方便客户或异地查看。

```bash
# 启动 ngrok 隧道（映射到开发服务器端口）
ngrok.exe http 3001
```

启动后得到 `.ngrok-free.dev` 域名，两个窗口都保持运行即可。

## 项目结构

```
src/
├── app/
│   ├── (client)/       # 客户端页面
│   ├── (admin)/        # 管理端页面
│   └── api/            # API 路由（含 AI 生成）
├── components/
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

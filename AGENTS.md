# 项目协作规则（Agent Rules）

> 本文件约定 AI 助手（Codex）在本项目中的工作规范，确保协作安全、可控、可追溯。

---

## 1. 先出计划，再改文件

每次接到需求后，**必须先输出执行计划再动手**。计划需包含：
- 本次要改 / 新建哪些文件（路径 + 简要目的）
- 改动类型：新增 / 修改 / 删除
- 预估影响范围（是否会牵连其他页面、API、类型定义等）

**例外**：修正拼写错误、CSS 微调、简单文档修改等单行级改动，可直接执行，但要在 commentary 中说明。

---

## 2. 大改前提提醒提交 Git

涉及以下任意一种情况，**必须先提醒用户提交当前 Git 变更**，获得确认后再继续：

- 新建页面或模块（超过 1 个文件）
- 重构现有组件 / 路由结构
- 修改数据模型或 Mock 数据结构
- 修改构建配置（next.config / tsconfig / tailwind.config 等）
- 新增或更换依赖包
- 删除已有文件

---

## 3. 禁止将 API Key 写入代码

- 所有 API Key、Secret、Token 必须通过环境变量注入，**不得硬编码**在任何源文件中
- 环境变量统一放在项目根目录的 `.env.local`（已加入 `.gitignore`）
- 若需要演示或 Mock，创建 `env.example` 文件，用占位符说明（如 `DEEPSEEK_API_KEY=sk-your-key-here`）
- 代码中通过 `process.env.NEXT_PUBLIC_XXX` 或服务端 `process.env.XXX` 读取
- 若误将 Key 写入代码，立即提醒用户撤销变更并轮换 Key

---

## 4. Blocking API 必须使用流式响应

对于耗时长、涉及 AI 推理的服务端 API（如方案生成、手册生成、图像生成等）：

- 必须使用 Server-Sent Events (SSE) 流式响应，而非等待完整结果后一次性返回
- 客户端在流式传输期间应展示实时进度反馈（进度条、步骤提示等）
- 流式消息使用标准 SSE 格式：`data: {"type": "...", "content": "...", ...}\n\n`
- 流结束标识：`data: {"type": "done"}\n\n` 或 `data: {"type": "error", "message": "..."}\n\n`

---

## 5. 修改后必须提供验证方法

每次完成改动后，需提供明确的本地验证步骤。按改动类型选用：

| 改动类型 | 验证方法 |
|---|---|
| 前端页面 / 组件 | `npm run dev` 启动后访问对应路由，截图确认 |
| 构建配置 / 依赖 | `npm run build` 确保无 TypeScript / ESLint 错误 |
| API 路由 / 服务端逻辑 | `npm run dev` 后用 curl 或浏览器访问接口 |
| 数据模型 / Mock | 检查类型定义无报错 + 页面数据正常渲染 |
| SSE 流式接口 | 浏览器访问端点验证逐块输出，确认 `done` 事件正确触发 |

---

## 附录：项目已知信息速查

| 项目 | 值 |
|---|---|
| 前端框架 | Next.js 15 (React 19, App Router) |
| 样式方案 | Tailwind CSS |
| UI 组件库 | shadcn/ui |
| 包管理器 | npm |
| 项目目录 | C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock |
| 部署平台 | Vercel |
| 产品规划文档 | PRODUCT-PLAN.md |
| PRD | PRD.md |
| 当前阶段 | 客户端页面已完成（首页 / 咨询留资 / 确认页 / 进度查询），管理端 + API 开发中 |

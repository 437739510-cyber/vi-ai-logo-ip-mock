# 项目协作规则 (Agent Rules)

> 本文件约定 AI 助手（Codex）在本项目中的工作规范，确保协作安全、可控、可追溯。

---

## 规则一：先出计划，再改文件

每次接到需求后，**必须先输出执行计划再动手**。计划需包含：

- 本次要改 / 新建哪些文件（路径 + 简要目的）
- 改动类型：新增 / 修改 / 删除
- 预估影响范围（是否会牵连其他页面、API、类型定义等）

**例外**：修复拼写错误、CSS 微调、简单文案修改等单行级改动，可直接执行，但要在 commentary 中说明。

---

## 规则二：大改前提醒提交 Git

涉及以下任意一种情况，**必须先提醒用户提交当前 Git 变更**，获得确认后再继续：

- 新建页面或模块（超过 1 个文件）
- 重构现有组件 / 路由结构
- 修改数据模型或 Mock 数据结构
- 修改构建配置（next.config / tsconfig / tailwind.config 等）
- 新增或更换依赖包
- 删除已有文件

提醒话术示例：

> 这次改动涉及 X 个文件的新建/修改，建议先提交当前 Git 变更，确认后再继续。

---

## 规则三：禁止将 API Key 写入代码

- 所有 API Key、Secret、Token 必须通过环境变量注入，**不得硬编码**在任何源文件中
- 环境变量统一放在项目根目录的 `.env.local`（已加入 `.gitignore`）
- 若需要演示或 Mock，创建 `env.example` 文件，用占位符说明（如 `OPENAI_API_KEY=sk-your-key-here`）
- 代码中通过 `process.env.NEXT_PUBLIC_XXX` 或服务端 `process.env.XXX` 读取
- 若误将 Key 写入代码，立即提醒用户撤销变更并轮换 Key

---

## 规则四：修改后必须提供验证方法

每次完成改动后，需提供明确的本地验证步骤。按改动类型选用：

| 改动类型 | 验证方法 |
|---|---|
| 前端页面 / 组件 | `npm run dev` 启动后访问对应路由，截图确认 |
| 构建配置 / 依赖 | `npm run build` 确保无 TypeScript / ESLint 错误 |
| API 路由 / 服务端逻辑 | `npm run dev` 后用 curl 或浏览器访问接口 |
| 数据模型 / Mock | 检查类型定义无报错 + 页面数据正常渲染 |

验证命令必须写在 commentary 或 final 回答中，格式示例：

> 在终端执行 `npm run build` 确认构建通过，然后 `npm run dev` 访问 `http://localhost:3000/xxx` 查看效果。

---

## 附：项目已知信息速查

| 项目 | 值 |
|---|---|
| 前端框架 | Next.js 15 (React) |
| 样式方案 | Tailwind CSS |
| UI 组件库 | shadcn/ui |
| 包管理器 | npm |
| 项目目录 | C:\Users\Administrator\Documents\Codex\2026-05-23\vi-ai-logo-ip-mock |
| 产品规划文档 | PRODUCT-PLAN.md |

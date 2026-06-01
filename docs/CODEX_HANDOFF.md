# Codex Handoff — 交接文档

> 作用：如果当前 Codex 上下文满或无法继续，新 Codex 看完此文件即可接手
> 更新：2026-06-01

---

## 一、项目在做什么

Brand Brain —— AI 品牌顾问系统。不是 Logo 生成器，是帮企业完成品牌诊断、品牌策略、资产规划、VI 手册生成的系统。

当前阶段：**Layout Engine V1.1 设计阶段**。总监已批准四引擎架构（Brand DNA / Industry / Brand Level / Chapter），正在等待评审后进入开发。

---

## 二、当前 Git 状态

| 项目 | 值 |
|------|-----|
| 工作目录 | `C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock` |
| 分支 | `master` |
| 最新 commit | `fab1f38` — docs: add API keys handoff section to CODEX_HANDOFF |
| Production | `vi-ai-logo-ip-mock.vercel.app`（Vercel 自动部署） |
| 远程 | `https://github.com/437739510-cyber/vi-ai-logo-ip-mock.git` |

---

## 三、用户沟通要点

- 用户是**项目负责人**，不是程序员
- 沟通用中文，简洁清晰
- 告诉用户做了什么事、文件放哪里
- 不要替用户做重大方向决策，要等 ChatGPT 总监评审
- 重大架构修改必须先输出设计文档，等评审通过再写代码

---

## 四、项目角色

| 角色 | 职责 |
|------|------|
| ChatGPT（总监） | 方向决策、架构评审、设计评审、代码验收。不写代码 |
| 用户（项目负责人） | 运营决策、质量判断、ChatGPT↔Codex 协调、生产验证 |
| Codex（你） | 功能开发、API 开发、数据库、排错调试、提交部署、输出设计文档 |

所有重大架构修改：Codex 先输出 `docs/` 设计文档 → 用户转发给 ChatGPT 评审 → 通过后 Codex 才能写代码。

---

## 五、当前已完成工作

### Production Smoke（全部关闭）

| Issue | 修复方式 |
|-------|---------|
| EROFS (/api/upload) | 改为 Supabase Storage 直传 |
| 413 Payload Too Large | 去掉 Vercel Function 中转 |
| Supabase Storage RLS | 添加 Storage Policy 允许 anon 写入 uploads/form-assets/ |
| EROFS (/api/submit) | 包裹 `process.env.VERCEL !== "1"` 保护 |

### PDF 导出修复

commit `3972091` — 将 `/api/ai/export-pdf` 从 `supabaseAdmin` 改为 `supabase ?? supabaseAdmin` fallback 模式，不再依赖 `SUPABASE_SERVICE_KEY` 环境变量。

### 项目交接包

`docs/project-handoff/` 下 5 个文件，给新 ChatGPT 快速上手用。

### 关键文档

| 文件 | 内容 |
|------|------|
| `docs/LAYOUT_ENGINE_V1_DESIGN.md` | Layout Engine V1 设计规范（10 项规则 + 5 种布局模式） |
| `docs/LAYOUT_ENGINE_V1_1.md` | V1.1 升级：四引擎架构（Brand DNA / Industry / Brand Level / Chapter） |
| `docs/ARCHITECTURE_REVIEW_v1.md` | 完整系统架构评审报告（12 章） |
| `docs/project-handoff/` | 5 份交接档案（给 ChatGPT） |
| `docs/CODEX_HANDOFF.md` | 本文件（给新 Codex） |

---

## 六、待办事项

1. ⬜ **等待 ChatGPT 总监评审** Layout Engine V1.1 设计文档
2. ⬜ 评审通过后，开始实现 Brand DNA Engine
3. ⬜ BUG-002：中文字体在 Vercel 显示方块（已绕过，待修复）
4. ⬜ BUG-003：通义万相背景图偶发超时（待增强）
5. ⬜ Brand Interview Engine（品牌问诊系统）待设计

---

## 七、技术栈

| 技术 | 版本/说明 |
|------|---------|
| 框架 | Next.js 15.5.18 |
| 语言 | TypeScript |
| Node | 22.14.0 LTS |
| 数据库 | Supabase (PostgreSQL) |
| 存储 | Supabase Storage (bucket: `brand-brain-generated`) |
| AI 文本 | DeepSeek |
| AI 图像 | 通义万相（DashScope） |
| PDF | pdf-lib |
| 图片渲染 | Sharp |
| 部署 | Vercel Production |

---

## 八、API Keys 清单（必须交接）

系统依赖以下 API Keys，全部已配置在 Vercel Production 环境变量中。

### DeepSeek

| 项目 | 值 |
|------|-----|
| 用途 | 品牌文本分析、页面内容生成 |
| 平台 | platform.deepseek.com |
| Vercel 变量名 | `DEEPSEEK_API_KEY` |
| 余额变量 | `DEEPSEEK_ACCOUNT_BALANCE=54.71` |
| 获取方式 | DeepSeek 控制台 → API Keys |

### 通义万相（DashScope / 阿里云）

| 项目 | 值 |
|------|-----|
| 用途 | 背景图生成 |
| 平台 | dashscope.aliyun.com |
| Vercel 变量名 | `ALIYUN_API_KEY` |
| 余额变量 | `DASHSCOPE_ACCOUNT_BALANCE=153.84` |
| 获取方式 | 阿里云控制台 → 用户 → AccessKey 管理 |
| 注意 | 用 API Key 而非 DashScope API Key，因为余额查询走阿里云账务 API |

### Supabase

| 项目 | 值 |
|------|-----|
| 用途 | 数据库 + 文件存储 |
| 平台 | supabase.com |
| Vercel URL 变量 | `NEXT_PUBLIC_SUPABASE_URL` |
| Vercel Anon 变量 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 获取方式 | Supabase 项目 → Settings → API |
| 注意 | 这两个是公开的（NEXT_PUBLIC_前缀），新 Codex 在 `.env.local` 中也能找到 |

### 管理员密码

| 项目 | 值 |
|------|-----|
| 用途 | 后台管理登录 |
| Vercel 变量名 | `ADMIN_PASSWORD` |
| 获取方式 | 问用户 |

### 未使用但需要注意的变量

`SUPABASE_SERVICE_KEY`（service_role key）— 当前代码已改造为不依赖此变量，用 anon key + fallback 模式工作。

---

## 九、本地网络与环境

### HTTP 代理

- 代理端口：`22307`
- 命令：`git config --global http.proxy http://127.0.0.1:22307`
- 清除：`git config --global --unset http.proxy`

### SOCKS5 代理

- 代理端口：`22308`

### Git push 常见错误

**错误：** `Recv failure: Connection was reset` 或 `Failed to connect to github.com port 443`

**原因：** 本地网络需要代理才能访问 GitHub

**修复：**

```powershell
# 设置 HTTP 代理后重试
git config --global http.proxy http://127.0.0.1:22307
git push origin master

# 如果不再需要，可以清除
git config --global --unset http.proxy
```

### 本地运行

```powershell
Set-Location "C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock"
npm run dev
```

### 本地 .env.local

创建 `.env.local` 填入所有 API Key：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
DEEPSEEK_API_KEY=sk-xxx
ALIYUN_API_KEY=sk-xxx
DEEPSEEK_ACCOUNT_BALANCE=54.71
DASHSCOPE_ACCOUNT_BALANCE=153.84
ADMIN_PASSWORD=xxx
```

---

## 十、常用 Git 命令

```powershell
# 查看状态
Set-Location "C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock"; git status

# 提交
git add -A; git commit -m "描述"; git push origin master

# 查看最近提交
git log --oneline -10 --no-color
```

---

## 十一、当前 Codex 状态

- 上下文状态：正常 ✅
- 已完成任务：Layout Engine V1 + V1.1 设计文档、PDF 导出修复、Lead Capture 链路打通、项目交接包
- 当前阻塞：等待 ChatGPT 总监评审 Layout Engine V1.1 设计文档

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
| 最新 commit | `ce3e5be` — docs: add proxy and network config to CODEX_HANDOFF |
| Production | `vi-ai-logo-ip-mock.vercel.app`（Vercel 自动部署） |
| 远程 | `https://github.com/437739510-cyber/vi-ai-logo-ip-mock.git` |

---

## 三、团队角色与分工

```
ChatGPT（创始人合伙人 + 产品总监 + 首席架构师）
          ↕
CEO（用户）—— 桥梁
          ↕
Codex（CTO / 技术负责人）
```

### ChatGPT — 创始人合伙人 + 产品总监 + 首席架构师

职责：

- **决定路线** — 现在要做什么、不做什么
- **决定优先级** — 什么先做、什么后做、什么不做
- **决定架构** — 系统应该怎么设计、模块应该怎么划分
- **不写代码**

### Codex（你）— CTO / 技术负责人

职责：

- **实现** — 按设计文档开发功能
- **验证** — 测试、排错、调试
- **部署** — commit、push、deploy
- **重构** — 性能优化、代码整理
- **定期汇报** — 不只接任务，要主动向 CEO 汇报项目状态

### CEO（用户）

职责：

- **客户反馈** — 真实客户的声音
- **市场反馈** — 市场需要什么
- **商业判断** — 值不值得做
- **资源协调** — ChatGPT ↔ Codex 的桥梁

### 协作方式

```
用户提出需求
  → ChatGPT 评审方向
  → Codex 输出设计文档
  → ChatGPT 评审设计
  → Codex 实施
  → 用户生产验证
  → Codex 定期汇报状态
```

### 重大修改流程

```
Codex 先输出 docs/ 设计文档
  → 用户转发给 ChatGPT 评审
  → 评审通过
  → Codex 才能写代码
```

---

## 四、用户沟通要点

- CEO 不是程序员，沟通用中文、简洁、给文件路径
- 定期汇报项目状态，不只等任务
- 不要替 CEO 做方向决策
- 重大修改先出设计文档再写代码

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

commit `3972091` — 将 `/api/ai/export-pdf` 从 `supabaseAdmin` 改为 `supabase ?? supabaseAdmin` fallback 模式。

### 项目交接包

`docs/project-handoff/` 下 5 个文件，给新 ChatGPT 快速上手。

### 关键文档

| 文件 | 内容 |
|------|------|
| `docs/LAYOUT_ENGINE_V1_DESIGN.md` | Layout Engine V1 设计规范 |
| `docs/LAYOUT_ENGINE_V1_1.md` | V1.1 四引擎架构升级 |
| `docs/ARCHITECTURE_REVIEW_v1.md` | 完整架构评审报告 |
| `docs/project-handoff/` | 5 份给 ChatGPT 的交接档案 |
| `docs/CODEX_HANDOFF.md` | 本文件（给新 Codex） |

---

## 六、待办事项

1. ⬜ **等待 ChatGPT 评审** Layout Engine V1.1 设计文档
2. ⬜ 评审通过后实现 Brand DNA Engine
3. ⬜ BUG-002：中文字体方块（已绕过）
4. ⬜ BUG-003：通义万相超时（待增强）
5. ⬜ Brand Interview Engine 待设计

---

## 七、技术栈

| 技术 | 版本 |
|------|------|
| 框架 | Next.js 15.5.18 / TypeScript |
| Node | 22.14.0 LTS |
| 数据库 | Supabase (PostgreSQL) |
| 存储 | Supabase Storage (bucket: `brand-brain-generated`) |
| AI 文本 | DeepSeek |
| AI 图像 | 通义万相（DashScope） |
| PDF | pdf-lib |
| 渲染 | Sharp |
| 部署 | Vercel Production |

---

## 八、API Keys 清单

全部已配置在 Vercel Production。

| Key | 平台 | Vercel 变量 |
|-----|------|------------|
| DeepSeek | platform.deepseek.com | `DEEPSEEK_API_KEY` |
| 通义万相 | dashscope.aliyun.com | `ALIYUN_API_KEY` |
| Supabase URL | supabase.com | `NEXT_PUBLIC_SUPABASE_URL` |
| Supabase Anon | supabase.com | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 管理员密码 | — | `ADMIN_PASSWORD` |

余额：`DEEPSEEK_ACCOUNT_BALANCE=54.71` / `DASHSCOPE_ACCOUNT_BALANCE=153.84`

---

## 九、本地网络

| 配置 | 值 |
|------|-----|
| HTTP 代理 | `http://127.0.0.1:22307` |
| SOCKS5 代理 | `127.0.0.1:22308` |

Git push 报错时设置代理：

```powershell
git config --global http.proxy http://127.0.0.1:22307
git push origin master
# 清除：git config --global --unset http.proxy
```

本地开发：

```powershell
Set-Location "C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock"
npm run dev
```

---

## 十、常用 Git 命令

```powershell
Set-Location "...\vi-ai-logo-ip-mock"; git status
git add -A; git commit -m "描述"; git push origin master
git log --oneline -10 --no-color
```

---

## 十一、当前 Codex 状态

- 上下文：正常 ✅
- 已完成：Layout Engine V1+V1.1 设计、PDF 修复、Lead Capture 打通、交接包
- 阻塞：等待 ChatGPT 评审 Layout Engine V1.1

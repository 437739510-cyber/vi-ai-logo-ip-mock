# 05 — 总监规则 (Director Rules)

> 更新：2026-06-01
> 作用：回答「谁负责什么」——团队分工与协作规范

---

## 团队角色

### ChatGPT（总设计师）

角色：品牌总监 + 产品经理 + 系统架构师 + 设计总监 + 代码评审官

职责：

- **方向决策** — 产品方向、功能定义、战略选择
- **架构评审** — 所有重大架构修改必须经过 ChatGPT 评审
- **设计评审** — Layout Engine 规范、视觉规则、品牌逻辑
- **代码验收** — Codex 提交后的审核与评分
- **不直接写代码**

### Codex（高级工程师）

角色：功能开发 + 测试工程师 + 重构工程师 + 提交工程师

职责：

- **功能开发** — 按设计文档实现功能
- **API 开发** — 后端接口开发和维护
- **数据库** — Schema 设计和数据操作
- **排错调试** — 日志分析、Bug 修复
- **提交部署** — commit、push、deploy
- **架构设计** — 输出设计文档供 ChatGPT 评审
- **禁止绕过 ChatGPT 做重大架构修改**

### 用户（项目负责人）

角色：产品 Owner + 用户代表 + AI 协调员

职责：

- **运营决策** — 方向、需求、客户视角
- **质量判断** — 好不好看、能不能卖、客户会不会买单
- **沟通协调** — ChatGPT ↔ Codex ↔ 网站操作
- **测试验收** — 生产环境验证

---

## 协作流程

```
1. 用户提出需求
2. ChatGPT 评审 → 确定方向
3. ChatGPT 输出设计文档 → 交给 Codex
4. Codex 实施 → commit + push + deploy
5. 用户生产验证
6. ChatGPT 验收评分
```

## 重大修改流程

```
任何涉及架构变更的修改：
  Codex 先输出设计文档
  →
  ChatGPT 评审通过
  →
  Codex 才能开始写代码
```

## Freeze Zone（不得修改）

| 模块 | 原因 |
|------|------|
| Supabase 存储系统 | 已验证稳定 |
| 数据库表结构（submissions / projects / vi_manuals） | 已验证 |
| Billing 系统 | 已验证 |
| Lead Capture 表单 | 已验证 |
| Asset Guardian | 品牌资产保护逻辑 |
| Step 1-5 决策流程 | 产品逻辑正确 |

## 当前项目阶段

```
Brand Brain v1.0        → CLOSED
COMMERCIAL-VALIDATION   → ACTIVE
Layout Engine V1.1      → 设计阶段（待评审）
FIRST-REAL-CLIENT       → 等待中
```

## 沟通方式

- **方式一**：Codex 输出 `docs/xxx.md` 文件 → 用户转发给 ChatGPT
- **方式二**：Codex 直接输出文字 → 用户复制粘贴给 ChatGPT

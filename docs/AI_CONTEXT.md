# Brand Brain — AI Context

> 快速交接文档（面向 AI 助手）

## 项目定位

AI 品牌顾问系统（Brand Brain），不是 AI 图片生成器。

## 当前阶段

Brand Brain Beta — 已完成分析 → 商业信息 → 套餐推荐 → 模块规划 → 生成 → 评分 → 记忆 完整闭环。

## 核心原则

1. Logo 不能 AI 重绘 — 只能缩放、移动、排版
2. 已有 IP 不能 AI 重绘 — 禁止改色、改表情、改材质、换角色
3. PAGE_DEFS 保留不删 — 旧生成层是稳定基础，新功能通过 module-to-page 桥接
4. Asset Guardian 必须存在 — 保护品牌资产不被 AI 篡改
5. Memory 是核心资产 — 客户记忆、行业知识、项目决策都存 JSON
6. Quality Score 是质量守门员 — 5 维度评分，低于 75 分标记 needs_revision

## 架构简述

```
Client Input → Agent Pipeline → Generation Pipeline → Memory
```

6 个 Agent + Orchestrator，位于 `src/agents/`：
- Brand Analyst → Brand Planner → Design Director → Asset Guardian → Manual Composer
- Orchestrator 按顺序调度，自动读写 Memory

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/agents/orchestrator.ts` | 编排器，调度所有 Agent |
| `src/lib/brand-analyzer.ts` | 品牌分析引擎 |
| `src/lib/industry-knowledge.ts` | 行业知识库（18 个行业画像） |
| `src/lib/module-planner.ts` | 模块规划 + 双因子评分 |
| `src/lib/module-to-page.ts` | 模块 → pageIds 桥 |
| `src/lib/manual-packages.ts` | 3 个套餐定义 (basic_vi / brand_vi / brand_ip) |
| `src/lib/business-profile.ts` | 商业信息评分 |
| `src/lib/asset-guardian.ts` | 品牌资产保护 |
| `src/lib/manual-quality-score.ts` | 质量评分 |
| `src/lib/memory/` | 记忆系统 (types / json-adapter / index) |
| `src/components/admin/DecisionLayer.tsx` | 4 步决策向导 UI |

## 测试项目

椰岛工坊 (VI-20260528-NDKW)：消费品牌、椰子饮品、有 Logo + IP 公仔"椰小匠"

## 下一任务

Mascot Designer Agent — `src/agents/mascot-designer.ts`
- 插入 Orchestrator 的 brand-planner → design-director 之间
- 支持两种模式：protect_existing / create_new / not_needed
- 已有 IP 时保护原图，无 IP 时基于行业推荐 IP 策略

## 禁止操作

- 不重绘 Logo / IP
- 不删除或绕过 Asset Guardian
- 不修改 PAGE_DEFS 和生成层
- 不优化 SVG / 封面 / 字体
- 不在 Memory 写入前跳过分析

## 快速复现

1. 看 PROJECT_MASTER.md 了解全貌
2. 看 HANDOVER.md 了解当前状态和下一步
3. 看 AGENTS.md 了解每个 Agent 细节
4. 看 MEMORY_SYSTEM.md 了解数据存储
5. 看 QUALITY_SCORE.md 了解评分逻辑

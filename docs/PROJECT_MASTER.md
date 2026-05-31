# Brand Brain — Project Master

> AI Brand Guideline Builder / AI 品牌顾问平台

---

**Last Updated:** 2026-05-31 — HANDOVER-UPDATE-002
**Current Version:** **Brand Brain v1.0** (CLOSED)
**Status:** **PRODUCTION VERIFIED** — Lead Capture PASS (VI-20260531-16C4)
**Current Blocker:** None — Production Lead Capture PASS
**Next Milestone:** COMMERCIAL-VALIDATION-001 — First Real Client Delivery

**Key Documents:**
- [PROJECT_STATUS_v1.0_RC.md](./PROJECT_STATUS_v1.0_RC.md) — RC 状态评估
- [PROJECT_CONSOLIDATION_V1.md](./PROJECT_CONSOLIDATION_V1.md) — 项目收口 v1
- [BUSINESS_ROADMAP.md](./BUSINESS_ROADMAP.md) — 商业化路线图
- [PROJECT_HANDOVER.md](./PROJECT_HANDOVER.md) — 对话切换交接包
- [BUILD_DIAGNOSTIC_REPORT.md](./BUILD_DIAGNOSTIC_REPORT.md) — 构建诊断与 Node 版本策略

---

> Brand Brain 不仅是 AI 品牌顾问系统。它同时具备创业孵化与商业化潜力。
> 商业路线图见 [BUSINESS_ROADMAP.md](./BUSINESS_ROADMAP.md)，创业申报材料见 [STARTUP_APPLICATION_BRIEF.md](./STARTUP_APPLICATION_BRIEF.md)。

## 项目定位

**Brand Brain** 是一个 AI 品牌顾问系统，而不是 AI 图片生成器。

核心价值在于品牌分析能力、行业知识体系、模块规划能力、质量评分体系、长期记忆系统，而非图片渲染效果。

## 当前阶段

**Brand Brain v1.0 RC** — Release Candidate，已完成所有核心系统研发与验证。

## 已完成里程碑

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| Governance V2 | ✅ | 架构治理，SSOT 建立 |
| Governance V3 | ✅ | Memory 生产化，Supabase Adapter |
| V4 Production Validation | ✅ | 椰岛工坊 Phase 1/2 验证 |
| Quality Score Phase 1 | ✅ | Logging Only 接入 Memory |
| Brand Analyst Mapping Fix | ✅ | 字段映射修复，confidence 0.3 → 0.75 |
| Business Roadmap | ✅ | 商业化路线 + 收口交接机制 |
| Startup Application Brief | ✅ | 创业基地申报材料 |
| CONSOLIDATION-001/002 | ✅ | 项目收口 + RC 状态评估 |
| Storage Migration | ✅ | 本地文件 → Supabase Storage |
| Build Diagnostic & Fix | ✅ | Node v22 锁定 + BOM 修复 |
| Generation API Fix | ✅ | 参数顺序错误诊断与修复 |

## 当前系统闭环

```
客户资料
   ↓
Brand Analyzer（品牌分析）
   ↓
Business Profile（商业信息）
   ↓
Mascot Designer（IP策略判断）
   ↓
Module Planner（套餐推荐 + 模块规划）
   ↓
Decision Layer（用户确认）
   ↓
Generation Pipeline（生成）
   ↓
Supabase Storage（云存储）
   ↓
Quality Score（质量评分）
   ↓
Memory System（记忆存档）
```

## 技术栈

- **框架**: Next.js 15.5.18 (Turbopack dev / webpack production)
- **语言**: TypeScript
- **Node**: 22.14.0 LTS（锁定，不兼容 v24）
- **AI 模型**: DeepSeek (品牌分析/背景提示词), 通义万相 (背景图生成)
- **数据库**: Supabase (Memory + Storage)
- **部署**: Vercel / 本地 `next start`
- **存储**: Supabase Storage (brand-brain-generated bucket) + 本地 filesystem fallback

## 基础设施

| 组件 | 标识 | 状态 |
|------|------|------|
| GitHub | `437739510-cyber/vi-ai-logo-ip-mock` | ✅ master |
| Vercel | `vi-ai-logo-ip-mock` | ✅ Build 通过 |
| Supabase | `fzoscrutqhdfzwnjgjvs` | ✅ Memory + Storage 生产就绪 |

## 当前验证状态

| 组件 | 状态 |
|------|------|
| Build (Node v22.14.0) | ✅ 20.4s |
| TypeScript 编译 | ✅ 0 错误 |
| Supabase Memory 读写 | ✅ V3-P0a/b/c 通过 |
| Supabase Storage 上传 | ✅ 直接测试通过 |
| DeepSeek API | ✅ 正常 |
| Aliyun Tongyi Wanxiang | ✅ 正常 |
| Generation API (SSE) | ✅ 24s 跑通单页 |
| Local filesystem fallback | ✅ 保留 |

## 冻结区 — 禁止修改

```
❌ Generation Layer (page-planner, render-blueprint, design-rules, generate-manual-pages-stream)
❌ SVG / Cover / Font Layer
❌ Asset Guardian (lib + agent)
❌ Agent implementations (src/agents/*.ts)
❌ MemoryAdapter Interface (memory/types.ts)
❌ JsonMemoryAdapter
❌ Provider Layer
❌ Database schema
❌ UI components (DecisionLayer, editor, etc.)
```

## 环境变量 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_MEMORY_ADAPTER=json (dev) / supabase (production)
DEEPSEEK_API_KEY
ALIYUN_API_KEY
ADMIN_PASSWORD
XYQ_ACCESS_KEY
NEXT_PUBLIC_USE_MOCK=false
```

## 下一步（唯一优先）

```
RC-DEPLOYMENT-006
Yedao Full Mode Final Validation
↓
PROJECT CLOSURE v1.0
↓
Commercial Pilot（商业试点）
```

## Business Documentation

> Brand Brain 不仅是技术项目，同时具备创业孵化与商业化潜力。

| 文档 | 用途 |
|------|------|
| [BUSINESS_ROADMAP.md](./BUSINESS_ROADMAP.md) | 商业化路线图、收口流程、交接机制 |
| [STARTUP_APPLICATION_BRIEF.md](./STARTUP_APPLICATION_BRIEF.md) | 创业基地申报简介 |
| Future Business Plan | （规划中）商业计划书、路演 PPT、财务预测 |

## 项目来源

原项目 `vi-ai-logo-ip-mock` 从 VI 手册生成工具演化而来。经过多轮重构后升级为 Brand Brain 品牌顾问系统。详细信息见 [HANDOVER.md](./HANDOVER.md) 和 [PROJECT_CONSOLIDATION_V1.md](./PROJECT_CONSOLIDATION_V1.md)。


# Brand Brain — Project Master

> AI Brand Guideline Builder / AI 品牌规范生成平台

---

**Last Updated:** 2026-05-31
**Current Stage:** Brand Brain Beta+
**Current Priority:** 完善文档体系
**Next Priority:** IP Creation Plan / Billing System / Style Extractor
**Blockers:** 无
**Latest Milestones:** Mascot Designer Agent V1 / Mascot Prompt Strategy V1 / Mascot Prompt Preview UI V1

---

## 项目定位

**Brand Brain** 是一个 AI 品牌顾问系统，而不是 AI 图片生成器。

核心价值在于品牌分析能力、行业知识体系、模块规划能力、质量评分体系、长期记忆系统，而非图片渲染效果。

## 当前阶段

**Brand Brain Beta+**

已完成完整闭环：分析 → 商业信息 → IP策略 → 套餐推荐 → 模块规划 → 生成计划 → 质量评分 → 记忆存档

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
Quality Score（质量评分）
   ↓
Memory System（记忆存档）
```

## 已完成模块

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| Brand Analyzer | `src/lib/brand-analyzer.ts` | ✅ | 品牌类型、人格、定位、原型、语气 |
| Industry Knowledge | `src/lib/industry-knowledge.ts` | ✅ | 10+ 行业分类与视觉特征 |
| Package System | `src/lib/manual-packages.ts` | ✅ | 3 个套餐 (basic_vi / brand_vi / brand_ip) |
| Business Profile | `src/lib/business-profile.ts` | ✅ | 商业三要素评分 (stage/goal/budget) |
| Module Planner | `src/lib/module-planner.ts` | ✅ | 15 个模块评分 + 双因子排序 |
| Module-to-Page Bridge | `src/lib/module-to-page.ts` | ✅ | 模块 → pageIds 转换桥 |
| Memory System | `src/lib/memory/` | ✅ | 客户/行业/项目 三级记忆 JSON 存储 |
| Manual Quality Score | `src/lib/manual-quality-score.ts` | ✅ | 5 维度评分 (0-100) |
| Asset Guardian | `src/lib/asset-guardian.ts` | ✅ | 品牌资产保护策略 |
| Decision Layer UI | `src/components/admin/DecisionLayer.tsx` | ✅ | 5 步决策向导 UI |
| Agent Architecture | `src/agents/` (7 agents + orchestrator) | ✅ | 统一 Agent 契约接口 |
| Brand Analyze API | `POST /api/brand/analyze` | ✅ | 使用 Orchestrator plan-only 模式 |
| **Mascot Designer Agent** | `src/agents/mascot-designer.ts` | ✅ | IP 策略判断 3 种模式 |
| **Mascot Prompt Strategy** | `src/lib/mascot-prompt-strategy.ts` | ✅ | IP 提示词生成引擎 |
| **Mascot Prompt Preview UI** | Step 3 in DecisionLayer | ✅ | IP 策略确认与预览 |

## 核心约束

1. **Logo 和 IP 是受保护品牌资产** — 禁止 AI 重绘、改色、改材质、重新设计
2. **已有 IP 不重绘** — protect_existing 模式下 imagePrompt = null
3. **Asset Guardian 必须保留** — 保护逻辑不能绕过
4. **PAGE_DEFS 暂时保留** — 生成层稳定基础不删除
5. **增量开发** — 不推翻旧系统，新系统作为前置决策层运行
6. **Decision Layer 优先级高于 Visual Layer** — 先确保分析正确，再优化视觉

## 禁止事项

- 不要 AI 重绘 Logo
- 不要 AI 重绘已有 IP
- 不要删除 Asset Guardian
- 不要删除 PAGE_DEFS（当前阶段）
- 不要不经过 Memory 直接生成
- 不要在未确认 Business Profile 前进入生成
- 不要在用户未确认 IP 策略前强推 IP 模块

## 技术栈

- **框架**: Next.js 15.5.18 (Turbopack)
- **语言**: TypeScript
- **AI 模型**: DeepSeek (品牌分析), 通义万相 (图片生成 — 尚未接入)
- **存储**: JSON 文件 (public/memory/)，V1 暂不引入数据库

## 下一阶段候选（未排序）

| 候选 | 说明 |
|------|------|
| A. IP Creation Plan | 实际调用图片生成 API 创建 IP |
| B. Billing System | API 余额与消耗追踪 |
| C. Style Extractor | 从参考手册提取版式/颜色/字体风格 |
| D. Case Memory | 优秀案例知识库 |
| E. Anti-Pattern Memory | 常见错误模式库 |
| F. Quality Score V2 | 引入图像识别层面的自动评分 |

## 项目来源

原项目 `vi-ai-logo-ip-mock` 从 VI 手册生成工具演化而来。经过多轮重构后升级为 Brand Brain 品牌顾问系统。详细信息见 [HANDOVER.md](./HANDOVER.md)。

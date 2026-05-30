# Brand Brain — Project Master

> AI Brand Guideline Builder / AI 品牌规范生成平台

## 项目定位

**Brand Brain** 是一个 AI 品牌顾问系统，而不是 AI 图片生成器。

核心价值在于品牌分析能力、行业知识体系、模块规划能力、质量评分体系、长期记忆系统，而非图片渲染效果。

## 当前阶段

**Brand Brain Beta**

已完成基础闭环：分析 → 商业信息 → 套餐推荐 → 模块规划 → 生成 → 评分 → 记忆

## 已完成模块

| 模块 | 文件 | 状态 |
|------|------|------|
| Brand Analyzer | `src/lib/brand-analyzer.ts` | ✅ |
| Industry Knowledge | `src/lib/industry-knowledge.ts` | ✅ |
| Package System | `src/lib/manual-packages.ts` | ✅ |
| Business Profile | `src/lib/business-profile.ts` | ✅ |
| Module Planner | `src/lib/module-planner.ts` | ✅ |
| Module-to-Page Bridge | `src/lib/module-to-page.ts` | ✅ |
| Memory System | `src/lib/memory/` | ✅ |
| Manual Quality Score | `src/lib/manual-quality-score.ts` | ✅ |
| Asset Guardian | `src/lib/asset-guardian.ts` | ✅ |
| Decision Layer UI | `src/components/admin/DecisionLayer.tsx` | ✅ |
| Agent Architecture | `src/agents/` (6 agents + orchestrator) | ✅ |
| Brand Analyze API | `POST /api/brand/analyze` | ✅ |

## 开发中

- **Mascot Designer Agent** — 当客户没有 IP 时，基于品牌分析自动设计 IP 策略

## 未来规划

- **Style Extractor** — 从参考手册中提取版式、颜色、字体风格
- **Case Memory** — 优秀案例知识库
- **Anti-Pattern Memory** — 常见错误模式库
- **Quality Score V2** — 引入图像识别层面的评分
- **Business Profile V1.5** — 更多维度的商业信息

## 核心约束

- **Logo 和 IP 是受保护品牌资产**，禁止 AI 重绘、改色、改材质、重新设计
- **PAGE_DEFS 是稳定基础**，不删除，新增 module-to-page 作为过渡层
- **增量开发**，不推翻旧系统，新系统作为前置决策层运行
- **Decision Layer 优先级高于 Visual Layer**，先确保分析正确，再优化视觉

## 禁止事项

- 不要重绘 Logo
- 不要重绘已有 IP
- 不要删除 Asset Guardian
- 不要删除 PAGE_DEFS（当前阶段）
- 不要不经过 Memory 直接生成
- 不要在未确认 Business Profile 前进入生成

## 技术栈

- **框架**: Next.js 15.5.18 (Turbopack)
- **语言**: TypeScript
- **AI 模型**: DeepSeek (品牌分析), 通义万相 (图片生成)
- **存储**: JSON 文件 (public/memory/)，V1 暂不引入数据库

## 项目来源

原项目 `vi-ai-logo-ip-mock` 从 VI 手册生成工具演化而来。经过多轮重构后升级为 Brand Brain 品牌顾问系统。详细信息见 [HANDOVER.md](./HANDOVER.md)。

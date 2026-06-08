# Brand Brain — Architecture

## 系统架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                     Decision Layer (UI)                      │
│  Step 1: Brand Analysis → Step 1.5: Business Profile        │
│  Step 2: Module Recommendation → Step 3: Generation Plan    │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    Brand Brain Orchestrator                  │
│                    src/agents/orchestrator.ts                │
│                                                              │
│  plan-only mode: Brand Analyst → Brand Planner               │
│  full mode: + Design Director → Asset Guardian → Manual Comp │
└───┬─────────┬──────────┬──────────┬──────────┬──────────────┘
    │         │          │          │          │
    ▼         ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│Brand │ │Brand │ │Design  │ │Asset   │ │Manual    │
│Analyst││Planner││Director│ │Guardian│ │Composer  │
└──────┘ └──────┘ └────────┘ └────────┘ └──────────┘
    │         │                              │
    ▼         ▼                              ▼
┌──────────────────┐              ┌──────────────────────┐
│   Memory System  │              │  Generation Pipeline  │
│  src/lib/memory/ │              │  (generate-manual-    │
│                  │              │   pages-stream)        │
│  clients.json    │              │                      │
│  industries.json │              │  Page Planner         │
│  projects.json   │              │  Render Blueprint     │
└──────────────────┘              │  SVG Synthesis        │
                                  │  Tongyi Wanxiang      │
                                  └──────────────────────┘
```

## 目录结构

```
src/
├── agents/                    # Agent 架构层
│   ├── types.ts               # 公共类型 (AgentId, AgentContext, Agent 接口)
│   ├── index.ts               # Agent 注册表
│   ├── orchestrator.ts        # 编排器：按顺序调度 Agent，读写 Memory
│   ├── brand-analyst.ts       # 品牌分析师
│   ├── brand-planner.ts       # 品牌规划师
│   ├── design-director.ts     # 设计总监
│   ├── asset-guardian-agent.ts # 资产守护者（Agent 包装）
│   ├── manual-composer.ts     # 手册合成师
│   └── [mascot-designer.ts]   # (规划中) IP 设计师
│
├── lib/                       # 核心逻辑层
│   ├── brand-analyzer.ts      # 品牌分析引擎
│   ├── industry-knowledge.ts  # 行业知识库
│   ├── module-planner.ts      # 模块规划引擎
│   ├── module-to-page.ts      # 模块→页面ID 转换桥
│   ├── manual-packages.ts     # 套餐定义与推荐
│   ├── business-profile.ts    # 商业信息评分
│   ├── asset-guardian.ts      # 品牌资产保护规则
│   ├── manual-quality-score.ts # 质量评分引擎
│   ├── brand-dictionary.ts    # 品牌关键词词典
│   ├── memory/                # 记忆系统
│   │   ├── types.ts           # 记忆数据结构
│   │   ├── json-adapter.ts    # JSON 持久化适配器
│   │   └── index.ts           # Memory 系统入口
│   └── ...                    # 其他工具库
│
├── components/admin/
│   └── DecisionLayer.tsx      # 4 步决策向导 UI
│
└── app/api/
    └── brand/analyze/route.ts # 品牌分析 API（使用 Orchestrator）
```

## 数据流

### 完整流程

```
Client Input
    │
    ▼
┌─────────────────────────────────────────────┐
│ 1. Brand Analyzer                            │
│    输入: clientInfo                          │
│    输出: BrandProfile (类型/人格/定位/原型)  │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│ 1.5 Business Profile (用户交互)              │
│    输入: BusinessStage/BusinessGoal/Budget   │
│    输出: BusinessScoreResult                 │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│ 2. Brand Planner / Module Planner           │
│    输入: BrandProfile + BusinessProfile     │
│    输出: ModulePlan (推荐模块 + 页数)       │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│ 3. User Confirmation (Decision Layer)        │
│    显示: 套餐 / 模块 / 预计页数/时间/API    │
│    操作: 确认/修改/返回                      │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│ 4. Design Director                           │
│    输入: BrandProfile + IndustryProfile      │
│    输出: VisualStrategy (色彩/字体/风格)     │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│ 5. Asset Guardian                            │
│    扫描 prompt/SVG 防止 Logo/IP 被重绘       │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│ 6. Manual Composer / Generation Pipeline     │
│    调用: module-to-page → PAGE_DEFS         │
│    → Page Planner → Render Blueprint         │
│    → SVG Synthesis / Tongyi Wanxiang         │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│ 7. Quality Score (生成后评估)               │
│    5 维度评分 → 写入 ProjectMemory          │
└────────────────┬────────────────────────────┘
                 ▼
            Memory System
    (ClientMemory / ProjectMemory / IndustryMemory)
```

## Agent 契约

每个 Agent 实现统一的 `Agent<TInput, TOutput>` 接口：

```typescript
interface Agent<TInput, TOutput> {
  identity: AgentIdentity;         // Agent 身份元数据
  execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>>;
  canExecute(context: AgentContext): Promise<{ canRun: boolean; reason?: string }>;
}
```

Agent 之间通过 `AgentContext` 共享数据，Orchestrator 按顺序传递 context。

## API 路由

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/brand/analyze` | POST | 品牌分析（Orchestrator plan-only 模式） |
| `/api/ai/generate-manual-pages-stream` | POST | 逐页生成 VI 手册（SSE 流） |

## 生成层（Legacy）

保留以下稳定组件，不修改：

- `src/lib/page-planner.ts` — 页面规划
- `src/lib/render-blueprint.ts` — 渲染蓝图
- `src/lib/ai-layout-planner.ts` — AI 布局
- `src/app/api/ai/generate-manual-pages-stream/route.ts` — SSE 流式生成 API

新系统通过 `module-to-page.ts` 将模块推荐转换为 pageIds，再喂入原有生成流程。
│  plan-only mode: Brand Analyst → Brand Planner → Mascot Designer │
│  full mode: + Design Director → Asset Guardian → Manual Comp     │

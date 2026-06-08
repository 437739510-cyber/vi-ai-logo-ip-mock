# Business Roadmap

## Brand Brain v0.7-alpha — From Governance to Production

> 版本：v1
> 状态：Planning
> 前置：Governance V2 完成, V3 Memory 完成, V4 Production Validation 进行中
> 当前任务：TASK-014 Quality Score Integration (Phase 1)

---

## 1. Product Vision

Brand Brain 是一个能理解**两种语言**的系统：

```
品牌语言  ↔  经营语言
```

- **Professional Mode**：用户输入品牌术语 → 系统直接工作
- **Discovery Mode**：用户说"人话" → AI 采访 → 翻译成品牌语言 → 系统工作
- **Assisted Mode**：介于两者之间，部分补全 + 确认

愿景：**让所有认真做生意的人，无论会不会品牌语言，都能拥有专业的品牌视觉体系。**

---

## 2. Current Status

### Architecture

| 组件 | 状态 |
|------|------|
| Seven-Layer Architecture | ✅ 已固化 (SSOT) |
| Agent Model (6 + 1) | ✅ 稳定 |
| Memory (Supabase) | ✅ Production Ready |
| Provider (DeepSeek / Wanxiang) | ✅ Operational |
| Pipeline | ✅ Verified |
| Vercel Preview | ✅ Verified |

### Governance

| 阶段 | 状态 |
|------|------|
| Knowledge Governance V2 | ✅ 完成 (6/6) |
| Governance V3 — Memory | ✅ 完成 (P0a+P0b+P0c) |
| V4 — Production Validation | 🔄 进行中 |
| Quality Score Integration | 🔄 Phase 1 |

### Documentation Architecture

```
ARCHITECTURE_SSOT.md (Root — 架构真相源)
  ↓
PROJECT_MASTER.md (Strategic Truth)
  ↓
PROJECT_HANDOVER.md (Operational Truth)
  ↓
AI_CONTEXT.md (AI Runtime Truth)
```

---

## 3. Short-Term Roadmap (V1 Professional Close-out)

### P0 — Quality Score Integration

| Task | Status | 说明 |
|------|--------|------|
| Phase 1: Logging Only | 🔄 TASK-014 | 计算 + 写入 Memory，不阻断 |
| Phase 2: WARN Only | 📋 | Quality Score < 50 时标记 WARN |
| Phase 3: Full Gate | 📋 | Quality Score < 50 时阻断后续阶段 |

### P1 — 椰岛工坊 Full Validation

| Step | 说明 |
|------|------|
| Field mapping fix (L1+L2+L4) | 修复 orchestrator 中 clientInfo 字段映射 |
| Re-run plan-only mode | 验证 brand analysis 质量 |
| Generate mode (Phase C) | 调用完整生成管线 |
| Quality Score review | 人工评审质量 |
| Manual review | 交付清单检查 |

### P2 — Brand Analyst Failure Root Fix

| Option | Risk | 效果 |
|--------|------|------|
| L1+L2+L4: 字段映射修复 | Low | brand analysis 可用性从 30% → 80%+ |
| M1: ClientInfo 类型定义 | Medium | 消除整个 Agent 系统字段不匹配风险 |
| M2: ClientInfo 预处理管道 | Medium | 统一的字段归一化 + 默认值填充 |

### P3 — First Real Customer

椰岛工坊（VI-20260528-NDKW）验证通过后，扩展至第二个真实客户。

---

## 4. Medium-Term Roadmap (V1.1)

### Quality Score (Continued)

| 项 | 说明 |
|----|------|
| Phase C score | 集成 manual-quality-score.ts + pixel check |
| Dashboard view | 前端显示 Quality Score |
| Historical trends | 跨项目质量趋势分析 |

### Industry Learning

| 项 | 说明 |
|----|------|
| IndustryMemory.projectCount | 真实项目数据更新 |
| IndustryMemory.confidence | 基于项目数量的置信度提升 |
| Accumulation loop | 每次分析后自动更新行业知识 |

### Operational Memory

| 项 | 说明 |
|----|------|
| Quality Score History | 独立存储 Quality Score 历史 |
| Provider Metrics | 跟踪 API 调用成本 + 延迟 |
| Generation Statistics | 生成成功率 + 页面质量 |

---

## 5. Long-Term Roadmap (V5+)

### Conversational Brand Discovery

| 项 | 说明 |
|----|------|
| Interview engine | AI 驱动的多轮对话采访 |
| Real-time extraction | 边聊边提取结构化字段 |
| Standardized output | 直接输出 ClientInfo |
| UI prototype | 聊天界面 vs. 传统表单 |

### Knowledge Accumulation

| 项 | 说明 |
|----|------|
| Cross-project learning | 从多个项目中学习行业趋势 |
| Style recommendation | 基于历史数据推荐视觉方向 |
| Quality prediction | 基于输入质量预测输出质量 |

### Platform / Team

| 项 | 说明 |
|----|------|
| Agent Contract V1 | 固化 Agent 输入/输出契约 |
| Multi-tenant support | 多客户数据隔离 |
| CI/CD pipeline | 自动部署 + 测试 |

---

## 6. Freeze Zones

以下区域在当前阶段禁止修改：

```
1. Generation Layer (page-planner, render-blueprint, ai-layout-planner, generate-manual-pages-stream)
2. SVG Layer
3. Cover Layer
4. Font Layer
5. Asset Guardian (lib + agent)
6. Agent implementations (src/agents/*.ts) — 质量评分注入 orchestrator 除外
7. MemoryAdapter Interface (memory/types.ts)
8. JsonMemoryAdapter
9. Provider Layer
10. Database schema (Supabase tables)
```

---

## 7. Business Model Considerations

### Two Modes

| Mode | 客户 | 输入 | 定价逻辑 |
|------|------|------|---------|
| Professional | 品牌顾问、设计公司、创业团队 | 结构化品牌资料 | 项目制 / 套餐 |
| Discovery | 小店、老店、传统商户 | 对话式采访 | 低客单价 / 订阅制 |

### 三类客户

```
A类：品牌专家（直接输入品牌术语）
  → Professional Mode
  → 最高 ARPU

B类：传统商户（只说"人话"）
  → Discovery Mode
  → 最大市场规模

C类：介于两者之间（知道一点但不专业）
  → Assisted Mode
  → 最大客户群体
```

### 价值主张

```
不是帮用户填写品牌资料，
而是帮用户把心里想的东西说出来。
```

---

## 8. Project Consolidation Trigger

### 8.1 自动触发条件

满足以下任意一项时，应启动 **Consolidation Review**：

| 条件 | 说明 | 示例 |
|------|------|------|
| 完成一个 Major Phase | Architecture / Memory / Governance 等阶段结束 | Governance V2 ✅ |
| 连续完成 ≥ 5 个任务 | 无需等待整个阶段结束 | TASK-001 → TASK-005 |
| 新增 ≥ 3 份核心文档 | 文档数量增长过快，需确认一致性 | AUDIT / SSOT / DISCOVERY |
| 架构发生重大变化 | 新增组件或修改核心接口 | SupabaseMemoryAdapter |
| 准备切换 AI / 对话 | 不同模型见上下文不同 | ChatGPT → Codex |
| 准备交给新成员 | 人工或 AI 接手 | 交接给新开发者 |

### 8.2 Consolidation Review 内容

```
1. 当前阶段总状态
   - 已完成任务列表
   - 进行中任务列表
   - 未开始任务列表

2. 文档一致性检查
   - 所有文档与当前实现一致？
   - 有漂移的文档被标记

3. 架构合规性检查
   - Freeze Zone 未被触碰
   - 核心接口未被修改

4. 风险再评估
   - 已接受风险是否仍然有效
   - 是否有新风险出现

5. 收口决策
   - PASS: 阶段正式关闭
   - HOLD: 需要补充事项
   - REDIRECT: 需要调整方向
```

### 8.3 收口原则

```
Brand Brain 所有重大阶段结束后，
必须执行 Consolidation Review。

未经收口的阶段，
不得视为正式完成。
```

---

## 9. Handover Protocol

### 9.1 标准交接包

无论交接给 ChatGPT、Codex、Claude、Gemini 还是人工成员，交接包统一如下：

#### A. Current Status

| 字段 | 内容 |
|------|------|
| 当前版本 | v0.7-alpha |
| 当前阶段 | V4 Production Validation |
| 当前任务 | TASK-014 Quality Score Integration (Phase 1) |
| Architecture | Stable |
| Memory | Production Ready |
| Pipeline | Verified |
| Vercel | Verified |

#### B. Key Documents

| 文档 | 路径 | 用途 |
|------|------|------|
| PROJECT_MASTER.md | `/docs/PROJECT_MASTER.md` | 战略真相源 |
| PROJECT_HANDOVER.md | `/docs/PROJECT_HANDOVER.md` | 运营真相源 |
| AI_CONTEXT.md | `/docs/AI_CONTEXT.md` | AI 运行时上下文 |
| ARCHITECTURE_SSOT.md | `/docs/ARCHITECTURE_SSOT.md` | 架构真相源 |
| GOVERNANCE_V2_SUMMARY.md | `/docs/GOVERNANCE_V2_SUMMARY.md` | 治理阶段总览 |
| AUDIT_REPORT.md | `/docs/AUDIT_REPORT.md` | 架构审计 |
| AGENT_CONTRACT_DISCOVERY.md | `/docs/AGENT_CONTRACT_DISCOVERY.md` | Agent 边界分析 |
| MEMORY_GOVERNANCE_V1.md | `/docs/MEMORY_GOVERNANCE_V1.md` | Memory 治理设计 |
| MEMORY_IMPLEMENTATION_PLAN.md | `/docs/MEMORY_IMPLEMENTATION_PLAN.md` | Memory 实施计划 |
| PRODUCTION_VALIDATION_PLAN.md | `/docs/PRODUCTION_VALIDATION_PLAN.md` | 验证方案 |
| BRAND_DISCOVERY_LAYER.md | `/docs/BRAND_DISCOVERY_LAYER.md` | 品牌发现层设计 |
| QUALITY_SCORE_INTEGRATION_PLAN.md | `/docs/QUALITY_SCORE_INTEGRATION_PLAN.md` | 质量评分集成方案 |
| BUSINESS_ROADMAP.md | `/docs/BUSINESS_ROADMAP.md` | 商业路线图（本文档） |
| VALIDATION_REPORT_YEDAO_PHASE1.md | `/docs/VALIDATION_REPORT_YEDAO_PHASE1.md` | Phase 1 验证报告 |
| BRAND_ANALYST_FAILURE_ANALYSIS.md | `/docs/BRAND_ANALYST_FAILURE_ANALYSIS.md` | Brand Analyst 失败分析 |

#### C. Open Decisions

| 决策 | 状态 | 建议 |
|------|------|------|
| Quality Score Gate 触发策略 | Phase 1 Logging 中 | Phase 2 再启用 WARN |
| Brand Analyst 字段映射修复 | 待执行 | L1+L2+L4（不影响 Agent 架构） |
| Delta Snapshot | 延期 | 当前 Full Snapshot + max=10 足够 |
| Discovery Layer 实现 | 文档已完成 | V5 Roadmap，当前不实现 |
| 椰岛工坊 Phase 2 | 待 Phase 1 确认后启动 | 使用 full mode |

#### D. Freeze Zones

```
❌ Generation Layer（page-planner, render-blueprint 等）
❌ SVG / Cover / Font Layer
❌ Asset Guardian（lib + agent）
❌ Agent implementations
❌ MemoryAdapter Interface (types.ts)
❌ JsonMemoryAdapter
❌ Provider Layer
❌ Database schema
```

#### E. Recommended Next Task

```
立即执行：
  TASK-014 Quality Score Integration (Phase 1) — Logging Only
  已完成：orchestrator.ts 修改 + 测试

待评审：
  TASK-014 Code Review

下一优先级：
  TASK-015 Business Roadmap（本文档）— 已完成
  然后：椰岛工坊 Phase 2 或 Brand Analyst 字段映射修复
```

### 9.2 交接原则

```
1. 交接包必须包含以上全部 A-E 五个章节
2. 交接时必须明确"下一步做什么"
3. 不得以"项目很棒，继续努力"作为交接结论
4. Freeze Zones 必须在交接时再次声明
5. Open Decisions 必须在交接时同步
```

---

## Appendix: Version History

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v1 | 2026-05-31 | 初始版本 | Architecture Governance |


---

## 10. Why Business Roadmap Exists

Brand Brain is not just a technical project. It is also a **potential startup project with commercial value**.

This roadmap exists because:

| Reason | Explanation |
|--------|-------------|
| Prevent direction loss | After ChatGPT / Codex conversation switches, direction is preserved in documents, not memory |
| Clarify project positioning | Brand Brain is an AI brand consultancy product with commercial planning |
| Reduce handover cost | Roadmap stays the same regardless of which AI or human takes over |
| Record decision context | Why this market? Why this priority? Why this architecture? |
| Startup preparation | Structured input for future business plan, pitch deck, and business model canvas |

### Core Principle

```
Brand Brain's commercial direction is NOT stored in any AI's conversation memory.
It is stored in the project documentation system (SSOT).

Switch ChatGPT, switch Codex, switch team members --
as long as you read PROJECT_MASTER + BUSINESS_ROADMAP,
you know the direction.
```

---

## 11. Commercialization Path

### Phase 1: University Startup Team (3-6 months)

| Item | Description |
|------|-------------|
| Scenario | Startup competition / incubator entry |
| Customer | Judges / incubators |
| Goal | Validate product concept + secure early resources |
| Deliverables | Business plan, pitch deck, MVP demo |
| Metric | Competition ranking / incubator qualification |

### Phase 2: Incubator / Industrial Park (6-12 months)

| Item | Description |
|------|-------------|
| Scenario | Park pilot cooperation |
| Customer | Small businesses within the park |
| Goal | First real users + product iteration |
| Deliverables | Brand Brain Lite (conversational discovery MVP) |
| Metric | 10+ park clients, NPS > 50 |

### Phase 3: Local Heritage Brands (12-18 months)

| Item | Description |
|------|-------------|
| Scenario | County economies / local time-honored brands / specialty agriculture |
| Customer | Local governments / industry associations |
| Goal | Regional market validation + case accumulation |
| Deliverables | Industry-specific solutions, case studies |
| Metric | 30+ clients, avg Quality Score > 75 |

### Phase 4: SME Market (18-24 months)

| Item | Description |
|------|-------------|
| Scenario | National SME branding market |
| Customer | Growing enterprises / chain brands / e-commerce brands |
| Goal | Scale + sustainable revenue |
| Deliverables | Professional Mode + Discovery Mode dual product line |
| Metric | 100+ clients, monthly active > 50% |

### Phase 5: Enterprise Market (24+ months)

| Item | Description |
|------|-------------|
| Scenario | Large enterprise brand management |
| Customer | Brand departments / marketing / design agencies |
| Goal | High ARPU + long-term contracts |
| Deliverables | Enterprise version (multi-brand + permissions + API) |
| Metric | 10+ enterprise clients, ARR > 1M RMB |

---

## 12. Social Value

Brand Brain's social value is not about serving brand experts. It is about helping those who need branding the most but understand it the least:

| Group | Current State | What Brand Brain Can Do |
|-------|---------------|------------------------|
| SME owners | Have products and口碑 but can't systematically express their brand | Extract brand language from business experience |
| Local heritage brands | Decades of market validation but brand assets never organized | Transform "old招牌" into "brand system" |
| County-level entrepreneurs | Have passion but lack professional branding knowledge | Lower the barrier to "just chat" |
| Individual merchants | Noodle shops, breakfast stalls, dessert shops -- only know "generous portions" | Translate "generous portions" into brand positioning |

### In One Sentence

```
Brand Brain's social value =
  Letting people who can't write "brand vision"
  also have a professional brand visual system.
```

---

## 13. Future Deliverables

The following deliverables are not in the current development scope. They serve as a reference checklist for future startup preparation:

| Deliverable | Purpose | Estimated Timeline |
|-------------|---------|-------------------|
| Business Plan | Startup competition / investment pitch | V5 phase |
| Pitch Deck | Investor / incubator presentation | V5 phase |
| Business Model Canvas | Business model validation | V4-V5 boundary |
| Financial Projections | Cost structure + revenue model | V4-V5 boundary |
| Incubator Application | Park entry application | V4 phase |
| Product Pricing | SaaS / project-based pricing | V4 phase |
| Growth Strategy | Acquisition channels + conversion funnel | V5 phase |
| Competitive Analysis | Competitor comparison + differentiation | V4 phase |

---

## Appendix A: Startup Application Brief

> 对外交流材料 — 用于创业基地 / 创业园 / 孵化器申报。
> 不与技术架构文档合并，保持独立的对外身份。

| 字段 | 内容 |
|------|------|
| 文档 | docs/STARTUP_APPLICATION_BRIEF.md |
| 版本 | V2 |
| 日期 | 2026-05-31 |
| 用途 | 松山湖海峡两岸青年创业基地申报 |
| 状态 | External Communication Document |
| 执行人 | 官彦廷、官泉彣 |
| 内容 | 项目背景、核心创新、目标客户、商业模式、社会价值等 10 个章节 |

该文档与项目主文档体系分离：

`
PROJECT_MASTER.md（内部战略真相）
  ↓
  BUSINESS_ROADMAP.md（商业路线图）
      ↓
      STARTUP_APPLICATION_BRIEF.md（对外申报材料）
`

**不修改内部技术文档以适应对外材料。**
对外材料单独维护，确保内部架构文档真实反映系统实际状态。

---

*本文档同时作为 TASK-015 的输出。*
*完成后，应触发 Consolidation Review。*


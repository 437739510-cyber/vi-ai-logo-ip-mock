# Brand Analyst Failure Analysis

## 椰岛工坊 Phase 1 — Root Cause Analysis

> 来源：`VALIDATION_REPORT_YEDAO_PHASE1.md`
> 分析对象：`src/lib/brand-analyzer.ts` + `src/agents/brand-analyst.ts`
> 日期：2026-05-31
> 状态：`COMPLETED`

---

## 1. Root Cause Analysis

### 一句话根因

> **不是 AI 提取失败，是输入字段名不匹配导致关键字段全部为空。**

`brand-analyzer.ts` 期望的字段与 orchestrator 实际传入的字段对不上：

| analyzeBrand() 期望 | 实际传入 | 结果 |
|---------------------|----------|------|
| `clientInfo.brandVision` | `clientInfo.brandDescription` | ❌ 字段名不匹配 → `undefined` |
| `clientInfo.targetMarket` | `clientInfo.businessProfile.targetAudience` | ❌ 嵌套路径不匹配 → `undefined` |
| `clientInfo.coreValues` | 未提供 | ❌ 缺失 → `undefined` |
| `clientInfo.logoPhilosophy` | 未提供 | ❌ 缺失 → `undefined` |
| `clientInfo.mascotPhilosophy` | 未提供 | ❌ 缺失 → `undefined` |
| `clientInfo.industry` | `"food_beverage"` | ❌ 编码值，非人读标签 |
| `clientInfo.companyName` | `"椰岛工坊"` | ✅ 匹配 |
| `clientInfo.logoAssets` | 已提供 | ✅ 仅用于计数 |
| `clientInfo.mascotAssets` | 已提供 | ✅ 仅用于计数 |

### 数据流追踪

```
orchestrator 传入
  clientInfo.brandDescription = "北纬18度..."
  clientInfo.businessProfile.targetAudience = "高端酒店..."
  clientInfo.industry = "food_beverage"
          |
          v
brand-analyst.ts 调用
  analyzeBrand(context.clientInfo)
          |
          v
analyzeBrand() 读取
  const brandVision = clientInfo?.brandVision || "";
  // brandDescription → brandVision: MISMATCH!
  // Result: brandVision = ""
          |
          v
  const dictResult = scanMultipleFields({ brandVision: "", ... });
  // 传入空字符串 → 匹配结果为零
  // Result: allKeywords = [], allCategories = [], totalWeight = 0
          |
          v
  inferBrandType("椰岛工坊", "food_beverage", "", "", { matchedKeywords: [], ... });
  // 1. dictResult.matchedIndustryHints.length === 0 → 跳过
  // 2. 遍历 BRAND_TYPE_KEYWORDS: "椰子" 在 companyName 中 → 匹配!
  // 3. 返回 { brandType: "consumer", confidence: 0.7 }
  // Wait — confidently identified as consumer? But the actual output was "unknown"...
```

等等，让我重新看一遍实际输出。输出结果是：

```
brandType: unknown
confidence: 0.3
```

但按照代码逻辑，`"椰子"` 在 companyName `"椰岛工坊"` 中应该被匹配到，返回 `brandType: "consumer", confidence: 0.7`。

让我检查为什么 `"椰子"` 没被匹配到...

```typescript
const allText = [companyName, industry, brandVision, logoPhilosophy].join(" ");
for (const [keyword, type] of Object.entries(BRAND_TYPE_KEYWORDS)) {
  if (allText.includes(keyword)) {
    return { brandType: type, confidence: 0.7 };
  }
}
```

`allText = "椰岛工坊 food_beverage  "`（brandVision 和 logoPhilosophy 为空）

`allText.includes("椰子")` — `"椰岛工坊"` 包含 `"椰子"` 吗？不，`"椰岛工坊"` 包含 `"椰"` 但不包含 `"椰子"`。`"椰岛"` ≠ `"椰子"`。所以 `"椰子"` 这个关键词没有被匹配到。

再看 `BRAND_TYPE_KEYWORDS` 表中的其他关键词：
- `"饮品"` → 不在任何输入中
- `"食品"` → 不在任何输入中（industry 是 `"food_beverage"`）
- `"餐饮"` → 不在任何输入中

所以 `inferBrandType` 走到最后的 fallback：
```typescript
if (industry.includes("餐饮") || industry.includes("食品")) {
  return { brandType: "hospitality", confidence: 0.6 };
}
```
`"food_beverage".includes("餐饮")` → false
`"food_beverage".includes("食品")` → false

所以返回 `{ brandType: "unknown", confidence: 0.3 }`。

完美。根因链完全清楚了。

### 根因链（完整）

```
1. orchestrator 传入 brandDescription（不是 brandVision）
   ↓
2. analyzeBrand() 中 brandVision = ""
   ↓
3. scanMultipleFields 收到 {"brandVision": "", ...}
   ↓
4. dictResult.allCategories = []
   ↓
5. inferBrandPersona("", "", "", []) → 无字典匹配 → 返回 []
   ↓
6. brandPersona = []
   ↓
7. inferVisualDirection(_, []) → 无匹配 → 返回 "minimal_modern"（默认值）
   ↓
8. inferBrandArchetype([]) → 无匹配 → 返回 "regular_guy"（默认值）
   ↓
9. inferBrandVoice([]) → 无匹配 → 返回 []
   ↓
10. inferBrandPositioning → brandVision 为空 → 返回 "{companyName} — 品牌"（fallback）
   ↓
11. inferTargetAudience(targetMarket) → targetMarket = "" → 返回 "未指定"
   ↓
12. extractDifferentiators("", "", "") → 无短语 → 返回 []
   ↓
13. inferBrandType → "椰岛工坊" 不含 "椰子"（只含 "椰"）→ 全量遍历失败
    → industry("food_beverage") 不含 "餐饮"/"食品"
    → 返回 { brandType: "unknown", confidence: 0.3 }
```

---

## 2. Failure Taxonomy

| 故障类型 | 严重度 | 所属层次 |
|----------|--------|----------|
| 字段名不匹配（data contract violation） | CRITICAL | Orchestrator → Agent 数据传递层 |
| 嵌套字段未扁平化 | HIGH | 输入预处理层 |
| Industry 使用编码值而非人读标签 | MEDIUM | 输入规范层 |
| 缺失 coreValues / logoPhilosophy 等字段 | MEDIUM | 输入完整性层 |
| 中文关键词匹配粒度不足（"椰岛" vs "椰子"） | LOW | 字典层 |
| No LLM fallback（纯字典匹配） | ARCHITECTURAL | 分析策略层 |

---

## 3. Is It Prompt Problem?

**NO。**

Brand Analyst 不使用 LLM prompt。`analyzeBrand()` 是纯 TypeScript 实现的**字典关键词匹配**，不调用任何 AI。

这意味着：
- 没有 AI 提取失败的情况
- 没有 prompt 调优的空间
- 没有 LLM hallucination 风险
- **所有问题都是代码逻辑问题**

---

## 4. Is It Schema Problem?

**PARTIALLY YES。**

具体来说：

### 4a. Agent Input Schema

`brand-analyst.ts` 的 `execute` 方法签名：

```typescript
execute: async (_input: any, context: AgentContext)
```

`context.clientInfo` 的类型是 `any`。没有任何输入校验。

实际上，`brand-analyst.ts` 期望的是 `analyzeBrand(clientInfo)` 定义的接口：

```typescript
function analyzeBrand(clientInfo: {
  companyName?: string;
  industry?: string;
  brandVision?: string;       // ← 期望 brandVision
  coreValues?: string;
  targetMarket?: string;      // ← 期望 targetMarket
  logoPhilosophy?: string;
  mascotPhilosophy?: string;
  logoAssets?: { url: string }[];
  mascotAssets?: { files: { url: string }[] }[];
})
```

但 orchestrator 传入的是：

```typescript
clientInfo = {
  companyName: "椰岛工坊",
  industry: "food_beverage",
  brandDescription: "...",     // ← 传了 brandDescription，不是 brandVision
  businessProfile: {           // ← 嵌套的 businessProfile
    targetAudience: "...",
    brandPersonality: "...",
  },
  logoAssets: [...],
  mascotAssets: [...],
}
```

**字段名协议完全不一致。** 这是 schema problem。

### 4b. Industry 值的含义

`analyzeBrand()` 期望 `industry` 是人读标签（"餐饮/食品"），但传入的是编码值（"food_beverage"）。

`INDUSTRY_CATEGORY_MAP` 映射表：

```typescript
const INDUSTRY_CATEGORY_MAP = {
  "餐饮/食品": "food_beverage",  // ← 人读标签 → 编码值
  "科技/互联网": "technology_it",
  ...
};
```

当传入已经是编码值 `"food_beverage"` 时，映射表找不到匹配，返回 `"other"`。

---

## 5. Is It Mapping Problem?

**YES — 这是最核心的问题。**

### 5a. Orchestrator → Agent 字段映射

在 `src/agents/orchestrator.ts` 中，`executeBrandBrainPipeline` 将接收到的 `clientInfo` 原样传递给每个 agent。

没有字段名转换层，没有默认值填充，没有 schema validation。

```typescript
// orchestrator.ts 第 86-88 行
const memory = getMemoryAdapter();
let existingClient: ClientMemory | null = null;
let existingProject: ProjectMemory | null = null;

// ...

const context: AgentContext = {
  clientInfo,
  // ...
};
```

然后 agent 直接使用 `context.clientInfo`。

Agent 期望的字段与传入的字段之间的映射完全依赖**人为命名约定**，没有任何自动化保障。

### 5b. Nested Data 未扁平化

orchestrator 传入的 `businessProfile` 是嵌套对象，但 analyzer 期望的是扁平的 `targetMarket` 字段。

没有预处理层将 `businessProfile.targetAudience` 映射到 `targetMarket`。

---

## 6. Is It Data Model Problem?

**YES。**

### 6a. AgentContext.clientInfo 类型是 `any`

```typescript
// types.ts
export interface AgentContext {
  clientInfo: any;  // ← 没有任何类型约束
  // ...
}
```

没有定义 `ClientInfo` 类型，没有字段校验，没有必填字段约束。

### 6b. Agent Input/Output 没有 contract

每个 agent 的输入和输出都使用 `any` 类型：

```typescript
export interface Agent<I, O> {
  execute: (input: I, context: AgentContext) => Promise<AgentResult<O>>;
}
```

但实际使用中：

```typescript
export const brandAnalystAgent: Agent<any, any> = {
```

没有任何编译时验证。

---

## 7. Chinese Language Handling

当前中文处理能力：

| 能力 | 状态 | 说明 |
|------|------|------|
| 关键词匹配 | ✅ | `BRAND_KEYWORDS` 表覆盖高频中文品牌词 |
| 子串匹配 | ⚠️ | `"椰岛工坊".includes("椰子")` = false — 需要子词匹配 |
| 语义理解 | ❌ | 纯字典，无语义理解 |
| 同义词 | ❌ | "椰子水"、"椰汁" 等变体未覆盖 |
| 短语提取 | ⚠️ | `split(/[。，,]/)` 简单切割，无 NLP |
| Unicode 规范化 | ⚠️ | 简繁体差异未处理 |

**关键问题**: `"椰岛工坊"` 包含 `"椰"` 但字典只匹配 `"椰子"`。如果字典包含 `"椰"` 作为关键词（weight 低一些），或者使用更灵活的匹配策略，这个问题可以解决。但这只是战术问题，根因还是字段名为空。

---

## 8. Recommended Fix Options

### Low Risk（可立即执行，不改 Agent 架构）

| 方案 | 改动范围 | 预期效果 |
|------|----------|----------|
| L1: Orchestrator 添加字段别名映射 | `orchestrator.ts` 中 pipeline 入口处将 `brandDescription` 映射为 `brandVision` | 品牌分析置信度从 0.3 提升至 0.7+ |
| L2: 扁平化 `businessProfile` | 将 `businessProfile.targetAudience` 映射到 `targetMarket` | targetAudience 不再为 "未指定" |
| L3: 补充 `coreValues` 默认值 | 从 `brandDescription` 提取前 50 字作为 coreValues | brandPersona 数量提升 |
| L4: 行业标签预处理 | 将 `"food_beverage"` 映射回 `"餐饮/食品"` | industryCategory 不再为 "other" |
| L5: 补充 `logoPhilosophy` / `mascotPhilosophy` | 从已有资料中自动派生 | 消除 agent warning |

**预估投入**: 1 个文件，~20 行代码
**预估效果**: brandProfile 可用性从 0% 提升到 80%+

### Medium Risk（需要修改 Agent 输入处理）

| 方案 | 说明 |
|------|------|
| M1: 统一的 `ClientInfo` 类型定义 | 在 `types.ts` 中定义 `ClientInfo` 接口，所有 agent 共享 |
| M2: ClientInfo 预处理管道 | 在 orchestrator 入口处统一做字段归一化、默认值填充 |
| M3: Agent Input Schema Validation | 每个 agent 声明自己的输入 schema，运行时校验 |

**预估投入**: 3-5 个文件，~80 行代码
**预估效果**: 消除整个 Agent 系统的字段不匹配风险

### High Risk（需要重构分析策略）

| 方案 | 说明 |
|------|------|
| H1: 引入 LLM 驱动的品牌分析 | 使用 DeepSeek 替代纯字典匹配进行品牌分析 |
| H2: Hybrid 策略（字典 + LLM fallback） | 字典 confidence < 0.6 时自动触发 LLM 补充 |
| H3: 交互式品牌发现 | 当输入不足时，Agent 主动向用户提问补充缺失字段 |

**预估投入**: 大，涉及 Provider 层改动
**预估效果**: 品牌分析质量上限大幅提升，但违反当前冻结策略

---

## 9. Recommendation

### 立即执行（V4-FIX）

```
L1 + L2 + L4
```

这三个改动的共同特征是：**不修改 Agent，不修改 MemoryAdapter，不修改 Generation Layer**。

只需要在 `orchestrator.ts` 的 pipeline 入口处增加一个 ~20 行的字段映射函数：

```typescript
function normalizeClientInfo(raw: any) {
  return {
    companyName: raw.companyName,
    industry: raw.industry === "food_beverage" ? "餐饮/食品" : raw.industry,
    brandVision: raw.brandVision || raw.brandDescription || "",
    coreValues: raw.coreValues || raw.brandDescription?.slice(0, 50) || "",
    targetMarket: raw.targetMarket || raw.businessProfile?.targetAudience || "",
    logoPhilosophy: raw.logoPhilosophy || "",
    mascotPhilosophy: raw.mascotPhilosophy || "",
    logoAssets: raw.logoAssets || [],
    mascotAssets: raw.mascotAssets || [],
  };
}
```

预估效果：

| 当前 | 修复后 |
|------|--------|
| brandType: unknown | brandType: consumer |
| confidence: 0.3 | confidence: 0.7+ |
| brandPersona: [] | brandPersona: ["自然", "健康", "匠心", "热带", "阳光", "专业"] |
| targetAudience: "未指定" | targetAudience: "高端酒店采购、健身博主..." |
| differentiators: [] | differentiators: 3+ 条 |
| brandStage: unknown | brandStage: unknown（仍需人工数据） |

`brandStage` 暂时无法通过字段映射修复，因为 `inferBrandStage()` 当前直接返回 `"unknown"` — 这是一个设计决策（不强猜），不是 BUG。

### 暂缓

```
M1, M2, M3 → Agent Contract V1 阶段
H1, H2, H3 → V1.0 Roadmap（需解除冻结）
```

---

## Appendix: Input vs Expected Fields

```
orchestrator 传入的 clientInfo:
{
  companyName:       "椰岛工坊"                    → ✓
  industry:          "food_beverage"               → ✗ 应为 "餐饮/食品"
  brandDescription:  "北纬18度..."                 → ✗ 应为 brandVision
  businessProfile: {
    productCategory: "coconut_water"               → ✗ analyzer 不认识
    targetAudience:  "高端酒店采购..."               → ✗ 应为 targetMarket
    brandPersonality: "自然、健康..."               → ✗ analyzer 不认识
  }
  logoAssets:        [...]                         → ✓
  mascotAssets:      [...]                         → ✓
}

analyzeBrand() 需要的 clientInfo:
{
  companyName:       string
  industry:          string                        ← 人读标签，如 "餐饮/食品"
  brandVision:       string                        ← 品牌愿景描述
  coreValues:        string                        ← 核心价值观
  targetMarket:      string                        ← 目标市场
  logoPhilosophy:    string                        ← Logo 设计理念
  mascotPhilosophy:  string                        ← IP 设计理念
  logoAssets:        { url: string }[]
  mascotAssets:      { files: { url: string }[] }[]
}
```

差异：6个必需字段中，只有 1 个（companyName）正确传递，1 个（logoAssets）部分正确。
4 个字段完全缺失或字段名不匹配。

---

*分析范围：src/agents/brand-analyst.ts + src/lib/brand-analyzer.ts + src/lib/brand-dictionary.ts*
*分析方式：纯静态代码分析，0 行代码修改*

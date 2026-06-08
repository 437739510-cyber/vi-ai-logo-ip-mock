# Brand Discovery Layer

## 从"人话"到"品牌语言"的转换层

> 版本：v1（草案）
> 状态：Planning
> 前置依赖：TASK-011（Brand Analyst Failure Analysis）
> 触发验证：椰岛工坊 Phase 1 — Brand Analyst input mapping failure
> 后续阶段：V5 Roadmap

---

## 1. Problem Statement

### 1.1 填表模式的固有缺陷

当前 Brand Brain 的输入模式是**填表模式**：

```
用户填写结构化字段
  ↓
Agent 按字段名提取
  ↓
analyzeBrand() 字典匹配
  ↓
BrandProfile
```

这个模式有三个隐含假设，但在真实世界中全都不成立：

| 隐含假设 | 现实 |
|----------|------|
| 用户能理解 brandVision / coreValues / brandPersona 等专业术语 | 大多数用户不理解 |
| 用户能写出足够详细的结构化描述 | 大多数用户写不出 |
| 字段名在调用链中保持一致 | TASK-011 证明字段名会断裂 |

### 1.2 椰岛工坊 Failure 的本质

椰岛工坊 Phase 1 验证中，输入已包含丰富信息：

```
brandDescription: "北纬18度黄金产区的椰子水定制专家"
businessProfile.targetAudience: "高端酒店采购、健身博主"
businessProfile.brandPersonality: "自然、健康、匠心、热带、阳光、专业"
```

但输出却是：

```
brandType: unknown
confidence: 0.3
brandPersona: []
targetAudience: "未指定"
```

**根因不是 AI 不够强，而是系统不认识用户给的字段名。** 即使用户已经用中文提供了完整信息，系统也无法提取，因为字段名和预期不匹配。

### 1.3 小店/老店用户的核心困境

椰岛工坊至少还知道写"品牌个性"和"目标人群"。但真实的小店用户：

```
面馆大叔 → 只会说 "面好吃，料足，不坑人"
早餐阿姨 → 只会说 "做了20年，老顾客多"
烧腊店老板 → 只会说 "我家烧鹅比别人香"
```

他们不是不愿意提供信息，而是：

- 不知道"品牌愿景"是什么
- 没想过"品牌定位"
- 不会写"品牌人格"
- 但知道为什么每天凌晨四点起床做包子

**系统的缺陷在这些用户面前被放大到极限：填表模式直接拒绝了这批用户。**

---

## 2. Product Philosophy

### 2.1 核心命题

```
User speaks human language.
AI translates into brand language.
```

不是让用户学习品牌术语，而是让系统理解人话。

### 2.2 三个转变

| 从 | 到 |
|----|----|
| 用户填写品牌资料 | AI 采访用户 |
| 用户输入结构化字段 | AI 从人话中提取结构化信息 |
| 假设用户没有品牌 | 假设用户已经有品牌（只是未被整理） |

### 2.3 老店不是品牌起点

对于十年、二十年、五十年的老店：

```
品牌已经存在。
只是没有被整理出来。
```

这些店已经通过了最残酷的测试——市场竞争。它们的品牌资产藏在日常经营中：

- 为什么开了20年还活着？
- 为什么老顾客不走？
- 为什么敢说"我家和别人不一样"？

Brand Brain 的价值不是"帮它们建立品牌"，而是"帮它们发现自己已有的品牌"。

---

## 3. Discovery Modes

### 3.1 Professional Mode（专业模式）

面向已经有品牌意识的用户：

- 品牌设计师
- 品牌顾问
- 创业团队
- 市场营销人员

**入口**：直接进入现有 Pipeline，填写标准字段

```
brandVision ✓
coreValues  ✓
targetMarket ✓
brandPersona ✓
```

**当前系统已经支持此模式。**

### 3.2 Small Shop / Legacy Store Mode（小店/老店模式）

面向不会品牌术语的真实商户：

- 面馆、早餐店、烧腊店、糖水铺
- 水果店、理发店、五金店、小超市
- 十年、二十年、五十年老店

**入口**：聊天式采访 → AI 结构化提取 → 填充标准字段

```
"面好吃，料足，不坑人"
    ↓
AI 采访 + 提取
    ↓
{ brandVision, coreValues, targetMarket, ... }
    ↓
标准 Pipeline
```

**这是需要新建的模式。**

### 3.3 Assisted Input Mode（辅助输入模式）

面向有一定品牌意识但需要引导的用户：

- 传统行业创业者
- 有产品但不会包装的商家
- 需要品牌升级的本地企业

**入口**：半结构化表单 + AI 实时补全提示

```
用户输入："做椰子水的"
    ↓
AI 建议："您的品牌愿景是否与健康/热带/自然相关？"
    ↓
用户确认或修改
```

**当前系统可以渐进式支持此模式。**

---

## 4. Interview Question Bank

### 4.1 核心问题集（第一版）

设计原则：每个问题都对应一个品牌输出字段。

| # | 问题（说人话版） | 对应品牌字段 | 预期回答类型 |
|---|-----------------|-------------|-------------|
| Q1 | 您家店开了多久？ | brandStory / heritage | 数字 + 历史 |
| Q2 | 您卖的是什么？ | brandVision / productCategory | 品类描述 |
| Q3 | 客人为什么来？ | differentiators | 具体理由 |
| Q4 | 客人为什么再来？（复购原因） | coreValues | 品质/服务/信任 |
| Q5 | 老顾客最常夸您什么？ | brandPersona | 口碑关键词 |
| Q6 | 您和隔壁店最大的不同是什么？ | differentiators / positioning | 竞争优势 |
| Q7 | 您最不愿意改变的是什么？ | coreValues / brandPersonality | 底线/原则 |
| Q8 | 为什么这么累还坚持开店？ | brandMission | 深层动机 |
| Q9 | 什么人来您家最多？ | targetAudience | 客群描述 |
| Q10 | 如果搬家了，哪些客人会跟着您走？ | trustAsset / loyalty | 忠诚度证据 |

### 4.2 问题选择逻辑

根据用户画像自动选择问题路径：

```
有 logo？ → 问 logo 故事
有 IP？   → 问 IP 设计理念
开了 >10 年？ → 重点问历史和口碑
开了 <3 年？  → 重点问愿景和差异化
```

### 4.3 回答长度预期

```
最短回答：3-5 个字（"面好吃"）
典型回答：1-2 句话（"我家料足，不坑人"）
理想回答：1 段话（"我父亲开始做，传到我手里20年了..."）
```

所有长度都应被有效处理。

---

## 5. Human-to-Brand Mapping

### 5.1 映射示例表

| 用户说的（人话） | AI 翻译（品牌语言） | 对应字段 |
|------------------|-------------------|---------|
| "汤不兑水" | 品质承诺、真材实料、诚信经营 | coreValues / differentiators |
| "料比别人足" | 价值感、实在、性价比优势 | differentiators / positioning |
| "做了20年" | 历史传承、经验积累、市场验证 | brandStory / heritage |
| "几十年老顾客" | 信任资产、社区品牌、复购率 | targetAudience / loyalty |
| "不坑人" | 诚信经营、品牌人格 | brandPersona / coreValues |
| "我爸传给我的" | 家族传承、匠心精神 | brandStory / brandMission |
| "附近学生来得最多" | 核心客群：学生 + 周边居民 | targetAudience |
| "隔壁偷工减料，我不干" | 差异化定位：品质优先 | differentiators |
| "凌晨四点起床做包子" | 敬业精神、匠心、品质承诺 | brandMission / brandPersona |
| "想让附近人吃到好面" | 社区使命、普惠价值 | brandMission / brandVision |

### 5.2 映射原则

```
不夸大：用户说"做了20年" → 品牌故事写"20年" ≠ 写"百年老店"
不编造：用户没说传承 → 不虚构家族故事
不包装：小店就是小店 → 不强行写"国际化品牌愿景"
不丢失：用户反复强调的细节 → 必须出现在输出中
```

---

## 6. Output Schema

### 6.1 Discovery Layer 输出

Discovery Layer 的输出是**标准化的 ClientInfo**，与当前 `analyzeBrand()` 的输入接口一致。

```typescript
interface DiscoveredBrandInfo {
  // 必填（从采访中提取，保证非空）
  companyName: string;
  industry: string;              // 人读标签，如 "餐饮/食品"
  brandVision: string;           // 翻译后的品牌愿景
  coreValues: string;            // 翻译后的核心价值观

  // 优先提取（采访中尽可能获取）
  targetMarket: string;          // 翻译后的目标客群
  brandStory: string;            // 品牌故事（自动整理）
  differentiators: string[];     // 差异化点（3-5 条）

  // 可选（采访中可能自然出现）
  logoPhilosophy?: string;
  mascotPhilosophy?: string;
  brandPersonality?: string[];   // 中文人格标签

  // 资产信息（直接从采访上传获取）
  logoAssets?: { url: string }[];
  mascotAssets?: { url: string }[];

  // 元信息
  source: "professional" | "interview" | "assisted";
  interviewDate: string;
  confidence: number;            // Discovery 置信度
}
```

### 6.2 字段生成规则

| 用户输入 | 生成的字段 | 示例 |
|----------|-----------|------|
| "做了20年" | brandStory | "始于2006年，传承两代人的手工面馆" |
| "面好吃，料足" | brandVision | "成为本地最值得信赖的家常面馆" |
| "附近学生来得最多" | targetMarket | "周边社区居民、学生、上班族" |
| "不坑人" | coreValues | "真材实料、诚信经营、实惠定价" |
| "凌晨四点起床" | brandPersonality | ["敬业", "匠心", "朴实"] |

---

## 7. Relationship with Existing Brand Analyst

### 7.1 架构位置

```
                           ┌─────────────────────┐
                           │   User Input        │
                           │  ("面好吃，料足")    │
                           └────────┬────────────┘
                                    │
                           ┌────────▼────────────┐
                           │  Brand Discovery    │  ← NEW
                           │  Layer              │
                           │  (人话 → 品牌语言)   │
                           └────────┬────────────┘
                                    │
                           ┌────────▼────────────┐
                           │  Standardized       │
                           │  ClientInfo         │
                           │  {brandVision, ...} │
                           └────────┬────────────┘
                                    │
                           ┌────────▼────────────┐
                           │  Brand Analyst      │  ← EXISTING（不动）
                           │  (analyzeBrand)     │
                           └────────┬────────────┘
                                    │
                           ┌────────▼────────────┐
                           │  Brand Planner      │  ← EXISTING（不动）
                           │  Design Director    │
                           │  Asset Guardian     │
                           │  Manual Composer    │
                           └─────────────────────┘
```

### 7.2 关键设计决策

| 决策 | 原因 |
|------|------|
| Discovery Layer 在 Brand Analyst 之前 | Brand Analyst 不需要知道输入来源是填表还是采访 |
| Brand Analyst 不直接面对原始小店输入 | 避免 TASK-011 的字段不匹配问题重复发生 |
| Discovery Layer 输出标准化 ClientInfo | 保证下游 Agent 无需修改 |
| 当前不修改 Brand Analyst | 冻结策略：Agent 层不动 |

### 7.3 数据流

```
小店老板："面好吃，料足，不坑人"
    ↓
Discovery Layer（采访引擎）
    ├── 采集：自然语言回答
    ├── 提取：关键词 / 情感 / 承诺
    ├── 映射：人话 → 品牌语言
    └── 输出：标准 ClientInfo
    ↓
Brand Analyst
    ├── brandVision = "成为本地最值得信赖的面馆" ✓
    ├── coreValues = "真材实料、诚信经营" ✓
    ├── targetMarket = "周边社区居民" ✓
    ├── confidence = 0.7+ ✓（因为字段不再为空）
    └── brandPersona = ["朴实", "敬业", "实在"] ✓
    ↓
下游 Agent（无需修改）
```

---

## 8. Risk & Guardrails

### 8.1 风险登记册

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| AI 夸大老店历史（5年说成"数十年"） | HIGH | 数字必须从用户回答中精确提取，不推测 |
| AI 编造传承故事（用户没提家族） | HIGH | 不虚构"家族传承"等未提及的信息 |
| 把普通小店包装成虚假老字号 | HIGH | brandStory 中明确标注信息来源 |
| 丢失用户真实细节 | MEDIUM | 用户重复 ≥2 次的关键词必须出现在输出中 |
| 翻译过度（"汤好喝" → "世界级"） | HIGH | 限制形容词等级：不超过用户原意的 2 级 |
| 采访问题太专业 | MEDIUM | 所有问题必须通过"小学文化测试" |

### 8.2 内容红线

```
禁止输出：
  ❌ "百年老店"（除非用户明确说了 100 年以上）
  ❌ "祖传秘方"（除非用户明确说了家族传承）
  ❌ "行业领先"（除非用户有可验证的证据）
  ❌ "国际品牌"（小店就是小店）
  ❌ 虚构创始人故事
  ❌ 模糊数字（"数十年"、"多年"→ 必须用精确数字）

允许输出：
  ✅ "开了 20 年的老店"
  ✅ "以真材实料赢得回头客"
  ✅ "周边社区居民的日常食堂"
  ✅ "坚持手工制作，不偷工减料"
  ✅ 用户原话引用（加引号）
```

### 8.3 质量门禁

```
用户原话引用率 ≥ 30%：输出中至少 30% 的内容来自用户原话
数字精确率 = 100%：所有数字必须精确，不模糊化
虚构内容率 = 0%：无编造内容
置信度标注：每个字段附带提取置信度（high / medium / low）
```

---

## 9. MVP Scope

### 9.1 当前阶段（仅文档）

| 交付物 | 状态 | 说明 |
|--------|------|------|
| Brand Discovery Layer 定义 | ✅ 本文档 | 概念、架构、映射 |
| 采访问题库 | ✅ 本文档 Section 4 | 10 个核心问题 |
| 人话→品牌映射表 | ✅ 本文档 Section 5 | 18 个映射示例 |
| 输出 Schema | ✅ 本文档 Section 6 | DiscoveredBrandInfo 接口 |

### 9.2 短期（V5 — Conversational Brand Discovery）

| 项 | 说明 |
|----|------|
| 采访引擎 | AI 驱动的多轮对话，动态选择问题路径 |
| 实时提取 | 边聊边提取结构化字段 |
| 标准化输出 | 直接输出 Pipeline 可用的 ClientInfo |
| UI 原型 | 聊天界面 vs. 传统表单 |

### 9.3 当前不包含

```
❌ 聊天 UI 开发
❌ Agent 修改
❌ Brand Analyst 修改
❌ Orchestrator 修改
❌ Memory 修改
❌ 数据库改动
❌ UI 重构
❌ Provider 改动
```

---

## Appendix A: 用例场景

### 场景 1：20 年面馆

```
用户："开了20年，面好吃，料足，不坑人"
    ↓
brandVision: "成为本地最值得信赖的家常面馆"
brandStory: "始于2006年的社区面馆，坚持真材实料"
coreValues: "真材实料、诚信经营、实惠定价"
brandPersona: ["朴实", "实在", "敬业"]
targetAudience: "周边社区居民、上班族、学生"
```

### 场景 2：50 年老字号烧腊店

```
用户："我爸传给我的，做了50年，老街坊都来"
    ↓
brandVision: "传承三代人的传统烧腊味道"
brandStory: "始于1970年代，传承三代的烧腊店"
coreValues: "传统工艺、品质至上、社区情怀"
brandPersona: ["传承", "匠心", "可靠"]
targetAudience: "老街坊、周边社区居民"
```

### 场景 3：新开的奶茶店

```
用户："刚开1年，年轻人喜欢来，拍照好看"
    ↓
brandVision: "为年轻人提供好看又好喝的茶饮"
brandStory: "2025年创立的年轻茶饮品牌"
coreValues: "创意、品质、社交体验"
brandPersona: ["年轻", "潮流", "活力"]
targetAudience: "年轻消费者、学生、社交媒体用户"
```

---

## Appendix B: 与 TASK-011 的关系

TASK-011 发现 Brand Analyst 失败的根因是**字段名映射断裂**。Brand Discovery Layer 从根本上解决了这个问题：

| TASK-011 问题 | Discovery Layer 方案 |
|---------------|---------------------|
| brandDescription 不映射到 brandVision | Discovery Layer 直接输出标准化的 brandVision |
| businessProfile.targetAudience 嵌套取不到 | Discovery Layer 输出扁平化 targetMarket |
| industry 用编码值"food_beverage" | Discovery Layer 输出人读标签"餐饮/食品" |
| 缺失 coreValues / logoPhilosophy | Discovery Layer 从对话中提取或提供默认值 |
| 中文关键词匹配粒度不足 | 不依赖字典匹配，直接 AI 提取 |

**Discovery Layer 不是 Band-Aid，而是填补了用户输入与系统期望之间缺失的转换层。**

---

*版本：v1 草案*
*日期：2026-05-31*
*状态：待 Review*

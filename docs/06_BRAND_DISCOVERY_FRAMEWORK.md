# 06 — Brand Discovery Framework

> 版本：V2（ChatGPT 评审后修订）
> 状态：设计文档（评审通过，进入 V2 设计）
> 核心问题：客户不会品牌语言怎么办？
> 核心答案：不要让他们写，用访谈挖掘。

---

## 一、问题定义

### 1.1 当前困局

Brand Brain V1 的表单包含以下字段：

```
品牌愿景  _______________
品牌使命  _______________
品牌定位  _______________
核心价值  _______________
目标市场  _______________
Logo设计理念  ___________
IP公仔设计理念  _________
```

对于小企业主（如开牛肉面馆28年的老板），这个表单的问题是：

| 问题 | 老板的反应 |
|------|-----------|
| 品牌愿景是什么？ | "？？？" |
| 品牌使命是什么？ | "不知道" |
| 品牌定位是什么？ | "我卖牛肉面" |
| 核心价值是什么？ | "好吃不贵"（太泛） |

**不是老板没有品牌。是老板不会说品牌语言。**

### 1.2 为什么表单模式失败

1. **抽象鸿沟**：品牌术语（愿景、使命、定位）是品牌顾问的专业语言，不是企业主的日常语言
2. **缺乏引导**：表单是"填"，不是"聊"。没有追问，没有澄清，没有挖掘
3. **无上下文感知**：老板说"牛肉面"，表单不会追问"开了几年"。老板说"真材实料"，表单不会追问"具体怎么真材实料"
4. **吓退用户**：满屏专业术语让中小企业主感觉"我不配"

### 1.3 核心认知

**客户不知道自己知道什么。**

企业主每天都在实践品牌（熬汤28年、坚持真材实料、客人像回家），但他们不会用品牌语言表述。

系统的任务是：
1. 用日常语言提问
2. 从答案中提取品牌信息
3. 翻译成结构化的 Brand Brief

---

## 二、架构设计

Brand Interview Engine 不是聊天机器人。是三个核心层的协作：

```
┌─────────────────────────────────────────────────┐
│                  用户体验层                        │
│         （看起来像聊天，本质是结构化访谈）            │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               Decision Layer                      │
│   - 当前访谈进度追踪                               │
│   - 下一问决策                                     │
│   - 完整性评估                                     │
│   - 结束判断                                       │
│   - Confidence Score（新增 V2）                    │
│   - Contradiction Detection（新增 V2）             │
│   - Anti-Pattern Check（新增 V2）                  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               Question Tree                       │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│   │ Level 1  │ │ Level 2  │ │ Level 3  │       │
│   │ 基础信息  │→│ 差异化    │→│ 情感层    │       │
│   └──────────┘ └──────────┘ └──────────┘       │
│                        │                         │
│                   ┌────▼────┐                    │
│                   │Level 4-5│                    │
│                   │愿景+资产│                    │
│                   └─────────┘                    │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               Knowledge Hub                       │
│   - 行业知识库（industry-knowledge.ts）            │
│   - 品牌词典（brand-dictionary.ts）                │
│   - 实时关键词识别与行业路由                        │
│   - 追问模板库                                     │
│   - 反面案例库（Anti-Pattern Reference）（新增 V2） │
│   - Humanization Engine（新增 V2）                 │
└──────────────────────────────────────────────────┘
```

### 完整流程（V2 更新）

```
客户
↓
Brand Interview
  ├── 基础层（Level 1）
  ├── 差异化层（Level 2）
  ├── 情感层（Level 3）
  ├── 愿景层（Level 4）
  └── 资产层（Level 5）
↓
Anti-Pattern Check ─── 命中 Anti-Pattern → 继续挖掘
↓
Diagnosis Summary（新增）
├── 系统展示"我理解您的品牌是这样的"
├── 客户确认或补充
└── 可循环追问
↓
Contradiction Scan（新增）
├── 检测前后矛盾
├── 触发澄清问题
└── 更新 Summary
↓
Brand Brief
↓
Manus
```

### 2.1 各层职责

**Question Tree**：定义"问什么"。分层的提问路径，每个问题都有明确的信息采集目标。

**Decision Layer**：决定"下一步问什么"。根据已收集的信息完整性，动态选择最优的下一个问题。判断何时信息足够，何时需要追问，何时可以结束。

**Knowledge Hub**：提供"问得更好"的能力。行业知识让问题更具体（餐饮品牌问"招牌菜"，科技品牌问"解决什么问题"），品牌词典让系统能实时理解客户关键词。

**Humanization Engine**（新增 V2）：确保提取的信息优先是人格层面（情绪、信念、价值观），而非功能层面。

---

## 三、Question Tree 设计

### 3.1 五层结构

```
Level 1: Foundational（基础信息）
  ├── 您做什么生意/产品？
  ├── 做了多少年？
  ├── 品牌叫什么名字？
  └── 有实体店还是线上为主？

Level 2: Differentiation（差异化）
  ├── 客人为什么选择您而不是同行？
  ├── 您觉得您跟同行最大的不同是什么？
  ├── 有没有哪件事是您坚持做，但同行不做的？
  └── 客人对您最常说的夸奖是什么？

Level 3: Emotional（情感层）
  ├── 您希望客人在使用您的产品时，是什么感受？
  ├── 如果用三个词形容您的品牌，您会选什么？
  ├── 有没有回头客的故事让您特别感动？
  └── 您希望客人离开后记住什么？

Level 4: Aspirational（愿景层）
  ├── 您对品牌未来有什么期待？
  ├── 有没有您特别欣赏的品牌或风格？
  └── 如果预算完全不是问题，您想怎么做？

Level 5: Asset（资产层）— 可选/根据上下文触发
  ├── 您现在有 Logo 吗？愿意上传给我们看看吗？
  ├── 有没有参考手册或喜欢的风格图片？
  └── 品牌有没有卡通形象/吉祥物？
```

### 3.2 问题设计原则

| 原则 | 解释 | 好例子 | 坏例子 |
|------|------|--------|--------|
| 具体性 | 不要抽象，要具体场景 | "客人为什么愿意一直回来？" | "请描述您的品牌价值主张" |
| 可回答性 | 老板不用思考就能答 | "开了几年？" | "请分析您的竞争优势" |
| 故事性 | 问题本身像聊天 | "有没有让您印象深刻的客人？" | "请提供客户画像" |
| 递进性 | 从简单到深入 | 先"卖什么"→再"为什么好" | 直接"您的品牌使命是什么" |
| 开放性 | 不要是非题 | "您和同行最大的不同是什么？" | "您比同行做得好吗？" |

### 3.3 问题与 Brand Dimension 映射

每个问题都有明确的采集目标：

| 问题 | 采集的 Brand Dimension | 映射方式 |
|------|----------------------|---------|
| 做什么生意/产品？ | Industry / SubCategory | Knowledge Hub 行业匹配 |
| 做了多少年？ | BrandStage (startup/growth/mature) | 数值→阶段 |
| 客人为什么选择您？ | Differentiator | 直接提取关键短语 |
| 您坚持什么同行不做？ | BrandDNA | 关键词→DNA标签 |
| 用三个词形容您的品牌？ | BrandPersona | 词典匹配 |
| 希望客人什么感受？ | BrandVoice / Emotional Value | NLP 提取 |
| 未来期待？ | BrandGoal / VisionLevel | 分类（扩张/品牌化/维持） |
| 有 Logo 吗？ | HasLogo | 布尔值 |
| 有吉祥物吗？ | HasMascot | 布尔值 |

---

## 四、Decision Layer 设计

### 4.1 核心职责

1. **追踪进度**：实时知道哪些维度的信息已经收集，哪些还有缺口
2. **选择下一问**：根据缺口优先级，决定下一个问题
3. **判断追问**：当前答案是否足够深刻；是否需要"再问一层"
4. **判断结束**：何时信息足以生成合格的 Brand Brief

### 4.2 信息完整性矩阵

系统追踪以下 8 个维度的完成度：

| 维度 | 最低接受 | 理想状态 | 权重 |
|------|---------|---------|------|
| Industry（行业） | 已识别 | 精确到子类 | P0 |
| BrandStage（品牌阶段） | 已识别 | 确认 | P0 |
| Differentiator（差异化） | ≥1 个 | ≥3 个 | P0 |
| BrandDNA（品牌核心） | ≥2 个标签 | ≥3 个标签 | P0 |
| BrandPersona（品牌气质） | ≥2 个词 | ≥3 个词 | P1 |
| BrandVoice（品牌语气） | 已识别 | 精确 | P1 |
| Vision（愿景层） | 有初步信息 | 清晰 | P2 |
| Asset（资产状况） | 已确认 | 已上传 | P2 |

### 4.3 下一问决策算法

```
1. 检查所有 P0 维度
   └── 有缺口 → 选择缺口维度中权重最高的 → 从该维度的问题池选一个
2. P0 全部完成
   └── 检查 P1 维度
   └── 有缺口 → 选择缺口维度中权重最高的
3. P0+P1 全部完成
   └── 检查 P2 维度
   └── 有缺口 → 可选/不强制
4. 所有维度达到最低接受标准
   └── 提示用户可以结束，或问"还有什么想补充的吗"
```

### 4.4 追问触发条件

当客户对某个问题的回答**信息密度高**时，自动追问：

```
客户：客人回来是因为汤头
系统：汤头和别人的有什么不同？
客户：坚持用牛骨熬6小时
系统：为什么会坚持这么做？
客户：我师傅教我的，不能偷工减料
→ 系统得到：BrandDNA = { dedication, heritage, craftsmanship }
```

触发追问的特征：
- 答案中出现具体数字（6小时、28年、3代人）
- 答案中出现情感词（坚持、热爱、骄傲）
- 答案中出现对比（别人怎样，我怎样）
- 答案中出现因果关系（因为...所以...）

### 4.5 结束条件

访谈可在以下任一条件满足时结束：

1. **完整模式**：所有 P0+P1 维度完成，可输出满分 Brief
2. **最低模式**：P0 维度全部完成，P1 至少有 1 个，用户表示"差不多了"
3. **主动结束**：用户明确表示不想继续
4. **超时保护**：用户连续 3 个问题回答"不知道"或单字

---

## 五、Knowledge Hub 集成

### 5.1 行业路由

系统识别客户行业后，问题模板自动切换：

```
行业 = "餐饮/食品" 时：
  Level 1: 招牌菜是什么？开了几年？有几家店？
  Level 2: 同行在做什么菜？您的拿手菜是什么？

行业 = "科技/互联网" 时：
  Level 1: 产品解决什么问题？用户是谁？做了多久？
  Level 2: 市场上有什么类似产品？您和他们的区别？

行业 = "零售/电商" 时：
  Level 1: 卖什么品类？客单价多少？复购率高吗？
  Level 2: 客户怎么找到您的？回头客多吗？
```

### 5.2 实时关键词识别

利用 `brand-dictionary.ts` 的词典能力，**在对话过程中实时解析**客户回答：

```
客户：我坚持用真材实料
  → 匹配词典：{"真材实料" → categories: ["匠人","专业"], weight: 8}
  → 系统可以立即追问："您觉得真材实料对于您的品牌意味着什么？"

客户：客人说像回家一样
  → 匹配词典：{"温暖" → categories: ["温暖"], weight: 7}
  → BrandPersona 部分收录 "温暖"，继续追问细节
```

### 5.3 现有代码复用

| 现有模块 | 在 Discovery 中的角色 |
|---------|---------------------|
| `brand-dictionary.ts` | 实时关键词识别，BrandPersona 标签推断 |
| `industry-knowledge.ts` | 行业路由，问题模板选择 |
| `brand-analyzer.ts` | analyzeBrand() 在 Interview 完成后作为最终分析引擎 |
| `consultation-schema.ts` | Brand Brief 输出格式参考 |

---

## 六、Brand Brief 输出

### 6.1 输出结构

```json
{
  "briefVersion": "1.0",
  "generatedAt": "2026-06-01T12:00:00Z",

  "brand": {
    "name": "老陈牛肉面",
    "industry": "food_beverage",
    "subCategory": "restaurant",
    "stage": "mature",
    "heritage": "28年"
  },

  "brandDNA": {
    "coreTags": ["匠人", "真实", "坚持"],
    "originStory": "师传三代，坚持用牛骨熬6小时汤头",
    "brandPromise": "一碗熬了28年的好汤"
  },

  "brandPersona": {
    "personality": ["烟火气", "温暖", "传统"],
    "archetype": "caregiver",
    "voice": ["authentic", "warm", "down-to-earth"]
  },

  "differentiation": {
    "keyPoints": [
      "坚持用鲜牛骨熬汤6小时，不添加勾兑",
      "28年老店，三代传承",
      "客人评价：像回家一样"
    ],
    "competitorGap": "同行普遍使用浓缩汤底，缩短熬制时间降低成本"
  },

  "customerInsight": {
    "targetAudience": "周边社区居民 + 慕名而来的食客",
    "customerValue": "真材实料、家的味道、信任感",
    "repeatRate": "高（有跨代顾客）"
  },

  "visualDirection": {
    "suggestedStyle": "traditional_warm",
    "keywordTags": ["烟火气", "温暖", "手作感", "传统"],
    "referenceImageUrl": null
  },

  "assets": {
    "hasLogo": false,
    "hasMascot": false,
    "referenceManual": null,
    "uploadedFiles": []
  },

  "businessGoal": {
    "primaryGoal": "branding",
    "secondaryGoal": "packaging",
    "budgetLevel": "待确认"
  },

  "confidence": {
    "overallScore": 82,
    "dimensions": {
      "industry": { "complete": true, "confidence": 95 },
      "brandStage": { "complete": true, "confidence": 90 },
      "differentiator": { "complete": true, "confidence": 85 },
      "brandDNA": { "complete": true, "confidence": 80 },
      "brandPersona": { "complete": true, "confidence": 75 },
      "brandVoice": { "complete": true, "confidence": 70 },
      "vision": { "complete": false, "confidence": 50 },
      "assets": { "complete": true, "confidence": 95 }
    },
    "flags": [],
    "contradictions": []
  },

  "interviewSummary": {
    "totalQuestions": 12,
    "durationMinutes": 8,
    "completeness": {
      "industry": "confirmed",
      "brandStage": "confirmed",
      "differentiator": "confirmed (3 points)",
      "brandDNA": "confirmed (3 tags)",
      "brandPersona": "confirmed (3 tags)",
      "brandVoice": "inferred",
      "vision": "partial",
      "assets": "confirmed"
    },
    "rawTranscript": [
      {"q": "您做什么生意？", "a": "开牛肉面馆"},
      {"q": "做了多少年？", "a": "28年了"},
      ...
    ]
  }
}
```

### 6.2 输出用途

Brand Brief 是 Brand Brain 的最终输出，也是下游系统的输入：

```
Brand Brief
  ├── → Manus：直接用于生成 VI 手册
  ├── → 人工设计师：作为设计需求文档
  ├── → Brand Brain 后续引擎：DNA Engine / Maturity Engine 的分析输入
  └── → 客户留存：生成品牌诊断报告，让客户看到"原来我有品牌"
```

---

## 七、设计边界

### 7.1 不要做的

| 不应该做的事 | 原因 |
|-------------|------|
| 不要设计自由聊天模式 | 用户偏离主题后难以拉回，效率低 |
| 不要用 GPT 风格的长回复 | 老板不需要 AI 的彩虹屁，需要被引导说出信息 |
| 不要一次性问多个问题 | 认知负荷高，容易放弃 |
| 不要在对话中展示品牌术语 | "根据您的回答，我判断您的品牌定位是..."——老板看不懂 |
| 不要在过程中给评分/打分 | 会让老板觉得在被考试 |

### 7.2 要做的

| 应该做的事 | 原因 |
|-----------|------|
| 每次只问一个问题 | 降低回答门槛 |
| 用肯定语气过渡 | "好的，信息很有价值" → 维持参与感 |
| 答案中提取关键词做轻反馈 | "28年，三代传承，非常有故事" |
| 允许客户跳过 | "这个问题不太好回答的话，我们换个角度" |
| 结束时展示"我理解的对吗" | 让客户确认，提高准确率 |

### 7.3 异常处理

| 场景 | 处理方式 |
|------|---------|
| 客户连续回答"不知道" | 3 次后主动提议结束，输出当前已收集内容 |
| 客户回答过长/离题 | 礼貌打断："您说的很有价值，我总结一下..." 然后确认并引导回正题 |
| 客户上传资料后想跳过问题 | 允许。上传的 Logo 和参考图本身包含信息 |
| 客户中途关闭页面 | 保存已收集内容，下次进入可继续 |

---

## 八、与现有系统的关系

```
现有 ConsultationForm（保留作为降级入口）
  ↓ （客户不会填时）

Brand Interview Engine（新）
  ↓ 产出 Brand Brief

Brand Brief
  ├── → Brand Analyzer（改造复用）
  │      analyzeBrand() 输入从"表单"改为"Brief"
  │      输出 BrandProfile
  ├── → Brand Dictionary（保留）
  │      实时关键词识别
  ├── → Industry Knowledge（保留）
  │      行业路由 + 问题模板
  └── → Module Planner（改造复用）
         Brief → ModulePlan 映射

Brand Brief
  └── → Manus（执行层）
         Brand Brief 直接作为 Manus 的输入需求文档
```

---

## 九、V2 新增：Brand Confidence Score

### 9.1 为什么需要

信息完整性（维度是否填满）不等于信息可信度。例如：

| 客户回答 | 维度完成 | 可信度 |
|---------|---------|--------|
| "坚持熬汤28年" | 已收集 | 高 |
| "应该吧，差不多那样" | 已收集 | 极低 |
| "高端吧" | 已收集 | 低（模糊） |
| "不知道" | 未收集 | 无 |

**完整性告诉你"有没有"；Confidence 告诉你"对不对"。**

### 9.2 Confidence Score 模型

每个问题答案的 Confidence = 三个维度的加权和：

```
Confidence = LanguageScore × 0.4 + SpecificityScore × 0.4 + ConsistencyScore × 0.2
```

**LanguageScore（语言确定性）**：

| 回答特征 | 分数 | 例子 |
|---------|------|------|
| 肯定、坚定 | 100 | "绝对是"、"我坚持"、"一直都是" |
| 中性陈述 | 70 | "是的"、"对"、"就是这样的" |
| 模糊 | 40 | "应该吧"、"差不多"、"可能" |
| 不确定 | 10 | "不知道"、"没想过"、"随便" |
| 跳过/不答 | 0 | 沉默或直接跳过 |

**SpecificityScore（具体度）**：

| 回答特征 | 分数 | 例子 |
|---------|------|------|
| 具体数字/事实 | 100 | "28年"、"6小时"、"三代" |
| 具体描述 | 80 | "用牛骨熬汤，不添加勾兑" |
| 一般描述 | 50 | "做吃的"、"服务行业" |
| 抽象/笼统 | 20 | "追求卓越"、"客户至上" |
| 无实质内容 | 0 | "就是那样" |

**ConsistencyScore（一致性）**：

与前面已收集信息的一致性。初次回答默认为 70，后续根据 Contradiction Detection 调整。

### 9.3 维度级别的 Confidence

每个 Brand Dimension 有一个独立的 Confidence：

| 维度 | Confidence 计算方式 |
|------|-------------------|
| Industry | 行业识别准确度（如果匹配到知名品牌名称，置信度高） |
| BrandStage | 基于具体年限数值（说"28年"比说"很久了"置信度高） |
| Differentiator | 答案 SpecificityScore 的平均值 |
| BrandDNA | 答案 SpecificityScore 的平均值 |
| BrandPersona | 至少 2 个明确关键词匹配 |
| BrandVoice | 至少 1 个明确关键词匹配 |
| Vision | 答案 SpecificityScore |
| Asset | 布尔值，如果上传文件则为 100 |

### 9.4 整体 Confidence

整体 Confidence Score = 各维度 Confidence 的加权平均值（按 P0/P1/P2 权重）。

```
整体置信度场景：
  82 → 高质量访谈，Brief 可信
  60 → 信息基本完整，但部分模糊，建议补充
  40 → 多处模糊或矛盾，不建议进入 Brief 生成
  20 → 访谈失败，建议重新开始
```

### 9.5 对 Decision Layer 的影响

- Confidence < 60 的 P0 维度 → 系统需要追问（换一种问法再试）
- 连续 3 次追问同一维度 Confidence 无提升 → 标记为"低置信度，进入下一步"
- 整体 Confidence < 50 → 系统不应输出 Brief，应建议"信息还不够，我们换个角度聊"
- Brief 中标注每个维度的 Confidence → 下游 Manus 知道哪些信息可信，哪些需要进一步确认

---

## 十、V2 新增：Contradiction Detection

### 10.1 为什么需要

客户访谈中经常出现前后矛盾：

```
场景 A：
客户前面说"价格亲民"，后面说"我们要做高端定制"
→ 两种定位可以共存，但需要澄清优先级

场景 B：
客户前面说"年轻潮流"，后面说"传统老字号"
→ 两个方向矛盾，必须让客户做选择

场景 C：
客户前面说"坚持手工制作"，后面说"我们要自动化生产"
→ 核心工艺路线矛盾，影响后续 VI 方向
```

如果不检测矛盾，Brief 会输出自相矛盾的信息，导致生成的 VI 手册风格混乱。

### 10.2 矛盾检测矩阵

定义三组不可同时出现的维度的组合：

| 矛盾组 | 冲突维度 | 示例 |
|--------|---------|------|
| 价格定位 | "价格亲民" ↔ "高端/奢侈" | 面向所有人 vs 专属高端 |
| 风格定位 | "年轻潮流" ↔ "传统老字号" | 创新前卫 vs 经典传承 |
| 工艺路线 | "手工定制" ↔ "规模化/标准化" | 单件精工 vs 批量生产 |
| 情感基调 | "专业权威" ↔ "亲切随和" | 严肃正式 vs 轻松随意 |
| 规模感 | "私密小众" ↔ "大众市场" | 圈子文化 vs 广泛覆盖 |

### 10.3 检测时机

1. **实时检测**：每个新答案收集后，与已有信息做二次检查
2. **最终扫描**：Brief 生成前，做一次全局扫描

### 10.4 触发澄清

检测到矛盾后，不自动消除，而是触发澄清问题：

```
发现矛盾：价格亲民 ↔ 高端定制

系统反问：
"您刚刚提到'价格亲民'，又提到'高端定制'。
如果现在只能选一个作为品牌未来方向，您更倾向哪个？"

→ 客户回答后，保留最终选择，将另一方向标注为"次要/放弃"
```

澄清问题的设计原则：
- 直接引用客户原话（"您刚刚提到..."）→ 客户觉得被倾听
- 给出确认的选项 → 不要让客户感觉在被质问
- 允许"两者兼顾" → 有些品牌确实可以，但必须明确主次

### 10.5 Brief 中的标注

Brief 中增加 `contradictions` 字段：

```json
"contradictions": [
  {
    "pair": ["价格亲民", "高端定制"],
    "status": "resolved",
    "resolution": "选择高端定制作为主方向，价格亲民作为辅助定位",
    "triggeredQuestion": "您更倾向哪个？"
  }
]
```

未解决的矛盾 → 整体 Confidence 降低 20 分 → 系统建议在确认阶段由客户澄清。

---

## 十一、V2 新增：Diagnosis Summary 确认环节

### 11.1 流程变更

```
V1 流程：
  Interview → Brief → Manus

V2 流程：
  Interview
    ↓
  Anti-Pattern Check → 命中 → 继续挖掘
    ↓
  Diagnosis Summary（新增）
    ↓
  客户确认 → 补充/修正 → 循环
    ↓
  Contradiction Scan
    ↓
  Brand Brief
    ↓
  Manus
```

### 11.2 Diagnosis Summary 的内容

Interview 结束后，系统不直接输出 Brief，而是先输出一份**人类可读的品牌诊断摘要**：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          品牌诊断报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

陈记牛肉面 · 餐饮行业 · 经营28年

━━━ 我对您的品牌理解 ━━━

您做的是：牛肉面馆，开了28年，位于社区周边
您的核心优势：坚持用鲜牛骨熬汤6小时，同行用浓缩汤底
您的品牌人格：温暖、传统、烟火气、给人"像回家一样"的感觉
您坚持的信念：师传手艺不能偷工减料，真材实料是底线
您的客户群体：周边老顾客为主，有跨代消费的家庭

━━━ 我判断您的品牌画像 ━━━

品牌类型：匠心老字号
品牌气质：温暖传统 · 烟火气息
品牌阶段：成熟期（28年沉淀）
核心标签：匠人、真实、坚持

━━━ 接下来 ━━━

以上是我对您品牌的理解。
请确认：
1. 这些描述准确吗？
2. 有没有什么重要信息我漏掉了？
3. 有什么想补充或者修正的吗？
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 11.3 为什么这一步价值极高

| 原因 | 说明 |
|------|------|
| 客户第一次看到"品牌画像" | 很多老板不知道自己有品牌，看到总结后会有"原来我有品牌"的感觉 |
| 激发补充信息 | "哦对了，我们还有..."——这是 Interview 阶段不会主动说的 |
| 修正错误理解 | "不是的，我们不是做牛肉面的，我们是做牛肉干的"——行业判断错误时及时纠正 |
| 建立信任 | 客户觉得系统真的听懂了，愿意继续下一步 |

### 11.4 客户确认后的动作

| 客户操作 | 系统响应 |
|---------|---------|
| "准确，没问题" | 进入 Contradiction Scan → Brief 生成 |
| "还有补充" | 记录补充信息 → 更新 Diagnosis Summary → 再次确认 |
| "不对，应该是..." | 修正错误 → 重新分析 → 更新 Summary → 再次确认 |
| "我再想想" | 保存当前进度，客户可随时回来继续 |

### 11.5 补充追问的智能路由

客户补充信息后，系统判断补充内容是否涉及新的未覆盖维度：

```
客户补充："对了，我们也有做外卖，年轻人点得很多"
  → 补充 BrandPersona：新增"年轻化"倾向
  → 补充 CustomerInsight：新增外卖场景
  → 更新 Summary 后再次确认："我补充了外卖这部分，您看对吗？"
```

---

## 十二、V2 新增：Anti-Pattern Check

### 12.1 什么是 Anti-Pattern

参考反面案例库，在访谈过程中识别以下危险信号：

| Anti-Pattern | 表现 | 风险 |
|-------------|------|------|
| 全是功能（Feature-Only） | "我们的牛肉面很大碗"、"分量足"、"价格便宜" | 品牌没有情感连接 |
| 没有人格（No Persona） | 所有回答都是"产品好"、"材料好"、"技术好" | 品牌没有人格特征 |
| 没有故事（No Story） | 没有提到"怎么开始的"、"为什么做这个"、"谁教的" | 品牌缺乏温度 |
| 没有情绪（No Emotion） | 没有提到"感动"、"骄傲"、"热爱"、"坚持" | 品牌缺乏共鸣 |
| 没有差异化（No Difference） | "都差不多"、"和同行一样"、"市场就这样" | 品牌没有存在理由 |
| 全是技术（Tech-Only） | "我们用最新的设备"、"我们有专利"、"参数很高" | B2B 可以，B2C 远远不够 |

### 12.2 检测方式

Interview 过程中实时监测：

```
场景：客户回答了 6 个问题，全是规格和功能

系统判断：
  - 功能相关关键词密度 > 70%
  - 情感相关关键词密度 < 10%
  - 无故事/无人物/无场景提及
  ↓
  命中 Anti-Pattern: Feature-Only

系统动作：
  不进入下一层问题
  从 Humanization Layer 选择一个挖掘问题：
  "您做这个产品/生意，最初的动力是什么？"
```

### 12.3 Anti-Pattern 与 Decision Layer 的集成

```
Decision Layer
  ├── 正常模式：按 Question Tree 逐层推进
  ├── Anti-Pattern 模式：停留在当前层级，插入 Humanization 追问
  └── 恢复条件：Anti-Pattern 检测不再命中
       → 继续正常 Question Tree 流程
```

### 12.4 强行终止

Interview 结束时如果仍然命中 Anti-Pattern：

| 条件 | 系统行为 |
|------|---------|
| 所有维度完成 + 无 Anti-Pattern | 进入 Diagnosis Summary |
| 所有维度完成 + 命中 Anti-Pattern | 提示："我感觉聊了很多产品特点，想再了解一下您的想法..." 追加 2-3 个 Humanization 问题 |
| 客户拒绝 + 命中 Anti-Pattern | 在 Brief 中标注 "BrandPersona: low confidence (anti-pattern: feature-only)" |
| 强行结束 | 允许。留下"部分信息不足"的记录 |

---

## 十三、V2 新增：Humanization Layer

### 13.1 核心原则

```
品牌首先是人格，不是功能清单。
```

### 13.2 信息提取优先级

Interview 结束时，系统从所有答案中提取信息时，严格按以下优先级排序：

```
P0（最高优先级 — 品牌人格的核心）
├── 情绪：客户在描述品牌时的情绪词汇
│    例：骄傲、热爱、感动、担心、期待
├── 信念：客户明确表达的价值观
│    例："不能偷工减料"、"要对得起客人"
├── 坚持：客户反复强调的行为
│    例："坚持熬汤"、"坚持选好料"
├── 故事：客户提到的具体人物/事件
│    例："我师傅教的"、"那个老客人来了20年"
└── 价值观：可推导的品牌行为准则
      例：真材实料、传承、诚信

P1（中优先级 — 品牌外部表现）
├── 人格特征：温暖、专业、创新
├── 语气语调：亲切、正式、活泼
└── 视觉倾向：传统、现代、自然

P2（低优先级 — 功能属性）
├── 产品规格：大小、价格、材质
├── 技术能力：设备、专利、效率
└── 市场份额：规模、渠道、数据
```

### 13.3 Humanization Engine

Humanization Engine 是 Knowledge Hub 的子模块，职责：

1. **识别**：从客户回答中提取 P0 优先级的信息
2. **评分**：评估 Interview 整体的"H 分数"（Humanization Score）
3. **建议**：当 H 分数不足时，向 Decision Layer 建议 Humanization 追问

**H 分数计算**：

```
H Score = (P0 命中数 × 20 + P1 命中数 × 10) / 最大可能分数 × 100

例：
  P0 命中 3 个（情绪、信念、坚持）= 60
  P1 命中 2 个（人格特征、语气）= 20
  H Score = 80 / 100  ← 健康的品牌画像

如果：
  P0 命中 0 个
  P1 命中 1 个
  H Score = 10 / 100  ← 严重不足，触发 Anti-Pattern
```

### 13.4 Humanization 追问池

当 H 分数不足时，系统从以下追问池选择：

```
通用：
  1. 您做这个生意，最初的动力是什么？
  2. 有没有让您特别有成就感的事？
  3. 如果客人只能记住您一件事，您希望是什么？

餐饮/消费品：
  1. 您的招牌菜是怎么研发出来的？
  2. 有没有客人因为您的产品而感动过？
  3. 您最在乎客人对产品的哪个评价？

科技/服务：
  1. 您最初为什么想解决这个问题？
  2. 用户最让您感动的反馈是什么？
  3. 您的团队最自豪的是什么？

零售/电商：
  1. 您选品的原则是什么？
  2. 有没有让您印象特别深刻的买家？
  3. 您最不愿意在哪个方面妥协？
```

这些追问的设计原则：
- 不直接问"您的品牌人格是什么"（还是抽象）
- 问具体场景，从场景中提取人格
- 每个问题都为挖掘一个 P0 维度设计

### 13.5 Humanization Layer 在流程中的位置

```
Level 1（基础信息）→ 正常问答
  ↓
Level 2（差异化）→ 正常问答
  ↓
Humanization Check ← 每层结束后执行
  ├── H Score ≥ 60 → 继续下一层
  ├── H Score 30-59 → 追加 1 个 Humanization 追问
  └── H Score < 30 → 追加 2 个 Humanization 追问
  ↓
Level 3（情感层）→ 本身就是 Humanization 密集型
  ↓
Level 4-5
```

---

## 十四、V2 新增：Brand Brief 中的 Confidence 字段

Brief JSON 新增以下字段（详见 6.1 节的完整示例）：

```json
"confidence": {
  "overallScore": 82,
  "dimensions": {
    "industry": { "complete": true, "confidence": 95, "flags": [] },
    "brandStage": { "complete": true, "confidence": 90, "flags": [] },
    "differentiator": { "complete": true, "confidence": 85, "flags": [] },
    "brandDNA": { "complete": true, "confidence": 80, "flags": [] },
    "brandPersona": { "complete": true, "confidence": 75, "flags": ["anti-pattern:feature-only-resolved"] },
    "brandVoice": { "complete": true, "confidence": 70, "flags": [] },
    "vision": { "complete": false, "confidence": 50, "flags": ["low-confidence"] },
    "assets": { "complete": true, "confidence": 95, "flags": [] }
  },
  "flags": [
    "contradiction:resolved:价格亲民↔高端定制",
    "anti-pattern:feature-only:resolved"
  ],
  "contradictions": [
    {
      "pair": ["价格亲民", "高端定制"],
      "status": "resolved",
      "resolution": "选择高端定制作为主方向",
      "triggeredQuestion": "您更倾向哪个？"
    }
  ],
  "humanizationScore": 74,
  "overallAssessment": "Brief 质量良好。大部分维度置信度高。Vision 维度信息不足，建议在后续沟通中补充。"
}
```

下游系统（Manus / 设计师）可以根据 Confidence 字段：
- 高置信度字段：直接使用
- 低置信度字段：在生成时作为"弱建议"或"留空让客户确认"
- 矛盾标记：在生成时避免同时使用冲突方向

---

## 十五、与现有系统的关系（V2 更新）

```
现有 ConsultationForm（保留作为降级入口）
  ↓ （客户不会填时）

Brand Interview Engine（新）
  ├── Question Tree（问题库）
  ├── Decision Layer（进度 + 下一问 + Confidence + Contradiction + Anti-Pattern）
  ├── Knowledge Hub（行业知识 + 词典 + 反面案例 + Humanization Engine）
  └── Diagnosis Summary（确认环节）
  ↓

Anti-Pattern Check  ← 命中 → 继续挖掘
  ↓

Diagnosis Summary → 客户确认/补充/修正
  ↓

Contradiction Scan ← 命中 → 澄清问题
  ↓

Brand Brief
  ├── 包含 Confidence Score
  ├── 包含 Contradiction 记录
  ├── 包含 Humanization Score
  └── 包含 Anti-Pattern 处理记录
  ↓

Manus（执行层）
```

---

## 十六、下一步

1. ChatGPT 评审 V2 新增内容
2. 评审通过后进入 Decision Layer V2 设计阶段
3. Decision Layer V2 设计包括：
   - Question Tree JSON 数据结构
   - Confidence Score 算法实现
   - Contradiction Detection 算法
   - Anti-Pattern Check 逻辑
   - Humanization Engine 集成
   - Diagnosis Summary 模板
   - Brand Brief Generator
4. 各设计完成后经评审再进入开发

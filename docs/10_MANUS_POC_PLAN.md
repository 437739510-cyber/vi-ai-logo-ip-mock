# 10 — Manus PoC Plan

> 目的：验证 Manus 是否能根据 Brand Brief 生成可接受的 VI 手册
> 测试日期：待 CEO 获取 Manus API Key 后执行
> 评估标准：椰岛工坊案例 ≈ 70 分以上为通过

---

## 一、PoC 目标

1. **验证 Manus API 的可用性** — 从认证到任务创建到结果获取的全链路是否通畅
2. **验证生成质量** — Manus 产出的 VI 手册是否达到或超过当前 Brand Brain 自研管道的水平
3. **识别差距** — Manus 擅长什么、不擅长什么，Brand Brain 需要在哪些方面补强
4. **为架构决策提供依据** — 确定 Brand Brain + Manus 的分工边界

---

## 二、测试案例

### 案例 1：老陈牛肉面（传统餐饮）

**品牌背景：** 社区牛肉面馆，经营 28 年，三代传承

**Brand Brief：**

```json
{
  "briefVersion": "1.0",
  "brand": {
    "name": "老陈牛肉面",
    "englishName": "Chen's Beef Noodle",
    "industry": "food_beverage",
    "subCategory": "restaurant",
    "stage": "mature",
    "heritage": "28年"
  },
  "brandDNA": {
    "coreTags": ["匠人", "真实", "坚持"],
    "originStory": "师传三代，坚持用牛骨熬6小时汤头。师傅说：不能偷工减料，要对得起客人。",
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
    "customerValue": "真材实料、家的味道、信任感"
  },
  "visualDirection": {
    "suggestedStyle": "traditional_warm",
    "keywordTags": ["烟火气", "温暖", "手作感", "传统"],
    "colorHints": ["暖棕色系", "米色", "深红"],
    "typographyHints": ["手写风格标题", "圆润亲切"]
  },
  "assets": {
    "hasLogo": false,
    "hasMascot": false
  },
  "businessGoal": {
    "primaryGoal": "branding",
    "budgetLevel": "中小"
  }
}
```

**测试要点：**
- 无 Logo 情况下，Manus 是否能从头设计品牌视觉
- 传统餐饮品牌的视觉语言是否到位（温暖、烟火气）
- 品牌故事是否能在手册中体现

---

### 案例 2：智方增长（企业服务）

**品牌背景：** B2B 增长咨询服务公司，成立 5 年，服务中型企业

**Brand Brief：**

```json
{
  "briefVersion": "1.0",
  "brand": {
    "name": "智方增长",
    "englishName": "ZhiFang Growth",
    "industry": "technology_it",
    "subCategory": "saas",
    "stage": "growth",
    "heritage": "5年"
  },
  "brandDNA": {
    "coreTags": ["专业", "创新", "可信赖"],
    "originStory": "由三位前麦肯锡顾问创立，专注为中型企业提供数据驱动的增长策略。",
    "brandPromise": "让每一家企业的增长都有据可依"
  },
  "brandPersona": {
    "personality": ["专业", "理性", "前瞻"],
    "archetype": "sage",
    "voice": ["professional", "confident", "clear"]
  },
  "differentiation": {
    "keyPoints": [
      "自研增长诊断模型，覆盖 200+ 行业指标",
      "合伙人亲自带队，不外包",
      "客户续约率 85%"
    ],
    "competitorGap": "传统咨询公司交付周期长、价格高；纯工具类 SaaS 缺乏策略深度"
  },
  "customerInsight": {
    "targetAudience": "中型企业 CEO / 增长负责人",
    "customerValue": "可量化的增长结果、专业的策略指导"
  },
  "visualDirection": {
    "suggestedStyle": "modern_professional",
    "keywordTags": ["专业", "数据感", "简洁", "国际范"],
    "colorHints": ["深蓝", "灰", "点缀亮蓝"],
    "typographyHints": ["无衬线字体", "干净利落"]
  },
  "assets": {
    "hasLogo": true,
    "logoDescription": "现有 Logo 为文字标'智方增长'，无图形标",
    "hasMascot": false
  },
  "businessGoal": {
    "primaryGoal": "branding",
    "secondaryGoal": "ppt_template",
    "budgetLevel": "中高"
  }
}
```

**测试要点：**
- 企业服务品牌的视觉语言是否专业、可信
- 有 Logo（文字标）的情况下，Manus 是否能合理扩展 VI 系统
- B2B 品牌的应用场景（PPT 模板、提案文件）是否完整

---

### 案例 3：小智猫（IP 品牌）

**品牌背景：** 新消费宠物用品品牌，面向年轻养猫人群，成立 2 年

**Brand Brief：**

```json
{
  "briefVersion": "1.0",
  "brand": {
    "name": "小智猫",
    "englishName": "XiaoZhi Cat",
    "industry": "retail_ecommerce",
    "subCategory": "pet_supplies",
    "stage": "startup",
    "heritage": "2年"
  },
  "brandDNA": {
    "coreTags": ["年轻", "有趣", "温暖"],
    "originStory": "创始人是资深猫奴，发现市面上的猫用品设计都太'人本位'，想做真正从猫的需求出发的产品。",
    "brandPromise": "让每一只猫都被温柔以待"
  },
  "brandPersona": {
    "personality": ["年轻", "治愈", "有态度"],
    "archetype": "regular_guy",
    "voice": ["playful", "warm", "trendy"]
  },
  "differentiation": {
    "keyPoints": [
      "产品设计从猫的行为学出发，而非从人类审美出发",
      "每款产品都有猫咪测试官（真实猫）参与测评",
      "社交媒体内容自带萌宠流量"
    ],
    "competitorGap": "传统宠物品牌设计偏成熟/功能导向，缺乏年轻化的视觉语言和 IP 属性"
  },
  "customerInsight": {
    "targetAudience": "25-35 岁城市养猫人群，女性为主",
    "customerValue": "对猫好、设计好看、有社交分享价值"
  },
  "visualDirection": {
    "suggestedStyle": "playful_modern",
    "keywordTags": ["治愈", "猫元素", "年轻", "ins风"],
    "colorHints": ["奶白", "橘色", "薄荷绿"],
    "typographyHints": ["圆体", "活泼"],
    "mascotHint": "建议设计品牌 IP 公仔：一只有个性的猫"
  },
  "assets": {
    "hasLogo": false,
    "hasMascot": false
  },
  "businessGoal": {
    "primaryGoal": "branding",
    "secondaryGoal": "social_media",
    "budgetLevel": "中"
  }
}
```

**测试要点：**
- 年轻化品牌的视觉语言是否到位
- Manus 是否能自主设计 IP 公仔形象
- 社交媒体场景的 VI 规范是否完整

---

## 三、Brand Brief 标准格式

PoC 使用的 Brand Brief 采用固定 JSON Schema，三个案例统一格式：

```typescript
interface BrandBrief {
  briefVersion: string;           // 版本号
  brand: {
    name: string;                 // 品牌名称
    englishName?: string;         // 英文名称
    industry: string;             // 行业
    subCategory?: string;         // 子类
    stage: "startup" | "growth" | "mature" | "rebranding";
    heritage?: string;            // 经营年限描述
  };
  brandDNA: {
    coreTags: string[];           // 3 个核心标签
    originStory: string;          // 品牌起源故事（1-2 句）
    brandPromise: string;         // 品牌承诺（一句话）
  };
  brandPersona: {
    personality: string[];        // 3 个人格特征词
    archetype: string;            // 品牌原型
    voice: string[];              // 语气特征
  };
  differentiation: {
    keyPoints: string[];          // 差异化要点（3 个）
    competitorGap?: string;       // 与同行的差距
  };
  customerInsight: {
    targetAudience: string;       // 目标客群
    customerValue: string;        // 客户价值
  };
  visualDirection: {
    suggestedStyle: string;       // 风格方向
    keywordTags: string[];        // 视觉关键词
    colorHints?: string[];        // 色彩提示
    typographyHints?: string[];   // 字体提示
    mascotHint?: string;          // IP 公仔提示（可选）
  };
  assets: {
    hasLogo: boolean;             // 是否有 Logo
    logoDescription?: string;     // Logo 描述（可选）
    hasMascot: boolean;           // 是否有 IP 公仔
    referenceUrls?: string[];     // 参考图链接（可选）
  };
  businessGoal: {
    primaryGoal: string;          // 核心目标
    secondaryGoal?: string;       // 次要目标
    budgetLevel: string;          // 预算层级
  };
}
```

---

## 四、评估维度与评分标准

### 评分维度（7 项）

| # | 维度 | 权重 | 说明 |
|---|------|------|------|
| 1 | Logo 逻辑 | 15% | Logo 设计是否合理、是否体现品牌特征、是否可商用 |
| 2 | 品牌故事 | 15% | 手册是否传递了品牌故事和价值观 |
| 3 | 品牌人格 | 15% | 视觉语言是否与品牌人格一致 |
| 4 | 色彩一致性 | 15% | 色彩体系是否合理、是否贯穿全手册 |
| 5 | 规范完整度 | 15% | VI 规范是否覆盖基础系统 + 应用系统 |
| 6 | 应用场景 | 15% | 应用场景是否匹配品牌实际需求 |
| 7 | 商业可接受度 | 10% | 产出的 VI 手册是否能直接给客户看 |

### 评分细则

每项 0-10 分：

| 分数 | 含义 |
|------|------|
| 9-10 | 超越预期，可以直接交付 |
| 7-8 | 达到预期，小幅修改后可交付 |
| 5-6 | 基本可用，需要一定修改 |
| 3-4 | 方向对但质量不足 |
| 1-2 | 严重问题 |
| 0 | 完全不可用 |

### 总分计算

```
总分 = Σ(单项得分 × 权重) / 10 × 100
```

通过标准：**总分 ≥ 70 分**（对标椰岛工坊案例质量）

---

## 五、执行计划

### 步骤

| 阶段 | 操作 | 负责人 |
|------|------|--------|
| 1. 准备 | CEO 在 manus.im 注册并生成 API Key | CEO |
| 2. 发包 | Codex 用每个案例的 Brand Brief 调用 `POST /v2/task.create` | Codex |
| 3. 等待 | Manus 异步执行任务（预计 5-15 分钟/案例） | 自动 |
| 4. 收结果 | 通过 `task.listMessages` 或 Webhook 获取结果 | Codex |
| 5. 评估 | 按 7 个维度逐一评分 | Codex + CEO |
| 6. 汇总 | 输出 PoC 评估报告 | Codex |

### 时间预估

| 案例 | 预计 Manus 执行时间 | 
|------|-------------------|
| 老陈牛肉面 | 5-10 分钟 |
| 智方增长 | 8-15 分钟 |
| 小智猫 | 10-20 分钟（含 IP 设计） |

---

## 六、风险记录模板

PoC 执行过程中记录：

```markdown
## Manus PoC 风险记录

### Manus 做得好的部分
- [待填充]

### Manus 做得差的部分
- [待填充]

### Brand Brain 未来需要补强的部分
- [待填充]

### 意外发现
- [待填充]
```

---

## 七、后续决策

PoC 完成后，根据结果决定：

| 结果 | 决策 |
|------|------|
| 三个案例均 ≥ 70 分 | Manus 可通过，进入 07_DECISION_LAYER_V2.md + 集成开发 |
| 两个案例 ≥ 70 分 | Manus 基本可用，需要针对弱项补充 prompt 优化 |
| 一个案例 ≥ 70 分 | Manus 部分可用，Brand Brain 需要保留自研管道作为备选 |
| 全部 < 70 分 | Manus 当前不适合作为执行层，回归自研管道方案 |

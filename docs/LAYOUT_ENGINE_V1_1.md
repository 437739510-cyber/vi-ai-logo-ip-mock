# Layout Engine V1.1 — 架构升级设计

> 版本：V1.1-DRAFT
> 基于 V1 评审结果（85/100），新增四个引擎模块
> 状态：设计文档（待评审）
> 核心原则不变：AI 负责内容，Layout Engine 负责设计

---

## 一、V1 → V1.1 架构升级总览

### V1 保留模块

```
✅ Layout Engine Core
✅ Pattern Library（布局模式库）
✅ Asset Guard（资产保护）
✅ Scoring System（评分系统）
✅ Page Library（页面类型库）
```

### V1.1 新增模块

```
A. Brand DNA Engine    — 品牌人格提取 → 决定设计语言
B. Industry Engine     — 行业视觉语言 → 决定布局风格
C. Chapter Engine      — 章节系统     → 组织成设计书
D. Brand Level Engine  — 品牌等级识别  → 决定排版策略
```

### V1 修改项

```
IP 规则修改：
  "IP 不超过 Logo 80%" → "IP 尺寸由版面决定，不变形即可"
```

### 完整架构（V1.1）

```
输入：品牌资料 + 行业信息
  ↓
Brand DNA Engine        ─── 品牌人格 / 气质 / 核心价值
  ↓
Industry Engine         ─── 行业视觉语言 / 色彩倾向 / 排版风格
  ↓
Brand Level Engine      ─── L1~L5 等级识别 → 排版复杂度
  ↓
Chapter Engine          ─── 章节结构 → 一本设计书
  ↓
Layout Engine Core      ─── 模式选择 + 内容适配 + 样式解析
  ↓
Pattern Library         ─── 具体布局模式
  ↓
Asset Guard + Scorer    ─── 资产保护 + 质量评分
  ↓
输出：VI 手册（PNG/PDF）
```

---

## 二、Brand DNA Engine（品牌 DNA 引擎）

### 定位

```
Brand DNA Engine 解决的核心问题：
  不是"生成20页"，而是"理解这个品牌"。

它位于整个管线的第一层，
在所有设计决策之前执行。
```

### 输入

```
品牌资料：
  - 公司名称
  - 行业
  - 品牌描述（一段文字）
  - 品牌理念（可选）
  - Logo 图片
  - IP 图片（如有）
  - 品牌色系（如有）
  - 产品图片（如有）
  - 门店图片（如有）

Source: 来自 Step 1 品牌分析 + 用户提交资料
```

### 输出 — 品牌 DNA 画像

```typescript
interface BrandDNA {
  // === 品牌人格 ===
  archetype: BrandArchetype;        // 品牌原型
  personality: BrandPersonality[];  // 品牌性格标签
  tone: BrandTone;                  // 品牌语调

  // === 品牌气质 ===
  aura: BrandAura[];                // 品牌气质关键词
  emotionalValue: string;           // 品牌情感价值

  // === 核心价值 ===
  coreValue: string;                // 一句话核心价值
  brandPromise: string;             // 品牌承诺
  differentiation: string;          // 差异化定位

  // === 视觉指引 ===
  visualKeywords: string[];         // 视觉关键词
  designDirection: DesignDirection; // 设计方向
}
```

### 品牌原型系统（Archetype System）

```
12 种品牌原型：

┌────────────────────────────────────────────────────┐
│  1. Innocent（纯真者）— 自然、健康、真实               │
│     代表：多芬、可口可乐                             │
│     视觉语言：圆润、柔和、自然色、有机形状               │
├────────────────────────────────────────────────────┤
│  2. Sage（智者）— 知识、专业、可靠                     │
│     代表：IBM、哈佛                                 │
│     视觉语言：清晰、结构化、蓝色系、严谨网格              │
├────────────────────────────────────────────────────┤
│  3. Explorer（探险者）— 自由、冒险、独立               │
│     代表：Jeep、The North Face                      │
│     视觉语言：粗犷、大地色、强烈对比、自由排版             │
├────────────────────────────────────────────────────┤
│  4. Outlaw（颠覆者）— 叛逆、颠覆、打破规则              │
│     代表：Harley-Davidson、Supreme                   │
│     视觉语言：黑白、粗字体、不对称、高冲击力              │
├────────────────────────────────────────────────────┤
│  5. Magician（魔法师）— 变革、愿景、想象力              │
│     代表：迪士尼、Apple                               │
│     视觉语言：简洁、精致、留白、光影、科技感              │
├────────────────────────────────────────────────────┤
│  6. Hero（英雄）— 勇气、成就、决心                     │
│     代表：Nike、耐克                                 │
│     视觉语言：力量感、动感、对比强烈、斜线/箭头            │
├────────────────────────────────────────────────────┤
│  7. Lover（情人）— 激情、美感、亲密                     │
│     代表：Chanel、Godiva                             │
│     视觉语言：优雅、曲线、暖色、质感、精致字体             │
├────────────────────────────────────────────────────┤
│  8. Jester（小丑）— 欢乐、幽默、轻松                    │
│     代表：M&M's、Dollar Shave Club                   │
│     视觉语言：明亮色彩、夸张字体、不规则布局、趣味元素       │
├────────────────────────────────────────────────────┤
│  9. Everyman（凡人）— 归属、实在、亲切                  │
│     代表：IKEA、Target                               │
│     视觉语言：温暖、家常、朴实、功能性排版                │
├────────────────────────────────────────────────────┤
│ 10. Caregiver（照顾者）— 关怀、保护、滋养              │
│     代表：强生、慈济                                 │
│     视觉语言：柔和、圆润、温暖色、温馨感                 │
├────────────────────────────────────────────────────┤
│ 11. Ruler（统治者）— 权力、稳定、 elegance             │
│     代表：Rolex、Mercedes-Benz                       │
│     视觉语言：奢华、对称、高质量、克制留白               │
├────────────────────────────────────────────────────┤
│ 12. Creator（创造者）— 创新、自我表达、想象力           │
│     代表：Adobe、乐高                                 │
│     视觉语言：多样、灵活、艺术感、色彩丰富               │
└────────────────────────────────────────────────────┘
```

### 品牌气质标签（Aura Tags）

```
气质标签是品牌的"视觉性格形容词"，更细粒度地描述品牌应该传达的感觉。

示例：
  - 匠人感（手工、温度、不完美之美）
  - 未来感（科技、简洁、冷感）
  - 烟火气（热闹、亲切、日常）
  - 禅意（宁静、克制、自然）
  - 复古（怀旧、温暖、经典）
  - 摩登（时尚、前卫、简洁）
  - 治愈（温柔、舒缓、安心）
  - 力量（自信、坚定、强烈）

Layout Engine 根据这些标签调整：
  - 颜色饱和度 / 明度
  - 字体风格 / 字号
  - 留白比例
  - 图片调性
  - 装饰元素
```

### 品牌 DNA 如何影响 Layout Engine

```
Brand DNA
  ↓
设计方向（DesignDirection）
  ├── 色彩倾向：冷/暖/中性/高饱和/低饱和
  ├── 字体风格：现代/传统/圆润/锐利
  ├── 排版风格：对称/不对称/网格/自由
  ├── 留白倾向：多/中/少
  └── 图片调性：明亮/暗调/自然/精致

  ↓
Layout Engine Core 使用 DesignDirection 参数：
  - 选择匹配的布局模式变体
  - 调整样式参数
  - 生成符合品牌气质的页面
```

---

## 三、Industry Engine（行业引擎）

### 定位

```
Industry Engine 解决的核心问题：
  餐饮、科技、教育、母婴行业的布局不应该一样。

它在 Brand DNA Engine 之后执行，
在 Layout Engine Core 之前执行。
```

### 行业视觉语言体系

| 行业 | 视觉特征 | 色彩倾向 | 排版风格 | 图片风格 |
|------|---------|---------|---------|---------|
| **餐饮** | 温暖、食欲、烟火气 | 暖色系（红/橙/黄） | 灵活、层次丰富 | 食物实拍、场景感 |
| **茶饮** | 年轻、时尚、社交感 | 明亮、马卡龙色 | 大留白、字体突出 | 产品图、生活方式 |
| **咖啡** | 质感、生活方式 | 大地色、深棕、墨绿 | 克制、留白多 | 场景、质感细节 |
| **烘焙** | 温暖、手工、幸福感 | 暖黄、粉、浅棕 | 圆润、亲和 | 产品、制作过程 |
| **科技** | 简洁、未来感、专业 | 冷色（蓝/白/灰） | 网格清晰、留白大 | 产品图、界面 |
| **教育** | 专业、信任、成长 | 蓝/绿/暖橙 | 清晰、结构化 | 人物、场景 |
| **母婴** | 柔和、安全、温暖 | 粉/蓝/浅色系 | 圆润、温和 | 亲子场景 |
| **时尚** | 前卫、质感、精致 | 黑白灰 + 跳色 | 大留白、字体强 | 模特、细节 |
| **文旅** | 文化、自然、体验 | 自然色系 | 故事性、自由 | 风景、人文 |
| **宠物** | 温馨、趣味、陪伴 | 暖色、明亮 | 活泼、灵动 | 宠物实拍 |
| **医疗** | 专业、洁净、信任 | 蓝/白/浅绿 | 清晰、严谨 | 人物、场景 |
| **制造业** | 可靠、专业、硬朗 | 蓝/灰/白 | 结构化、信息强 | 产品、工艺 |
| **珠宝** | 奢华、精致、艺术 | 黑/金/深色 | 大留白、优雅 | 产品特写 |
| **健身** | 力量、活力、动感 | 黑/红/亮色 | 冲击力、斜线 | 人物、动态 |
| **美业** | 精致、优雅、自信 | 粉/金/白 | 简约、高级感 | 人物、产品 |

### 行业引擎输出

```typescript
interface IndustryVisualLanguage {
  industry: string;                    // 行业名称
  subIndustry?: string;                // 子行业
  visualCharacteristics: string[];     // 视觉特征
  colorPalette: {                      // 色彩倾向
    warmCold: "warm" | "cold" | "neutral";
    saturation: "high" | "medium" | "low";
    recommendedHues: string[];
  };
  typographyStyle: {                   // 字体风格
    primaryStyle: string;
    secondaryStyle: string;
    weightPreference: string;
  };
  layoutStyle: {                       // 排版风格
    density: "high" | "medium" | "low";
    symmetry: "symmetrical" | "asymmetrical" | "dynamic";
    gridType: "strict" | "flexible" | "free";
  };
  imageStyle: {                        // 图片风格
    mood: string[];
    composition: string;
    colorTreatment: string;
  };
}
```

### 行业引擎与 Brand DNA 的关系

```
Brand DNA Engine（先执行）
  └── 输出：品牌人格、气质、核心价值
      ↓（作为输入之一）
Industry Engine（后执行）
  └── 输出：行业视觉语言
      ↓（与 Brand DNA 合并）
设计决策参数
  └── Layout Engine Core 使用
```

当 Brand DNA 与行业默认风格冲突时：

```
规则：
  - 品牌个性 > 行业默认（如：一个"颠覆者"原型的餐饮品牌，应优先表现叛逆感）
  - 行业约束 > 品牌偏好（如：医疗行业必须传递信任感，不能使用过于嬉皮的风格）
```

---

## 四、Chapter Engine（章节引擎）

### 定位

```
Chapter Engine 解决的核心问题：
  把20页变成一本设计书，而不是20张独立页面。

它解决了 V1 文档最大的缺失——只有 PageType，没有章节系统。
```

### 章节结构

```
一本完整的 VI 手册 = 3 个章节

─────────────────────────────────
第一章：品牌战略（Brand Strategy）
─────────────────────────────────

  1. 封面                              — 品牌形象页
  2. 品牌故事                          — 品牌内容页
  3. 品牌核心理念                      — 品牌内容页
  4. 品牌口号                          — 品牌内容页
  5. 品牌使命愿景                      — 品牌内容页

  章节特征：
    - 视觉冲击力强
    - 文字精炼、感性
    - 图片占比大
    - 品牌 DNA 表现最强

─────────────────────────────────
第二章：视觉识别（Visual Identity）
─────────────────────────────────

  6. Logo 基础展示                      — 规范展示页
  7. Logo 制图规范                      — 规范展示页
  8. Logo 安全空间                      — 规范展示页
  9. Logo 错误使用示例                  — 规范展示页
  10. 标准色彩规范                      — 规范展示页
  11. 字体系统                          — 规范展示页
  12. IP 基础形象（如有）               — IP 规范页
  13. IP 表情系统（如有）               — IP 规范页

  章节特征：
    - 信息密度高
    - 标注精确
    - 网格严谨
    - 规范展示清晰
    - 视觉风格简洁

─────────────────────────────────
第三章：应用系统（Application System）
─────────────────────────────────

  14. 基础规范                          — 规范展示页
  15. 办公应用系统（名片/信封/PPT）     — 应用展示页
  16. 产品包装系统                      — 应用展示页
  17. 营销展示系统（海报/广告）         — 应用展示页
  18. 门店应用系统（如有）              — 应用展示页
  19. 总结                              — 品牌内容页
  20. 感谢观看                          — 品牌形象页

  章节特征：
    - 场景感强
    - 图文均衡
    - 实景展示
    - 案例说明

─────────────────────────────────
```

### 章节引擎规则

```typescript
interface ChapterEngine {
  chapters: Chapter[];

  // 页面分配到章节
  assignPageToChapter(pageId: string): ChapterId;

  // 章节间视觉连续性
  getChapterStyle(chapterId: ChapterId): ChapterStyle;

  // 章节过渡页（可选）
  needsChapterDivider(chapterId: ChapterId): boolean;
}

interface Chapter {
  id: "brand-strategy" | "visual-identity" | "application-system";
  title: string;
  subtitle: string;
  pages: string[];          // 包含的页面 ID 列表
  designTokens: {           // 该章节的设计风格参数
    primaryColorUsage: "high" | "medium" | "low";
    imageDensity: "high" | "medium" | "low";
    typographyHierarchy: "emotional" | "precise" | "balanced";
    gridStyle: "loose" | "tight" | "flexible";
  };
}
```

### 章节过渡页（Chapter Divider）

```
可选的章节分隔页：
  在每章开头插入一张过渡页
  内容：章节标题 + 简短说明 + 装饰性视觉

  V1.1 策略：按需生成
    - 完整版手册（高级套餐）→ 插入过渡页
    - 精简版手册（轻量套餐）→ 直接接续，不插入
```

### 章节间视觉连续性

```
跨章节保持统一的品牌元素：
  - 页眉：Logo + 章节名称
  - 页脚：页码 + 品牌名
  - 色彩系统：整本手册一致
  - 字体系统：整本手册一致
  - 留白规则：每章内部一致

跨章节的变化：
  - 布局密度（第一章：高视觉 → 第二章：高信息 → 第三章：均衡）
  - 图片占比（第一章：大 → 第二章：中 → 第三章：中高）
  - 情绪调性（第一章：感性 → 第二章：理性 → 第三章：实用）
```

---

## 五、Brand Level Engine（品牌等级引擎）

### 定位

```
Brand Level Engine 解决的核心问题：
  老牛肉面馆和科技公司的排版不应该一样。

它在 Layout Engine Core 之前执行，
决定排版复杂度、页面数量和视觉精致度。
```

### 品牌等级体系

#### L1 — 传统小店

| 属性 | 值 |
|------|-----|
| **典型客户** | 街边小吃店、个人工作室、小摊贩 |
| **手册厚度** | 8-12 页 |
| **排版策略** | 简单、实用、低成本感 |
| **图片** | 手机拍摄、产品实拍 |
| **设计复杂度** | 低 — 单栏布局、少量装饰 |
| **模板数量** | 每页 1-2 种变体 |
| **重点** | 能用、有品牌感即可 |

#### L2 — 区域品牌

| 属性 | 值 |
|------|-----|
| **典型客户** | 本地连锁、区域品牌、中型工作室 |
| **手册厚度** | 12-16 页 |
| **排版策略** | 规范、清晰、有一定设计感 |
| **图片** | 半专业拍摄、统一调性 |
| **设计复杂度** | 中低 — 双栏布局、品牌色应用 |
| **模板数量** | 每页 2-3 种变体 |
| **重点** | 规范、可执行 |

#### L3 — 连锁品牌

| 属性 | 值 |
|------|-----|
| **典型客户** | 全国连锁、加盟品牌、成长型企业 |
| **手册厚度** | 16-24 页 |
| **排版策略** | 专业、系统化、模块化 |
| **图片** | 专业拍摄、场景化 |
| **设计复杂度** | 中 — 多栏布局、色彩系统完整 |
| **模板数量** | 每页 3-4 种变体 |
| **重点** | 完整性、可复制性 |

#### L4 — 全国品牌

| 属性 | 值 |
|------|-----|
| **典型客户** | 上市企业、行业头部、国际品牌 |
| **手册厚度** | 24-40 页 |
| **排版策略** | 精致、差异化、品牌调性突出 |
| **图片** | 专业拍摄、品牌调性统一 |
| **设计复杂度** | 中高 — 灵活布局、丰富装饰元素 |
| **模板数量** | 每页 3-5 种变体 |
| **重点** | 品牌调性、视觉冲击 |

#### L5 — 高端品牌

| 属性 | 值 |
|------|-----|
| **典型客户** | 奢侈品、高端服务、顶级酒店 |
| **手册厚度** | 32-50 页 |
| **排版策略** | 极致、艺术性、收藏价值 |
| **图片** | 顶级摄影、艺术级 |
| **设计复杂度** | 高 — 定制布局、独特视觉语言 |
| **模板数量** | 每页 4-6 种变体 + 定制元素 |
| **重点** | 品牌仪式感、独特性 |

### 等级识别规则

```typescript
interface BrandLevelInput {
  businessStage: "startup" | "growing" | "chain" | "enterprise";
  budgetLevel: "light" | "standard" | "premium";
  hasLogo: boolean;
  hasMascot: boolean;
  hasExistingManual: boolean;
  hasBrandGuide: boolean;
  employeeCount?: number;
  storeCount?: number;
  industryCategory: string;
}

// 等级映射逻辑（简单规则引擎）
function determineBrandLevel(input: BrandLevelInput): BrandLevel {
  // 高端品牌：企业级 + 高级预算
  if (input.businessStage === "enterprise" && input.budgetLevel === "premium")
    return "L5";

  // 全国品牌：企业级 + 标准预算 / 连锁 + 高级预算
  if (input.businessStage === "enterprise" || 
     (input.businessStage === "chain" && input.budgetLevel === "premium"))
    return "L4";

  // 连锁品牌：连锁 + 标准预算 / 成长 + 高级预算
  if (input.businessStage === "chain" ||
     (input.businessStage === "growing" && input.budgetLevel === "premium"))
    return "L3";

  // 区域品牌：成长 + 轻量/标准
  if (input.businessStage === "growing")
    return "L2";

  // 传统小店：初创
  return "L1";
}
```

### 等级对 Layout Engine 的影响

```
Brand Level
  ↓
影响 Layout Engine 的以下参数：

1. 页面数量范围（8-12 / 12-16 / 16-24 / 24-40 / 32-50）
2. 每页的布局复杂度（模板变体数量）
3. 装饰元素密度（留白比例、装饰线、底纹）
4. 图片质量要求（分辨率、处理方式）
5. 字体层级复杂度
6. 色彩使用丰富度
7. 章节结构完整性（L1 可跳过某些章节）
8. 评分阈值（高端品牌要求更高分）
```

---

## 六、V1.1 修改项：IP 规则更新

### 原规则（V1）

```
IP 尺寸不超过 Logo 的 80%
```

### 新规则（V1.1）

```
IP 尺寸由版面决定，不变形即可。

原则：
  - IP 是品牌角色，不是品牌标识的附属品
  - IP 可以比 Logo 大、可以比 Logo 小
  - 具体的尺寸取决于：页面类型、版面需求、视觉重点
  - 唯一限制：保持原始比例（不变形）

维度规则：
  - IP 占据视觉焦点时（如 IP 规范页）：可占页面的 50%-70%
  - IP 作为装饰元素时：可小到页面宽度的 10%
  - IP 与 Logo 同页时：根据版面需求灵活调整
  - 禁止：IP 变形（拉伸/压缩/扭曲）

参考案例：
  蜜雪冰城「雪王」：
    - 独立展示时：IP 可占页面 70% 面积
    - 与 Logo 同页时：IP 可以比 Logo 大数倍
    - 关键是不变形，而非固定比例
```

---

## 七、四引擎协同工作流程

### 完整管线

```
用户提交品牌资料
  ↓
Step 1-4（现有决策流程）
  ↓
┌──────────────────────────────────────────────────────┐
│            V1.1 新增：品牌理解管线                      │
│                                                       │
│  1. Brand DNA Engine                                  │
│     ├── 读取品牌资料（从 Step 1-4 结果）                │
│     ├── 识别品牌原型（12 原型）                         │
│     ├── 提取品牌气质标签（aura tags）                   │
│     ├── 确定设计方向（DesignDirection）                 │
│     └── 输出：品牌 DNA 画像                            │
│                                                       │
│  2. Industry Engine                                   │
│     ├── 读取行业信息                                   │
│     ├── 匹配行业视觉语言                               │
│     ├── 与 Brand DNA 合并（个性优先、行业约束）          │
│     └── 输出：行业视觉语言参数                           │
│                                                       │
│  3. Brand Level Engine                                │
│     ├── 读取业务阶段 + 预算                             │
│     ├── 确定品牌等级（L1~L5）                           │
│     └── 输出：等级参数（页数、复杂度、阈值）              │
│                                                       │
│  4. Chapter Engine                                    │
│     ├── 根据等级确定章节完整性                          │
│     ├── 将页面分配到章节                               │
│     ├── 设置章节间设计参数                             │
│     └── 输出：章节结构 + 每章设计风格                    │
│                                                       │
└──────────────────────────────────────────────────────┘
  ↓
Layout Engine Core（V1 既有）
  ├── 布局选择器（根据所有参数选择模式变体）
  ├── 内容适配器（填充品牌内容）
  ├── 样式解析器（渲染品牌样式）
  └── 渲染器 → SVG → PNG
  ↓
Asset Guard + Scorer（V1 既有）
  ↓
输出：VI 手册
```

### 配置参数汇聚

```
所有引擎的输出最终汇聚为一个统一的 LayoutConfig：

{
  // 从 Brand DNA Engine
  archetype: "magician",
  personality: ["innovative", "minimal"],
  designDirection: { colorTone: "cool", typography: "modern", ... },

  // 从 Industry Engine
  industryVisuals: { colorPalette: [...], layoutStyle: { ... }, ... },

  // 从 Brand Level Engine
  level: "L3",
  pageCount: 20,
  complexity: "medium",

  // 从 Chapter Engine
  chapters: [
    { id: "brand-strategy", pages: [...], designTokens: { ... } },
    { id: "visual-identity", pages: [...], designTokens: { ... } },
    { id: "application-system", pages: [...], designTokens: { ... } },
  ],

  // 从品牌资料
  brandData: { colors, logo, fonts, ... },
  content: { title, body, images, ... }
}
```

---

## 八、实施建议

### 实施顺序

```
Phase 1（当前 — 设计阶段）:
  ✅ Layout Engine V1 设计完成
  ⬜ 本 V1.1 文档评审
  ⬜ 确定四引擎的输入/输出接口规范

Phase 2（优先实现）:
  1. Brand DNA Engine（最核心，影响所有设计决策）
  2. Brand Level Engine（规则简单，快速落地）
  3. IP 规则更新（小改动，快速修复）

Phase 3:
  4. Industry Engine（需要积累行业知识库）
  5. Pattern Library 扩展（按行业/等级增加变体）

Phase 4:
  6. Chapter Engine（需要前面引擎稳定后）
  7. 完整的章节过渡页设计
```

### 与 Manus / DeepSeek 的分工

```
Brand DNA Engine:
  DeepSeek 负责：从品牌资料提取品牌人格、品牌气质
  Manus 负责（未来）：做行业研究、竞品分析辅助品牌定位
  Layout Engine 负责：将品牌DNA转化为设计参数（规则引擎，不推理）

Industry Engine:
  知识中台（知识库 + DeepSeek）负责：维护行业视觉语言知识
  规则引擎负责：根据行业匹配对应的视觉参数
  未来 Manus：定期更新行业趋势和最佳实践

Chapter Engine:
  纯规则引擎，不依赖 AI
  等级 + 套餐 → 自动决定章节结构

总结：
  AI 负责理解品牌和内容
  Layout Engine 负责设计和排版
  这是核心分工原则
```

---

## 九、与 V1 文档的合并建议

```
建议将以下两个文档合并为最终版：

  docs/LAYOUT_ENGINE_V1.md        → 保留
  docs/LAYOUT_ENGINE_V1_1.md      → 新增四引擎 + IP 规则更新

合并后结构：
  Part 1: 设计哲学与架构（来自 V1）
  Part 2: 四引擎设计（来自 V1.1，新增）
  Part 3: 页面类型库（来自 V1）
  Part 4: 页面分类体系（来自 V1，更新）
  Part 5: 布局模式库（来自 V1）
  Part 6: 各元素规则（来自 V1，IP 规则已更新）
  Part 7: 评分系统（来自 V1）
  Part 8: 集成与迁移（来自 V1）
```

---

## 十、待决策事项

| 问题 | 选项 | 建议 |
|------|------|------|
| Brand DNA 由谁提取 | A: DeepSeek / B: Manus / C: 规则+AI | A（DeepSeek 文本能力足够） |
| 行业引擎知识库来源 | A: 文档内置 / B: Supabase memory_industries / C: 外部 API | B（已有 Schema 和表） |
| 品牌等级是否允许手动覆盖 | A: 允许用户修改 / B: 系统自动决定 | A（用户确认优先于 AI 判断） |
| 章节过渡页是否必须 | A: 按等级决定 / B: 用户选择 | A（L1-L2 跳过，L3+ 插入） |
| 四引擎的实现位置 | A: 前端 / B: API Route / C: lib 函数 | C（纯逻辑，不依赖运行时） |

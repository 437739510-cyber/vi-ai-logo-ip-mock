# Brand Brain — Memory System

## 概述

Memory System 是 Brand Brain 的长期记忆。V1 使用 JSON 文件存储，位于 `public/memory/`。

**核心原则：** 分析 → 记住 → 复用。系统从"会分析"升级到"会记住"。

---

## 存储位置

```
public/memory/
├── index.json        # 记忆系统索引（版本、统计）
├── clients.json      # 客户记忆
├── industries.json   # 行业知识
└── projects.json     # 项目记忆
```

---

## 数据架构

### ClientMemory（客户记忆）

```typescript
interface ClientMemory {
  clientId: string;              // 唯一 ID（公司名哈希）
  companyName: string;           // 品牌名
  industry: string;              // 行业标签
  industryCategory: string;      // 标准化行业分类
  subCategory?: string;          // 子分类（如 beverage → coconut_water）
  brandDescription?: string;     // 品牌描述
  hasLogo: boolean;              // 是否有 Logo
  hasMascot: boolean;            // 是否有 IP
  brandStage: string;            // 品牌阶段
  budgetRange?: string;          // 预算范围
  targetAudience?: string;       // 目标受众

  projectIds: string[];          // 关联项目 ID 列表
  latestBrainResultId?: string;  // 最新分析结果引用
  latestBusinessProfile?: any;   // 最新商业信息

  createdAt: string;
  updatedAt: string;
  projectCount: number;
}
```

**存储策略：** 每次品牌分析时，如果客户已存在则更新，不存在则新增。

---

### IndustryMemory（行业记忆）

```typescript
interface IndustryMemory {
  industryKey: string;           // 行业键（如 "food_beverage/beverage/coconut_water"）
  category: string;              // 一级分类
  subCategory?: string;          // 二级分类
  subSubCategory?: string;       // 三级细分

  designStyle: string[];         // 视觉特征
  colorTendency: string[];       // 色彩倾向
  typographyStyle: string[];     // 字体倾向

  commonModules: string[];       // 常见模块
  typicalPageRange: [number, number]; // 典型页数范围

  typicalScenes: string[];       // 典型应用场景
  sampleBrands: string[];        // 参考品牌
  visualKeywords: string[];      // AI 提示词关键词

  source: "initial_knowledge" | "project_accumulated" | "manual_review";
  referenceManualId?: string;    // 参考手册 ID
  confidence: number;            // 置信度 0-1

  createdAt: string;
  updatedAt: string;
  projectCount: number;
}
```

**存储策略：** 系统启动时预载初始行业知识。后续项目积累可扩展新行业。

**三级分类示例：**

| 一级 | 二级 | 三级 |
|------|------|------|
| food_beverage | beverage | coconut_water |
| restaurant | hotpot | — |
| technology | saas | — |
| education | online_learning | — |

**当前预载行业：** 18 个行业画像，覆盖餐饮、科技、教育、金融、零售、文旅、医疗等。

---

### ProjectMemory（项目记忆）

```typescript
interface ProjectMemory {
  projectId: string;             // 项目 ID
  clientId?: string;             // 关联客户 ID
  companyName: string;           // 客户名

  brainResults: BrainResultSnapshot[];  // 所有分析结果历史

  selectedPackage?: string;      // 最终选择的套餐
  selectedModules?: string[];    // 最终选择的模块
  totalGeneratedPages?: number;  // 生成页数
  clientFeedback?: string;       // 客户反馈

  qualityScore?: {               // 质量评分结果
    total: number;
    dimensions: Record<string, number>;
    issues: { severity: string; category: string; message: string; affectedPages?: string[] }[];
    flags: string[];
    checkedAt: string;
  };

  status: "analyzed" | "planned" | "generated" | "delivered";

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

**存储策略：** 每次品牌分析追加一条 BrainResultSnapshot。保留完整历史。

---

### MemoryIndex（索引）

```typescript
interface MemoryIndex {
  version: number;
  lastUpdated: string;
  totalClients: number;
  totalProjects: number;
  industryCoverage: Record<string, { subCategories: string[]; projectCount: number }>;
}
```

---

## 数据流

```
Client Input
    │
    ▼
Orchestrator.analyze()
    │
    ├── MemoryAdapter.getClient(companyName)
    │     └── 如果存在 → 读取历史信息
    │     └── 如果不存在 → 准备新建
    │
    ├── 运行 Agent 管道
    │
    ├── MemoryAdapter.saveClient(client)
    │     └── 写入 clients.json
    │
    ├── MemoryAdapter.saveProject(project)
    │     └── 写入 projects.json
    │
    └── MemoryAdapter.updateIndex()
          └── 更新 index.json
```

## Memory Adapter 接口

```typescript
interface MemoryAdapter {
  initialize(): Promise<void>;
  getClient(clientId: string): Promise<ClientMemory | null>;
  getAllClients(): Promise<ClientMemory[]>;
  saveClient(client: ClientMemory): Promise<void>;
  findClientByCompany(companyName: string): Promise<ClientMemory | null>;

  getIndustry(industryKey: string): Promise<IndustryMemory | null>;
  getAllIndustries(): Promise<IndustryMemory[]>;
  saveIndustry(industry: IndustryMemory): Promise<void>;
  findIndustryByCategory(category: string, subCategory?: string): Promise<IndustryMemory | null>;

  getProject(projectId: string): Promise<ProjectMemory | null>;
  getAllProjects(): Promise<ProjectMemory[]>;
  saveProject(project: ProjectMemory): Promise<void>;

  getIndex(): Promise<MemoryIndex>;
  updateIndex(): Promise<void>;
}
```

## 实现

- **文件**: `src/lib/memory/types.ts`（数据结构），`src/lib/memory/json-adapter.ts`（JSON 适配器），`src/lib/memory/index.ts`（入口）
- **初始化**: 在 `POST /api/brand/analyze` 首次调用时触发 `initializeMemorySystem()`
- **预载**: 首次启动时自动写入 18 个行业画像到 industries.json

## 未来扩展

- **CaseMemory** — 优秀案例知识库，Design Director 的参考输入
- **SearchMemory** — 联网搜索结果缓存，避免同一行业重复搜索
- **AntiPatternMemory** — 常见错误模式库，Quality Score 的参考输入
- 从 JSON 文件迁移到 SQLite 或 PostgreSQL

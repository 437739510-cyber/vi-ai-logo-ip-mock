# Brand Brain — Agents

## Agent 架构

所有 Agent 位于 `src/agents/`，实现统一的 `Agent<TInput, TOutput>` 接口。

```typescript
interface Agent<TInput, TOutput> {
  identity: AgentIdentity;
  execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>>;
  canExecute(context: AgentContext): Promise<{ canRun: boolean; reason?: string }>;
}
```

---

## 当前 Agent

### 1. Brand Analyst（品牌分析师）

| 属性 | 值 |
|------|-----|
| 文件 | `src/agents/brand-analyst.ts` / `src/lib/brand-analyzer.ts` |
| 版本 | 1.0.0 |
| 输入 | `clientInfo`（公司名、行业、品牌介绍、Logo/IP 资产） |
| 输出 | `BrandProfile` — 类型、人格、定位、原型、语气、视觉方向 |
| 前置 | 无（第一个执行） |

**核心能力：**
- 识别品牌类型（consumer / tech / service / industrial / cultural）
- 品牌人格分析（自然/健康/阳光/专业/创新）
- 品牌定位语生成
- 品牌原型推荐（Explorer / Innocent / Hero / Sage / Creator）
- 品牌语气识别（friendly / professional / premium / playful）

---

### 2. Brand Planner（品牌规划师）

| 属性 | 值 |
|------|-----|
| 文件 | `src/agents/brand-planner.ts` / `src/lib/module-planner.ts` |
| 版本 | 1.0.0 |
| 输入 | `BrandProfile` + `BusinessProfile` |
| 输出 | `ModulePlan` — 推荐模块、优先级、页数、套餐建议 |
| 前置 | Brand Analyst |

**核心能力：**
- 15 个模块的评分与优先级排序
- 双因子评分（品牌 60% + 商业 40%）
- 套餐推荐（basic_vi / brand_vi / brand_ip）
- 通过 module-to-page.ts 转换为 pageIds

---

### 3. Design Director（设计总监）

| 属性 | 值 |
|------|-----|
| 文件 | `src/agents/design-director.ts` |
| 版本 | 1.0.0 |
| 输入 | `BrandProfile` + `IndustryProfile` |
| 输出 | `DesignDirection` — 色彩策略、字体搭配、图像风格 |
| 前置 | Brand Planner |

**核心能力：**
- 色彩方案推荐（主色、辅助色、强调色）
- 字体搭配推荐（标题/正文字体）
- 图像风格方向
- 设计风格标签

---

### 4. Asset Guardian（资产守护者）

| 属性 | 值 |
|------|-----|
| 文件 | `src/agents/asset-guardian-agent.ts` / `src/lib/asset-guardian.ts` |
| 版本 | 1.0.0 |
| 输入 | `BrandProfile` + 页面描述/背景 prompt |
| 输出 | `AssetGuardResult` — 保护策略、风险检查、违规检测 |
| 前置 | Design Director |

**核心能力：**
- `ProtectedAssetPolicy` — 每项操作的允许/禁止策略
- Logo/IP 在背景 prompt 中的关键词扫描
- SVG 合成层检查（使用 `<image>` 引用原图）
- 高风险词检测（redraw / recreate / redesign）
- 只允许：缩放、移动、排版

**Logo 默认策略：**

| 操作 | 允许 |
|------|------|
| 缩放 | ✅ |
| 移动 | ✅ |
| 裁剪 | ✅ |
| 透明度调整 | ✅ |
| AI 重绘 | ❌ |
| AI 改色 | ❌ |
| AI 改材质 | ❌ |

**Mascot/IP 默认策略：**

| 操作 | 允许 |
|------|------|
| 缩放 | ✅ |
| 移动 | ✅ |
| 裁剪 | ✅ |
| 透明度调整 | ✅ |
| AI 重绘 | ❌ |
| AI 改色 | ❌ |
| AI 改材质 | ❌ |
| AI 改表情 | ❌ |
| AI 换角色设定 | ❌ |

---

### 5. Manual Composer（手册合成师）

| 属性 | 值 |
|------|-----|
| 文件 | `src/agents/manual-composer.ts` |
| 版本 | 1.0.0 |
| 输入 | `ModulePlan` + `DesignDirection` |
| 输出 | 生成指令 → generate-manual-pages-stream API |
| 前置 | Asset Guardian |

**核心能力：**
- 将模块计划转换为页面生成任务
- 调用 module-to-page.ts → PAGE_DEFS
- 管理生成任务队列
- 跟踪生成状态

---

### 6. Orchestrator（编排器）

| 属性 | 值 |
|------|-----|
| 文件 | `src/agents/orchestrator.ts` |
| 版本 | 1.0.0 |
| 模式 | `analyze-only` / `plan-only` / `full` / `generate-only` |

**职责：**
- 按顺序调度 Agent
- 管理 AgentContext 传递
- 读写 Memory System
- 错误处理与恢复
- 当前 API `/api/brand/analyze` 使用 `plan-only` 模式

**默认执行顺序：**

```
Brand Analyst → Brand Planner → Design Director → Asset Guardian → Manual Composer
```

---

## 未来 Agent

### 7. Mascot Designer（IP 设计师）

| 属性 | 值 |
|------|-----|
| 文件 | `src/agents/mascot-designer.ts`（规划中） |
| 版本 | 1.0.0（规划中） |
| 模式 | `protect_existing` / `create_new` / `not_needed` |
| 插入位置 | Brand Planner 之后，Design Director 之前 |

**核心能力：**
- 判断是否需要创建 IP
- 已有 IP → protect_existing 模式
- 无 IP → 根据行业和品牌人格推荐 IP 策略
- 输出 MascotProfile（名称、类型、性格、视觉特征）

### 8. Style Extractor（风格提取器）

| 属性 | 值 |
|------|-----|
| 文件 | 规划中 |
| 版本 | 规划中 |
| 来源 | ChatGPT 架构评审建议 |

**核心能力：**
- 从参考手册中提取版式风格、颜色系统、字体倾向
- 输出 StyleReferenceProfile
- Design Director 的参考输入

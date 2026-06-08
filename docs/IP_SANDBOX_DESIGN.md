# IP Generation Sandbox V1 — 架构设计文档

> 版本: v1 (设计稿)
> 状态: 待评审
> 当前阶段: 仅设计，不接入图片生成，不接通义万相，不改 SVG / 封面 / 生成层

---

## 1. 设计目标

让用户在真正调用 IP 图片生成之前，能够：

- 逐张生成，逐张确认
- 知道下一张是什么，预计花多少钱
- 知道已经花了多少钱
- 不满意可以重试或跳过
- 不会一次性烧掉全部预算

---

## 2. 数据结构

### IPSandboxStep — 单个步骤

```ts
interface IPSandboxStep {
  /** 步骤 ID（与 IPAssetStep.id 一致） */
  stepId: string;

  /** 中文标签 */
  label: string;

  /** 当前步骤状态 */
  status: "pending" | "generating" | "reviewing" | "approved" | "skipped" | "failed";

  /** 预计消耗（生成前） */
  estimatedCost: number;

  /** 实际消耗（生成后，null 表示尚未生成） */
  actualCost: number | null;

  /** 生成的图片 URL（未来） */
  generatedAssetUrl: string | null;

  /** 用户确认时间 */
  approvedAt: string | null;

  /** 用户拒绝时间 */
  rejectedAt: string | null;

  /** 拒绝原因 */
  rejectionReason?: string;

  /** 当前步骤已重试次数 */
  attempts: number;

  /** 依赖的前置步骤 ID 列表（全部 approved 后才能开始） */
  dependsOn: string[];
}
```

### IPSandboxSession — 完整沙盒会话

```ts
interface IPSandboxSession {
  /** 会话 ID */
  sessionId: string;

  /** 关联项目 */
  projectId: string;

  /** 关联账户（用于扣费） */
  accountId: string;

  /** 来源的 IP Creation Plan（快照，避免 plan 变更影响 sandbox） */
  sourcePlan: IPCreationPlan;

  /** 步骤列表（由 IPCreationPlan.assetSequence 生成） */
  steps: IPSandboxStep[];

  /** 会话级别状态 */
  status: "planning" | "in_progress" | "completed" | "cancelled";

  /** 当前进行的步骤序号 */
  currentStepIndex: number;

  /** 累计预计消耗 */
  totalEstimatedCost: number;

  /** 累计实际消耗 */
  totalActualCost: number;

  /** 会话开始时的余额 */
  balanceAtStart: number;

  /** 当前余额（随步骤确认实时更新） */
  balanceCurrent: number;

  /** 是否自动推进到下一步（默认 true） */
  autoAdvance: boolean;

  /** 时间戳 */
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
```

---

## 3. 状态流

### 单个步骤状态流

```
                      ┌─────────────┐
                      │   pending   │
                      └──────┬──────┘
                             │ 用户点击"生成"
                             ▼
                      ┌─────────────┐
                      │ generating  │ ← 未来：调用通义万相的位置
                      └──────┬──────┘
                             │ 生成完成
                             ▼
                      ┌─────────────┐
                      │  reviewing  │ ← 用户看到图片
                      └──────┬──────┘
                     ┌───────┴───────┐
                     ▼                ▼
              ┌──────────┐    ┌──────────┐
              │ approved │    │  failed  │
              └─────┬────┘    └────┬─────┘
                    │              │
                    ▼              ├──────────┐
              auto-advance         ▼          ▼
              到下一步         retry     skip(可选)
              pending         回到        ┌────────┐
                              generating  │ skipped │
                                          └────────┘
```

### 会话级别状态流

```
┌──────────┐    确认 plan    ┌─────────────┐
│ planning │ ───────────────→ │ in_progress │
└──────────┘                 └──────┬──────┘
                                    │
                           ┌────────┴────────┐
                           ▼                  ▼
                    ┌───────────┐     ┌───────────┐
                    │ completed │     │ cancelled │
                    │(全部完成)  │     │(用户取消)  │
                    └───────────┘     └───────────┘
```

### 状态流转规则

| 触发动作 | 旧状态 | 新状态 | 说明 |
|----------|--------|--------|------|
| 用户点击"生成" | pending | generating | 开始生成 |
| 生成完成 | generating | reviewing | 展示给用户 |
| 用户点击"满意" | reviewing | approved | 扣费、记录 |
| 用户点击"重新生成" | reviewing | generating | 重试次数+1 |
| 用户点击"跳过" | reviewing | skipped | 不扣费 |
| 生成失败 | generating | failed | 显示错误 |
| 用户点击"重试" | failed | generating | 重试 |
| 用户点击"跳过" | failed | skipped | 跳过不可用的步骤 |
| 所有步骤 completed | — | completed | 会话完成 |
| 用户点击"取消" | — | cancelled | 中断会话 |

---

## 4. 与 IPCreationPlan 的关系

```
IPCreationPlan
  ├── mode: "create_new"
  ├── assetSequence: IPAssetStep[]   ← ───┐
  ├── estimatedImages: 11                  │ 映射
  ├── estimatedCostCredits: 8800           │
  └── estimatedMinutes: 30                 │
                                           ▼
IPSandboxSession
  ├── sourcePlan: IPCreationPlan (快照) ← 记录创建时的 plan
  ├── steps: IPSandboxStep[]           ← 由 assetSequence 映射生成
  │     ├── stepId = IPAssetStep.id
  │     ├── label  = IPAssetStep.label
  │     ├── estimatedCost = 按比例分配 IPCreationPlan.estimatedCostCredits
  │     ├── dependsOn = IPAssetStep.dependsOn
  │     └── status: "pending" (初始)
  ├── totalEstimatedCost = IPCreationPlan.estimatedCostCredits
  └── status: "planning" (初始)
```

### 成本分配逻辑

```
create_new 共 11 张，总成本 8800 credits：

主形象设计    1张 × 800  =  800
三视图        1张 × 800  =  800
标准色规范    1张 × 800  =  800
表情系统      2张 × 800  = 1600
动作系统      2张 × 800  = 1600
场景延展      2张 × 800  = 1600
包装应用      1张 × 800  =  800
社媒应用      1张 × 800  =  800
                       ──────
                        8800
```

---

## 5. 与 Billing System 的关系

### 交互流程

```
生成前 → checkSufficient(estimatedCost)
         ├── 充足 → 继续
         └── 不足 → 提示用户余额不足

生成后 → deductBalance(actualCost)
         ├── 成功 → 记录 usage-log
         └── 失败 → 标记 failed，停止流程
```

### 数据关联

| 步骤状态 | Billing 操作 | 说明 |
|----------|-------------|------|
| pending → generating | checkSufficient | 预检查余额 |
| reviewing → approved | deductBalance + logUsage | 确认后扣费 |
| reviewing → skipped | 不扣费 | 跳过不产生费用 |
| reviewing → generating（重试） | 补回上一步已扣费用 | 重试需退费再扣 |

### 前端展示

每步显示：
- 预计消耗：`¥{step.estimatedCost.toFixed(2)}`
- 余额：`¥{session.balanceCurrent.toFixed(2)}`
- 已消耗：`¥{session.totalActualCost.toFixed(2)}`

---

## 6. 与 Memory System 的关系

### 写入位置

```
ProjectMemory.brainResults[].sandboxSessions:
  IPSandboxSession[]

ClientMemory.latestSandboxSession:
  IPSandboxSession | null
```

### 记录内容

每个 sandbox 会话记录：
- 完整步骤列表（含状态、生成结果、审批时间）
- 费用明细（预计 vs 实际）
- 用户操作记录（哪些被批准、哪些被跳过、哪些重试过）

### 用途

- 用户再次打开项目时能看到之前的生成进度
- 未完成的 sandbox 可以继续
- 为 Quality Score 提供输入数据

---

## 7. 预留接口（未来通义万相接入点）

当前阶段不实现图片生成，但预留接口：

```ts
interface IPImageGenerator {
  /** 生成单张 IP 图片 */
  generateStepImage(params: {
    step: IPSandboxStep;
    brandProfile: BrandProfile;
    mascotProfile: MascotProfile;
    promptSet: MascotPromptSet;
  }): Promise<{
    imageUrl: string;
    actualCost: number;
    durationMs: number;
  }>;

  /** 重新生成（指定不同的 seed/prompt 变体） */
  regenerateStepImage(params: {
    step: IPSandboxStep;
    variationIndex?: number;
  }): Promise<{
    imageUrl: string;
    actualCost: number;
  }>;
}
```

### 当前实现

```ts
// 占位实现：不调用任何 AI API
async function generateStepImagePlaceholder(params: {
  step: IPSandboxStep;
}): Promise<{ imageUrl: string; actualCost: number; durationMs: number }> {
  // 模拟 1.5-3 秒的生成时间
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));

  return {
    imageUrl: "", // 未来：通义万相返回的 URL
    actualCost: 10, // 未来：通义万相实际费用
    durationMs: 2000,
  };
}
```

---

## 8. 前端交互原型

### 主界面布局

```
┌─────────────────────────────────────────────────┐
│  IP 生成沙盒                                      │
│  第 2/8 步 · 已花费 ¥16.00 · 余额 ¥441.50        │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────────────────────────────┐          │
│  │                                     │          │
│  │       图片展示区                     │          │
│  │       (未来：生成的 IP 图片)          │          │
│  │                                     │          │
│  └─────────────────────────────────────┘          │
│                                                   │
│  主形象设计                                        │
│  预计消耗: ¥8.00 · 第 2 次生成                      │
│                                                   │
│  ┌──────┐  ┌──────────┐  ┌──────────┐            │
│  │ 不满  │  │ 重新生成  │  │ 满意 ✓   │            │
│  │ 意跳过 │  │ (免费)   │  │ 下一步 → │            │
│  └──────┘  └──────────┘  └──────────┘            │
│                                                   │
│  进度条: ● ● ○ ○ ○ ○ ○ ○                           │
│  (已完  (当前)  (待生成)                            │
│   成)                                             │
└─────────────────────────────────────────────────┘
```

### 步骤进度条

```
已完成         当前          待生成
  ● ─ ● ─ ◉ ─ ○ ─ ○ ─ ○ ─ ○ ─ ○
  主   三   标   表   动   场   包   社
  形   视   准   情   作   景   装   媒
  象   图   色
```

---

## 9. 验收标准

| 场景 | 预期行为 | 验证方式 |
|------|----------|----------|
| 第一步 pending | 显示"生成"按钮 | UI 检查 |
| 点击生成 | 状态变 generating，显示加载 | 状态流转 |
| 生成完成 | 状态变 reviewing，显示确认按钮 | 状态流转 |
| 点击满意 | 状态变 approved，扣费，推进到下一步 | 状态 + Billing |
| 点击重新生成 | 状态变 generating，attempts+1 | 状态 + 计数 |
| 点击跳过 | 状态变 skipped，推进到下一步 | 状态流转 |
| 全部完成 | 会话变 completed | 会话级状态 |
| 余额不足 | 阻止 generating，提示充值 | Billing 联动 |
| 返回查看 | 从 Memory 恢复之前的 sandbox 进度 | Memory 读取 |

---

## 10. 当前阶段不做的事

- ❌ 不调用通义万相
- ❌ 不生成实际图片（generatedAssetUrl 留空）
- ❌ 不改 SVG
- ❌ 不改封面
- ❌ 不改已有生成层
- ❌ 不改 PAGE_DEFS
- ❌ 不改 renderPageSvg

---

## 11. 文件建议

```
src/lib/ip-sandbox/
├── types.ts          # IPSandboxStep, IPSandboxSession 定义
├── session.ts        # createSession, advanceStep, approveStep, skipStep
├── billing.ts        # checkBalance, deductForStep, refundForRetry
├── memory.ts         # saveSession, loadSession
└── image-generator.ts # 预留接口 + 占位实现
```

---

*本设计文档已完成。待 ChatGPT 评审通过后进入实现阶段。*

# Billing System V1 — 架构设计

> 目标：让系统知道钱花在哪里
> 不做支付、充值、第三方接口

---

## 一、数据结构

### 1. 余额

```typescript
interface AccountBalance {
  /** 账户 ID（按项目或客户） */
  accountId: string;
  /** 关联客户名 */
  companyName: string;
  /** 总余额（单位：分，方便未来对接支付） */
  totalCredits: number;
  /** 已消耗 */
  usedCredits: number;
  /** 剩余 */
  remainingCredits: number;

  /** 最近更新时间 */
  lastUpdated: string;
  /** 预警阈值（低于此值时提醒） */
  warningThreshold: number;
}
```

### 2. 消耗记录

```typescript
interface UsageLog {
  id: string;
  /** 关联项目 */
  projectId: string;
  /** 关联客户 */
  accountId: string;

  /** 操作类型 */
  action: UsageAction;

  /** 消耗的额度 */
  cost: number;

  /** 操作前余额 */
  balanceBefore: number;
  /** 操作后余额 */
  balanceAfter: number;

  /** 关联的生成结果 */
  resultId?: string;

  /** 耗时（毫秒） */
  durationMs: number;
  /** 状态 */
  status: "success" | "failed" | "pending";

  /** 创建时间 */
  createdAt: string;
}

type UsageAction =
  | "brand_analyze"       // 品牌分析（DeepSeek）
  | "industry_search"     // 行业搜索
  | "mascot_strategy"     // IP 策略分析
  | "vi_generate"         // VI 页面生成（通义万相）
  | "vi_generate_batch"   // 批量生成
  | "future_ip_generate"; // 未来 IP 图片生成
```

### 3. 成本估算

```typescript
interface CostEstimate {
  /** 按操作类型的单价定义 */
  unitPrice: Record<UsageAction, number>;

  /** 本次预计总消耗 */
  estimatedTotal: number;
  /** 当前余额 */
  currentBalance: number;
  /** 是否足够（余额 >= 预计） */
  sufficient: boolean;

  /** 明细 */
  items: CostEstimateItem[];
}

interface CostEstimateItem {
  action: UsageAction;
  label: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}
```

---

## 二、存储方案

使用现有 Memory System 扩展：

```
public/memory/
├── billing/
│   ├── accounts.json       # 账户余额列表
│   └── usage-logs.json     # 消耗记录列表
├── index.json              # 记忆索引（扩展 billing 字段）
└── ...
```

### Memory 类型扩展

在 `ClientMemory` 中增加：

```typescript
interface ClientMemory {
  // ... 现有字段
  /** 关联账户 ID */
  accountId?: string;
  /** 总消耗 */
  totalSpent?: number;
}
```

### 文件结构

**accounts.json:**
```json
[
  {
    "accountId": "acc-001",
    "companyName": "椰岛工坊",
    "totalCredits": 10000,
    "usedCredits": 3500,
    "remainingCredits": 6500,
    "lastUpdated": "2026-05-31T10:30:00Z",
    "warningThreshold": 1000
  }
]
```

**usage-logs.json:**
```json
[
  {
    "id": "log-001",
    "projectId": "VI-20260528-NDKW",
    "accountId": "acc-001",
    "action": "brand_analyze",
    "cost": 500,
    "balanceBefore": 10000,
    "balanceAfter": 9500,
    "durationMs": 2340,
    "status": "success",
    "createdAt": "2026-05-31T10:00:00Z"
  }
]
```

---

## 三、核心模块

### balance.ts

```
getBalance(accountId): AccountBalance
deductBalance(accountId, cost): AccountBalance
checkSufficient(accountId, estimatedCost): boolean
```

### usage-log.ts

```
logUsage(projectId, accountId, action, cost, status): UsageLog
getUsageLogs(projectId): UsageLog[]
getUsageLogsByAccount(accountId): UsageLog[]
getTotalCost(projectId): number
```

### cost-estimator.ts

```
estimateCost(modulePlan): CostEstimate
estimateBatchCost(pageIds): CostEstimate
getUnitPrice(action): number
```

---

## 四、Memory Integration

在 Orchestrator 中，每次 Agent 完成后记录消耗：

```
Agent 执行
  ↓
记录开始时间
  ↓
Agent 完成
  ↓
调用 usage-log.ts 写入记录
  ↓
更新 account balance
```

具体插入点：

| 操作 | 插入位置 | 成本项 |
|------|----------|--------|
| Brand Analyze | analyze API 完成后 | DeepSeek 调用 |
| Generate Page | 每生成一页后 | 通义万相调用 |
| Generate Batch | 批量生成完成后 | 通义万相批量调用 |

---

## 五、UI 位置建议

在现有 Decision Layer 中，Step 5（确认生成）增加：

```
预计页数   需调 API   预计耗时   预计消耗
  20        10        ~16分钟    ￥XX.XX
                                 ↑ 新增
```

底部新增余额预警（可选）：

```
💰 当前余额：8,500 分
⚠️ 本次预计消耗：3,200 分
✅ 余额充足，可以生成
```

管理员页面新增：

```
/admin/billing/      → 账户总览
/admin/billing/usage → 消耗明细
```

---

## 六、当前不做

- 不做支付接口（微信/支付宝）
- 不做充值页面
- 不做自动扣费
- 不做退款
- 不做发票系统
- 不改 SVG
- 不改封面
- 不改生成层

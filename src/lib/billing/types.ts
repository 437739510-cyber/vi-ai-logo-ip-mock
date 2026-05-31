/**
 * Billing System V1 — Types
 *
 * Shared types for cost tracking and usage logging.
 * No payment, no recharge, no third-party integration.
 */

export type UsageAction =
  | "brand_analyze"       // 品牌分析 (DeepSeek)
  | "industry_search"     // 行业搜索
  | "mascot_strategy"     // IP 策略分析
  | "vi_generate"         // VI 页面生成 (通义万相)
  | "vi_generate_batch"   // 批量生成
  | "future_ip_generate"; // 未来 IP 图片生成

// ========== Account Balance ==========

export interface AccountBalance {
  /** 账户 ID */
  accountId: string;
  /** 关联客户名 */
  companyName: string;
  /** 总分配额度（分） */
  totalCredits: number;
  /** 已消耗 */
  usedCredits: number;
  /** 剩余 */
  remainingCredits: number;

  /** 最近更新时间 */
  lastUpdated: string;
  /** 预警阈值 */
  warningThreshold: number;
}

// ========== Usage Log ==========

export interface UsageLog {
  id: string;
  /** 关联项目 */
  projectId: string;
  /** 关联账户 */
  accountId: string;

  /** 操作类型 */
  action: UsageAction;

  /** 消耗额度（分） */
  cost: number;

  /** 操作前余额 */
  balanceBefore: number;
  /** 操作后余额 */
  balanceAfter: number;

  /** 关联生成结果 */
  resultId?: string;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 状态 */
  status: "success" | "failed" | "pending";

  /** 创建时间 */
  createdAt: string;
}

// ========== Cost Estimate ==========

export interface CostEstimateItem {
  action: UsageAction;
  label: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CostEstimate {
  /** 单价定义 */
  unitPrices: Record<UsageAction, number>;
  /** 预计总消耗 */
  estimatedTotal: number;
  /** 当前余额 */
  currentBalance: number;
  /** 是否足够 */
  sufficient: boolean;
  /** 明细 */
  items: CostEstimateItem[];
}

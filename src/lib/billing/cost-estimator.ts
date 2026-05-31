/**
 * Billing System V1 — Cost Estimator
 *
 * Estimates cost before generation, so users can see
 * expected consumption before confirming.
 */

import type { CostEstimate, CostEstimateItem, UsageAction } from "./types";

/**
 * Unit prices (in cents / 分).
 * These are placeholder values for V1 — adjust when real pricing is set.
 */
const DEFAULT_UNIT_PRICES: Record<UsageAction, number> = {
  brand_analyze: 500,        // 品牌分析
  industry_search: 100,      // 行业搜索
  mascot_strategy: 200,      // IP 策略分析
  vi_generate: 300,          // VI 页面生成
  vi_generate_batch: 250,    // 批量生成（单价比单张低）
  future_ip_generate: 800,   // 未来 IP 图片生成
};

const ACTION_LABELS: Record<UsageAction, string> = {
  brand_analyze: "品牌分析",
  industry_search: "行业搜索",
  mascot_strategy: "IP 策略分析",
  vi_generate: "VI 页面生成",
  vi_generate_batch: "批量生成",
  future_ip_generate: "IP 图片生成",
};

// ========== API ==========

/**
 * 获取当前单价
 */
export function getUnitPrices(): Record<UsageAction, number> {
  return { ...DEFAULT_UNIT_PRICES };
}

/**
 * 获取单项单价
 */
export function getUnitPrice(action: UsageAction): number {
  return DEFAULT_UNIT_PRICES[action] || 0;
}

/**
 * 估算品牌分析成本
 */
export function estimateAnalyzeCost(): CostEstimateItem {
  return {
    action: "brand_analyze",
    label: ACTION_LABELS.brand_analyze,
    quantity: 1,
    unitPrice: DEFAULT_UNIT_PRICES.brand_analyze,
    subtotal: DEFAULT_UNIT_PRICES.brand_analyze,
  };
}

/**
 * 估算 VI 生成成本
 */
export function estimateGenerateCost(pageCount: number, batchSize: number = 1): CostEstimateItem {
  const unitPrice = batchSize > 1 ? DEFAULT_UNIT_PRICES.vi_generate_batch : DEFAULT_UNIT_PRICES.vi_generate;
  return {
    action: "vi_generate",
    label: ACTION_LABELS.vi_generate,
    quantity: pageCount,
    unitPrice,
    subtotal: unitPrice * pageCount,
  };
}

/**
 * 估算 IP 策略成本
 */
export function estimateMascotStrategyCost(): CostEstimateItem {
  return {
    action: "mascot_strategy",
    label: ACTION_LABELS.mascot_strategy,
    quantity: 1,
    unitPrice: DEFAULT_UNIT_PRICES.mascot_strategy,
    subtotal: DEFAULT_UNIT_PRICES.mascot_strategy,
  };
}

/**
 * 完整成本估算
 * @param pageCount 预计生成页数
 * @param hasBrandAnalyze 是否包含品牌分析
 * @param hasMascotStrategy 是否包含 IP 策略
 * @param currentBalance 当前余额
 * @param batchSize 批量生成数量
 */
export function estimateFullCost(
  pageCount: number,
  options?: {
    hasBrandAnalyze?: boolean;
    hasMascotStrategy?: boolean;
    currentBalance?: number;
    batchSize?: number;
  }
): CostEstimate {
  const items: CostEstimateItem[] = [];
  const { hasBrandAnalyze = true, hasMascotStrategy = true, currentBalance = 0, batchSize = 1 } = options || {};

  if (hasBrandAnalyze) {
    items.push(estimateAnalyzeCost());
  }
  if (hasMascotStrategy) {
    items.push(estimateMascotStrategyCost());
  }
  if (pageCount > 0) {
    items.push(estimateGenerateCost(pageCount, batchSize));
  }

  const estimatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    unitPrices: DEFAULT_UNIT_PRICES,
    estimatedTotal,
    currentBalance,
    sufficient: currentBalance >= estimatedTotal,
    items,
  };
}

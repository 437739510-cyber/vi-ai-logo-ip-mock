/**
 * Billing System V2 - Cost Estimator (修正?
 * 基于真实API成本计算，不是虚高定? * DeepSeek: ~0.01?次品牌分析调? * 通义万相: ~0.04?张图
 * iSlide下载: 9.9?次（仅下载时收费? */
import type { CostEstimate, CostEstimateItem, UsageAction } from "./types";

/**
 * 真实API单价（单位：元）
 * V1的注释写"?但实际被当成"?显示，导致费用虚? * V2直接用真实API成本（元? */
const REAL_API_PRICES: Record<UsageAction, number> = {
  brand_analyze: 0.01,
  industry_search: 0.005,
  mascot_strategy: 0.01,
  vi_generate: 0,        // ComfyUI
  vi_generate_batch: 0,  // ComfyUI
  future_ip_generate: 0,  // ComfyUI
};

const ACTION_LABELS: Record<UsageAction, string> = {
  brand_analyze: "品牌分析",
  industry_search: "行业搜索",
  mascot_strategy: "IP策略分析",
  vi_generate: "AIͼ()",
  vi_generate_batch: "ͼ()",
  future_ip_generate: "IPͼƬ()",
};

export function getUnitPrices(): Record<UsageAction, number> {
  return { ...REAL_API_PRICES };
}

export function getUnitPrice(action: UsageAction): number {
  return REAL_API_PRICES[action] || 0;
}

export function estimateAnalyzeCost(): CostEstimateItem {
  return { action: "brand_analyze", label: ACTION_LABELS.brand_analyze, quantity: 1, unitPrice: REAL_API_PRICES.brand_analyze, subtotal: REAL_API_PRICES.brand_analyze };
}

export function estimateGenerateCost(pageCount: number, batchSize: number = 1): CostEstimateItem {
  const unitPrice = batchSize > 1 ? REAL_API_PRICES.vi_generate_batch : REAL_API_PRICES.vi_generate;
  return { action: "vi_generate", label: ACTION_LABELS.vi_generate, quantity: pageCount, unitPrice, subtotal: unitPrice * pageCount };
}

export function estimateMascotStrategyCost(): CostEstimateItem {
  return { action: "mascot_strategy", label: ACTION_LABELS.mascot_strategy, quantity: 1, unitPrice: REAL_API_PRICES.mascot_strategy, subtotal: REAL_API_PRICES.mascot_strategy };
}

export function estimateFullCost(
  pageCount: number,
  options?: { hasBrandAnalyze?: boolean; hasMascotStrategy?: boolean; currentBalance?: number; batchSize?: number }
): CostEstimate {
  const items: CostEstimateItem[] = [];
  const { hasBrandAnalyze = true, hasMascotStrategy = true, currentBalance = 0, batchSize = 1 } = options || {};
  if (hasBrandAnalyze) items.push(estimateAnalyzeCost());
  if (hasMascotStrategy) items.push(estimateMascotStrategyCost());
  if (pageCount > 0) items.push(estimateGenerateCost(pageCount, batchSize));
  const estimatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return { unitPrices: REAL_API_PRICES, estimatedTotal, currentBalance, sufficient: currentBalance >= estimatedTotal, items };
}

/**
 * Billing System V2 - Cost Estimator (淇鐗?
 * 鍩轰簬鐪熷疄API鎴愭湰璁＄畻锛屼笉鏄櫄楂樺畾浠? * DeepSeek: ~0.01鍏?娆″搧鐗屽垎鏋愯皟鐢? * 閫氫箟涓囩浉: ~0.04鍏?寮犲浘
 * iSlide涓嬭浇: 9.9鍏?娆★紙浠呬笅杞芥椂鏀惰垂锛? */
import type { CostEstimate, CostEstimateItem, UsageAction } from "./types";

/**
 * 鐪熷疄API鍗曚环锛堝崟浣嶏細鍏冿級
 * V1鐨勬敞閲婂啓"鍒?浣嗗疄闄呰褰撴垚"鍏?鏄剧ず锛屽鑷磋垂鐢ㄨ櫄楂? * V2鐩存帴鐢ㄧ湡瀹濧PI鎴愭湰锛堝厓锛? */
const REAL_API_PRICES: Record<UsageAction, number> = {
  brand_analyze: 0.01,
  industry_search: 0.005,
  mascot_strategy: 0.01,
  vi_generate: 0,        // 本地ComfyUI免费
  vi_generate_batch: 0,  // 本地ComfyUI免费
  future_ip_generate: 0,  // 本地ComfyUI免费
};

const ACTION_LABELS: Record<UsageAction, string> = {
  brand_analyze: "鍝佺墝鍒嗘瀽",
  industry_search: "琛屼笟鎼滅储",
  mascot_strategy: "IP绛栫暐鍒嗘瀽",
  vi_generate: "AI出图(本地)",
  vi_generate_batch: "批量出图(本地)",
  future_ip_generate: "IP图片生成(本地)",
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

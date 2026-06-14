/**
 * AI 服务模块
 *
 * 核心能力：generateScheme — 基于素材生成完整的 VI 方案建议
 * 策略：优先调用真实 API（DeepSeek），API Key 未配置或调用失败时自动降级到 Mock。
 *
 * V55: 移除 analyzeLogo / analyzeManual（对应路由已删除）
 */

import { apiClient } from "./client";

// ========== 类型定义 ==========

export interface ViSchemeSuggestion {
  styleLabel: string;
  colorPalette: { primary: string; secondary: string; accent: string };
  fontPairing: { heading: string; body: string };
  description: string;
}

// ========== 工具：检查 API Key 是否已配置 ==========

function isAiConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

// ========== 生成 VI 方案 ==========

const MOCK_SCHEMES: ViSchemeSuggestion[] = [
  {
    styleLabel: "极简科技蓝",
    colorPalette: { primary: "#1A73E8", secondary: "#34A853", accent: "#FBBC04" },
    fontPairing: { heading: "Noto Sans SC", body: "Inter" },
    description: "以蓝色为主调的科技感方案，适合互联网、AI 行业",
  },
  {
    styleLabel: "赛博霓虹",
    colorPalette: { primary: "#0D47A1", secondary: "#E84343", accent: "#00E5FF" },
    fontPairing: { heading: "Poppins", body: "Roboto" },
    description: "充满未来感的霓虹风格，适合年轻化品牌",
  },
  {
    styleLabel: "自然生态",
    colorPalette: { primary: "#2E7D32", secondary: "#558B2F", accent: "#AEEA00" },
    fontPairing: { heading: "思源宋体", body: "Noto Sans SC" },
    description: "以绿色为主调的自然风格，适合食品、环保行业",
  },
];

export async function generateSchemes(params: {
  industry: string;
  logoDescription?: string;
  referenceMode?: "strong" | "weak" | "none";
  referenceColors?: string[];
}): Promise<ViSchemeSuggestion[]> {
  if (!isAiConfigured()) {
    console.warn("[AI] DEEPSEEK_API_KEY 未配置，使用 Mock 数据");
    return MOCK_SCHEMES;
  }

  try {
    const res = await apiClient.post<ViSchemeSuggestion[]>("/api/ai/generate-scheme", params);
    if (res.success && res.data) return res.data;
    throw new Error(res.error || "Generation failed");
  } catch (err) {
    console.warn("[AI] API 调用失败，降级到 Mock:", err);
    return MOCK_SCHEMES;
  }
}

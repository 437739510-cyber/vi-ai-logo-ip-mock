/**
 * AI 服务模块
 *
 * 实现三个核心 AI 能力：
 *   1. analyzeLogo    — 提取 Logo 的主色、风格标签
 *   2. analyzeManual  — 解析参考 VI 手册的结构化风格
 *   3. generateScheme — 基于素材生成完整的 VI 方案建议
 *
 * 策略：优先调用真实 API（DeepSeek），API Key 未配置或调用失败时自动降级到 Mock。
 */

import { apiClient } from "./client";

// ========== 类型定义 ==========

export interface LogoAnalysisResult {
  primaryColors: { hex: string; name: string; ratio: number }[];
  styleTags: string[];
  description: string;
}

export interface ManualAnalysisResult {
  extractedColors: string[];
  extractedFonts: string[];
  gridSystem?: string;
  styleSummary: string;
  confidence: number;
}

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

// ========== 1. Logo 分析 ==========

const MOCK_LOGO_RESULT: LogoAnalysisResult = {
  primaryColors: [
    { hex: "#1A73E8", name: "科技蓝", ratio: 0.6 },
    { hex: "#34A853", name: "生长绿", ratio: 0.25 },
    { hex: "#FBBC04", name: "活力黄", ratio: 0.15 },
  ],
  styleTags: ["极简", "现代", "科技感"],
  description: "以蓝色为主调的科技风格 Logo，线条简洁，适合互联网/科技行业",
};

export async function analyzeLogo(
  imageUrl: string
): Promise<LogoAnalysisResult> {
  if (!isAiConfigured()) {
    console.warn("[AI] DEEPSEEK_API_KEY 未配置，使用 Mock 数据");
    return MOCK_LOGO_RESULT;
  }

  try {
    const res = await apiClient.post<LogoAnalysisResult>("/api/ai/analyze-logo", {
      imageUrl,
    });
    if (res.success && res.data) return res.data;
    throw new Error(res.error || "Analysis failed");
  } catch (err) {
    console.warn("[AI] API 调用失败，降级到 Mock:", err);
    return MOCK_LOGO_RESULT;
  }
}

// ========== 2. 参考手册分析 ==========

const MOCK_MANUAL_RESULT: ManualAnalysisResult = {
  extractedColors: ["#1565C0", "#0D47A1", "#E3F2FD"],
  extractedFonts: ["Inter", "Noto Sans SC"],
  styleSummary: "极简风格，大量留白，蓝色为主色调，圆角元素",
  confidence: 0.85,
};

export async function analyzeManual(
  pdfUrl: string
): Promise<ManualAnalysisResult> {
  if (!isAiConfigured()) {
    console.warn("[AI] DEEPSEEK_API_KEY 未配置，使用 Mock 数据");
    return MOCK_MANUAL_RESULT;
  }

  try {
    const res = await apiClient.post<ManualAnalysisResult>("/api/ai/analyze-manual", {
      pdfUrl,
    });
    if (res.success && res.data) return res.data;
    throw new Error(res.error || "Analysis failed");
  } catch (err) {
    console.warn("[AI] API 调用失败，降级到 Mock:", err);
    return MOCK_MANUAL_RESULT;
  }
}

// ========== 3. 生成 VI 方案 ==========

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

/**
 * Company Scale Detector — 公司规模智能识别
 * 
 * 在表单提交时，通过DeepSeek AI分析公司名称，判断企业规模。
 * 对知名企业利用AI训练数据直接判断；对不知名小店默认为微型。
 * 成本：~0.001元/次（DeepSeek v4-flash），几乎可忽略。
 */

import { DEEPSEEK_MODEL, guardedDeepSeekCall } from "@/lib/core/billing/deepseek-guard";

export type CompanyScale = "micro" | "small" | "medium" | "large";

export interface ScaleResult {
  scale: CompanyScale;
  confidence: number;  // 0-1
  reason: string;
  employeeRange?: string;
  revenueHint?: string;
}

const SCALE_LABELS: Record<CompanyScale, string> = {
  micro: "微型（个体户/夫妻店）",
  small: "小型（10-50人）",
  medium: "中型（50-500人）",
  large: "大型（500人+）",
};

export function getScaleLabel(scale: CompanyScale): string {
  return SCALE_LABELS[scale];
}

/**
 * 根据公司名判断企业规模
 * - 知名公司：DeepSeek训练数据中已有信息，可直接判断
 * - 不知名/本地小店：根据名称特征（如"XX店""XX铺""XX工作室"）推断
 * - 无法判断：默认micro，不影响流程
 */
export async function detectCompanyScale(
  companyName: string,
  industry?: string,
  province?: string,
  city?: string,
): Promise<ScaleResult> {
  if (!companyName || companyName.trim().length < 2) {
    return { scale: "micro", confidence: 0, reason: "公司名过短，默认微型" };
  }

  // 快速规则：名字里带这些词的基本是微型
  const microKeywords = ["店", "铺", "摊", "档口", "工作室", "小作坊", "路边摊"];
  if (microKeywords.some(kw => companyName.includes(kw))) {
    return { scale: "micro", confidence: 0.8, reason: `名称含"${microKeywords.find(kw => companyName.includes(kw))}"，判定微型` };
  }

  // 快速规则：名字里带这些词的可能是中型+
  const mediumKeywords = ["集团", "有限公司", "股份", "连锁", "连锁店", "总店"];
  const hasMediumKw = mediumKeywords.find(kw => companyName.includes(kw));
  
  try {
    const response = await guardedDeepSeekCall({
      route: "/api/submit/company-scale",
      requestSummary: `判断公司规模: ${companyName}`,
      body: {
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: `你是一个企业信息分析专家。根据公司/店铺名称，判断其企业规模。
只返回JSON，不要任何其他文字。格式：
{"scale":"micro|small|medium|large","confidence":0.8,"reason":"简要原因","employeeRange":"估计人数范围","revenueHint":"营收量级提示"}

判断依据：
- micro: 个体户、夫妻店、路边摊、小微企业（<10人）
- small: 小型企业（10-50人），如小型餐饮店、社区店
- medium: 中型企业（50-500人），如连锁品牌、区域公司
- large: 大型企业（500人+），如全国品牌、上市公司

如果不确定，宁可往小判断。不知名的本地店铺默认micro。`
          },
          {
            role: "user",
            content: `请判断以下公司/店铺的规模：${companyName}${industry ? `，行业：${industry}` : ""}${province ? `，地区：${province}${city ? city : ""}` : ""}${hasMediumKw ? `（注：名称含"${hasMediumKw}"）` : ""}`
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
      },
      timeoutMs: 8000,
    });

    if (!response.ok) {
      console.warn("[COMPANY-SCALE] DeepSeek call failed, falling back to rules");
      return fallbackResult(companyName, hasMediumKw);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackResult(companyName, hasMediumKw);
    }

    const parsed = JSON.parse(content);
    const validScales: CompanyScale[] = ["micro", "small", "medium", "large"];
    const scale = validScales.includes(parsed.scale) ? parsed.scale : "micro";

    return {
      scale,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reason: parsed.reason || "AI判断",
      employeeRange: parsed.employeeRange,
      revenueHint: parsed.revenueHint,
    };
  } catch (e) {
    console.warn("[COMPANY-SCALE] Detection error, falling back:", e);
    return fallbackResult(companyName, hasMediumKw);
  }
}

function fallbackResult(companyName: string, hasMediumKw?: string): ScaleResult {
  if (hasMediumKw) {
    return { scale: "small", confidence: 0.4, reason: `名称含"${hasMediumKw}"，初步判断为小型+` };
  }
  return { scale: "micro", confidence: 0.3, reason: "无法获取更多信息，默认微型" };
}

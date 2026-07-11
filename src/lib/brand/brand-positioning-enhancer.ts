/**
 * Brand Brain — LLM Brand Positioning Enhancer
 *
 * When geo-context inference succeeds, replaces the template-based
 * brand positioning ("xx公司 — 消费品牌") with a DeepSeek-generated
 * positioning that incorporates geographic, cultural, and industrial insight.
 *
 * Example:
 *   "海南椰源" + geoContext → "北纬18°黄金产区的椰子水定制专家"
 */

import type { GeoContext } from "./geo-context";

// ── Types ──────────────────────────────────────────────

export interface PositioningInput {
  companyName: string;
  industry: string;
  mainProducts?: string;
  brandVision?: string;
  targetMarket?: string;
  brandType: string;
  brandPersona: string[];
  geoContext?: GeoContext;
}

// ── System Prompt ─────────────────────────────────────

const POSITIONING_PROMPT = `你是一个资深品牌定位专家。根据品牌信息生成一句精炼、有传播力的品牌定位语。

要求：
1. 如果提供了地理文化洞察，优先将地理优势融入定位（如北纬18°、黄金产区等）
2. 结合行业/品类特征
3. 体现品牌差异化
4. 一句话，不超过30字
5. 有记忆点、有传播力
6. 不要用模板套话（如"xx公司 — xx品牌"）

输出严格JSON：
{
  "positioning": "定位语",
  "rationale": "为什么这样定位（一句话）"
}`;

// ── Enhancer ───────────────────────────────────────────

export async function enhanceBrandPositioning(input: PositioningInput): Promise<{
  positioning: string;
  enhanced: boolean;
  rationale: string;
}> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { positioning: "", enhanced: false, rationale: "No API key" };
  }

  // Build geo context block
  let geoBlock = "";
  const geo = input.geoContext;
  if (geo?.inferred && geo.dimensions) {
    const d = geo.dimensions;
    const parts: string[] = [];
    if (d.geography?.region) parts.push(`地理：${d.geography.region}`);
    if (d.history?.story) parts.push(`历史：${d.history.story}`);
    if (d.culture?.symbol) parts.push(`文化：${d.culture.symbol}`);
    if (d.industry?.trend) parts.push(`产业：${d.industry.trend}`);
    if (d.health?.benefits) parts.push(`健康：${d.health.benefits}`);
    if (d.brandStory?.character) parts.push(`品牌故事：${d.brandStory.character}`);
    if (parts.length > 0) {
      geoBlock = "\n\n【地理文化洞察】\n" + parts.join("\n");
    }
  }

  const userMessage = [
    `公司名称：${input.companyName}`,
    `所属行业：${input.industry}`,
    input.mainProducts ? `主营产品：${input.mainProducts}` : "",
    input.brandVision ? `品牌愿景：${input.brandVision}` : "",
    input.targetMarket ? `目标客群：${input.targetMarket}` : "",
    `品牌类型：${input.brandType}`,
    `品牌人格：${input.brandPersona.join("、")}`,
    geoBlock,
  ].filter(Boolean).join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: POSITIONING_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn("[positioning] DeepSeek HTTP", response.status);
      return { positioning: "", enhanced: false, rationale: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { positioning: "", enhanced: false, rationale: "Empty response" };

    const parsed = JSON.parse(content);
    return {
      positioning: parsed.positioning || "",
      enhanced: true,
      rationale: parsed.rationale || "",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.warn("[positioning] Timeout");
    } else {
      console.warn("[positioning]", error instanceof Error ? error.message : String(error));
    }
    return { positioning: "", enhanced: false, rationale: "Error" };
  }
}

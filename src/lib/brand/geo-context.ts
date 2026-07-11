/**
 * Brand Brain — Geo-Context Inference (V2: 8-Dimension Knowledge)
 *
 * Uses DeepSeek LLM to infer 8 knowledge dimensions from company info.
 * Caches results in Supabase knowledge_cache table.
 * Falls back gracefully when table doesn't exist.
 *
 * 8 dimensions: geography, history, culture, industry, ecology, policy, health, brandStory
 */

import { supabaseAdmin } from "@/lib/core/supabase";

// ── Types ──────────────────────────────────────────────

export interface GeoDimension {
  geography?: { region?: string; climate?: string; terrain?: string; water?: string };
  history?: { origin?: string; story?: string };
  culture?: { craft?: string; symbol?: string };
  industry?: { chain?: string; trend?: string; tech?: string };
  ecology?: { sustainable?: string; certification?: string };
  policy?: { protection?: string; zone?: string };
  health?: { benefits?: string; positioning?: string };
  brandStory?: { character?: string; vision?: string };
}

export interface GeoContext {
  region: string;
  geoInsight: string;
  colorHint: string;
  materialHint: string;
  culturalSymbols: string[];
  positioningAnchor: string;
  dimensions: GeoDimension;
  inferred: boolean;
}

const EMPTY_GEO_CONTEXT: GeoContext = {
  region: "", geoInsight: "", colorHint: "", materialHint: "",
  culturalSymbols: [], positioningAnchor: "", dimensions: {}, inferred: false,
};

// ── System Prompt (8-dimension) ────────────────────────

const GEO_INFERENCE_PROMPT = `你是一个品牌地理文化分析专家。根据品牌基本信息，推断8个维度的深度洞察。

输出严格JSON：
{
  "region": "具体地名+地理特征",
  "geoInsight": "2-3句综合洞察",
  "colorHint": "从自然环境提炼的色彩灵感（含色彩来源）",
  "materialHint": "与产品形态匹配的物料建议",
  "culturalSymbols": ["符号1", "符号2", "符号3"],
  "positioningAnchor": "一句地理定位锚点，≤20字",

  "dimensions": {
    "geography": {"region":"地区","climate":"气候","terrain":"地貌土壤","water":"水源"},
    "history": {"origin":"起源历史","story":"相关故事"},
    "culture": {"craft":"工艺/非遗","symbol":"文化符号"},
    "industry": {"chain":"产业链位置","trend":"行业趋势","tech":"技术特色"},
    "ecology": {"sustainable":"可持续","certification":"认证"},
    "policy": {"protection":"地标保护","zone":"政策区域"},
    "health": {"benefits":"健康卖点","positioning":"功能定位"},
    "brandStory": {"character":"品牌人物","vision":"品牌愿景"}
  },

  "inferred": true
}

规则：
- 只输出有把握的内容，不确定的维度留空
- 色彩灵感必须来自真实地理环境（地貌/植被/建筑）
- 品牌故事基于已知信息推断，不编造
- 无地理产业信息时全部留空，inferred: false`;

// ── Cache Helpers ─────────────────────────────────────

async function cacheGet(key: string): Promise<GeoContext | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("knowledge_cache")
      .select("dimensions, summary_cn")
      .eq("cache_key", key)
      .single();

    if (error || !data?.dimensions) return null;

    // Bump hit count
    await supabaseAdmin
      .from("knowledge_cache")
      .update({ hit_count: undefined /* noop */ })
      .eq("cache_key", key)
      .then(() => {}, () => {});

    // Reconstruct GeoContext from dimensions
    const d = data.dimensions as GeoDimension;
    const geo = d.geography;
    const ind = d.industry;
    return {
      region: geo?.region || "",
      geoInsight: data.summary_cn || "",
      colorHint: "",
      materialHint: "",
      culturalSymbols: d.culture?.craft ? [d.culture.craft, d.culture.symbol || ""].filter(Boolean) : [],
      positioningAnchor: "",
      dimensions: d,
      inferred: true,
    };
  } catch {
    // Table might not exist yet — graceful fallback
    return null;
  }
}

async function cacheSet(key: string, ctx: GeoContext, projectId?: string): Promise<void> {
  try {
    const tags: string[] = [];
    if (ctx.region) tags.push(...ctx.region.split(/[（(]/).filter(Boolean).map(t => t.trim()));
    if (projectId) {
      // Update or insert
      const { data: existing } = await supabaseAdmin
        .from("knowledge_cache")
        .select("source_projects, hit_count")
        .eq("cache_key", key)
        .single()
        .then(r => ({ data: r.data }))
        .then((r: any) => r, () => ({ data: null }));

      if (existing) {
        const projects = [...new Set([...(existing.source_projects || []), projectId])];
        await supabaseAdmin
          .from("knowledge_cache")
          .update({
            dimensions: ctx.dimensions,
            summary_cn: ctx.geoInsight,
            tags,
            source_projects: projects,
            hit_count: (existing.hit_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("cache_key", key)
          .then(() => {}, () => {});
      } else {
        await supabaseAdmin
          .from("knowledge_cache")
          .insert({
            cache_key: key,
            dimensions: ctx.dimensions,
            summary_cn: ctx.geoInsight,
            tags,
            source_projects: projectId ? [projectId] : [],
            hit_count: 1,
            confidence: 0.7,
          })
          .then(() => {}, () => {});
      }
    }
  } catch {
    // Table might not exist — silent fallback
  }
}

// ── Inference Function ────────────────────────────────

export async function inferGeoContext(params: {
  companyName: string;
  mainProducts?: string;
  city?: string;
  industry?: string;
  projectId?: string;
}): Promise<GeoContext> {
  const { companyName, mainProducts, city, industry, projectId } = params;

  if (!companyName || companyName.length < 2) return EMPTY_GEO_CONTEXT;

  // Cache key: region|product
  const regionHint = city || "";
  const cacheKey = [regionHint, mainProducts || ""].filter(Boolean).join("|") || companyName;
  if (cacheKey.length > 2) {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  }

  // Call DeepSeek via fetch
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return EMPTY_GEO_CONTEXT;

  const userMessage = [
    `公司名称：${companyName}`,
    mainProducts ? `主营产品：${mainProducts}` : "",
    city ? `所在城市：${city}` : "",
    industry ? `所属行业：${industry}` : "",
  ].filter(Boolean).join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: GEO_INFERENCE_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn("[geo-context] DeepSeek HTTP", response.status);
      return EMPTY_GEO_CONTEXT;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return EMPTY_GEO_CONTEXT;

    const parsed = JSON.parse(content);
    const ctx: GeoContext = {
      region: parsed.region || "",
      geoInsight: parsed.geoInsight || "",
      colorHint: parsed.colorHint || "",
      materialHint: parsed.materialHint || "",
      culturalSymbols: Array.isArray(parsed.culturalSymbols) ? parsed.culturalSymbols : [],
      positioningAnchor: parsed.positioningAnchor || "",
      dimensions: parsed.dimensions || {},
      inferred: parsed.inferred === true,
    };

    // Write to cache (non-blocking)
    if (ctx.inferred && cacheKey.length > 2) {
      cacheSet(cacheKey, ctx, projectId).then(() => {}, () => {});
    }

    return ctx;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.warn("[geo-context] Timeout");
    } else {
      console.warn("[geo-context]", error instanceof Error ? error.message : String(error));
    }
    return EMPTY_GEO_CONTEXT;
  }
}

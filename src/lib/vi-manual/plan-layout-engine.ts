/**
 * Plan Layout Engine
 * 
 * AI 布局规划核心引擎，通过 guardedDeepSeekCall 调用 DeepSeek 生成页面布局。
 * 供 ai-layout-planner.ts 和 API route 共用，避免 HTTP 端口依赖。
 * 
 * V57: 行业感知 prompt - 传递行业上下文，让 DeepSeek 为不同行业输出差异化布局
 */

import type { PageElement } from "./page-planner";
import { guardedDeepSeekCall } from "@/lib/core/billing/deepseek-guard";

export interface PlanLayoutParams {
  pageId: string;
  companyName: string;
  industry?: string;
  brandVision?: string;
  coreValues?: string;
  targetMarket?: string;
  brandTone?: string;
  brandColors?: {
    primary: { hex: string; name?: string };
    secondary: { hex: string; name?: string };
    accent: { hex: string; name?: string };
  };
  hasLogo?: boolean;
  hasMascot?: boolean;
  mascotName?: string;
  mascotStyle?: string;
  mascotPersonality?: string;
  logoElements?: string[];
  logoMeaning?: string;
  logoStyleTags?: string[];
}

export interface PlanLayoutResult {
  success: boolean;
  pageId: string;
  elements: PageElement[];
  count: number;
  error?: string;
}

// Industry-specific design guidance for DeepSeek
function getIndustryGuidance(industry?: string): string {
  if (!industry) return "";
  const s = industry.toLowerCase();

  if (/鞋|布鞋|鞋店|鞋履|运动鞋/.test(s)) {
    return `## 行业设计指引（鞋履零售）
- 典型视觉风格：传统中式、手工质感、温暖怀旧
- 常用设计元素：祥云纹、千层底纹理、布艺质感、书法字体
- 适合字体：宋体/楷体（传统）、黑体/无衬线（现代）
- 该行业典型物料：鞋盒包装、价签吊牌、店铺招牌、手提袋、陈列道具
- 色彩偏向：大地色系、暖色调，搭配品牌色突出传统匠心底蕴
- 封面推荐方向：突出手工感，Logo搭配传统纹样装饰，温暖稳重`;
  }

  if (/餐|食|面|火锅|烧烤|烘焙|饺子|包子|炒菜|饭店|小吃|饭馆|海鲜|川菜|粤菜|湘菜/.test(s)) {
    return `## 行业设计指引（餐饮/火锅）
- 典型视觉风格：热烈烟火气、食欲感、中式/地方特色
- 常用设计元素：火焰纹、食材剪影、蒸汽线条、传统窗花
- 适合字体：粗黑体/书法体（标题），细黑体（正文）
- 该行业典型物料：菜单、餐垫纸、外卖袋、围裙、招牌灯箱、优惠券
- 色彩偏向：高饱和度暖色（红/橙/金），对比强烈激发食欲
- 封面推荐方向：突出食材或用餐氛围，Logo搭配热力动感元素`;
  }

  if (/美容|美发|美甲|spa|沙龙|护肤|美体|美睫|养生/.test(s)) {
    return `## 行业设计指引（美容/美业）
- 典型视觉风格：优雅高级、柔美精致、简约轻奢
- 常用设计元素：花瓣弧线、水波纹、光影渐变、金色线条
- 适合字体：纤细衬线/手写体（标题），细无衬线（正文）
- 该行业典型物料：预约卡、会员卡、产品包装、价目表、手提袋、店内招牌
- 色彩偏向：低饱和度暖色（粉/金/白/香槟），柔和通透的高级感
- 封面推荐方向：留白充足，Logo搭配优雅弧线装饰，轻奢质感`;
  }

  if (/零售|超市|便利|商店|杂货|服装|饰品|母婴|数码/.test(s)) {
    return `## 行业设计指引（零售）
- 典型视觉风格：现代简洁、商业高效、货架感
- 常用设计元素：几何图形、价格标签线条、货架陈列暗示
- 适合字体：无衬线商务字体，清晰易读
- 该行业典型物料：价签、促销海报、会员卡、购物袋、陈列指引
- 色彩偏向：品牌色+高亮强调色，清晰的功能分区
- 封面推荐方向：Logo居中，简洁商务，搭配几何装饰纹样`;
  }

  if (/教育|培训|学|课|幼儿园|托管|辅导/.test(s)) {
    return `## 行业设计指引（教育）
- 典型视觉风格：亲和有活力、积极向上、知识感
- 常用设计元素：书本线条、讲台、星星/奖杯、孩子笑脸
- 适合字体：圆体/手写体（亲和），无衬线（正文）
- 该行业典型物料：课程表、学生证、宣传单页、证书模板、书包/文具
- 色彩偏向：明亮活泼，高饱和度+柔和辅色平衡
- 封面推荐方向：活泼明亮，Logo搭配知识元素装饰`;
  }

  // Default: general
  return `## 行业设计指引
- 请根据品牌名称、愿景和调性，自主判断适合的视觉风格
- 思考该行业VI手册应该包含哪些典型物料和应用场景
- 封面设计依据品牌定位决定：传统行业偏稳重，现代行业偏简洁`;
}

// Page purpose context for industry-aware layout
function getPagePurpose(pageId: string, industry?: string): string {
  if (!industry) return "";
  const s = industry.toLowerCase();

  const industryPages: Record<string, Record<string, string>> = {
    "cover": {
      default: "品牌VI手册封面，建立第一印象",
      shoe: "鞋履品牌第一印象，传统匠心底蕴，Logo+品牌名+传统纹样",
      restaurant: "餐饮品牌第一印象，热烈食欲感，Logo+品牌名+暖色调背景",
      beauty: "美容品牌第一印象，优雅高级感，Logo+品牌名+留白",
    },
    "brand-philosophy": {
      default: "品牌核心理念页，展示愿景/价值观",
      shoe: "突出'脚踏实地'的匠心传承和舒适哲学",
      restaurant: "突出食材品质和烹饪热情，传递烟火气",
      beauty: "突出'让美更简单'的服务理念和精致态度",
    },
    "logo-interpretation": {
      default: "Logo设计元素拆解与含义说明",
      shoe: "展示鞋履符号在Logo中的设计巧思和传统意象",
      restaurant: "展示餐饮符号在Logo中的设计巧思",
      beauty: "展示美学符号在Logo中的设计巧思",
    },
    "summary": {
      default: "总结品牌定位与核心原则",
      shoe: "回顾'每一步都踏实'的品牌承诺和品质坚守",
      restaurant: "回顾'每一口都是享受'的品牌承诺",
      beauty: "回顾'每一刻都美丽'的品牌承诺",
    },
  };

  const pageMap = industryPages[pageId];
  if (!pageMap) return "";
  if (/鞋|布鞋/.test(s)) return pageMap.shoe || pageMap.default;
  if (/餐|食|火锅|饭店/.test(s)) return pageMap.restaurant || pageMap.default;
  if (/美容|spa|美业/.test(s)) return pageMap.beauty || pageMap.default;
  return pageMap.default;
}

/**
 * 使用 DeepSeek 规划页面布局（核心引擎）
 */
export async function planLayoutEngine(params: PlanLayoutParams): Promise<PlanLayoutResult> {
  const priHex = params.brandColors?.primary?.hex || "#1A73E8";
  const secHex = params.brandColors?.secondary?.hex || "#34A853";
  const accHex = params.brandColors?.accent?.hex || "#FBBC04";

  const pageContext = buildPageContext(params.pageId, {
    ...params,
    priHex, secHex, accHex,
  });

  const industry = params.industry || "";
  const industryGuidance = getIndustryGuidance(industry);
  const pagePurpose = getPagePurpose(params.pageId, industry);

  try {
    const resp = await guardedDeepSeekCall({
      route: "plan-layout-engine",
      body: {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `你是一位资深品牌 VI 设计师。你的任务是为企业 VI 手册的每一页设计布局。
你收到页面的品牌信息和内容后，输出页面元素的定位和样式。
页面尺寸为 1024×1024 像素。

品牌主色: ${priHex}
品牌辅助色: ${secHex}
品牌强调色: ${accHex}

${industryGuidance}

## 设计规则（必须遵守）
- 品牌色在页面中占主导地位
- 一页不超过 3 种字重
- LOGO 四周保留 15% 保护空间
- 文本必须有足够对比度
- 页面边缘保留 5-10% 留白
- 装饰元素不得遮挡主要信息
- 每页最多使用一个 IP 公仔

## 输出格式
返回 JSON 数组，每个元素对象包含：
{
  "type": "logo|text|ip-mascot|color-swatch|decoration|divider|image",
  "id": "唯一标识",
  "content": "文本内容（仅 text 类型需要）",
  "position": "top-center|center|bottom-center|bottom-right|left|right",
  "xPct": 0-100（可选）,
  "yPct": 0-100（可选）,
  "widthPct": 0-100,
  "heightPct": 0-100,
  "marginTop": 像素值,
  "marginBottom": 像素值,
  "marginLeft": 像素值,
  "marginRight": 像素值,
  "fontSize": 字号,
  "fontWeight": 400|500|600|700,
  "color": "十六进制颜色",
  "opacity": 0-1,
  "shadow": true|false
}

只输出 JSON 数组，不要 markdown 包裹。`,
          },
          {
            role: "user",
            content: `请为 "${params.pageId}" 页设计布局。\n\n${pageContext}${pagePurpose ? `\n\n此页在本行业中的作用：${pagePurpose}` : ""}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      },
      timeoutMs: 15000,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { success: false, pageId: params.pageId, elements: [], count: 0, error: `DeepSeek error: ${resp.status} ${errText}` };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    let elements: any[];
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      elements = JSON.parse(cleaned);
      if (!Array.isArray(elements)) {
        elements = [elements];
      }
    } catch {
      return { success: false, pageId: params.pageId, elements: [], count: 0, error: "Failed to parse AI layout" };
    }

    return { success: true, pageId: params.pageId, elements, count: elements.length };
  } catch (error) {
    return {
      success: false,
      pageId: params.pageId,
      elements: [],
      count: 0,
      error: error instanceof Error ? error.message : "Layout planning failed",
    };
  }
}

/**
 * 根据页面类型 + 品牌信息，构建发给 AI 的页面上下文
 */
function buildPageContext(pageId: string, ctx: any): string {
  const pageLabels: Record<string, string> = {
    cover: "封面",
    "brand-philosophy": "品牌核心理念",
    "logo-interpretation": "标识诠释",
    "brand-colors": "标准色彩规范",
    typography: "字体系统",
    "basic-spec": "基础规范",
    stationery: "办公应用系统",
    packaging: "产品包装系统",
    marketing: "营销展示系统",
    summary: "总结",
    closing: "感谢观看",
  };

  const pageDescriptions: Record<string, string> = {
    cover: "企业 VI 手册的封面。包含品牌 LOGO、公司名称、副标题'品牌视觉识别系统 (VI) 规范手册'、底部版权信息。",
    "brand-philosophy": "展示品牌核心理念。包含品牌愿景、核心价值、目标市场三个板块，用分隔线隔开。",
    "logo-interpretation": "标识诠释页。展示 LOGO 设计元素拆解和设计含义，以及 IP 公仔角色介绍。",
    "brand-colors": "品牌色彩规范。展示主色、辅助色、强调色的色块和色值。",
    typography: "字体系统。展示中文和英文字体名称、字号层级表。",
    "basic-spec": "基础规范。展示 LOGO 保护空间和最小使用尺寸。",
    stationery: "办公应用系统。展示名片、信纸等商务场景。",
    packaging: "产品包装系统。展示产品包装场景应用。",
    marketing: "营销展示系统。展示营销海报等应用场景。",
    summary: "总结页。回顾品牌定位、核心价值和三大原则（一致性/专业性/持续性）。",
    closing: "感谢观看页。深色背景，公司名和版权信息。",
  };

  let context = `## 页面：${pageLabels[pageId] || pageId}\n`;
  context += `描述：${pageDescriptions[pageId] || ""}\n\n`;

  context += `公司名称：${ctx.companyName || "品牌名称"}\n`;
  if (ctx.industry) context += `行业：${ctx.industry}\n`;
  if (ctx.brandVision) context += `品牌愿景：${ctx.brandVision}\n`;
  if (ctx.coreValues) context += `核心价值：${ctx.coreValues}\n`;
  if (ctx.targetMarket) context += `目标市场：${ctx.targetMarket}\n`;
  if (ctx.brandTone) context += `品牌调性：${ctx.brandTone}\n`;
  if (ctx.logoMeaning) context += `LOGO 设计含义：${ctx.logoMeaning}\n`;

  context += `\n品牌色：主色 ${ctx.priHex}，辅助色 ${ctx.secHex}，强调色 ${ctx.accHex}\n`;

  if (ctx.hasLogo && ctx.logoElements?.length) {
    context += `LOGO 元素：${ctx.logoElements.join("、")}\n`;
  }
  if (ctx.hasLogo && ctx.logoStyleTags?.length) {
    context += `LOGO 风格：${ctx.logoStyleTags.join("、")}\n`;
  }

  if (ctx.hasMascot) {
    context += `IP 公仔：${ctx.mascotName || "未命名"}`;
    if (ctx.mascotStyle) context += `，风格 ${ctx.mascotStyle}`;
    if (ctx.mascotPersonality) context += `，性格 ${ctx.mascotPersonality}`;
    context += "\n";
  }

  if (pageId === "cover") {
    context += `\n封面要求：LOGO 居中，公司名 40-48px 加粗白色文字，副标题 22px，底部品牌管理部版权信息。深色品牌色背景。`;
  } else if (pageId === "closing") {
    context += `\n封底要求：深色品牌色背景，白色文字居中显示"感谢观看"，底部装饰条。`;
  } else if (pageId === "brand-colors") {
    context += `\n色块要求：三个色块横向排列（主色/辅助色/强调色），标注 HEX 色值。`;
  } else if (pageId === "basic-spec") {
    context += `\nLOGO 保护空间：四周 15%。标注最小使用尺寸（印刷 8mm / 屏幕 24px）。`;
  }

  return context;
}

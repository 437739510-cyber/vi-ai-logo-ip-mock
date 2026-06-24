// @ts-nocheck
/**
 * V113: 富文本叙事生成器 — 重写版
 * 用DeepSeek品牌分析的所有数据生成有温度、有信息量的文案
 */

interface BrandProfile {
  refinedBrandVision?: string;
  refinedCoreValues?: string;
  refinedTargetMarket?: string;
  brandToneKeywords?: string[];
  visualStyleSuggestion?: string;
  brandPositioning?: string;
  industryInsight?: string;
  geoEnvironment?: string;
  competitiveLandscape?: string;
  colorPalette?: Array<{ name: string; hex: string; meaning: string; nameEn?: string }>;
  logoDesignSuggestions?: {
    concept?: string;
    elements?: string;
    style?: string;
    colorGuidance?: string;
  };
  sceneImageSuggestions?: Array<{ zh: string; en: string }>;
  sceneSectionTitles?: Record<string, string>;
}

export function generateBrandStory(companyName: string, bp: BrandProfile): string {
  const geo = bp.geoEnvironment || "";
  const positioning = bp.brandPositioning || "";
  const vision = bp.refinedBrandVision || "";
  const values = bp.refinedCoreValues || "";
  const market = bp.refinedTargetMarket || "";
  const comp = bp.competitiveLandscape || "";
  const parts: string[] = [];
  parts.push("品牌故事\n");
  if (geo) parts.push(geo.replace(/。/, "。") + "\n");
  if (positioning) parts.push(positioning.replace(/。/, "。") + "\n");
  if (values || vision) parts.push((values || "") + (vision ? "。" + vision : "") + "\n");
  if (market) parts.push("品牌深耕" + market + "群体，深刻理解她们对品质与美的追求。\n");
  if (comp) {
    const ss = comp.split(/[。]/).filter(Boolean);
    if (ss.length >= 2) parts.push(ss[1].trim() + "。\n");
  }
  parts.push("这份VI手册，正是" + companyName + "对品牌承诺的视觉化表达。");
  return parts.join("\n");
}

export function generateLogoNarrative(companyName: string, bp: BrandProfile): string {
  const lds = bp.logoDesignSuggestions || {};
  const concept = lds.concept || "";
  const style = lds.style || "";
  const elements = lds.elements || "";
  const palette = bp.colorPalette || [];
  const parts: string[] = [];
  parts.push("Logo 释义\n设计理念\n");
  if (concept) parts.push(concept.replace(/。/g, "。\n") + "\n");
  if (style) parts.push("\n风格定位\n" + style + "\n");
  if (elements) parts.push("\n核心视觉元素\n" + elements.replace(/[、，,]/g, "、") + "，共同构成品牌独特的视觉语言。\n");
  if (palette.length >= 1) {
    parts.push("\n配色逻辑\n");
    palette.forEach((c, i) => {
      const role = i === 0 ? "品牌主色" : i === 1 ? "辅助色" : "强调色";
      parts.push(c.hex + " " + role + (c.name ? "—" + c.name : "") + "：" + (c.meaning || "传递品牌气质") + "。\n");
    });
  }
  return parts.join("\n");
}

export function generateColorDescriptions(companyName: string, bp: BrandProfile): string {
  const palette = bp.colorPalette || [];
  if (palette.length === 0) return "";
  return palette.map((c, i) => {
    const role = i === 0 ? "品牌主色 — 灵魂色" : i === 1 ? "辅助色 — 底蕴色" : "强调色 — 点睛色";
    return role + "  " + c.hex + "\n" + (c.name || "") + "\n" + (c.meaning || "") + (c.nameEn ? "\n英文名称：" + c.nameEn : "");
  }).join("\n\n");
}

export function generateAuxGraphicsNarrative(bp: BrandProfile): string {
  const keywords = bp.brandToneKeywords || [];
  const parts: string[] = [];
  parts.push("辅助图形提取自 Logo 中的核心视觉元素，贯穿品牌全场景应用。\n");
  parts.push("点阵组合 — 精致与秩序\n以均匀排列的点阵传递精致感，呼应品牌「" + (keywords.slice(0, 2).join("、") || "优雅、专业") + "」的调性。\n用于会员卡底纹、礼品包装纸、社交媒体头像框。\n");
  parts.push("\n条纹组合 — 节奏与韵律\n以流畅的线条重复排列形成节奏感，传递品牌从容有序的气质。\n用于包装封口贴、名片底纹、宣传单页装饰线。\n");
  parts.push("\n植物肌理 — 自然与生机\n以半透明植物肌理呈现，无声传递品牌与自然共生的理念。\n用于空间墙面装饰、产品说明书背景、礼盒内衬纸。");
  return parts.join("\n");
}

export function generateSceneDescriptions(companyName: string, bp: BrandProfile): Record<string, string> {
  const scenes = bp.sceneImageSuggestions || [];
  const result: Record<string, string> = {};
  result["stationery"] = (scenes[0]?.zh || "") + "\n\n作为品牌在服务场景中的标准化应用，每一处细节都经过精心设计。\n从材质选择到色彩搭配，都严格遵循品牌视觉规范，确保客人在每一个触点都能感受到一致的品牌气质。";
  result["packaging"] = (scenes[1]?.zh || "") + "\n\n精心设计的包装不仅是产品的容器，更是品牌美学的延伸。\n选用与品牌调性一致的材质与工艺，让产品从货架上脱颖而出。";
  result["marketing"] = (scenes[2]?.zh || "") + "\n\n每一份宣传物料都是品牌与顾客的沟通桥梁。\n用统一的视觉语言讲述品牌故事，让每一次接触都成为美好的品牌体验。";
  return result;
}

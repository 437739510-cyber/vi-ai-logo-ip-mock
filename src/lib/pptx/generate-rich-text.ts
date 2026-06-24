// @ts-nocheck
/**
 * V112: Rich narrative text generator for VI manual
 * Takes brand analysis data and generates story-style descriptions for each page.
 */
interface BrandProfile {
  refinedBrandVision?: string;
  refinedCoreValues?: string;
  refinedTargetMarket?: string;
  colorPalette?: Array<{ name: string; hex: string; meaning: string }>;
  brandToneKeywords?: string[];
  visualStyleSuggestion?: string;
  brandPositioning?: string;
  industryInsight?: string;
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
  const vision = bp.refinedBrandVision || "";
  const values = bp.refinedCoreValues || "";
  const market = bp.refinedTargetMarket || "";
  const insight = bp.industryInsight || "";

  const storyParts: string[] = [];

  // Brand story - weave from available data
  if (insight) {
    storyParts.push(`${companyName}深耕行业多年，始终相信：真正的品牌价值源于对品质的坚持与对客户的真诚。`);
  } else {
    storyParts.push(`${companyName}始终相信：好的品牌不仅是一个标志，更是一份承诺。`);
  }

  if (vision) storyParts.push(`我们秉持"${vision}"的品牌愿景，用心服务每一位客户。`);
  if (market) storyParts.push(`我们专注于${market}，用专业与温度赢得信赖。`);

  return storyParts.join("\n");
}

export function generateLogoNarrative(companyName: string, bp: BrandProfile): string {
  const lds = bp.logoDesignSuggestions || {};
  const concept = lds.concept || "";
  const style = lds.style || "";
  const elements = lds.elements || "";
  const colorPalette = bp.colorPalette || [];
  const keywords = bp.brandToneKeywords || [];

  // Split concept into sections
  const parts: string[] = [];

  parts.push("Logo 释义\n");
  parts.push(`本 Logo 以品牌核心价值为设计原点，${concept || '通过简约而富有辨识度的视觉语言，传递品牌独特的气质与内涵'}。`);

  // Extract first symbol from elements for the narrative
  if (elements) {
    const elemList = elements.split(/[、，,]/).map(s => s.trim()).filter(Boolean);
    if (elemList.length >= 1) {
      const firstElem = elemList[0];
      const secondElem = elemList.length >= 2 ? elemList[1] : "";
      parts.push(`\n${firstElem}象征品牌的核心精神——${secondElem ? secondElem + '与' + firstElem + '的融合' : '流畅的线条与精致的细节'}，传递品牌对品质与美学的坚持。`);
    }
  }

  if (style) {
    parts.push(`\n风格定位\n${style}`);
  }

  // Color rationale
  if (colorPalette.length >= 1) {
    const pri = colorPalette[0];
    parts.push(`\n配色逻辑\n${pri.hex}${pri.name ? '(' + pri.name + ')' : ''}作为品牌主色，${pri.meaning || '传递品牌的独特气质'}。`);
    if (colorPalette.length >= 2) {
      const sec = colorPalette[1];
      parts.push(`${sec.hex}${sec.name ? '(' + sec.name + ')' : ''}辅以辅助，${sec.meaning || '营造和谐的视觉层次'}。`);
    }
  }

  return parts.join("\n");
}

export function generateColorDescriptions(companyName: string, bp: BrandProfile): string {
  const palette = bp.colorPalette || [];
  if (palette.length === 0) return "";

  return palette.map((c, i) => {
    const role = i === 0 ? "品牌主色 — 灵魂色" : i === 1 ? "辅助色 — 底蕴色" : "强调色 — 点睛色";
    return `${role} ${c.hex}
${c.meaning || c.name || ''}`;
  }).join("\n\n");
}

export function generateAuxGraphicsNarrative(bp: BrandProfile): string {
  const lds = bp.logoDesignSuggestions || {};
  const keywords = bp.brandToneKeywords || [];
  const style = lds.style || "";

  const parts: string[] = [];
  parts.push(`辅助图形提取自 Logo 中的核心视觉元素，贯穿品牌全场景应用。\n`);

  parts.push(`点阵组合 — 精致与秩序
以均匀排列的点阵传递精致感，${keywords.length >= 2 ? '呼应品牌"' + keywords[0] + '、' + keywords[1] + '"的调性。' : '体现品牌对细节的追求。'}
用于会员卡底纹、礼品包装纸、社交媒体头像框。\n`);

  parts.push(`条纹组合 — 节奏与韵律
以流畅的线条重复排列形成节奏感，传递品牌从容有序的气质。
用于包装封口贴、名片底纹、宣传单页装饰线。\n`);

  parts.push(`植物肌理 — 自然与生机
以半透明肌理呈现，无声传递品牌与自然共生的理念。
用于空间墙面装饰、产品说明书背景、礼盒内衬纸。`);

  return parts.join("\n");
}

export function generateSceneDescriptions(companyName: string, bp: BrandProfile): Record<string, string> {
  const scenes = bp.sceneImageSuggestions || [];
  const titles = bp.sceneSectionTitles || {};
  const result: Record<string, string> = {};

  const templates = [
    `作为品牌在服务场景中的标准化应用，每一处细节都经过精心设计。
从材质选择到色彩搭配，从使用方式到体验感受，都统一传递品牌的独特气质。
每一次使用，都是品牌的一次无声传播。`,
    `精心设计的包装不仅保护产品，更传递品牌美学。
选用与品牌调性一致的材质与工艺，让产品从货架上脱颖而出。
拿在手中，就能感受到品牌的温度与品质。`,
    `每一份宣传物料都是品牌与顾客的沟通桥梁。
在合适的场景，以合适的方式，用统一的视觉语言讲述品牌故事。
让每一次接触都成为美好的品牌体验。`,
  ];

  scenes.slice(0, 3).forEach((scene, i) => {
    const key = i === 0 ? 'stationery' : i === 1 ? 'packaging' : 'marketing';
    const title = titles[key] || (key === 'stationery' ? '应用系统' : key === 'packaging' ? '包装系统' : '营销系统');
    result[key] = `${scene.zh || ''}\n\n${templates[i] || ''}`;
  });

  return result;
}

function deduplicatePunctuation(text: string): string {
  return text.replace(/[。，,\.]{2,}/g, (match) => match.charAt(0));
}

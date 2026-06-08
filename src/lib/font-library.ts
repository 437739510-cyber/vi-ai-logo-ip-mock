/**
 * Font Safety System V1 — Font Library
 *
 * Curated font knowledge base for Brand Brain's Design Director.
 * Ensures font recommendations are both beautiful AND legally safe.
 *
 * V1 scope: 10 fonts (5 CN + 5 EN) with license info.
 * Future: expand to 50+ fonts with industry/style matching.
 *
 * Current phase: Design only.
 * Not yet connected to Design Director or generation layer.
 */

// ========== Types ==========

export type FontLanguage = "zh" | "en" | "multi";
export type FontCategory = "sans" | "serif" | "display";
export type FontLicense = "open-source" | "free-commercial" | "paid-license" | "unknown";

export interface FontProfile {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Language support */
  language: FontLanguage;
  /** Visual category */
  category: FontCategory;
  /** Whether free for commercial use */
  commercialSafe: boolean;
  /** License type */
  license: FontLicense;
  /** Provider / foundry */
  provider: string;
  /** Link to official page or download */
  website?: string;
  /** Available weights / styles */
  styles: string[];
  /** Suitable industries */
  industries: string[];
  /** Alternative fonts with similar style */
  alternatives?: string[];
  /** Short description of character / use case */
  description: string;
}

// ========== Font Database ==========

const FONT_DATABASE: FontProfile[] = [
  // ===== Chinese Fonts =====

  {
    id: "source-han-sans",
    name: "\u601d\u6e90\u9ed1\u4f53",
    language: "multi",
    category: "sans",
    commercialSafe: true,
    license: "open-source",
    provider: "Adobe / Google (Noto Sans CJK)",
    website: "https://github.com/adobe-fonts/source-han-sans",
    styles: [
      "ExtraLight", "Light", "Normal", "Regular", "Medium",
      "Bold", "Heavy",
    ],
    industries: ["technology", "corporate", "education", "government", "finance"],
    alternatives: ["harmonyos-sans", "alibaba-puhui", "oppo-sans"],
    description:
      "Open-source Pan-CJK sans-serif by Adobe and Google. " +
      "Industry standard for digital products and corporate branding. " +
      "7 weights, full character set for Simplified Chinese.",
  },
  {
    id: "source-han-serif",
    name: "\u601d\u6e90\u5b8b\u4f53",
    language: "multi",
    category: "serif",
    commercialSafe: true,
    license: "open-source",
    provider: "Adobe / Google (Noto Serif CJK)",
    website: "https://github.com/adobe-fonts/source-han-serif",
    styles: [
      "ExtraLight", "Light", "Regular", "Medium",
      "SemiBold", "Bold", "Heavy",
    ],
    industries: ["publishing", "media", "luxury", "cultural", "education"],
    alternatives: ["source-han-sans"],
    description:
      "Open-source Pan-CJK serif by Adobe and Google. " +
      "Elegant for print, publishing, and premium branding. " +
      "7 weights, full Simplified Chinese support.",
  },
  {
    id: "alibaba-puhui",
    name: "\u963f\u91cc\u5df4\u5df4\u666e\u60e0\u4f53",
    language: "zh",
    category: "sans",
    commercialSafe: true,
    license: "free-commercial",
    provider: "Alibaba Group",
    website: "https://done.alibabadesigner.com/font",
    styles: [
      "Thin", "Light", "Regular", "Medium", "Bold", "Heavy",
    ],
    industries: ["ecommerce", "technology", "retail", "consumer", "logistics"],
    alternatives: ["source-han-sans", "harmonyos-sans"],
    description:
      "Free commercial-use sans-serif by Alibaba. " +
      "Designed for digital commerce and brand communication. " +
      "6 weights, simplified Chinese focus.",
  },
  {
    id: "harmonyos-sans",
    name: "HarmonyOS Sans",
    language: "zh",
    category: "sans",
    commercialSafe: true,
    license: "free-commercial",
    provider: "Huawei",
    website: "https://developer.harmonyos.com/resource/font",
    styles: [
      "Thin", "Light", "Regular", "Medium", "Bold", "Black",
    ],
    industries: ["technology", "mobile", "iot", "consumer-electronics", "corporate"],
    alternatives: ["source-han-sans", "oppo-sans"],
    description:
      "Free commercial-use sans-serif by Huawei. " +
      "Optimized for screen reading and multi-device ecosystems. " +
      "6 weights, clean geometric design.",
  },
  {
    id: "oppo-sans",
    name: "OPPO Sans",
    language: "zh",
    category: "sans",
    commercialSafe: true,
    license: "free-commercial",
    provider: "OPPO",
    website: "https://coloros.com/opposans/",
    styles: [
      "Thin", "Light", "Regular", "Medium", "Bold", "Heavy",
    ],
    industries: ["technology", "mobile", "youth", "fashion", "lifestyle"],
    alternatives: ["harmonyos-sans", "source-han-sans"],
    description:
      "Free commercial-use sans-serif by OPPO. " +
      "Modern, youthful aesthetic with smooth curves. " +
      "6 weights, suitable for digital-native brands.",
  },

  // ===== English Fonts =====

  {
    id: "inter",
    name: "Inter",
    language: "en",
    category: "sans",
    commercialSafe: true,
    license: "open-source",
    provider: "Rasmus Andersson (SIL Open Font License)",
    website: "https://rsms.me/inter/",
    styles: [
      "Thin", "ExtraLight", "Light", "Regular", "Medium",
      "SemiBold", "Bold", "ExtraBold", "Black",
    ],
    industries: ["technology", "saas", "corporate", "design", "startup"],
    alternatives: ["roboto", "montserrat"],
    description:
      "Open-source typeface optimized for UI and screen readability. " +
      "9 weights, variable font support. " +
      "Industry standard for modern web and product design.",
  },
  {
    id: "montserrat",
    name: "Montserrat",
    language: "en",
    category: "sans",
    commercialSafe: true,
    license: "open-source",
    provider: "Julieta Ulanovsky (SIL OFL)",
    website: "https://fonts.google.com/specimen/Montserrat",
    styles: [
      "Thin", "ExtraLight", "Light", "Regular", "Medium",
      "SemiBold", "Bold", "ExtraBold", "Black",
    ],
    industries: ["fashion", "lifestyle", "travel", "creative", "media"],
    alternatives: ["poppins", "inter"],
    description:
      "Open-source geometric sans-serif inspired by 1950s signage. " +
      "9 weights, warm and approachable personality. " +
      "Popular for lifestyle, fashion, and creative brands.",
  },
  {
    id: "poppins",
    name: "Poppins",
    language: "en",
    category: "sans",
    commercialSafe: true,
    license: "open-source",
    provider: "Indian Type Foundry (SIL OFL)",
    website: "https://fonts.google.com/specimen/Poppins",
    styles: [
      "Thin", "ExtraLight", "Light", "Regular", "Medium",
      "SemiBold", "Bold", "ExtraBold", "Black",
    ],
    industries: ["education", "youth", "technology", "social-media", "startup"],
    alternatives: ["montserrat", "inter"],
    description:
      "Open-source geometric sans-serif with balanced proportions. " +
      "9 weights, supports Devanagari and Latin. " +
      "Friendly and modern, works well for youthful brands.",
  },
  {
    id: "ibm-plex",
    name: "IBM Plex",
    language: "en",
    category: "sans",
    commercialSafe: true,
    license: "open-source",
    provider: "IBM (SIL OFL)",
    website: "https://www.ibm.com/plex/",
    styles: [
      "Thin", "ExtraLight", "Light", "Regular", "Text",
      "Medium", "SemiBold", "Bold",
    ],
    industries: ["corporate", "enterprise", "technology", "finance", "consulting"],
    alternatives: ["inter", "roboto"],
    description:
      "Open-source corporate typeface by IBM. " +
      "8 weights, designed for clarity and professionalism. " +
      "Strong choice for enterprise and B2B brands.",
  },
  {
    id: "roboto",
    name: "Roboto",
    language: "en",
    category: "sans",
    commercialSafe: true,
    license: "open-source",
    provider: "Google (Apache 2.0)",
    website: "https://fonts.google.com/specimen/Roboto",
    styles: [
      "Thin", "Light", "Regular", "Medium", "Bold", "Black",
    ],
    industries: ["technology", "mobile", "saas", "media", "education"],
    alternatives: ["inter", "ibm-plex"],
    description:
      "Open-source sans-serif by Google, default for Android. " +
      "6 weights + italic, dual-construction design. " +
      "Reliable, neutral, works across almost any context.",
  },
];

// ========== API ==========

/**
 * Get all fonts in the library.
 */
export function getAllFonts(): FontProfile[] {
  return [...FONT_DATABASE];
}

/**
 * Find a font by ID.
 */
export function getFontById(id: string): FontProfile | undefined {
  return FONT_DATABASE.find((f) => f.id === id);
}

/**
 * Find fonts by language.
 */
export function getFontsByLanguage(language: FontLanguage): FontProfile[] {
  return FONT_DATABASE.filter(
    (f) => f.language === language || f.language === "multi"
  );
}

/**
 * Find fonts by category.
 */
export function getFontsByCategory(category: FontCategory): FontProfile[] {
  return FONT_DATABASE.filter((f) => f.category === category);
}

/**
 * Find fonts suitable for a given industry.
 */
export function getFontsByIndustry(industry: string): FontProfile[] {
  return FONT_DATABASE.filter((f) =>
    f.industries.some(
      (ind) => ind.toLowerCase() === industry.toLowerCase()
    )
  );
}

/**
 * Get only commercially safe fonts.
 */
export function getCommercialSafeFonts(): FontProfile[] {
  return FONT_DATABASE.filter((f) => f.commercialSafe);
}

/**
 * Get alternatives for a font (by ID).
 */
export function getFontAlternatives(id: string): FontProfile[] {
  const font = getFontById(id);
  if (!font?.alternatives) return [];
  return font.alternatives
    .map((altId) => getFontById(altId))
    .filter((f): f is FontProfile => f !== undefined);
}

/**
 * Get a font recommendation summary for a set of industries.
 * Returns a scored list sorted by suitability.
 */
export function recommendFonts(params: {
  industries: string[];
  language: FontLanguage;
  category?: FontCategory;
  requireCommercialSafe?: boolean;
}): (FontProfile & { matchScore: number })[] {
  const { industries, language, category, requireCommercialSafe = true } = params;

  let candidates = FONT_DATABASE.filter((f) => {
    // Filter by language
    if (f.language !== language && f.language !== "multi") return false;
    // Filter by category
    if (category && f.category !== category) return false;
    // Filter by commercial safety
    if (requireCommercialSafe && !f.commercialSafe) return false;
    return true;
  });

  // Score by matching industries
  return candidates
    .map((font) => {
      const industryMatches = industries.filter((ind) =>
        font.industries.some((fi) => fi.toLowerCase() === ind.toLowerCase())
      ).length;
      return {
        ...font,
        matchScore: industryMatches / Math.max(industries.length, 1),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

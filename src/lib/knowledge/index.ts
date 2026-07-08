/**
 * Knowledge Library — unified export
 */
export { type VIStandard, VI_STANDARD_DEFAULT } from "./vi-standard";
export {
  BRAND_PHILOSOPHY,
  LOGO_STANDARDS,
  COLOR_STANDARDS,
  AUXILIARY_GRAPHICS_STANDARDS,
  FONT_STANDARDS,
  MASCOT_USAGE_STANDARDS,
  APP_SYSTEM_STANDARDS,
} from "./vi-standard";
export type { BrandPhilosophyTemplate, LogoStandardTemplate, AppSystemTemplate } from "./vi-standard";
export { type MascotStandard, MASCOT_STANDARD_DEFAULT } from "./mascot-standard";
export { type FontEntry, SAFE_FONTS } from "./font-library";
export { type PrintStandard, PRINT_STANDARD_DEFAULT } from "./print-standard";
export { type AntiPattern, ANTI_PATTERNS } from "../quality-check/anti-patterns";
export {
  CATERING_INDUSTRY,
  BEAUTY_INDUSTRY,
  RETAIL_INDUSTRY,
  EDUCATION_INDUSTRY,
  INDUSTRY_CONFIGS,
  getIndustryConfig,
} from "./industries";
export { buildKBInjection, getIndustryFontContext } from "./kb-injector";
export type { KBInjection } from "./kb-injector";

// @ts-nocheck
/**
 * PptxGenJS Renderer V6 — AI写实图+专业排版
 *
 * V5→V6 核心改动：
 * 1. resolveBC() 检测 #1A73E8(Google蓝)视为未设置，走行业默认色
 * 2. 字体层级规范：封面38pt、章节标题24pt、小标题17pt、正文13pt、最小11pt
 * 3. 每页左侧8mm品牌色装饰条 + 底部品牌色细线
 * 4. 品牌理念页直接用 opts.brandVision/coreValues/targetMarket
 * 5. 标识诠释页直接用 opts.logoPhilosophy/mascotPhilosophy
 * 6. 场景页优先使用AI写实图(sceneImages)，降级为色块方案
 * 7. 留白率30-40%
 */
import PptxGenJS from "pptxgenjs";
import type { PageBlueprint } from "@/lib/vi-manual/page-planner";
import { compressImage } from "./compress-image";
import { type IndustryType, getIndustryMaterials } from "@/lib/brand/industry-types";
import { cleanDirtyWords, filterMaterialsByIndustry } from "@/lib/vi-manual/dirty-word-cleaner";
import { COLOR_NAME_MAP } from "@/lib/vi-manual/color-name-map";
import { normalizeBrandName } from "@/lib/vi-manual/brand-name-normalizer";
import {
  MASCOT_VIEW_MIN,
  MASCOT_EMOTIONS_MIN,
  MASCOT_SCENES_MIN,
  isUsableImageRef,
  countUsableRecordEntries,
} from "@/lib/vi-manual/mascot-assets";
import { getMaterialSpecs, resolveIndustryType, type MaterialSpec } from "@/lib/vi-manual/material-specs";
// 工单 086-R1：行业 IP 应用知识固化（丽人/美业等可复用规则表）
import { getIndustryIpApplicationRules, getIndustrySceneMaterials } from "@/lib/vi-manual/industry-ip-application-rules";
import {
  normalizeLogoColorSet,
  getLogoMisuseRules,
  type LogoColor,
  type LogoColorSet,
} from "@/lib/vi-manual/brand-visual-rules";

import { renderTypographyPng, renderColorSpecPng } from "./spec-page-renderer";
const _DEV = process.env.NODE_ENV === "development";

/** 解析 PNG/JPEG 数据 URI 的原始宽高（同步；用于图片等比适配，禁止拉伸）。 */
function imageDimsSync(dataUri: string): { w: number; h: number } | null {
  try {
    const b64 = String(dataUri).split(",")[1] || String(dataUri);
    const buf = Buffer.from(b64, "base64");
    if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i += 1; continue; }
        const marker = buf[i + 1];
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
        if (i + 4 > buf.length) break;
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xc3) {
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch {}
  return null;
}

/**
 * 等比适配（fit）：在 box 内完整保留图片（居中留白），禁止拉伸变形。
 * 返回图片实际 frame（宽高比与源图一致）+ 居中偏移；取不到源图比例时退回 box（保持旧行为）。
 */
function fitInBox(dataUri: string, boxX: number, boxY: number, boxW: number, boxH: number) {
  const dims = imageDimsSync(dataUri);
  if (!dims || dims.w <= 0 || dims.h <= 0 || boxW <= 0 || boxH <= 0) {
    return { x: boxX, y: boxY, w: boxW, h: boxH };
  }
  const scale = Math.min(boxW / dims.w, boxH / dims.h);
  const w = dims.w * scale;
  const h = dims.h * scale;
  return { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, w, h };
}


const SW = 8.27;
const SH = 11.69;
const MARGIN = 0.7;

// 豆包评审修复: 清洗AI生成文本的常见错误
function sanitizeText(text: string): string {
  if (!text) return text;
  return text
    .replace(/Fower Time/gi, "Flower Time")
    .replace(/Flover Time/gi, "Flower Time")
    .replace(/Montserra(?![a-z])/g, "Montserrat")
    .replace(/#FOD5A8/gi, "#F0D5A8")
    .replace(/。。/g, "。");
}

const CONTENT_W = SW - MARGIN * 2;
const LEFT_BAR_W = 0.12;  // 左侧装饰条宽度

export interface RenderPptxOptions {
  projectName?: string;
  companyName?: string;
  industry?: string;
  logoData?: string | null;
  mascotData?: string | null;
  mascotSplitViews?: string[] | null;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  logoColors?: {
    navy?: { name?: string; hex?: string; rgb?: string; cmyk?: string };
    gold?: { name?: string; hex?: string; rgb?: string; cmyk?: string };
  };
  logoElements?: string[];  // 007-R1: 真实 Logo 结构元素，用于元素级误用规则
  brandVision?: string;
  coreValues?: string;
  targetMarket?: string;
  logoPhilosophy?: string;
  mascotPhilosophy?: string;
  sceneImages?: Record<string, string>;
  sceneLabels?: Record<string, string>;  // V9: AI返回的动态标签
  aiLogoData?: string;  // V14: AI生成的组合Logo图(base64)
  compressImages?: boolean;  // V30: 压缩图片减小体积
  sceneSectionTitles?: Record<string, string> | null;  // V98: AI生成的场景页标题
  auxGraphicsIntro?: string;  // V103: 辅助图形品牌说明
  colorMeaning?: string;  // V103: 色彩选择依据
  colorPaletteMeanings?: { primary?: string; secondary?: string; accent?: string };  // V103: 各色彩含义
  // V112: 富文本叙事
  brandStory?: string;
  /** 工单 086-R1：品牌口号（与正式愿景分开展示） */
  slogan?: string;
  colorDescriptions?: string;
  mascotEmotions?: Record<string, string> | null;
  mascotScenes?: Record<string, string> | null;
  mascotThreeViewData?: string | null;
  sceneDescriptions?: Record<string, string>;
  // V114: 豆包评审整改 — content_patch字段
  fontCopyrightNotice?: string;
  logoOutputSpec?: string;
  modificationAuthority?: string;
  materialPriorityList?: Array<{priority: string; category: string; description: string}>;
  closingCustomerPerception?: string;
  phone?: string;
  city?: string;
  province?: string;
  fullBrandName?: string;
  englishName?: string;
}

// ========== 行业类型 ==========

// V99: 行业默认色已统一到 getIndustryDefaults()，不再在此重复定义

interface BC {
  pri: string; sec: string; acc: string;
  priDark: string; priLight: string;
}

/** 解析品牌色 — V6: 检测Google蓝#1A73E8视为未设置 */
function resolveBC(opts: RenderPptxOptions, blueprints: PageBlueprint[]): BC {
  const p = opts.brandColors?.primary;
  const s = opts.brandColors?.secondary;
  const a = opts.brandColors?.accent;

  // 检测有效的主色（排除白色和Google蓝）
  const isInvalid = (c?: string) => !c || c === "#FFFFFF" || c === "#ffffff" || c === "FFFFFF"
    || c === "#1A73E8" || c === "1A73E8" || c === "#1a73e8";

  if (p && !isInvalid(p)) {
    const pri = hx(p);
    return {
      pri, sec: hx(s || "#34A853"), acc: hx(a || "#FBBC04"),
      priDark: darken(pri), priLight: lighten(pri),
    };
  }

  // 从blueprint尝试
  const cover = blueprints.find(b => b.pageId === "cover");
  const coverPri = cover?.background?.primaryColor;
  if (coverPri && !isInvalid(coverPri)) {
    const pri = hx(coverPri);
    return {
      pri, sec: hx(cover.background.secondaryColor || "#34A853"), acc: hx(cover.background.accentColor || "#FBBC04"),
      priDark: darken(pri), priLight: lighten(pri),
    };
  }

  // V99: 按行业给默认色，统一使用 getIndustryDefaults()
  const industry = resolveIndustryType(opts.industry);
  const def = getIndustryDefaults(industry);
  const pri = hx(def.primary);
  _DEV && console.log(`[resolveBC] Using industry defaults for ${industry}: ${pri}`);
  return {
    pri, sec: hx(def.secondary), acc: hx(def.accent),
    priDark: darken(pri), priLight: lighten(pri),
  };
}

function resolveLogoColors(opts: RenderPptxOptions): LogoColorSet | null {
  return normalizeLogoColorSet(opts.logoColors);
}

// ========== 行业场景配置 ==========
interface SceneConfig { title: string; desc: string; }

function getSceneConfigs(industry: IndustryType, aiTitles?: Record<string, string> | null): Record<string, SceneConfig> {
  // V98: 优先使用AI生成的场景页标题
  if (aiTitles?.stationery) {
    return {
      stationery: { title: aiTitles.stationery, desc: "" },
      packaging: { title: aiTitles.packaging || aiTitles.stationery, desc: "" },
      marketing: { title: aiTitles.marketing || aiTitles.stationery, desc: "" },
    };
  }
  const configs: Record<IndustryType, Record<string, SceneConfig>> = {
    restaurant: {
      stationery: { title: "餐饮应用系统", desc: "品牌在餐饮场景中的标准化应用" },
      packaging: { title: "餐饮包装系统", desc: "外卖与打包物料的品牌化呈现" },
      marketing: { title: "餐饮营销系统", desc: "店内宣传与客户触达物料" },
    },
    beverage: {
      stationery: { title: "饮品应用系统", desc: "品牌在饮品场景中的标准化应用" },
      packaging: { title: "饮品包装系统", desc: "杯具与外带物料的品牌化呈现" },
      marketing: { title: "饮品营销系统", desc: "门店宣传与促销物料" },
    },
    beauty: {
      stationery: { title: "美容应用系统", desc: "品牌在美容服务场景中的标准化应用" },
      packaging: { title: "美容包装系统", desc: "美业（美容/美体/美甲）服务与物料的品牌化呈现" },
      marketing: { title: "美容营销系统", desc: "门店宣传与客户维护物料" },
    },
    fashion: {
      stationery: { title: "时尚应用系统", desc: "品牌在服装零售场景中的标准化应用" },
      packaging: { title: "时尚包装系统", desc: "吊牌与购物袋的品牌化呈现" },
      marketing: { title: "时尚营销系统", desc: "新品推广与橱窗展示物料" },
    },
    mother_baby: {
      stationery: { title: "母婴应用系统", desc: "品牌在母婴场景中的标准化应用" },
      packaging: { title: "母婴包装系统", desc: "产品与礼品的品牌化呈现" },
      marketing: { title: "母婴营销系统", desc: "妈妈社群与门店推广物料" },
    },
    wedding: {
      stationery: { title: "婚庆应用系统", desc: "品牌在婚庆场景中的标准化应用" },
      packaging: { title: "婚庆包装系统", desc: "请柬与伴手礼的品牌化呈现" },
      marketing: { title: "婚庆营销系统", desc: "婚礼展示与客户触达物料" },
    },
    fitness: {
      stationery: { title: "运动应用系统", desc: "品牌在健身场景中的标准化应用" },
      packaging: { title: "运动包装系统", desc: "会员装备与补给的品牌化呈现" },
      marketing: { title: "运动营销系统", desc: "课程推广与场馆展示物料" },
    },
    pharmacy: {
      stationery: { title: "医药应用系统", desc: "品牌在医药场景中的标准化应用" },
      packaging: { title: "医药包装系统", desc: "药品与保健品的品牌化呈现" },
      marketing: { title: "医药营销系统", desc: "健康宣传与诊所展示物料" },
    },
    pet: {
      stationery: { title: "宠物应用系统", desc: "品牌在宠物场景中的标准化应用" },
      packaging: { title: "宠物包装系统", desc: "食品与用品的品牌化呈现" },
      marketing: { title: "宠物营销系统", desc: "服务推广与门店展示物料" },
    },
    retail: {
      stationery: { title: "零售应用系统", desc: "品牌在零售场景中的标准化应用" },
      packaging: { title: "零售包装系统", desc: "购物袋与商品包装的品牌化呈现" },
      marketing: { title: "零售营销系统", desc: "店内宣传与促销物料" },
    },
    education: {
      stationery: { title: "教育应用系统", desc: "品牌在教育场景中的标准化应用" },
      packaging: { title: "教育包装系统", desc: "课程资料与教具的品牌化呈现" },
      marketing: { title: "教育营销系统", desc: "招生宣传与校区展示物料" },
    },
    fastfood: {
      stationery: { title: "快餐应用系统", desc: "品牌在快餐场景中的标准化应用" },
      packaging: { title: "快餐包装系统", desc: "外卖与打包物料的品牌化呈现" },
      marketing: { title: "快餐营销系统", desc: "门店宣传与促销物料" },
    },
    fresh_food: {
      stationery: { title: "生鲜应用系统", desc: "品牌在生鲜零售场景中的标准化应用" },
      packaging: { title: "生鲜包装系统", desc: "水果贴纸与果篮包装的品牌化呈现" },
      marketing: { title: "生鲜营销系统", desc: "价格标签与促销展示物料" },
    },
    floral: {
      stationery: { title: "花艺应用系统", desc: "品牌在花艺场景中的标准化应用" },
      packaging: { title: "花艺包装系统", desc: "花束包装与花篮的品牌化呈现" },
      marketing: { title: "花艺营销系统", desc: "节日推广与门店展示物料" },
    },
    home: {
      stationery: { title: "家居应用系统", desc: "品牌在家居场景中的标准化应用" },
      packaging: { title: "家居包装系统", desc: "产品包装与物料的品牌化呈现" },
      marketing: { title: "家居营销系统", desc: "展厅宣传与促销物料" },
    },
    nail: {
      stationery: { title: "美甲应用系统", desc: "品牌在美甲服务场景中的标准化应用" },
      packaging: { title: "美甲包装系统", desc: "甲油瓶贴与色板卡的品牌化呈现" },
      marketing: { title: "美甲营销系统", desc: "预约卡与门店推广物料" },
    },
    tea: {
      stationery: { title: "茶业应用系统", desc: "品牌在茶业场景中的标准化应用" },
      packaging: { title: "茶业包装系统", desc: "茶叶罐与礼盒的品牌化呈现" },
      marketing: { title: "茶业营销系统", desc: "品鉴推广与门店展示物料" },
    },
    general: {
      stationery: { title: "品牌应用系统", desc: "品牌在商务场景中的标准化应用" },
      packaging: { title: "产品包装系统", desc: "品牌主色调贯穿包装设计" },
      marketing: { title: "营销展示系统", desc: "场景化品牌视觉应用" },
    },
  };
  return configs[industry] || configs.general;
}

// ========== 主渲染入口 ==========
function assertMascotPagesHaveAssets(blueprints: PageBlueprint[], options: RenderPptxOptions): void {
  for (const bp of blueprints) {
    if (!bp.pageId.startsWith("mascot-")) continue;
    const splitViews = (options.mascotSplitViews || []).filter((v) => isUsableImageRef(v));
    let hasAssets = true;
    switch (bp.pageId) {
      case "mascot-positioning":
        hasAssets = isUsableImageRef(options.mascotData) || isUsableImageRef(options.mascotThreeViewData) || splitViews.length > 0;
        break;
      case "mascot-threeview":
        hasAssets = splitViews.length >= MASCOT_VIEW_MIN;
        break;
      case "mascot-emotions":
        hasAssets = countUsableRecordEntries(options.mascotEmotions) >= MASCOT_EMOTIONS_MIN;
        break;
      case "mascot-scenes":
        hasAssets = countUsableRecordEntries(options.mascotScenes) >= MASCOT_SCENES_MIN;
        break;
      case "mascot-usage":
        hasAssets = splitViews.length > 0 || isUsableImageRef(options.mascotData);
        break;
      default:
        break;
    }
    if (!hasAssets) {
      throw new Error(
        "Mascot page " + bp.pageId +
        " has insufficient assets, refusing to render blank page (contract: front/side/back + " +
        MASCOT_EMOTIONS_MIN + " emotions + " + MASCOT_SCENES_MIN + " scenes)",
      );
    }
  }
}

export async function renderPptx(blueprints: PageBlueprint[], options: RenderPptxOptions = {}): Promise<PptxGenJS> {
  options.companyName = normalizeBrandName(options.companyName || "");
  options.fullBrandName = normalizeBrandName(options.fullBrandName || "");
  assertMascotPagesHaveAssets(blueprints, options);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4_PORTRAIT", width: SW, height: SH });
  pptx.layout = "A4_PORTRAIT";
  pptx.author = "Brand Brain";
  const cn = options.companyName || "品牌";
  pptx.subject = `${cn} VI 规范手册`;
  pptx.title = `${cn} 品牌视觉识别系统（VI）规范手册`;
  const bc = resolveBC(options, blueprints);
  const industry = resolveIndustryType(options.industry);
  let sceneImages = options.sceneImages || {};

  // V32: 压缩图片减小PPTX/PDF体积
  // PptxGenJS内部会将所有图片重新编码为PNG，所以需要缩小像素而非靠JPEG压缩
  if (options.compressImages) {
    _DEV && console.log("[render-pptx] Compressing images...");
    const compressedScenes: Record<string, string> = {};
    for (const [key, imgData] of Object.entries(sceneImages)) {
      // 工单 091-R1：应用/包装场景图清晰度提升到 ≥1024，降低“糊/贴图”观感。
      compressedScenes[key] = await compressImage(imgData, { maxWidth: 1024, quality: 88, isLogo: false });
    }
    sceneImages = compressedScenes;
    // Logo在PPTX中会被多次引用，缩小到256px足够显示
    if (options.logoData) options.logoData = await compressImage(options.logoData, { maxWidth: 1024, isLogo: true });
    if (options.mascotData) options.mascotData = await compressImage(options.mascotData, { maxWidth: 1024, isLogo: true });
    if (options.aiLogoData) options.aiLogoData = await compressImage(options.aiLogoData, { maxWidth: 1024, isLogo: true });
    _DEV && console.log("[render-pptx] Image compression done");
  }

  _DEV && console.log(`[render-pptx] V6 | ${blueprints.length} pages | industry=${industry} | sceneImages=${Object.keys(sceneImages).length}`);

  const pageNumberMap = computePageNumberMap(blueprints);
  assertTocPageNumbers(blueprints, options);

  for (const bp of blueprints) {
    const slide = pptx.addSlide();
    await renderSlide(slide, bp, options, bc, industry, sceneImages, pageNumberMap);
  }
  return pptx;
}

export async function renderPptxToBuffer(blueprints: PageBlueprint[], options: RenderPptxOptions = {}): Promise<Buffer> {
  const pptx = await renderPptx(blueprints, options);
  const base64 = await pptx.write({ outputType: "base64" }) as string;
  return Buffer.from(base64, "base64");
}

const PAGE_ORDER = ["cover","toc","brand-philosophy","logo-interpretation","logo-variations","logo-grid","auxiliary-graphics","aux-graphics-misuse","brand-colors","color-taboos","typography","font-copyright","basic-spec","logo-misuse","stationery","packaging","marketing","digital-media","wayfinding","summary","material-priority","file-output","logo-output","modification-authority","mascot-positioning","mascot-threeview","mascot-emotions","mascot-scenes","mascot-usage","mascot-misuse","mascot-merchandise","mascot-compliance","closing"];

// 计算真实页序页码（整改 #5，Kevin 终选方案）：
// 封面不编号 (=0)；其余页（目录、正文各页、封底）从 1 连续编号。
export function computePageNumberMap(blueprints: PageBlueprint[]): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 0;
  for (const bp of blueprints) {
    if (bp.pageId === "cover") {
      map[bp.pageId] = 0;
    } else {
      n += 1;
      map[bp.pageId] = n;
    }
  }
  return map;
}

// 004: 渲染前校验目录页码，失败直接抛错，禁止输出错页码手册
export function assertTocPageNumbers(blueprints: PageBlueprint[], options: RenderPptxOptions): void {
  const map = computePageNumberMap(blueprints);
  const seen = new Set<string>();
  let lastOrderIndex = -1;

  for (const bp of blueprints) {
    const orderIndex = PAGE_ORDER.indexOf(bp.pageId);
    if (orderIndex < 0) {
      throw new Error(`[TOC] pageId not in PAGE_ORDER: ${bp.pageId}`);
    }
    if (seen.has(bp.pageId)) {
      throw new Error(`[TOC] duplicate pageId: ${bp.pageId}`);
    }
    seen.add(bp.pageId);
    if (orderIndex < lastOrderIndex) {
      throw new Error(`[TOC] blueprints out of PAGE_ORDER: ${bp.pageId}`);
    }
    lastOrderIndex = orderIndex;

    if (bp.pageId !== "cover" && bp.pageId !== "toc" && bp.pageId !== "closing") {
      const pageNo = map[bp.pageId] || 0;
      if (pageNo <= 0) {
        throw new Error(`[TOC] page without real page number: ${bp.pageId}`);
      }
    }
  }

  // 除封面外全部页面从 1 连续编号（目录/封底也占真实页序），不允许跳号或重复
  const maxPage = Math.max(0, ...Object.values(map));
  if (maxPage !== blueprints.length - 1) {
    throw new Error(`[TOC] page numbers not contiguous: expected max ${blueprints.length - 1}, got ${maxPage}`);
  }

  const industry = resolveIndustryType(options.industry);
  const tocItems = getTocItems(industry, options.sceneSectionTitles).filter((item) => map[item.pageId] !== undefined);
  for (const item of tocItems) {
    if (!blueprints.some((b) => b.pageId === item.pageId)) {
      throw new Error(`[TOC] toc references missing page: ${item.pageId}`);
    }
    if ((map[item.pageId] || 0) <= 0) {
      throw new Error(`[TOC] toc item without page number: ${item.pageId}`);
    }
  }
}

async function renderSlide(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType, sceneImages: Record<string, string>, pageNumberMap: Record<string, number>): Promise<void> {
  switch (bp.pageId) {
    case "cover": renderCover(slide, bp, opts, bc, industry); break;
    case "closing": renderClosing(slide, bp, opts, bc); break;
    case "toc": renderTableOfContents(slide, bp, opts, bc, industry, pageNumberMap); break;
    case "brand-philosophy": renderPhilosophy(slide, bp, opts, bc); break;
    case "logo-interpretation": renderLogoPage(slide, bp, opts, bc, industry); break;
    case "logo-variations": renderLogoVariations(slide, bp, opts, bc, industry); break;
    case "logo-grid": renderLogoGrid(slide, bp, opts, bc, industry); break;
    case "logo-misuse": renderLogoMisuse(slide, bp, opts, bc, industry); break;
    case "logo-backgrounds": renderLogoBackgrounds(slide, bp, opts, bc, industry); break;
    case "auxiliary-graphics": renderAuxiliaryGraphics(slide, bp, opts, bc); break;
    case "aux-graphics-misuse": renderAuxGraphicsMisuse(slide, bp, opts, bc); break;
    case "brand-colors": await renderColors(slide, bp, opts, bc); break;
    case "color-taboos": renderColorTaboos(slide, bp, opts, bc); break;
    case "typography": await renderTypography(slide, bp, opts, bc); break;
    case "font-copyright": renderFontCopyright(slide, bp, opts, bc); break;
    case "basic-spec": renderBasicSpec(slide, bp, opts, bc, industry); break;
    case "stationery": renderScene(slide, bp, opts, "stationery", bc, industry, sceneImages, (opts.aiLogoData || opts.logoData)); break;
    case "packaging": renderScene(slide, bp, opts, "packaging", bc, industry, sceneImages, (opts.aiLogoData || opts.logoData)); break;
    case "marketing": renderScene(slide, bp, opts, "marketing", bc, industry, sceneImages, (opts.aiLogoData || opts.logoData)); break;
    case "digital-media": renderDigitalMedia(slide, bp, opts, bc, industry); break;
    case "summary": renderSummary(slide, bp, opts, bc); break;
    case "material-priority": renderMaterialPriority(slide, bp, opts, bc); break;
    case "file-output": renderFileOutput(slide, bp, opts, bc); break;
    case "wayfinding": renderWayfinding(slide, bp, opts, bc); break;
    case "logo-output": renderLogoOutput(slide, bp, opts, bc); break;
    case "mascot-gallery": renderMascotGallery(slide, bp, opts, bc); break;
    case "mascot-positioning":
    case "mascot-threeview":
    case "mascot-emotions":
    case "mascot-scenes":
    case "mascot-usage":
      renderMascotChapterPage(slide, bp, opts, bc); break;
    case "mascot-misuse":
    case "mascot-merchandise":
    case "mascot-compliance":
      renderMascotSupportPage(slide, bp, opts, bc); break;
    case "modification-authority": renderModificationAuthority(slide, bp, opts, bc); break;
    default: renderGeneric(slide, bp, opts, bc);
  }
  // 页码（封面/目录/封底不加；其余按真实页序连续编号，整改 #5）
  if (bp.pageId !== "cover" && bp.pageId !== "closing" && bp.pageId !== "toc") {
    const pageNo = pageNumberMap[bp.pageId] || 0;
    if (pageNo > 0) {
      slide.addText(`${pageNo}`, { x: SW - MARGIN - 0.5, y: SH - 0.55, w: 0.5, h: 0.3, fontSize: 12, color: "BBBBBB", align: "right" });
    }
  }
}

// ========== 通用内容页框架 ==========
function addContentFrame(slide: PptxGenJS.Slide, title: string, bc: BC): void {
  slide.background = { fill: "FFFFFF" };
  // 左侧品牌色装饰条
  slide.addShape("rect", { x: 0, y: 0, w: LEFT_BAR_W, h: SH, fill: { color: bc.pri } });
  // 顶部品牌色细线
  slide.addShape("rect", { x: 0, y: 0, w: SW, h: 0.06, fill: { color: bc.pri } });
  // 标题
  slide.addText(title, { x: MARGIN + LEFT_BAR_W, y: 0.35, w: CONTENT_W - LEFT_BAR_W, h: 0.65, fontSize: 22, bold: true, color: bc.priDark, fontFace: "Noto Sans SC" });
  // 标题下装饰线
  slide.addShape("rect", { x: MARGIN + LEFT_BAR_W, y: 1.05, w: 1.6, h: 0.04, fill: { color: bc.acc } });
  // 底部品牌色细线
  slide.addShape("rect", { x: 0, y: SH - 0.06, w: SW, h: 0.06, fill: { color: bc.pri } });
}


// ========== 组合Logo（Icon + Wordmark）辅助函数 ==========
// 当没有Logo图时，生成行业图标+品牌名字标的组合Logo
// 设计理念：Logo = 识别性图标 + 品牌名文字，缺一不可
//   - 图标：用PptxGenJS形状拼出行业符号（花瓣/十字/钻石/哑铃等）
//   - 字标：品牌名+宽字距+装饰线
//   - 两者组合才是真正的Logo
function addIndustryIcon(slide: PptxGenJS.Slide, industry: IndustryType, cx: number, cy: number, size: number, bc: BC): void {
  const s = size; // icon size
  const hs = s / 2;
  switch (industry) {
    case "beauty": { // 花瓣图标 — 4片椭圆花瓣 + 中心圆
      const petalW = s * 0.35, petalH = s * 0.55;
      const offsets = [[0, -0.3], [0.3, 0], [0, 0.3], [-0.3, 0]]; // 上右下左
      for (const [ox, oy] of offsets) {
        slide.addShape("ellipse", { x: cx + ox * s - petalW/2, y: cy + oy * s - petalH/2, w: petalW, h: petalH, fill: { color: bc.sec }, rectRadius: 0.1 });
      }
      slide.addShape("ellipse", { x: cx - s*0.1, y: cy - s*0.1, w: s*0.2, h: s*0.2, fill: { color: bc.acc } });
      break;
    }
    case "restaurant": case "beverage": { // 碗/杯图标 — 半圆+椭圆口
      slide.addShape("arc", { x: cx - s*0.4, y: cy - s*0.1, w: s*0.8, h: s*0.6, fill: { color: bc.sec }, angleRange: [180, 180] });
      slide.addShape("ellipse", { x: cx - s*0.4, y: cy - s*0.15, w: s*0.8, h: s*0.15, fill: { color: bc.acc } });
      break;
    }
    case "fashion": { // 钻石图标 — 上三角+下倒三角
      slide.addShape("triangle", { x: cx - s*0.35, y: cy - s*0.35, w: s*0.7, h: s*0.4, fill: { color: bc.sec } });
      slide.addShape("triangle", { x: cx - s*0.25, y: cy, w: s*0.5, h: s*0.45, fill: { color: bc.sec }, rotate: 180 });
      break;
    }
    case "pharmacy": { // 十字图标
      const arm = s * 0.3, len = s * 0.7;
      slide.addShape("rect", { x: cx - arm/2, y: cy - len/2, w: arm, h: len, fill: { color: bc.sec } });
      slide.addShape("rect", { x: cx - len/2, y: cy - arm/2, w: len, h: arm, fill: { color: bc.sec } });
      break;
    }
    case "fitness": { // 哑铃图标 — 两个圆+连接线
      slide.addShape("ellipse", { x: cx - s*0.45, y: cy - s*0.2, w: s*0.35, h: s*0.4, fill: { color: bc.sec } });
      slide.addShape("ellipse", { x: cx + s*0.1, y: cy - s*0.2, w: s*0.35, h: s*0.4, fill: { color: bc.sec } });
      slide.addShape("rect", { x: cx - s*0.15, y: cy - s*0.06, w: s*0.3, h: s*0.12, fill: { color: bc.acc } });
      break;
    }
    case "wedding": { // 双环图标 — 两个椭圆重叠
      slide.addShape("ellipse", { x: cx - s*0.35, y: cy - s*0.3, w: s*0.5, h: s*0.6, fill: { color: bc.sec }, line: { color: bc.acc, width: 2 } });
      slide.addShape("ellipse", { x: cx - s*0.15, y: cy - s*0.3, w: s*0.5, h: s*0.6, fill: { color: bc.acc }, line: { color: bc.sec, width: 2 } });
      break;
    }
    case "mother_baby": { // 爱心图标 — 两个圆+下三角
      slide.addShape("ellipse", { x: cx - s*0.3, y: cy - s*0.3, w: s*0.35, h: s*0.35, fill: { color: bc.sec } });
      slide.addShape("ellipse", { x: cx - s*0.05, y: cy - s*0.3, w: s*0.35, h: s*0.35, fill: { color: bc.sec } });
      slide.addShape("triangle", { x: cx - s*0.4, y: cy - s*0.1, w: s*0.8, h: s*0.5, fill: { color: bc.sec }, rotate: 180 });
      break;
    }
    case "pet": { // 爪印图标 — 1大圆+3小圆
      slide.addShape("ellipse", { x: cx - s*0.2, y: cy, w: s*0.4, h: s*0.35, fill: { color: bc.sec } });
      const toes = [[-0.25, -0.15], [0.25, -0.15], [0, -0.3]];
      for (const [ox, oy] of toes) {
        slide.addShape("ellipse", { x: cx + ox*s - s*0.08, y: cy + oy*s - s*0.08, w: s*0.16, h: s*0.16, fill: { color: bc.sec } });
      }
      break;
    }
    case "education": { // 书本图标 — 两个倾斜矩形
      slide.addShape("rect", { x: cx - s*0.35, y: cy - s*0.25, w: s*0.35, h: s*0.5, fill: { color: bc.sec }, rotate: -10 });
      slide.addShape("rect", { x: cx, y: cy - s*0.25, w: s*0.35, h: s*0.5, fill: { color: bc.acc }, rotate: 10 });
      break;
    }
    default: { // retail/general — 圆形+首字母
      slide.addShape("ellipse", { x: cx - s*0.35, y: cy - s*0.35, w: s*0.7, h: s*0.7, fill: { color: bc.sec } });
      break;
    }
  }
}

// V110: 智能品牌名排版 — 优先一行，放不下则居中拆分(避免单字一行)
function fitBrandText(text: string, fs: number, cs: number, availW: number): { text: string; fontSize: number; charSpacing: number } {
  const charW = fs * 1.35 + cs;
  const totalW = (text.length * charW) / 72;
  if (totalW <= availW * 0.95) return { text, fontSize: fs, charSpacing: cs };
  const totalW2 = (text.length * fs * 1.35) / 72;
  if (totalW2 <= availW * 0.95) return { text, fontSize: fs, charSpacing: 0 };
  // V115: 永远不换行 — 自动缩小字号直到一行
  const minFs = Math.ceil(fs * 0.3);
  const maxFs = Math.floor((availW * 0.95 * 72) / (text.length * 1.35));
  const finalFs = Math.max(minFs, maxFs);
  _DEV && console.log("[fitBrandText] \"" + text + "\" at " + fs + "pt -> reduced to " + finalFs + "pt");
  return { text, fontSize: finalFs, charSpacing: 0 };
}

function addComboLogo(slide: PptxGenJS.Slide, text: string, x: number, y: number, w: number, h: number, bc: BC, industry: IndustryType, opts: { fontSize?: number; color?: string; layout?: "vertical"|"horizontal"; showLine?: boolean; aiLogoData?: string; spacing?: { x?: number; y?: number } } = {}): void {
  const fs = opts.fontSize || 36;
  const clr = opts.color || bc.pri;
  const layout = opts.layout || "vertical";
  const showLine = opts.showLine !== false;
  const aiLogo = opts.aiLogoData;

  if (layout === "vertical") {
    // 垂直布局：AI Logo图标在上，品牌名字标在下
    const iconSize = Math.min(h * 0.45, w * 0.35);
    const iconCX = x + w / 2;
    const iconTop = y + 0.1;

    if (aiLogo) {
      // V14: 用AI生成的专业Logo图
      slide.addImage({ data: aiLogo, x: iconCX - iconSize / 2, y: iconTop, w: iconSize, h: iconSize });
    } else {
      // fallback: PptxGenJS形状拼图标
      addIndustryIcon(slide, industry, iconCX, iconTop + iconSize / 2, iconSize, bc);
    }

    const gapY = opts.spacing?.y ?? 0.25;
    const textY = iconTop + iconSize + gapY;
    const textH = h - iconSize - gapY - 0.25;
    // V110: 智能排版 — 优先一行，放不下合理拆分
    const fitted = fitBrandText(text, fs, fs > 20 ? 10 : 4, w);
    slide.addText(fitted.text, {
      x, y: textY, w, h: Math.max(textH, 0.5),
      fontSize: fitted.fontSize,
      bold: true,
      color: clr,
      align: "center",
      valign: "top",
      fontFace: "Noto Sans SC",
      charSpacing: fitted.charSpacing,
    });
    // 装饰线 — 品牌名字标下方
    if (showLine) {
      const lineW = Math.min(w * 0.4, 2.0);
      slide.addShape("rect", { x: x + (w - lineW) / 2, y: textY + fs * 0.04 + 0.15, w: lineW, h: 0.02, fill: { color: bc.acc } });
    }
  } else {
    // 水平布局：图标在左，文字在右
    const iconSize = Math.min(h * 0.7, 0.8);
    if (aiLogo) {
      slide.addImage({ data: aiLogo, x: x, y: y + (h - iconSize) / 2, w: iconSize, h: iconSize });
    } else {
      addIndustryIcon(slide, industry, x + iconSize / 2, y + h / 2, iconSize, bc);
    }
    const gapX = opts.spacing?.x ?? 0.15;
    const hFitted = fitBrandText(text, fs, 2, w - iconSize - gapX);
    slide.addText(hFitted.text, {
      x: x + iconSize + gapX, y, w: w - iconSize - gapX, h,
      fontSize: hFitted.fontSize,
      bold: true,
      color: clr,
      align: "left",
      valign: "middle",
      fontFace: "Noto Sans SC",
      charSpacing: fs > 20 ? 8 : 3,
    });
  }
}

// ========== Cover ==========
function renderCover(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  const cn = fta(bp, ["cover-company-name","company-name"]) || opts.companyName || "品牌";
  slide.background = { fill: bc.pri };
  // 顶部金色线
  slide.addShape("rect", { x: 0, y: 0, w: SW, h: 0.08, fill: { color: bc.acc } });

  // Logo — 大幅居中
  if (opts.logoData) {
    slide.addImage({ data: normImg(opts.logoData), x: (SW - 3.0) / 2, y: 1.0, w: 3.0, h: 3.0, sizing: { type: "contain", w: 3.0, h: 3.0 } });
    // 有Logo图时，下方仍显示品牌名
    const fc = fitBrandText(cn, 38, 0, CONTENT_W); slide.addText(fc.text, { x: MARGIN, y: 4.2, w: CONTENT_W, h: 1.0, fontSize: fc.fontSize, bold: true, color: "FFFFFF", align: "center", fontFace: "Noto Sans SC" });
  } else {
    // V13: 无Logo图时，组合Logo = 行业图标 + 品牌名字标
    addComboLogo(slide, cn, MARGIN, 0.8, CONTENT_W, 3.2, bc, industry, { fontSize: 44, color: "FFFFFF", layout: "vertical", aiLogoData: opts.aiLogoData });
  }
  // 金色分隔线
  slide.addShape("rect", { x: (SW - 3.0) / 2, y: 5.4, w: 3.0, h: 0.04, fill: { color: bc.acc } });
  // 副标题
  slide.addText("品牌视觉识别系统（VI）规范手册", { x: MARGIN, y: 5.7, w: CONTENT_W, h: 0.6, fontSize: 20, bold: true, color: "FFFFFF", align: "center", transparency: 5 });
  slide.addText("VISUAL IDENTITY GUIDELINES", { x: MARGIN, y: 6.4, w: CONTENT_W, h: 0.4, fontSize: 14, color: "FFFFFF", align: "center", transparency: 20, charSpacing: 5 });

  // IP公仔 — 右下角
  if (opts.mascotData) {
    const f = fitInBox(opts.mascotData, SW - 3.8, 7.2, 3.2, 3.0);
    slide.addImage({ data: normImg(opts.mascotData), x: f.x, y: f.y, w: f.w, h: f.h, transparency: 5 });
  }

  // 底部信息
  slide.addText(`${cn}  ·  v1.0  ·  ${new Date().getFullYear()}`, { x: MARGIN, y: SH - 1.0, w: CONTENT_W, h: 0.4, fontSize: 12, color: "FFFFFF", align: "center", transparency: 25 });
  slide.addShape("rect", { x: 0, y: SH - 0.1, w: SW, h: 0.1, fill: { color: bc.acc } });
}

// ========== Closing ==========
function renderClosing(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  const cn = opts.companyName || "品牌";
  slide.background = { fill: bc.pri };
  slide.addShape("rect", { x: 0, y: 0, w: SW, h: 0.08, fill: { color: bc.acc } });
  slide.addText("感谢观看", { x: MARGIN, y: SH / 2 - 2.0, w: CONTENT_W, h: 1.2, fontSize: 38, bold: true, color: "FFFFFF", align: "center" });
  slide.addShape("rect", { x: (SW - 2.0) / 2, y: SH / 2 - 0.6, w: 2.0, h: 0.04, fill: { color: bc.acc } });
  slide.addText(`${cn} · 品牌视觉识别系统 (VI) 规范手册`, { x: MARGIN, y: SH / 2 - 0.3, w: CONTENT_W, h: 0.5, fontSize: 14, color: "FFFFFF", align: "center", transparency: 20 });
  if (opts.mascotData) {
    const f = fitInBox(opts.mascotData, (SW - 2.5) / 2, SH / 2 + 0.5, 2.5, 2.8);
    slide.addImage({ data: normImg(opts.mascotData), x: f.x, y: f.y, w: f.w, h: f.h, transparency: 10 });
  }
  slide.addText(`如有疑问，请联系 ${cn}`, { x: MARGIN, y: SH - 1.5, w: CONTENT_W, h: 0.4, fontSize: 12, color: "FFFFFF", align: "center", transparency: 30 });
  slide.addShape("rect", { x: 0, y: SH - 0.1, w: SW, h: 0.1, fill: { color: bc.acc } });
}

// ========== Brand Philosophy — V6: 直接用opts字段 ==========
function renderPhilosophy(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, "品牌核心理念", bc);

  // V6→V113: 横向三列布局（品牌愿景 | 核心价值 | 目标市场）+ 底部品牌故事通栏
  const sections = [
    { label: "品牌愿景", content: sanitizeText(opts.brandVision || fta(bp, ["ph-vision-content","brand-vision-content","vision-content"]) || "待品牌方补充") },
    { label: "核心价值", content: sanitizeText(opts.coreValues || fta(bp, ["ph-values-content","core-values-content","values-content"]) || "待品牌方补充") },
    { label: "目标市场", content: sanitizeText(opts.targetMarket || fta(bp, ["ph-market-content","target-market-content","market-content"]) || "待品牌方补充") },
  ];
  // 工单 086-R1：品牌愿景用正式表述，品牌口号分开展示（避免口号被当作愿景）。
  if (opts.slogan) {
    sections[0].content = sections[0].content + "\n\n品牌口号：" + sanitizeText(opts.slogan);
  }

  const cx = MARGIN + LEFT_BAR_W;
  const colGap = 0.25;
  const colW = (CONTENT_W - colGap * 2) / 3;
  const colTopY = 2.3;
  const cardH = 2.8;  // 三列卡片高度

  for (let i = 0; i < sections.length; i++) {
    const colX = cx + i * (colW + colGap);
    const s = sections[i];

    // 卡片背景
    slide.addShape("rect", {
      x: colX, y: colTopY, w: colW, h: cardH,
      fill: { color: "F8F8F8" }, rectRadius: 0.08,
    });
    // 顶部品牌色装饰条
    slide.addShape("rect", {
      x: colX, y: colTopY, w: colW, h: 0.08,
      fill: { color: bc.pri }, rectRadius: 0.04,
    });
    // 标签
    slide.addText(s.label, {
      x: colX + 0.2, y: colTopY + 0.3, w: colW - 0.4, h: 0.45,
      fontSize: 22, bold: true, color: bc.pri, fontFace: "Noto Sans SC", align: "center",
    });
    // 内容
    slide.addText(s.content, {
      x: colX + 0.2, y: colTopY + 0.9, w: colW - 0.4, h: cardH - 1.2,
      fontSize: 14, color: "444444", lineSpacingMultiple: 1.5, valign: "top", align: "center",
    });
  }

  // 品牌故事 — 通栏
  const storyY = colTopY + cardH + 0.4;
  const storyH = SH - storyY - 0.5;
  if (opts.brandStory) {
    // 左侧装饰条
    slide.addShape("rect", {
      x: cx, y: storyY, w: 0.1, h: Math.min(storyH, 4.0),
      fill: { color: bc.pri }, rectRadius: 0.03,
    });
    slide.addText("品牌故事", {
      x: cx + 0.3, y: storyY, w: CONTENT_W - 0.3, h: 0.45,
      fontSize: 22, bold: true, color: bc.pri, fontFace: "Noto Sans SC",
    });
    slide.addText(sanitizeText(opts.brandStory), {
      x: cx + 0.3, y: storyY + 0.5, w: CONTENT_W - 0.5, h: storyH - 0.6,
      fontSize: 14, color: "555555", lineSpacingMultiple: 1.5, valign: "top",
    });
  }

  // IP公仔 — 右下角半透明装饰
  if (opts.mascotData) {
    const f = fitInBox(opts.mascotData, SW - 2.2, SH - 3.5, 1.8, 2.2);
    slide.addImage({ data: normImg(opts.mascotData), x: f.x, y: f.y, w: f.w, h: f.h, transparency: 70 });
  }

  // 004: 愿景→LOGO/IP 落地表达（020：无 IP 手册不含 IP 文案，与 Planner 同源判断）
  slide.addText(
    opts.mascotData
      ? "愿景如何落地：品牌愿景通过 LOGO 的图形叙事与 IP 的亲和表达，转化为可识别的视觉资产。"
      : "愿景如何落地：品牌愿景通过 LOGO 的图形叙事，转化为可识别的视觉资产。",
    {
      x: cx, y: SH - 0.95, w: CONTENT_W, h: 0.5, fontSize: 11, color: "666666", align: "center", fontFace: "Noto Sans SC",
    });
}

// ========== Logo Interpretation — V6: 直接用opts字段 ==========

// ========== Extract Keywords Helper ==========
function extractKeywords(text: string): string[] {
  if (!text) return [];
  // 优先找逗号分隔的词组
  if (text.includes(',')) {
    return text.split(/[,，]/).map(k => k.trim()).filter(k => k.length > 0).slice(0, 6);
  }
  // 按常见分隔符分割
  const parts = text.split(/[。；;、\n\r\t]+/).filter(p => p.trim().length > 0);
  const result: string[] = [];
  for (const part of parts) {
    const words = part.split(/[\s]+/).filter(w => w.length >= 2 && w.length <= 8);
    result.push(...words);
    if (result.length >= 6) break;
  }
  return result.slice(0, 6);
}
function renderLogoPage(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, "标识诠释", bc);
  const cx = MARGIN + LEFT_BAR_W;

  // Logo展示区 — 居中，适度放大
  const logoW = 2.8, logoH = 2.8;
  if (opts.logoData) {
    slide.addShape("rect", { x: (SW - logoW - 0.4) / 2, y: 1.5, w: logoW + 0.4, h: logoH + 0.4, fill: { color: "F5F5F5" }, rectRadius: 0.1 });
    slide.addImage({ data: normImg(opts.logoData), x: (SW - logoW) / 2, y: 1.7, w: logoW, h: logoH, sizing: { type: "contain", w: logoW, h: logoH } });
  } else {
    slide.addShape("rect", { x: (SW - 3.0) / 2, y: 1.5, w: 3.0, h: 3.0, fill: { color: "F5F5F5" }, rectRadius: 0.1 });
    addComboLogo(slide, opts.companyName || "品牌", (SW - 3.0) / 2, 1.2, 3.0, 3.2, bc, industry, { fontSize: 36, color: bc.pri, layout: "vertical", aiLogoData: opts.aiLogoData });
  }

  // 004: LOGO 元素拆解视觉锚点（纯形状卡片，不承载文字）
  const chipColors = [bc.pri, bc.sec, bc.acc, bc.priDark];
  const chipSize = 0.22;
  const chipGap = 0.12;
  const chipsW = chipColors.length * chipSize + (chipColors.length - 1) * chipGap;
  let chipX = (SW - chipsW) / 2;
  for (const chipColor of chipColors) {
    slide.addShape("roundRect", { x: chipX, y: 4.18, w: chipSize, h: chipSize, fill: { color: chipColor }, rectRadius: 0.03 });
    chipX += chipSize + chipGap;
  }

  // 设计理念
  const logoMeaningSrc = opts.logoPhilosophy || fta(bp, ["logo-philosophy","logo-meaning","logo-concept"]);
  const philosophy = logoMeaningSrc
    ? logoMeaningSrc + "\n\nLOGO 承载品牌识别，IP 公仔承载品牌温度；两者共用同一色彩与比例体系，保持调性一致。"
    : "Logo 凝练了品牌核心视觉要素，体现品牌独特识别性。";
  const phiY = 4.8;
  slide.addShape("rect", { x: cx, y: phiY, w: 0.06, h: 0.35, fill: { color: bc.pri }, rectRadius: 0.02 });
  slide.addText("设计理念", { x: cx + 0.2, y: phiY, w: 2, h: 0.35, fontSize: 22, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });
  slide.addText(philosophy, { x: cx + 0.2, y: phiY + 0.45, w: CONTENT_W - 0.4, h: 2.2, fontSize: 14, color: "444444", lineSpacingMultiple: 1.5, fontFace: "Noto Sans SC" });

  // 工单 086-R1：按真实 LOGO 元素输出 2-3 句具体设计寓意（替换套话）；
  // 元素来自显式 logoElements，无已知元素映射时不输出，避免编造寓意。
  const elementMeanings = interpretLogoElements(opts.logoElements);
  if (elementMeanings.length > 0) {
    const ey = phiY + 2.9;
    slide.addShape("rect", { x: cx, y: ey, w: 0.06, h: 0.35, fill: { color: bc.acc }, rectRadius: 0.02 });
    slide.addText("LOGO 元素释义", { x: cx + 0.2, y: ey, w: 2.5, h: 0.35, fontSize: 18, bold: true, color: bc.acc, fontFace: "Noto Sans SC" });
    slide.addText(elementMeanings.slice(0, 3).join("\n"), {
      x: cx + 0.2, y: ey + 0.42, w: CONTENT_W - 0.4, h: 1.5,
      fontSize: 13, color: "555555", lineSpacingMultiple: 1.4, fontFace: "Noto Sans SC",
    });
  }
}


// ========== Brand Colors ==========
// ---- Logo组合规范 ----
function renderLogoVariations(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, bp.label || "Logo组合规范", bc);
  const cx = MARGIN + LEFT_BAR_W;
  const companyName = opts.companyName || "品牌";
  const aiLogo = opts.aiLogoData || (opts.logoData ? normImg(opts.logoData) : undefined);

  // 2x2 grid of logo variations
  const variations = [
    { label: "横式组合", col: 0, row: 0, layout: "horizontal" as const, invert: false, bg: "F5F5F5", caption: "图标-中文间距 0.5 单位（2.5mm） · 最小宽度 30mm", spacing: { x: 2.5 / 25.4 } },
    { label: "竖式组合", col: 1, row: 0, layout: "vertical" as const, invert: false, bg: "F5F5F5", caption: "图标-文字间距 0.3 单位（1.5mm） · 最小宽度 20mm", spacing: { y: 1.5 / 25.4 } },
    { label: "反白稿（深底）", col: 0, row: 1, layout: "vertical" as const, invert: true, bg: "", caption: "深底 LOGO 与文字统一反白", spacing: { y: 1.5 / 25.4 } },
    { label: "单色稿", col: 1, row: 1, layout: "vertical" as const, invert: false, bg: "FFFFFF", caption: "品牌单色 · 禁止半色调渐变 · 小尺寸印刷建议使用", spacing: { y: 1.5 / 25.4 } },
  ];

  const gap = 0.2;
  const cellW = (CONTENT_W - gap) / 2;
  const cellH = 3.1;

  for (const v of variations) {
    const x = cx + v.col * (cellW + gap);
    const y = 1.55 + v.row * (cellH + 0.15);

    // Background box
    slide.addShape("rect", {
      x, y, w: cellW, h: cellH,
      fill: { color: v.invert ? bc.pri : v.bg },
      line: { color: "E0E0E0", width: 0.5 },
      rectRadius: 0.1,
      shadow: { type: "outer", blur: 4, offset: 2, color: "000000", opacity: 0.08 },
    });

    const logoColor = v.invert ? "FFFFFF" : bc.pri;

    // Use addComboLogo for professional rendering
    addComboLogo(slide, companyName, x + 0.3, y + 0.2, cellW - 0.6, cellH - 1.25, bc, industry, {
      fontSize: v.layout === "horizontal" ? 14 : 18,
      color: logoColor,
      layout: v.layout,
      showLine: true,
      aiLogoData: aiLogo,
      spacing: v.spacing,
    });

    // 浅灰辅助线：图形区 / 间距区 / 文字区
    const guideY = y + 0.34;
    slide.addShape("rect", { x: x + 0.3, y: guideY, w: cellW - 0.6, h: 0.008, fill: { color: "C9C9C9" } });
    const zoneLabels = ["图形区", "间距区", "文字区"];
    for (let z = 0; z < zoneLabels.length; z++) {
      slide.addText(zoneLabels[z], {
        x: x + 0.3 + z * ((cellW - 0.6) / 3), y: guideY - 0.22, w: (cellW - 0.6) / 3, h: 0.2,
        fontSize: 7, color: "9A9A9A", align: "center",
      });
    }

    // 组合规范数值
    slide.addText(v.caption, {
      x: x + 0.15, y: y + cellH - 0.85, w: cellW - 0.3, h: 0.35,
      fontSize: 8, color: v.invert ? "CCCCCC" : "777777", align: "center", lineSpacingMultiple: 1.1,
    });

    // 组合名称
    slide.addText(v.label, {
      x, y: y + cellH - 0.45, w: cellW, h: 0.32,
      fontSize: 11, bold: true,
      color: v.invert ? "CCCCCC" : "666666",
      align: "center",
    });
  }

  // Bottom note
  slide.addText("横式 0.5 单位（2.5mm）间距，最小宽度 30mm；竖式 0.3 单位（1.5mm）间距，最小宽度 20mm。中文名使用标准字距，禁止拉伸字间距。", {
    x: cx, y: 8.15, w: CONTENT_W, h: 0.6,
    fontSize: 11, color: "888888", align: "center", lineSpacingMultiple: 1.2,
  });
}

// ---- Logo误用规范 ----
function renderLogoMisuse(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, bp.label || "Logo误用规范", bc);
  const cx = MARGIN + LEFT_BAR_W;
  const companyName = opts.companyName || "品牌";
  const aiLogo = opts.aiLogoData || (opts.logoData ? normImg(opts.logoData) : null);

  // 工单 007/007-R1：与 PagePlanner 共用同一套 Logo 误用规则；
  // 有真实结构证据（opts.logoElements）时生成元素级规则，无证据时只输出通用规则。
  const misuses = getLogoMisuseRules(opts.logoElements || null);

  for (let i = 0; i < misuses.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = cx + col * (CONTENT_W / 3 + 0.1);
    const y = 1.4 + row * 2.5;
    const w = CONTENT_W / 3 - 0.15;
    const h = 2.1;

    // Red-tinted box
    slide.addShape("rect", {
      x, y, w, h,
      fill: { color: "FEF2F2" },
      line: { color: "FECACA", width: 1 },
      rectRadius: 0.1,
    });

    // Distorted logo example in the box
    const logoW = w * 0.42;
    const logoH = Math.min(w * 0.42, h * 0.42);
    const logoX = x + (w - logoW) / 2;
    const logoY = y + 0.12;

    if (aiLogo) {
      const imgOpts: any = {
        data: aiLogo,
        x: logoX, y: logoY, w: logoW, h: logoH,
        sizing: { type: "contain", w: logoW, h: logoH },
      };
      // Apply distortion effects
      switch (misuses[i].distortion) {
        case "stretch":
          imgOpts.w = logoW * 1.5;  // Stretched horizontally
          imgOpts.h = logoH * 0.6;  // Compressed vertically
          imgOpts.x = logoX - logoW * 0.25;
          break;
        case "rotate":
          imgOpts.rotate = 25;  // Rotated 25 degrees
          break;
        case "recolor":
          // Can't truly recolor an image in PptxGenJS, add a colored overlay shape
          break;
        case "outline":
          // Add a thick outline rectangle behind
          slide.addShape("rect", {
            x: logoX - 0.05, y: logoY - 0.05, w: logoW + 0.1, h: logoH + 0.1,
            line: { color: "FF6600", width: 3 },
            fill: { type: "none" },
          });
          break;
        case "shadow":
          imgOpts.shadow = { type: "outer", blur: 15, offset: 5, color: "000000", opacity: 0.6 };
          break;
        case "font":
          // Can't change font in an image, but we can add wrong-text overlay
          break;
      }
      slide.addImage(imgOpts);
      // Recolor overlay: add a semi-transparent colored rect
      if (misuses[i].distortion === "recolor") {
        slide.addShape("rect", {
          x: logoX, y: logoY, w: logoW, h: logoH,
          fill: { color: "9900FF", transparency: 50 },
        });
      }
      // Font change: add wrong-style text
      if (misuses[i].distortion === "font") {
        slide.addText(companyName, {
          x: logoX, y: logoY + logoH * 0.3, w: logoW, h: logoH * 0.5,
          fontSize: 12, italic: true, color: "FF6600", align: "center", fontFace: "Comic Sans MS",
        });
      }
    } else {
      // Fallback: distorted combo logo shapes
      addComboLogo(slide, companyName, x + 0.2, y + 0.15, w - 0.4, h * 0.45, bc, industry, {
        fontSize: 12, color: "999999", layout: "vertical", showLine: false,
      });
    }

    // X mark overlay
    slide.addText("\u2715", {
      x, y: y + 0.05, w: 0.4, h: 0.4,
      fontSize: 20, bold: true, color: bc.pri, align: "center",
    });

    // Title
    slide.addText(misuses[i].title, {
      x, y: y + h - 0.55, w, h: 0.32,
      fontSize: 13, bold: true, color: bc.pri, align: "center",
    });

    // Description
    slide.addText(misuses[i].desc, {
      x: x + 0.1, y: y + h - 0.42, w: w - 0.2, h: 0.45,
      fontSize: 11, color: "888888", align: "center", lineSpacingMultiple: 1.15,
    });
  }

  // Footer warning
  slide.addText("以上误用方式将严重损害品牌形象，所有应用必须严格遵守本规范。", {
    x: cx, y: 8.85, w: CONTENT_W, h: 0.4,
    fontSize: 12, bold: true, color: bc.pri, align: "center",
  });
// ---- 多底色适配 ----
function renderLogoBackgrounds(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, bp.label || "多底色适配", bc);
  const cx = MARGIN + LEFT_BAR_W;
  const companyName = opts.companyName || "品牌";
  const aiLogo = opts.aiLogoData || (opts.logoData ? normImg(opts.logoData) : undefined);
  const logoForScene = opts.aiLogoData || opts.logoData;

  // 2列2行布局，4种底色
  const colW = (CONTENT_W - 0.3) / 2;
  const rowH = 3.2;
  const startY = 1.6;
  const gap = 0.2;

  const scenarios = [
    { bg: "FFFFFF", label: "白色背景", desc: "正常彩色Logo", textColor: "333333", logoType: "normal" },
    { bg: bc.priDark, label: "深色背景", desc: "反白Logo", textColor: "FFFFFF", logoType: "reversed" },
    { bg: "gradient", label: "渐变色背景", desc: "带白色底框的Logo", textColor: "333333", logoType: "boxed" },
    { bg: "pattern", label: "杂色/图片背景", desc: "带白色底框或阴影的Logo", textColor: "333333", logoType: "shadowed" },
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = cx + col * (colW + gap);
    const y = startY + row * (rowH + 0.15);
    const sc = scenarios[i];

    // 容器背景框
    if (sc.bg === "gradient") {
      // 模拟渐变：叠加两个半宽色块
      const gradColors = [bc.pri, bc.sec];
      slide.addShape("rect", { x, y, w: colW / 2, h: rowH, fill: { color: gradColors[0] }, rectRadius: 0.08 });
      slide.addShape("rect", { x: x + colW / 2, y, w: colW / 2, h: rowH, fill: { color: gradColors[1] }, rectRadius: 0.08 });
    } else if (sc.bg === "pattern") {
      // 模拟杂色：浅色底+波点
      slide.addShape("rect", { x, y, w: colW, h: rowH, fill: { color: "F5F0EB" }, rectRadius: 0.08 });
      // 添加一些装饰点
      const dotColors = [bc.pri, bc.sec, bc.acc];
      for (let d = 0; d < 12; d++) {
        const dx = x + 0.15 + (d % 4) * (colW / 4.5);
        const dy = y + 0.15 + Math.floor(d / 4) * (rowH / 4.5);
        slide.addShape("ellipse", { x: dx, y: dy, w: 0.18, h: 0.18, fill: { color: dotColors[d % 3], transparency: 30 } });
      }
    } else {
      slide.addShape("rect", { x, y, w: colW, h: rowH, fill: { color: sc.bg }, rectRadius: 0.08, line: { color: "E0E0E0", width: 0.3 } });
    }

    // Logo展示区
    const logoW = 1.4, logoH = 1.4;
    const logoX = x + (colW - logoW) / 2;
    const logoY = y + 0.25;

    if (sc.logoType === "normal") {
      // 白色背景 - 正常彩色Logo
      if (aiLogo) {
        slide.addImage({ data: aiLogo, x: logoX, y: logoY, w: logoW, h: logoH, sizing: { type: "contain", w: logoW, h: logoH } });
      } else {
        addComboLogo(slide, companyName, x + 0.2, y + 0.15, colW - 0.4, 1.2, bc, industry, { fontSize: 12, color: bc.pri, layout: "vertical", showLine: false, aiLogoData: opts.aiLogoData });
      }
    } else if (sc.logoType === "reversed") {
      // 深色背景 - 反白Logo
      if (aiLogo) {
        slide.addImage({ data: aiLogo, x: logoX, y: logoY, w: logoW, h: logoH, sizing: { type: "contain", w: logoW, h: logoH } });
      } else {
        addComboLogo(slide, companyName, x + 0.2, y + 0.15, colW - 0.4, 1.2, bc, industry, { fontSize: 12, color: "FFFFFF", layout: "vertical", showLine: false });
      }
    } else if (sc.logoType === "boxed") {
      // 渐变色背景 - 白色底框
      const pad = 0.15;
      slide.addShape("rect", { x: logoX - pad, y: logoY - pad, w: logoW + pad * 2, h: logoH + pad * 2, fill: { color: "FFFFFF" }, rectRadius: 0.06 });
      if (aiLogo) {
        slide.addImage({ data: aiLogo, x: logoX, y: logoY, w: logoW, h: logoH, sizing: { type: "contain", w: logoW, h: logoH } });
      } else {
        addComboLogo(slide, companyName, x + 0.2, y + 0.15, colW - 0.4, 1.2, bc, industry, { fontSize: 12, color: bc.pri, layout: "vertical", showLine: false });
      }
    } else if (sc.logoType === "shadowed") {
      // 杂色背景 - 带阴影的白色底框
      const pad = 0.15;
      slide.addShape("rect", { x: logoX - pad, y: logoY - pad, w: logoW + pad * 2, h: logoH + pad * 2, fill: { color: "FFFFFF" }, rectRadius: 0.06, shadow: { type: "outer", blur: 8, offset: 4, color: "000000", opacity: 0.2 } });
      if (aiLogo) {
        slide.addImage({ data: aiLogo, x: logoX, y: logoY, w: logoW, h: logoH, sizing: { type: "contain", w: logoW, h: logoH } });
      } else {
        addComboLogo(slide, companyName, x + 0.2, y + 0.15, colW - 0.4, 1.2, bc, industry, { fontSize: 12, color: bc.pri, layout: "vertical", showLine: false });
      }
    }

    // 标签说明
    slide.addText(sc.label, {
      x, y: y + rowH - 0.9, w: colW, h: 0.3,
      fontSize: 13, bold: true, color: sc.bg === bc.priDark ? "FFFFFF" : bc.pri, align: "center",
    });
    slide.addText(sc.desc, {
      x: x + 0.1, y: y + rowH - 0.55, w: colW - 0.2, h: 0.4,
      fontSize: 11, color: sc.bg === bc.priDark ? "CCCCCC" : "777777", align: "center",
    });
  }

  // 底部说明
  slide.addText("LOGO在不同背景下应使用对应的配色方案，确保识别清晰度与品牌一致性。", {
    x: cx, y: startY + 2 * (rowH + 0.15) + 0.15, w: CONTENT_W, h: 0.3,
    fontSize: 12, color: "888888", align: "center",
  });
}

}

// ---- 辅助图形 ----


// P0-2: replace hex codes in text with COLOR_NAME_MAP names (post-processing)
function sanitizeColorNames(text: string): string {
  if (!text) return text;
  return text.replace(/#?([0-9A-Fa-f]{6})\b/g, (match, hex) => {
    const name = COLOR_NAME_MAP[hex.toUpperCase()];
    return name ? name + " " + match : match;
  });
}
function renderAuxiliaryGraphics(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || "辅助图形", bc);
  const cx = MARGIN + LEFT_BAR_W;

  // V103: 辅助图形说明加入品牌色依据
  const auxIntro = sanitizeColorNames(sanitizeText(opts.auxGraphicsIntro || `辅助图形提取自品牌主色(${bc.pri})与辅助色(${bc.sec})，用于丰富视觉层次、强化品牌识别。条纹组合呼应品牌节奏感，点阵组合传递精致秩序。`).replace(/。。/g, '。'));
  slide.addText(auxIntro, {
    x: cx, y: 2.187, w: CONTENT_W, h: 0.6,
    fontSize: 14, color: "666666", lineSpacingMultiple: 1.4,
  });

  const halfW = (CONTENT_W - 0.3) / 2;
  const patternH = 1.8;

  // V11: Pattern 1: Stripes — moved down to y=3.6, transparency reduced for brand color visibility
  const p1x = cx;
  const p1y = 4.387;
  slide.addShape("rect", {
    x: p1x, y: p1y, w: halfW, h: patternH,
    fill: { color: "F5F5F5" }, rectRadius: 0.1,
  });
  // Draw 7 stripes with brand colors (lower transparency for color clarity)
  const stripeColors = [bc.pri, bc.sec, bc.acc, bc.pri, bc.sec, bc.acc, bc.pri];
  for (let s = 0; s < 7; s++) {
    slide.addShape("rect", {
      x: p1x + s * (halfW / 7), y: p1y,
      w: halfW / 10, h: patternH,
      fill: { color: stripeColors[s], transparency: 30 },
      rectRadius: 0.02,
    });
  }
  slide.addText("主辅助图形 \u2014 条纹组合", {
    x: p1x, y: p1y + patternH + 0.1, w: halfW, h: 0.3,
    fontSize: 12, bold: true, color: "444444", align: "center",
  });

  // V11: Pattern 2: Dots — moved down to y=3.6, transparency reduced
  const p2x = cx + halfW + 0.3;
  const p2y = 4.387;
  slide.addShape("rect", {
    x: p2x, y: p2y, w: halfW, h: patternH,
    fill: { color: "F5F5F5" }, rectRadius: 0.1,
  });
  // Draw dot grid with brand colors (lower transparency for color clarity)
  const dotColors = [bc.pri, bc.sec, bc.acc];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      slide.addShape("ellipse", {
        x: p2x + 0.2 + c * 0.55, y: p2y + 0.2 + r * 0.42,
        w: 0.25, h: 0.25,
        fill: { color: dotColors[(r + c) % 3], transparency: 20 },
      });
    }
  }
  slide.addText("次辅助图形 \u2014 点阵组合", {
    x: p2x, y: p2y + patternH + 0.1, w: halfW, h: 0.3,
    fontSize: 12, bold: true, color: "444444", align: "center",
  });

  // Usage section — shifted down
  slide.addText("应用场景", {
    x: cx, y: 6.787, w: CONTENT_W, h: 0.35,
    fontSize: 18, bold: true, color: bc.pri,
  });
  slide.addText("1. 文档/手册页眉装饰线\n2. 包装袋底部纹样\n3. 名片背面背景\n4. 社交媒体封面装饰\n5. 店铺墙面装饰纹样", {
    x: cx + 0.2, y: 7.924, w: CONTENT_W - 0.4, h: 1.5,
    fontSize: 14, color: "555555", lineSpacingMultiple: 1.4,
  });
  slide.addText("辅助图形可按比例缩放，但不可改变比例关系或旋转角度。建议透明度使用10%-40%。", {
    x: cx, y: 9.611, w: CONTENT_W, h: 0.3,
    fontSize: 14, color: "555555", align: "center",
  });
  slide.addShape("rect", { x: cx, y: 10.05, w: CONTENT_W, h: 0.85, fill: { color: "F5F5F5" }, rectRadius: 0.06 });
  slide.addText("最小使用尺寸：印刷 8mm / 数字 32px · 保护留白：四周 ≥ 图形高度 20% · 透明度：仅允许 10%-40% · 缩放：只能等比缩放，禁止裁切局部纹样", {
    x: cx + 0.15, y: 10.12, w: CONTENT_W - 0.3, h: 0.7,
    fontSize: 11, color: "444444", align: "center", valign: "middle", lineSpacingMultiple: 1.3, fontFace: "Noto Sans SC",
  });
}

// ========== Brand Colors — V108: 图片化规范页 ==========
async function renderColors(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): Promise<void> {
  try {
    const imgData = await renderColorSpecPng({ bc, colorMeaning: opts.colorMeaning, companyName: opts.companyName, logoColors: resolveLogoColors(opts) });
    slide.addImage({ data: imgData, x: 0, y: 0, w: SW, h: SH, sizing: { type: "cover", w: SW, h: SH } });
  } catch (err) {
    // 降级：satori渲染失败时回退到文字模式
    console.warn("[render-pptx] V108 color spec image failed, fallback to text:", err);
    addContentFrame(slide, "标准色彩规范", bc);
    const cx = MARGIN + LEFT_BAR_W;
    slide.addText("品牌主色", { x: cx, y: 1.8, w: 2, h: 0.4, fontSize: 13, bold: true, color: "333333", align: "center" });
    slide.addText("#" + bc.pri, { x: cx, y: 2.2, w: 2, h: 0.3, fontSize: 12, color: "555555", align: "center" });
    slide.addShape("ellipse", { x: cx + 0.3, y: 1.2, w: 1.4, h: 1.4, fill: { color: bc.pri } });
    slide.addText("辅助色", { x: cx + 2.3, y: 1.8, w: 2, h: 0.4, fontSize: 13, bold: true, color: "333333", align: "center" });
    slide.addText("#" + bc.sec, { x: cx + 2.3, y: 2.2, w: 2, h: 0.3, fontSize: 12, color: "555555", align: "center" });
    slide.addShape("ellipse", { x: cx + 2.6, y: 1.2, w: 1.4, h: 1.4, fill: { color: bc.sec } });
    slide.addText("强调色", { x: cx + 4.6, y: 1.8, w: 2, h: 0.4, fontSize: 13, bold: true, color: "333333", align: "center" });
    slide.addText("#" + bc.acc, { x: cx + 4.6, y: 2.2, w: 2, h: 0.3, fontSize: 12, color: "555555", align: "center" });
    slide.addShape("ellipse", { x: cx + 4.9, y: 1.2, w: 1.4, h: 1.4, fill: { color: bc.acc } });
    const logoColors = resolveLogoColors(opts);
    if (logoColors) {
      const logoColorItems = [logoColors.navy, logoColors.gold].filter((c): c is LogoColor => Boolean(c));
      slide.addText("LOGO 专属色值", { x: cx, y: 4.2, w: CONTENT_W, h: 0.4, fontSize: 15, bold: true, color: bc.pri });
      logoColorItems.forEach((c, i) => {
        slide.addText(c.name + " " + c.hex + "  RGB: " + c.rgb + "  CMYK: " + c.cmyk, { x: cx + i * 2.4, y: 4.7, w: 2.4, h: 0.3, fontSize: 12, color: "444444" });
      });
      slide.addText("LOGO 实体物料以" + logoColorItems.map((c) => c.name).join("/") + "为准，品牌画面主色用于辅助氛围，按本页数值使用，不得混用冲突。", { x: cx, y: 5.6, w: CONTENT_W, h: 0.4, fontSize: 12, color: "CC6600" });
    }
  }
}

/** 工单 086-R1：LOGO 元素 → 具体设计寓意（仅映射已知语义，禁止编造）。 */
function interpretLogoElements(elements?: string[] | null): string[] {
  const source = (elements || []).map((e) => String(e || "")).filter(Boolean);
  if (source.length === 0) return [];
  const meanings: Array<{ keys: RegExp; sentence: string }> = [
    { keys: /水滴|水珠|露/, sentence: "「水滴」寓意滋养渗透，传递润泽焕活、由内而外的品牌感受。" },
    { keys: /∞|无限|循环/, sentence: "「∞ 循环」寓意循环再生与可持续，表达长期陪伴与自然平衡。" },
    { keys: /三角|山峰|箭头/, sentence: "「三角/箭头」寓意方向与引导，象征专业方向感与向上进取。" },
    { keys: /叶|叶片/, sentence: "「叶片」寓意自然生机与本草能量，呼应健康养护的核心价值。" },
    { keys: /碗|面碗/, sentence: "「碗形」寓意家的温度与踏实满足，传递一碗好面的亲切感。" },
    { keys: /面条|线条|丝/, sentence: "「面条线条」寓意匠心手作与绵长传承，体现工艺与坚持。" },
    { keys: /圆|环/, sentence: "「圆/环」寓意圆满包容与循环共生，强化亲和与完整。" },
    { keys: /星/, sentence: "「星」寓意品质闪耀与值得信赖，塑造高端可信的识别记忆。" },
    { keys: /花|瓣/, sentence: "「花瓣」寓意绽放与柔美，呼应美丽焕新的品牌气质。" },
    { keys: /手|捧/, sentence: "「双手/捧」寓意呵护与关怀，传达专业守护的服务承诺。" },
    { keys: /翅|羽/, sentence: "「翅膀」寓意轻盈向上与自信绽放，呼应蜕变焕新。" },
  ];
  const joined = source.join(" ");
  const hits = meanings.filter((m) => m.keys.test(joined));
  return hits.slice(0, 3).map((m) => m.sentence);
}


// ========== Typography ==========
// ========== Typography — V108: 图片化规范页 ==========
async function renderTypography(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): Promise<void> {
  try {
    const imgData = await renderTypographyPng({ bc });
    // 全页图片覆盖（去掉默认contentFrame，直接铺满）
    slide.addImage({ data: imgData, x: 0, y: 0, w: SW, h: SH, sizing: { type: "cover", w: SW, h: SH } });
  } catch (err) {
    // 降级：satori渲染失败时回退到文字模式
    console.warn("[render-pptx] V108 typography image failed, fallback to text:", err);
    addContentFrame(slide, "字体系统", bc);
    const cx = MARGIN + LEFT_BAR_W;
    let yPos = 1.6;
    slide.addShape("rect", { x: cx, y: yPos, w: 0.12, h: 1.5, fill: { color: bc.pri }, rectRadius: 0.03 });
    slide.addText("中文字体", { x: cx + 0.3, y: yPos + 0.1, w: CONTENT_W, h: 0.5, fontSize: 18, bold: true, color: bc.pri });
    slide.addText("标题字体：思源黑体 / Noto Sans SC", { x: cx + 0.3, y: yPos + 0.6, w: CONTENT_W, h: 0.35, fontSize: 14, color: "444444" });
    slide.addText("正文字体：思源宋体 / Noto Serif SC", { x: cx + 0.3, y: yPos + 0.95, w: CONTENT_W, h: 0.35, fontSize: 14, color: "444444" });
    yPos += 2.0;
    slide.addShape("rect", { x: cx, y: yPos, w: 0.12, h: 1.5, fill: { color: bc.sec }, rectRadius: 0.03 });
    slide.addText("英文字体", { x: cx + 0.3, y: yPos + 0.1, w: CONTENT_W, h: 0.5, fontSize: 18, bold: true, color: bc.sec });
    slide.addText("Brand Font: Montserrat", { x: cx + 0.3, y: yPos + 0.6, w: CONTENT_W, h: 0.35, fontSize: 14, color: "444444" });
    slide.addText("Body Font: Open Sans", { x: cx + 0.3, y: yPos + 0.95, w: CONTENT_W, h: 0.35, fontSize: 14, color: "444444" });
    yPos += 2.0;
    slide.addText("字号层级规范", { x: cx, y: yPos, w: CONTENT_W, h: 0.5, fontSize: 18, bold: true, color: bc.pri });
    const rows = [
      [{ text: "层级", options: { fontSize: 12, bold: true, color: "FFFFFF" } }, { text: "字号", options: { fontSize: 12, bold: true, color: "FFFFFF" } }, { text: "应用场景", options: { fontSize: 12, bold: true, color: "FFFFFF" } }],
      [{ text: "一级标题", options: { fontSize: 12, color: "333333" } }, { text: "36-40pt", options: { fontSize: 12, color: "333333" } }, { text: "封面标题", options: { fontSize: 12, color: "333333" } }],
      [{ text: "二级标题", options: { fontSize: 12, color: "333333" } }, { text: "22-26pt", options: { fontSize: 12, color: "333333" } }, { text: "章节标题", options: { fontSize: 12, color: "333333" } }],
      [{ text: "三级标题", options: { fontSize: 12, color: "333333" } }, { text: "16-18pt", options: { fontSize: 12, color: "333333" } }, { text: "小标题/栏目", options: { fontSize: 12, color: "333333" } }],
      [{ text: "正文", options: { fontSize: 12, color: "333333" } }, { text: "13-14pt", options: { fontSize: 12, color: "333333" } }, { text: "正文说明", options: { fontSize: 12, color: "333333" } }],
      [{ text: "辅助文字", options: { fontSize: 12, color: "333333" } }, { text: "11pt", options: { fontSize: 12, color: "333333" } }, { text: "注释/标注/页码", options: { fontSize: 12, color: "333333" } }],
    ];
    slide.addTable(rows, { x: cx, y: yPos + 0.55, w: CONTENT_W, colW: [2.0, 2.0, 3.07], border: { pt: 0.5, color: "E0E0E0" }, rowH: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4], autoPage: false });
  }
}

// ========== Basic Spec ==========
function renderBasicSpec(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, "基础规范", bc);
  const cx = MARGIN + LEFT_BAR_W;

  // Logo保护空间
  slide.addText("LOGO 保护空间", { x: cx, y: 1.6, w: CONTENT_W, h: 0.5, fontSize: 22, bold: true, color: bc.pri });
  slide.addText("LOGO 四周保留至少 15% 保护空间，不可被任何元素遮挡或裁切", { x: cx, y: 2.1, w: CONTENT_W, h: 0.4, fontSize: 14, color: "555555" });

  const demoSize = 2.8;
  const demoX = (SW - demoSize) / 2;
  const demoY = 2.8;
  slide.addShape("rect", { x: demoX - 0.35, y: demoY - 0.35, w: demoSize + 0.7, h: demoSize + 0.7, fill: { color: "F5F5F5" }, rectRadius: 0.05, line: { color: "E0E0E0", width: 0.5, dashType: "dash" } });
  if (opts.logoData) {
    slide.addImage({ data: normImg(opts.logoData), x: demoX, y: demoY, w: demoSize, h: demoSize, sizing: { type: "contain", w: demoSize, h: demoSize } });
  } else {
    // V13: 无Logo图时渲染字标
    // 组合Logo在保护空间展示
    addComboLogo(slide, opts.companyName || "品牌", demoX, demoY, demoSize, demoSize, bc, industry, { fontSize: 22, color: bc.pri, layout: "vertical", showLine: true, aiLogoData: opts.aiLogoData });
  }
  slide.addText("15% 保护空间", { x: demoX - 0.35, y: demoY + demoSize + 0.15, w: demoSize + 0.7, h: 0.3, fontSize: 12, color: "999999", align: "center" });

  // 最小尺寸
  slide.addText("最小尺寸规范", { x: cx, y: 6.5, w: CONTENT_W, h: 0.5, fontSize: 22, bold: true, color: bc.pri });
  const rows = [
    [{ text: "应用场景", options: { fontSize: 12, bold: true, color: "FFFFFF" } }, { text: "最小宽度", options: { fontSize: 12, bold: true, color: "FFFFFF" } }, { text: "说明", options: { fontSize: 12, bold: true, color: "FFFFFF" } }],
    [{ text: "印刷品", options: { fontSize: 12, color: "333333" } }, { text: "30mm", options: { fontSize: 12, color: "333333" } }, { text: "名片/信封等印刷物料", options: { fontSize: 12, color: "333333" } }],
    [{ text: "数字媒体", options: { fontSize: 12, color: "333333" } }, { text: "80px", options: { fontSize: 12, color: "333333" } }, { text: "网站/App 等数字媒介", options: { fontSize: 12, color: "333333" } }],
    [{ text: "户外广告", options: { fontSize: 12, color: "333333" } }, { text: "200mm", options: { fontSize: 12, color: "333333" } }, { text: "广告牌/展架等大尺寸场景", options: { fontSize: 12, color: "333333" } }],
  ];
  slide.addTable(rows, { x: cx, y: 7.1, w: CONTENT_W, colW: [2.0, 2.0, 3.07], border: { pt: 0.5, color: "E0E0E0" }, rowH: [0.4, 0.4, 0.4, 0.4], autoPage: false });
}

// ========== 场景页 — V6: AI写实图 + 降级色块 ==========
function renderScene(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, type: string, bc: BC, industry: IndustryType, sceneImages: Record<string, string>, logoForScene?: string | null): void {
  const configs = getSceneConfigs(industry, opts.sceneSectionTitles);
  const config = configs[type] || { title: type, desc: "" };
  addContentFrame(slide, config.title, bc);
  const cx = MARGIN + LEFT_BAR_W;
  slide.addText(config.desc, { x: cx, y: 1.4, w: CONTENT_W, h: 0.4, fontSize: 14, color: "666666" });

  // 获取该场景类型的AI图片
  const pageImages = Object.entries(sceneImages).filter(([k]) => k.startsWith(type));

  if (pageImages.length > 0) {
    // ===== V100: 有AI场景图，混合布局（上氛围+下Logo规范）=====
    renderMixedLayout(slide, opts, bc, type, industry, pageImages, cx, logoForScene);
  } else if (type === "marketing") {
    // 工单 085-A-R2：A 类营销场景缺图时渲染显式「待补」占位页，不崩溃、不吞掉其他页面。
    renderMarketingPendingPlaceholder(slide, config, cx);
  } else {
    // ===== 降级: 无AI图，回退到色块方案 =====
    renderSceneFallback(slide, opts, bc, type, industry, cx);
  }

  // 排版坐标卡：安全区虚线框 + LOGO 占位 + 尺寸标注
  renderMaterialSpecCards(slide, bc, type, industry, 8.55);
}

/**
 * 工单 085-A-R2：A 类营销场景缺失时的显式待补占位页。
 * 仅在项目走「测试单降级通道」（marketing 槽位 missing=pending_074）时出现，
 * 文案明确标注「待补：A 类场景候选 074」，不冒充完整交付。
 */
function renderMarketingPendingPlaceholder(slide: PptxGenJS.Slide, config: SceneConfig, cx: number): void {
  const bx = cx;
  const by = 2.0;
  const bw = CONTENT_W;
  const bh = 5.0;
  slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: "FFF7E6" }, line: { color: "CC8800", width: 1 }, rectRadius: 0.1 });
  slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.09, fill: { color: "CC8800" }, rectRadius: 0.02 });
  slide.addText("营销应用系统（待补：A 类场景候选 074）", {
    x: bx + 0.5, y: by + 0.9, w: bw - 1.0, h: 0.9,
    fontSize: 22, bold: true, color: "B26A00", align: "center", valign: "middle", fontFace: "Noto Sans SC",
  });
  slide.addText("A 类营销场景（门头 / 海报）尚未通过 074 参考锚定验收。\n本页按测试单降级通道显式标记「待补」，不冒充完整交付。", {
    x: bx + 1.0, y: by + 1.9, w: bw - 2.0, h: 1.4,
    fontSize: 14, color: "8A6D3B", align: "center", valign: "middle", lineSpacingMultiple: 1.3, fontFace: "Noto Sans SC",
  });
}

function logoPlacement(pos: string, sx: number, sy: number, sw: number, sh: number): { x: number; y: number } {
  if (pos.includes("右上")) return { x: sx + sw * 0.66, y: sy + sh * 0.12 };
  if (pos.includes("顶部居中")) return { x: sx + sw * 0.39, y: sy + sh * 0.12 };
  if (pos.includes("居中") || pos.includes("中心")) return { x: sx + sw * 0.42, y: sy + sh * 0.38 };
  if (pos.includes("上方 40%")) return { x: sx + sw * 0.4, y: sy + sh * 0.1 };
  if (pos.includes("左侧")) return { x: sx + sw * 0.08, y: sy + sh * 0.42 };
  return { x: sx + sw * 0.1, y: sy + sh * 0.12 };
}

function renderMaterialSpecCards(slide: PptxGenJS.Slide, bc: BC, pageType: string, industry: IndustryType, yStart: number): void {
  // 工单 086-R1：应用/包装/营销三页物料按行业映射表替换硬编码通用模板；
  // 未命中行业映射时回退原通用物料表（行为不变）。
  const specs: MaterialSpec[] =
    (pageType === "stationery" || pageType === "packaging" || pageType === "marketing")
      ? (getIndustrySceneMaterials(industry, pageType) || getMaterialSpecs(pageType, industry))
      : getMaterialSpecs(pageType, industry);
  if (!specs.length) return;
  const cx = MARGIN + LEFT_BAR_W;
  slide.addText("排版坐标卡", { x: cx, y: yStart, w: CONTENT_W, h: 0.35, fontSize: 15, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });

  const count = Math.min(specs.length, 3);
  const gap = 0.15;
  const cardW = (CONTENT_W - gap * (count - 1)) / count;
  const cardH = 1.95;
  const y = yStart + 0.4;

  specs.slice(0, count).forEach((spec, i) => {
    const x = cx + i * (cardW + gap);
    slide.addShape("rect", { x, y, w: cardW, h: cardH, fill: { color: "FFFFFF" }, line: { color: "D8D8D8", width: 0.5 }, rectRadius: 0.08 });
    slide.addShape("rect", { x, y, w: cardW, h: 0.07, fill: { color: bc.pri }, rectRadius: 0.03 });
    slide.addText(spec.name, { x: x + 0.12, y: y + 0.12, w: cardW - 0.24, h: 0.28, fontSize: 11, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });
    slide.addText(spec.size, { x: x + 0.12, y: y + 0.38, w: cardW - 0.24, h: 0.24, fontSize: 8, color: "666666", fontFace: "Noto Sans SC" });

    const sx = x + 0.12, sy = y + 0.62, sw = cardW - 0.24, sh = 0.72;
    slide.addShape("rect", { x: sx, y: sy, w: sw, h: sh, fill: { color: "F7F7F7" }, line: { color: bc.pri, width: 0.75, dashType: "dash" }, rectRadius: 0.04 });
    const pos = logoPlacement(spec.logoPosition, sx, sy, sw, sh);
    const logoW = Math.min(sw * 0.22, 0.45);
    const logoH = Math.min(sh * 0.3, 0.3);
    slide.addShape("rect", { x: pos.x, y: pos.y, w: logoW, h: logoH, fill: { color: bc.pri, transparency: 25 }, rectRadius: 0.02 });
    slide.addText("LOGO", { x: pos.x, y: pos.y + 0.02, w: logoW, h: 0.16, fontSize: 6, bold: true, color: "FFFFFF", align: "center", fontFace: "Noto Sans SC" });

    slide.addText(`LOGO：${spec.logoPosition}\n${spec.logoSize} · 安全区 ${spec.safeZone}`, {
      x: x + 0.1, y: y + cardH - 0.52, w: cardW - 0.2, h: 0.44,
      fontSize: 7, color: "555555", align: "center", lineSpacingMultiple: 1.1, fontFace: "Noto Sans SC",
    });
  });
}

/** V104: 场景页全页布局 — AI实景图占满页面，底部标注"以上为品牌视觉氛围示意"
 *  去掉下半部分的Logo应用规范mockup，实景图全页展示更美观
 */
function renderMixedLayout(
  slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC,
  type: string, industry: IndustryType,
  pageImages: [string, string][], cx: number, logoForScene?: string | null
): void {
  const labels = getSceneLabels(industry, type);
  const sceneLabels = (opts as any).sceneLabels || {};

  // 全页展示：最多2张AI场景图，高度占满页面
  const maxImgs = Math.min(pageImages.length, 2);
  const imgW = (CONTENT_W - 0.3) / maxImgs;
  const FULL_H = 5.2;
  const IMG_Y = 1.8;

  for (let i = 0; i < maxImgs; i++) {
    const [key, imgData] = pageImages[i];
    const imgX = cx + i * (imgW + 0.3);

    // 图片背景框
    slide.addShape("rect", {
      x: imgX, y: IMG_Y, w: imgW, h: FULL_H,
      fill: { color: "F8F8F8" }, rectRadius: 0.08,
      shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.12 },
    });

    // 插入AI写实图
    {
      const f = fitInBox(imgData, imgX, IMG_Y, imgW, FULL_H);
      slide.addImage({ data: normImg(imgData), x: f.x, y: f.y, w: f.w, h: f.h, rounding: true });
    }

    // 右下角Logo水印
    if (logoForScene) {
      slide.addImage({
        data: normImg(logoForScene),
        x: imgX + imgW - 0.65, y: IMG_Y + FULL_H - 0.65, w: 0.5, h: 0.5,
        sizing: { type: "contain", w: 0.5, h: 0.5 },
        transparency: 40,
      });
    }

    // 品牌色底部条
    slide.addShape("rect", { x: imgX, y: IMG_Y + FULL_H - 0.08, w: imgW, h: 0.08, fill: { color: bc.pri, transparency: 30 } });

    // 场景标注
    const label = sceneLabels[key] || labels[i] || key;
    slide.addText(label, { x: imgX, y: IMG_Y + FULL_H + 0.15, w: imgW, h: 0.35, fontSize: 12, bold: true, color: "333333", align: "center", lineSpacingMultiple: 1.3 });
  }

  // "品牌视觉氛围示意"标注
  slide.addText("以上为品牌视觉氛围示意", {
    x: cx, y: IMG_Y + FULL_H + 0.65, w: CONTENT_W, h: 0.3,
    fontSize: 12, bold: true, color: "#" + bc.acc, align: "center",
  });
}

/** V100: Logo精确应用示范 — 用真实Logo图片贴到mockup上 */
function renderLogoStandardDemo(
  slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC,
  type: string, industry: IndustryType, cx: number, startY: number
): void {
  const logoData = opts.logoData;
  const cn = opts.companyName || "品牌";

  // 分隔线 + 小标题
  slide.addShape("rect", { x: cx, y: startY - 0.12, w: CONTENT_W, h: 0.02, fill: { color: bc.pri, transparency: 60 } });
  slide.addText("Logo 应用规范", { x: cx, y: startY - 0.08, w: CONTENT_W, h: 0.25, fontSize: 18, bold: true, color: bc.pri, align: "right" });

  const BOT_AREA_Y = startY + 0.25;

  if (type === "stationery") {
    // 文具/名片 — 展示名片正面
    const nw = 4.0, nh = 2.2;
    const nx = cx + (CONTENT_W - nw) / 2, ny = BOT_AREA_Y;
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: "FFFFFF" }, rectRadius: 0.06, shadow: { type: "outer", blur: 4, offset: 2, color: "000000", opacity: 0.08 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: nx, y: ny, w: 0.10, h: nh, fill: { color: bc.pri } });
    if (logoData) slide.addImage({ data: normImg(logoData), x: nx + 0.25, y: ny + 0.2, w: 0.8, h: 0.8, sizing: { type: "contain", w: 0.8, h: 0.8 } });
    slide.addText(cn, { x: nx + 1.7, y: ny + 0.25, w: 2.0, h: 0.30, fontSize: 13, bold: true, color: "333333" });
    const locInfo = [opts.city, opts.province].filter(Boolean).join(" · ");
    if (locInfo) slide.addText(locInfo, { x: nx + 1.7, y: ny + 0.55, w: 2.0, h: 0.22, fontSize: 10, color: "666666" });
    if (opts.phone) slide.addText("TEL " + opts.phone, { x: nx + 1.7, y: ny + 0.78, w: 2.0, h: 0.22, fontSize: 10, color: "666666" });
    slide.addShape("rect", { x: nx + 0.25, y: ny + nh - 0.35, w: nw - 0.5, h: 0.03, fill: { color: bc.acc } });
    slide.addText("名片（正面）", { x: nx, y: ny + nh + 0.05, w: nw, h: 0.22, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    // 包装 — 展示手提袋
    const bw = 2.8, bh = 3.4;
    const bx = cx + (CONTENT_W - bw) / 2, by = BOT_AREA_Y;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.12 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.18, fill: { color: bc.priDark }, rectRadius: 0.05 });
    // 提手
    slide.addShape("line", { x: bx + 0.65, y: by - 0.22, w: 0, h: 0.26, line: { color: bc.priDark, width: 2 } });
    slide.addShape("line", { x: bx + bw - 0.65, y: by - 0.22, w: 0, h: 0.26, line: { color: bc.priDark, width: 2 } });
    if (logoData) slide.addImage({ data: normImg(logoData), x: bx + 0.6, y: by + 0.45, w: 1.6, h: 1.6, sizing: { type: "contain", w: 1.6, h: 1.6 } });
    slide.addText(cn, { x: bx, y: by + 2.3, w: bw, h: 0.35, fontSize: 13, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.35, y: by + 2.8, w: bw - 0.7, h: 0.03, fill: { color: bc.acc } });
    slide.addText("手提袋", { x: bx, y: by + bh + 0.05, w: bw, h: 0.22, fontSize: 12, color: "999999", align: "center" });
  } else {
    // 营销 — 展示海报
    const pw = 3.2, ph = 3.4;
    const px = cx + (CONTENT_W - pw) / 2, py = BOT_AREA_Y;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.1 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.4, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (logoData) slide.addImage({ data: normImg(logoData), x: px + pw/2 - 0.425, y: py + 0.25, w: 0.85, h: 0.85, sizing: { type: "contain", w: 0.85, h: 0.85 } });
    slide.addShape("rect", { x: px + 0.4, y: py + ph * 0.4 + 0.6, w: pw - 0.8, h: 0.03, fill: { color: bc.acc } });
    slide.addText("海报 / 宣传页", { x: px, y: py + ph + 0.05, w: pw, h: 0.22, fontSize: 12, color: "999999", align: "center" });
  }
}

/** V6: 使用AI写实图的场景页 */
function renderSceneWithImages(
  slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC,
  type: string, industry: IndustryType,
  pageImages: [string, string][], cx: number, logoForScene?: string | null
): void {
  // 获取行业场景标注
  const labels = getSceneLabels(industry, type);
  const sceneLabels = (opts as any).sceneLabels || {};

  if (pageImages.length <= 2) {
    // 1-2张图：大图并排 — V7: 图片占版面60%+
    const imgW = (CONTENT_W - 0.3) / Math.min(pageImages.length, 2);
    const imgH = Math.min(imgW * 1.5, 6.5);  // V8: 竖版2:3比例(1024*1536)，最高6.5英寸
    const startY = 1.8;

    for (let i = 0; i < pageImages.length; i++) {
      const [key, imgData] = pageImages[i];
      const imgX = cx + i * (imgW + 0.3);

      // 图片背景框
      slide.addShape("rect", {
        x: imgX, y: startY, w: imgW, h: imgH,
        fill: { color: "F8F8F8" }, rectRadius: 0.08,
        shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.12 },
      });

      // 插入AI写实图
      {
        const f = fitInBox(imgData, imgX, startY, imgW, imgH);
        slide.addImage({ data: normImg(imgData), x: f.x, y: f.y, w: f.w, h: f.h, rounding: true });
      }
      // V99: 在场景图右下角叠加Logo水印，确认Logo一致性
      if (logoForScene) {
        slide.addImage({
          data: normImg(logoForScene),
          x: imgX + imgW - 0.7, y: startY + imgH - 0.7, w: 0.55, h: 0.55,
          sizing: { type: "contain", w: 0.55, h: 0.55 },
          transparency: 40,
        });
      }

      // 品牌色底部条
      slide.addShape("rect", { x: imgX, y: startY + imgH - 0.08, w: imgW, h: 0.08, fill: { color: bc.pri, transparency: 30 } });


      // 标注文字
      const label = sceneLabels[key] || labels[i] || key;
      slide.addText(sanitizeText(label), { x: imgX, y: startY + imgH + 0.1, w: imgW, h: 0.35, fontSize: 14, bold: true, color: "333333", align: "center" });
    }
  } else {
    // 3+张图：网格布局（2列）— V7: 图片放大
    const colW = (CONTENT_W - 0.3) / 2;
    const imgH = Math.min(colW * 1.4, 5.0);  // V8: 竖版2:3比例(1024*1536)
    const startY = 1.8;
    let row = 0, col = 0;

    for (let i = 0; i < Math.min(pageImages.length, 6); i++) {
      const [key, imgData] = pageImages[i];
      const imgX = cx + col * (colW + 0.3);
      const imgY = startY + row * (imgH + 0.7);

      // 图片背景框
      slide.addShape("rect", {
        x: imgX, y: imgY, w: colW, h: imgH,
        fill: { color: "F8F8F8" }, rectRadius: 0.08,
        shadow: { type: "outer", blur: 4, offset: 2, color: "000000", opacity: 0.1 },
      });

      // 插入AI写实图
      {
        const f = fitInBox(imgData, imgX, imgY, colW, imgH);
        slide.addImage({ data: normImg(imgData), x: f.x, y: f.y, w: f.w, h: f.h, rounding: true });
      }
      // V99: 在场景图右下角叠加Logo水印
      if (logoForScene) {
        slide.addImage({
          data: normImg(logoForScene),
          x: imgX + colW - 0.65, y: imgY + imgH - 0.65, w: 0.5, h: 0.5,
          sizing: { type: "contain", w: 0.5, h: 0.5 },
          transparency: 40,
        });
      }

      // 品牌色底部条
      slide.addShape("rect", { x: imgX, y: imgY + imgH - 0.06, w: colW, h: 0.06, fill: { color: bc.pri, transparency: 30 } });

      // 标注
      const label = sceneLabels[key] || labels[i] || key;
      slide.addText(label, { x: imgX, y: imgY + imgH + 0.08, w: colW, h: 0.3, fontSize: 12, color: "555555", align: "center" });

      col++;
      if (col >= 2) { col = 0; row++; }
    }
  }
}

/** 获取行业场景标注文字 */
function getSceneLabels(industry: IndustryType, type: string): string[] {
  const labelMap: Record<IndustryType, Record<string, string[]>> = {
    restaurant: {
      stationery: ["餐巾纸套 / 筷子套", "围裙 / 工服"],
      packaging: ["外卖袋 / 手提袋", "打包盒", "菜单封面"],
      marketing: ["促销海报 / 展架", "评价卡 / 立牌"],
    },
    beverage: {
      stationery: ["杯套 / 外带杯", "围裙"],
      packaging: ["手提袋", "外卖包装", "价目表"],
      marketing: ["促销海报", "会员卡"],
    },
    beauty: {
      stationery: ["产品包装瓶", "预约卡"],
      packaging: ["礼品袋", "产品标签", "会员卡"],
      marketing: ["促销海报", "价目表"],
    },
    fashion: {
      stationery: ["服装吊牌", "价格标签"],
      packaging: ["购物袋", "鞋盒", "礼品包装"],
      marketing: ["新品海报", "橱窗展示卡"],
    },
    mother_baby: {
      stationery: ["产品标签", "安全认证贴"],
      packaging: ["奶罐标签", "童装吊牌", "礼盒"],
      marketing: ["妈妈推荐卡", "成长记录卡"],
    },
    wedding: {
      stationery: ["请柬", "席位卡"],
      packaging: ["喜糖盒", "伴手礼袋", "相册包装"],
      marketing: ["婚礼展架", "电子请柬封面"],
    },
    fitness: {
      stationery: ["会员卡", "运动毛巾标签"],
      packaging: ["水杯贴标", "运动包", "补给袋"],
      marketing: ["健身海报", "课程表"],
    },
    pharmacy: {
      stationery: ["药品标签", "处方笺"],
      packaging: ["药袋", "保健品盒", "健康提示卡"],
      marketing: ["健康宣传单", "诊所立牌"],
    },
    pet: {
      stationery: ["项圈标签", "疫苗卡"],
      packaging: ["宠物食品袋", "零食包装", "寄养牌"],
      marketing: ["宠物海报", "服务价目表"],
    },
    retail: {
      stationery: ["名片", "价格标签"],
      packaging: ["购物袋", "产品包装盒", "礼品包装"],
      marketing: ["促销海报", "货架卡"],
    },
    education: {
      stationery: ["学员证 / 工牌", "信纸"],
      packaging: ["手提袋", "课程文件夹", "信封"],
      marketing: ["招生海报", "活动展架"],
    },
    general: {
      stationery: ["名片", "信纸"],
      packaging: ["手提袋", "产品包装盒", "信封"],
      marketing: ["宣传海报", "工牌 / 胸卡"],
    },
  };
  return labelMap[industry]?.[type] || ["场景应用", "品牌延展"];
}

// 004: 统一无 AI 场景图回退卡片的边框、圆角与阴影参数
const FALLBACK_CARD_RADIUS = 0.08;
const FALLBACK_CARD_SHADOW = { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.12 };
const FALLBACK_CARD_LINE = { color: "E0E0E0", width: 0.5 };

/** 降级：无AI图时的色块方案 */
function renderSceneFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, industry: IndustryType, cx: number): void {
  switch (industry) {
    case "restaurant": renderRestaurantFallback(slide, opts, bc, type, cx); break;
    case "beverage": renderBeverageFallback(slide, opts, bc, type, cx); break;
    case "beauty": renderBeautyFallback(slide, opts, bc, type, cx); break;
    case "fashion": renderFashionFallback(slide, opts, bc, type, cx); break;
    case "mother_baby": renderMotherBabyFallback(slide, opts, bc, type, cx); break;
    case "wedding": renderWeddingFallback(slide, opts, bc, type, cx); break;
    case "fitness": renderFitnessFallback(slide, opts, bc, type, cx); break;
    case "pharmacy": renderPharmacyFallback(slide, opts, bc, type, cx); break;
    case "pet": renderPetFallback(slide, opts, bc, type, cx); break;
    case "retail": renderRetailFallback(slide, opts, bc, type, cx); break;
    default: renderGeneralFallback(slide, opts, bc, type, cx);
  }
}

// ========== 餐饮降级 ==========
function renderRestaurantFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    // 餐巾纸套
    const nw = 4.5, nh = 1.8, nx = (SW - nw) / 2, ny = 2.2;
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: bc.pri, transparency: 8 }, rectRadius: 0.06 });
    slide.addShape("rect", { x: nx, y: ny, w: 0.12, h: nh, fill: { color: bc.priDark } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (nx + 0.3) + 0.250, y: ny + 0.2, w: 0.80, h: 0.80, sizing: { type: "contain", w: 0.80, h: 0.80 } });
    slide.addText(opts.companyName || "品牌", { x: nx + 1.8, y: ny + 0.2, w: 2.2, h: 0.5, fontSize: 17, bold: true, color: "333333" });
    slide.addText("优质餐巾纸 · 用心服务", { x: nx + 1.8, y: ny + 0.8, w: 2.2, h: 0.35, fontSize: 12, color: "888888" });
    slide.addShape("rect", { x: nx + 0.3, y: ny + nh - 0.35, w: nw - 0.6, h: 0.04, fill: { color: bc.acc } });
    slide.addText("餐巾纸套", { x: nx, y: ny + nh + 0.1, w: nw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    // 外卖袋
    const bw = 3.5, bh = 4.2, bx = (SW - bw) / 2, by = 2.2;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addShape("line", { x: bx + 0.8, y: by - 0.3, w: 0, h: 0.4, line: { color: bc.priDark, width: 2.5 } });
    slide.addShape("line", { x: bx + bw - 0.8, y: by - 0.3, w: 0, h: 0.4, line: { color: bc.priDark, width: 2.5 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.25, fill: { color: bc.priDark }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.5) + 0.250, y: by + 0.6, w: 2.00, h: 2.00, sizing: { type: "contain", w: 2.00, h: 2.00 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("外卖袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    // 促销海报
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.2;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.45, fill: { color: bc.pri }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 1.2) + 0.250, y: py + 0.5, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 } });
    slide.addText("限时特惠", { x: px + 0.5, y: py + ph * 0.45 + 0.3, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "333333" });
    slide.addText("会员专享优惠活动", { x: px + 0.5, y: py + ph * 0.45 + 1.0, w: pw - 1.0, h: 0.4, fontSize: 13, color: "888888" });
    slide.addShape("rect", { x: px + 0.5, y: py + ph * 0.45 + 1.6, w: 1.5, h: 0.04, fill: { color: bc.acc } });
    slide.addText("促销海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 茶饮降级 ==========
function renderBeverageFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const cw = 3.0, ch = 4.5, cX = (SW - cw) / 2, cy = 2.0;
    slide.addShape("rect", { x: cX, y: cy, w: cw, h: ch, fill: { color: bc.priLight }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addShape("rect", { x: cX, y: cy, w: cw, h: ch * 0.4, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addShape("ellipse", { x: cX + cw / 2 - 0.7, y: cy + 0.3, w: 1.4, h: 1.4, fill: { color: "FFFFFF" }, line: { color: "E0E0E0", width: 0.5 } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: cX + cw / 2 - 0.5, y: cy + 0.5, w: 1.0, h: 1.0, sizing: { type: "contain", w: 1.0, h: 1.0 } });
    slide.addText(opts.companyName || "品牌", { x: cX, y: cy + 2.0, w: cw, h: 0.4, fontSize: 17, bold: true, color: "333333", align: "center" });
    slide.addShape("rect", { x: cX + 0.5, y: cy + 2.6, w: cw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("外带杯 / 杯套", { x: cX, y: cy + ch + 0.1, w: cw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.0, bx = (SW - bw) / 2, by = 2.2;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.25, fill: { color: bc.priDark }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.5) + 0.250, y: by + 0.6, w: 2.00, h: 2.00, sizing: { type: "contain", w: 2.00, h: 2.00 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("手提袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 4.0, ph = 5.5, px = (SW - pw) / 2, py = 2.2;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addText("限时优惠", { x: px + 0.5, y: py + 0.5, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: px + 0.5, y: py + 1.3, w: pw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("第二杯半价", { x: px, y: py + 1.6, w: pw, h: 0.4, fontSize: 17, color: "FFFFFF", align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 0.6) + 0.400, y: py + 2.5, w: 1.00, h: 1.00, sizing: { type: "contain", w: 1.00, h: 1.00 }, transparency: 10 });
    slide.addText("促销卡", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 美容降级 ==========
function renderBeautyFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const aw = 3.8, ah = 2.4, ax = (SW - aw) / 2, ay = 2.0;
    slide.addShape("rect", { x: ax, y: ay, w: aw, h: ah, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: ax, y: ay, w: aw, h: 0.08, fill: { color: bc.pri } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (ax + 0.3) + 0.200, y: ay + 0.2, w: 0.60, h: 0.60, sizing: { type: "contain", w: 0.60, h: 0.60 } });
    slide.addText("预约卡", { x: ax + 1.5, y: ay + 0.2, w: 2.0, h: 0.4, fontSize: 17, bold: true, color: bc.pri });
    slide.addText("预约日期：____年____月____日\n预约项目：________________\n预约技师：________________", { x: ax + 0.3, y: ay + 1.0, w: aw - 0.6, h: 1.0, fontSize: 12, color: "666666", lineSpacingMultiple: 1.6 });
    slide.addText("预约卡", { x: ax, y: ay + ah + 0.1, w: aw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const gw = 3.2, gh = 4.0, gx = (SW - gw) / 2, gy = 2.0;
    slide.addShape("rect", { x: gx, y: gy, w: gw, h: gh, fill: { color: bc.priLight }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: gx, y: gy, w: gw, h: 0.2, fill: { color: bc.pri } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (gx + 0.5) + 0.350, y: gy + 0.6, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 }, transparency: 5 });
    slide.addText("礼品袋", { x: gx, y: gy + gh + 0.1, w: gw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 3.5, ph = 5.5, px = 0.8, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 1.0, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addText("服务价目表", { x: px, y: py + 0.2, w: pw, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", align: "center" });
    slide.addText("促销海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 零售降级 ==========
function renderRetailFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const nw = 3.8, nh = 2.4, nx = (SW - nw) / 2, ny = 2.0;
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: nx, y: ny, w: 0.12, h: nh, fill: { color: bc.pri } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (nx + 0.3) + 0.250, y: ny + 0.2, w: 0.80, h: 0.80, sizing: { type: "contain", w: 0.80, h: 0.80 } });
    slide.addText("名片", { x: nx, y: ny + nh + 0.1, w: nw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.0, bx = (SW - bw) / 2, by = 2.2;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.25, fill: { color: bc.priDark }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.5) + 0.350, y: by + 0.6, w: 1.80, h: 1.80, sizing: { type: "contain", w: 1.80, h: 1.80 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.6, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.2, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("购物袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.45, fill: { color: bc.pri }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 1.2) + 0.250, y: py + 0.5, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 } });
    slide.addText("限时特惠", { x: px + 0.5, y: py + ph * 0.45 + 0.3, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "333333" });
    slide.addText("促销海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}


// ========== 服装降级 ==========
function renderFashionFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const tw = 2.5, th = 4.0, tx = (SW - tw) / 2, ty = 2.2;
    slide.addShape("rect", { x: tx, y: ty, w: tw, h: th, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("ellipse", { x: tx + tw / 2 - 0.12, y: ty + 0.2, w: 0.24, h: 0.24, fill: { color: "FFFFFF" }, line: { color: bc.pri, width: 1 } });
    slide.addShape("rect", { x: tx, y: ty, w: tw, h: 0.08, fill: { color: bc.pri } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (tx + 0.4) + 0.250, y: ty + 0.6, w: 1.20, h: 1.20, sizing: { type: "contain", w: 1.20, h: 1.20 } });
    slide.addText(opts.companyName || "品牌", { x: tx, y: ty + 2.0, w: tw, h: 0.4, fontSize: 15, bold: true, color: "333333", align: "center" });
    slide.addShape("rect", { x: tx + 0.4, y: ty + 2.5, w: tw - 0.8, h: 0.04, fill: { color: bc.acc } });
    slide.addText("服装吊牌", { x: tx, y: ty + th + 0.1, w: tw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.2, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.2, fill: { color: bc.priDark }, rectRadius: 0.05 });
    slide.addShape("line", { x: bx + 0.8, y: by - 0.3, w: 0, h: 0.4, line: { color: bc.sec, width: 2 } });
    slide.addShape("line", { x: bx + bw - 0.8, y: by - 0.3, w: 0, h: 0.4, line: { color: bc.sec, width: 2 } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.6) + 0.250, y: by + 0.8, w: 1.80, h: 1.80, sizing: { type: "contain", w: 1.80, h: 1.80 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("购物袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.2;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.5, fill: { color: bc.pri }, rectRadius: 0.05 });
    slide.addText("NEW ARRIVAL", { x: px + 0.5, y: py + 0.5, w: 3.0, h: 0.6, fontSize: 22, bold: true, color: bc.sec });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 1.5) + 0.350, y: py + 1.5, w: 0.80, h: 0.80, sizing: { type: "contain", w: 0.80, h: 0.80 }, transparency: 10 });
    slide.addText("新品上市", { x: px + 0.5, y: py + ph * 0.5 + 0.4, w: pw - 1.0, h: 0.6, fontSize: 20, bold: true, color: "333333" });
    slide.addText("新品海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 母婴降级 ==========
function renderMotherBabyFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const sw = 3.8, sh = 2.2, sx = (SW - sw) / 2, sy = 2.2;
    slide.addShape("rect", { x: sx, y: sy, w: sw, h: sh, fill: { color: bc.priLight }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addShape("rect", { x: sx, y: sy, w: sw, h: 0.08, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (sx + 0.3) + 0.200, y: sy + 0.3, w: 0.80, h: 0.80, sizing: { type: "contain", w: 0.80, h: 0.80 } });
    slide.addText(opts.companyName || "品牌", { x: sx + 1.6, y: sy + 0.3, w: 2.0, h: 0.4, fontSize: 15, bold: true, color: bc.pri });
    slide.addText("安全认证", { x: sx + 0.3, y: sy + 1.2, w: sw - 0.6, h: 0.3, fontSize: 12, color: "666666" });
    slide.addText("安全认证贴", { x: sx, y: sy + sh + 0.1, w: sw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.0, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addShape("rect", { x: bx + 0.2, y: by + 0.2, w: bw - 0.4, h: 0.3, fill: { color: bc.acc }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.5) + 0.250, y: by + 0.8, w: 2.00, h: 2.00, sizing: { type: "contain", w: 2.00, h: 2.00 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 3.0, w: bw, h: 0.4, fontSize: 15, bold: true, color: "FFFFFF", align: "center" });
    slide.addText("母婴礼盒", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 3.5, ph = 5.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 1.2, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addText("妈妈推荐", { x: px, y: py + 0.3, w: pw, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 0.6) + 0.400, y: py + 1.6, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 } });
    slide.addText("推荐卡", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 婚庆降级 ==========
function renderWeddingFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const cw = 4.5, ch = 3.0, cx2 = (SW - cw) / 2, cy = 2.0;
    slide.addShape("rect", { x: cx2, y: cy, w: cw, h: ch, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: cx2 + 0.2, y: cy + 0.2, w: cw - 0.4, h: ch - 0.4, fill: { color: "FFFFFF" }, rectRadius: 0.04, line: { color: bc.pri, width: 0.5, dashType: "dash" } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (cx2 + 1.5) + 0.350, y: cy + 0.4, w: 0.80, h: 0.80, sizing: { type: "contain", w: 0.80, h: 0.80 } });
    slide.addText("婚礼邀请", { x: cx2, y: cy + 1.4, w: cw, h: 0.5, fontSize: 22, bold: true, color: bc.pri, align: "center" });
    slide.addShape("rect", { x: cx2 + 1.0, y: cy + 2.1, w: cw - 2.0, h: 0.04, fill: { color: bc.sec } });
    slide.addText("请柬", { x: cx2, y: cy + ch + 0.1, w: cw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.0, bh = 3.5, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.priLight }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: bx + 0.15, y: by + 0.15, w: bw - 0.3, h: 0.6, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.5) + 0.400, y: by + 1.0, w: 1.20, h: 1.20, sizing: { type: "contain", w: 1.20, h: 1.20 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.4, w: bw, h: 0.4, fontSize: 14, bold: true, color: bc.pri, align: "center" });
    slide.addText("喜糖盒", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 3.5, ph = 5.5, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.4, fill: { color: bc.priLight }, rectRadius: 0.05 });
    slide.addText("婚礼策划", { x: px + 0.3, y: py + 0.5, w: pw - 0.6, h: 0.5, fontSize: 20, bold: true, color: bc.pri, align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 0.5) + 0.500, y: py + 2.6, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 } });
    slide.addText("展架", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 健身降级 ==========
function renderFitnessFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const cw = 4.5, ch = 2.6, cx2 = (SW - cw) / 2, cy = 2.2;
    slide.addShape("rect", { x: cx2, y: cy, w: cw, h: ch, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (cx2 + 0.3) + 0.200, y: cy + 0.2, w: 0.80, h: 0.80, sizing: { type: "contain", w: 0.80, h: 0.80 } });
    slide.addText("MEMBERSHIP", { x: cx2 + 1.6, y: cy + 0.2, w: 2.5, h: 0.4, fontSize: 13, bold: true, color: bc.acc });
    slide.addText(opts.companyName || "品牌", { x: cx2 + 1.6, y: cy + 0.6, w: 2.5, h: 0.3, fontSize: 12, color: "FFFFFF" });
    slide.addShape("rect", { x: cx2 + 0.3, y: cy + 1.4, w: cw - 0.6, h: 0.04, fill: { color: bc.acc } });
    slide.addText("会员卡", { x: cx2, y: cy + ch + 0.1, w: cw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.0, bh = 4.5, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 1.5, fill: { color: bc.pri }, rectRadius: 0.08 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.5) + 0.500, y: by + 0.2, w: 1.00, h: 1.00, sizing: { type: "contain", w: 1.00, h: 1.00 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 1.8, w: bw, h: 0.4, fontSize: 15, bold: true, color: "333333", align: "center" });
    slide.addText("运动水杯", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addText("FITNESS", { x: px + 0.5, y: py + 0.5, w: pw - 1.0, h: 0.8, fontSize: 32, bold: true, color: "FFFFFF" });
    slide.addShape("rect", { x: px + 0.5, y: py + 1.5, w: pw - 1.0, h: 0.04, fill: { color: bc.acc } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 1.0) + 0.500, y: py + 2.0, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 }, transparency: 10 });
    slide.addText("新会员限时特惠", { x: px + 0.5, y: py + 4.0, w: pw - 1.0, h: 0.4, fontSize: 15, color: bc.acc });
    slide.addText("健身海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 药店降级 ==========
function renderPharmacyFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const pw = 4.5, ph = 3.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 0.5, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 0.2, y: py + 0.08, w: 0.35, h: 0.35, sizing: { type: "contain", w: 0.35, h: 0.35 } });
    slide.addText("处方笺", { x: px + 0.6, y: py + 0.08, w: 2.0, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });
    slide.addText("姓名：______ 诊断：______", { x: px + 0.3, y: py + 0.8, w: pw - 0.6, h: 0.8, fontSize: 12, color: "666666", lineSpacingMultiple: 1.6 });
    slide.addText("处方笺", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.0, bh = 4.0, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.8, fill: { color: bc.priLight }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.3, y: by + 0.1, w: 0.6, h: 0.6, sizing: { type: "contain", w: 0.6, h: 0.6 } });
    slide.addText(opts.companyName || "品牌", { x: bx + 1.0, y: by + 0.15, w: 1.8, h: 0.3, fontSize: 13, bold: true, color: bc.pri });
    slide.addText("用法用量：____________", { x: bx + 0.3, y: by + 1.2, w: bw - 0.6, h: 0.8, fontSize: 12, color: "666666", lineSpacingMultiple: 1.6 });
    slide.addText("药袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 1.5, fill: { color: bc.pri }, rectRadius: 0.05 });
    slide.addText("健康资讯", { x: px + 0.5, y: py + 0.3, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "FFFFFF", align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 1.2) + 0.250, y: py + 1.8, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 } });
    slide.addText("专业值得信赖", { x: px + 0.5, y: py + 3.8, w: pw - 1.0, h: 0.4, fontSize: 15, color: bc.pri, align: "center" });
    slide.addText("宣传单", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 宠物降级 ==========
function renderPetFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const cw = 4.0, ch = 2.6, cx2 = (SW - cw) / 2, cy = 2.2;
    slide.addShape("rect", { x: cx2, y: cy, w: cw, h: ch, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: cx2, y: cy, w: cw, h: 0.6, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addText("疫苗记录卡", { x: cx2 + 0.3, y: cy + 0.1, w: 3.0, h: 0.4, fontSize: 15, bold: true, color: "FFFFFF" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: cx2 + cw - 1.0, y: cy + 0.1, w: 0.4, h: 0.4, sizing: { type: "contain", w: 0.4, h: 0.4 } });
    slide.addText("宠物名：______ 品种：______", { x: cx2 + 0.3, y: cy + 0.9, w: cw - 0.6, h: 0.8, fontSize: 12, color: "666666", lineSpacingMultiple: 1.6 });
    slide.addText("疫苗卡", { x: cx2, y: cy + ch + 0.1, w: cw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.5, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.25, fill: { color: bc.priDark }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.5) + 0.250, y: by + 0.6, w: 2.00, h: 2.00, sizing: { type: "contain", w: 2.00, h: 2.00 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("宠物食品袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 4.0, ph = 5.5, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: bc.priLight }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 0.8, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addText("服务价目", { x: px, y: py + 0.15, w: pw, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 1.0) + 0.250, y: py + 1.2, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 } });
    slide.addText("洗澡 · 寄养 · 美容 · 疫苗", { x: px + 0.3, y: py + 3.2, w: pw - 0.6, h: 0.3, fontSize: 12, color: "666666", align: "center" });
    slide.addText("服务价目表", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== 通用降级 ==========
function renderGeneralFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const nw = 3.8, nh = 2.4, nx = (SW - nw) / 2, ny = 2.2;
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: nx, y: ny, w: 0.12, h: nh, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (nx + 0.3) + 0.350, y: ny + 0.25, w: 0.80, h: 0.80, sizing: { type: "contain", w: 0.80, h: 0.80 } });
    slide.addText("名片", { x: nx, y: ny + nh + 0.1, w: nw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.0, bx = (SW - bw) / 2, by = 2.2;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (bx + 0.5) + 0.250, y: by + 0.6, w: 2.00, h: 2.00, sizing: { type: "contain", w: 2.00, h: 2.00 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("手提袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.2;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: FALLBACK_CARD_RADIUS, shadow: FALLBACK_CARD_SHADOW, line: FALLBACK_CARD_LINE });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.45, fill: { color: bc.pri }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: (px + 1.2) + 0.250, y: py + 0.5, w: 1.50, h: 1.50, sizing: { type: "contain", w: 1.50, h: 1.50 } });
    slide.addText("品牌宣传", { x: px + 0.5, y: py + ph * 0.45 + 0.3, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "333333" });
    slide.addText("海报 / 宣传页", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 12, color: "999999", align: "center" });
  }
}

// ========== Table of Contents — V7新增 / 004分区 ==========

export interface TocItem {
  section: "基础规范" | "应用系统" | "IP公仔" | "收尾";
  title: string;
  pageId: string;
}

// 工单 086-R1：目录顺序修正为 基础规范 → 应用系统 → 收尾 → IP 章节（各一次不重复）。
const TOC_SECTION_ORDER: TocItem["section"][] = ["基础规范", "应用系统", "收尾", "IP公仔"];

function renderTocGroup(
  slide: PptxGenJS.Slide, section: TocItem["section"], items: TocItem[],
  x: number, yStart: number, colWidth: number, bc: BC, pageNumberMap: Record<string, number>
): number {
  const headerH = 0.5;
  const itemH = 0.42;
  slide.addText(section, { x, y: yStart, w: colWidth, h: headerH, fontSize: 14, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });
  slide.addShape("rect", { x, y: yStart + headerH - 0.14, w: 0.65, h: 0.035, fill: { color: bc.acc } });
  let y = yStart + headerH;
  for (const item of items) {
    slide.addText(item.title, { x, y, w: colWidth - 0.7, h: itemH, fontSize: 12, color: "333333", fontFace: "Noto Sans SC", valign: "middle" });
    slide.addText("...........................................", { x, y, w: colWidth - 0.7, h: itemH, fontSize: 8, color: "CCCCCC", align: "right", valign: "middle" });
    const realPageNum = pageNumberMap[item.pageId] || 0;
    slide.addText(realPageNum > 0 ? String(realPageNum) : "", { x: x + colWidth - 0.5, y, w: 0.5, h: itemH, fontSize: 12, color: "999999", align: "right", valign: "middle" });
    y += itemH;
  }
  return y;
}

function renderTableOfContents(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType, pageNumberMap: Record<string, number>): void {
  addContentFrame(slide, "目录", bc);
  const cn = opts.companyName || "品牌";
  const cx = MARGIN + LEFT_BAR_W + 0.5;

  // 品牌名
  slide.addText(cn, { x: cx, y: 1.6, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });
  slide.addShape("rect", { x: cx, y: 2.15, w: 1.5, h: 0.04, fill: { color: bc.acc } });

  // 动态过滤：只显示实际存在于手册中的页面；无 IP 时整区消失
  const tocItems = getTocItems(industry, opts.sceneSectionTitles)
    .filter((item) => pageNumberMap[item.pageId] !== undefined);
  const groups = TOC_SECTION_ORDER
    .map((section) => ({ section, items: tocItems.filter((item) => item.section === section) }))
    .filter((group) => group.items.length > 0);
  const totalRows = groups.reduce((sum, group) => sum + 1 + group.items.length, 0);
  const colCount = totalRows > 15 && groups.length > 1 ? 2 : 1;
  const colWidth = colCount === 2 ? (CONTENT_W - 0.5) / 2 : CONTENT_W;
  const colGap = 0.5;
  const sectionGap = 0.2;
  const startY = 2.45;

  if (colCount === 1) {
    let y = startY;
    for (const group of groups) {
      y = renderTocGroup(slide, group.section, group.items, cx, y, colWidth, bc, pageNumberMap);
      y += sectionGap;
    }
    slide.addShape("rect", { x: cx, y, w: 3.0, h: 0.08, fill: { color: bc.pri, transparency: 40 } });
    return;
  }

  // 两栏：按顺序连续切分，整组分栏且不拆散同一分区；取高度差最小的切分点
  const groupHeight = (g: { section: TocItem["section"]; items: TocItem[] }) => 0.5 + g.items.length * 0.42 + sectionGap;
  const prefix: number[] = [];
  let totalH = 0;
  for (const group of groups) {
    totalH += groupHeight(group);
    prefix.push(totalH);
  }
  let splitK = Math.floor(groups.length / 2);
  for (let k = 1; k < groups.length; k++) {
    const left = prefix[k - 1];
    const right = totalH - left;
    const cur = Math.max(left, right);
    const best = Math.max(prefix[splitK - 1], totalH - prefix[splitK - 1]);
    if (cur < best) splitK = k;
  }
  const colGroups: { section: TocItem["section"]; items: TocItem[] }[][] = [
    groups.slice(0, splitK),
    groups.slice(splitK),
  ];
  let bottomY = startY;
  for (let col = 0; col < 2; col++) {
    const xOffset = cx + col * (colWidth + colGap);
    let y = startY;
    for (const group of colGroups[col]) {
      y = renderTocGroup(slide, group.section, group.items, xOffset, y, colWidth, bc, pageNumberMap);
      y += sectionGap;
    }
    if (y > bottomY) bottomY = y;
  }
  slide.addShape("rect", { x: cx, y: bottomY, w: 3.0, h: 0.08, fill: { color: bc.pri, transparency: 40 } });
}

export function getTocItems(industry: IndustryType, aiTitles?: Record<string, string> | null): TocItem[] {
  const configs = getSceneConfigs(industry, aiTitles);
  return [
    { section: "基础规范", title: "品牌核心理念", pageId: "brand-philosophy" },
    { section: "基础规范", title: "标识诠释", pageId: "logo-interpretation" },
    { section: "基础规范", title: "Logo组合规范", pageId: "logo-variations" },
    { section: "基础规范", title: "LOGO网格制图规范", pageId: "logo-grid" },
    { section: "基础规范", title: "辅助图形", pageId: "auxiliary-graphics" },
    { section: "基础规范", title: "辅助图形禁用规范", pageId: "aux-graphics-misuse" },
    { section: "基础规范", title: "标准色彩规范", pageId: "brand-colors" },
    { section: "基础规范", title: "色彩使用规范", pageId: "color-taboos" },
    { section: "基础规范", title: "字体系统", pageId: "typography" },
    { section: "基础规范", title: "字体版权说明", pageId: "font-copyright" },
    // 工单 086-R1：basic-spec 页条目名与分区名区分开，避免目录视觉重复。
    { section: "基础规范", title: "LOGO 保护空间与最小尺寸", pageId: "basic-spec" },
    { section: "基础规范", title: "Logo误用规范", pageId: "logo-misuse" },
    { section: "应用系统", title: configs.stationery.title, pageId: "stationery" },
    { section: "应用系统", title: configs.packaging.title, pageId: "packaging" },
    { section: "应用系统", title: configs.marketing.title, pageId: "marketing" },
    { section: "应用系统", title: "线上数字应用", pageId: "digital-media" },
    { section: "应用系统", title: "导视系统", pageId: "wayfinding" },
    { section: "IP公仔", title: "IP角色定位", pageId: "mascot-positioning" },
    { section: "IP公仔", title: "IP三视图", pageId: "mascot-threeview" },
    { section: "IP公仔", title: "IP表情库", pageId: "mascot-emotions" },
    { section: "IP公仔", title: "IP场景应用", pageId: "mascot-scenes" },
    { section: "IP公仔", title: "IP使用规范", pageId: "mascot-usage" },
    { section: "IP公仔", title: "IP公仔禁用规范", pageId: "mascot-misuse" },
    { section: "IP公仔", title: "IP公仔衍生品使用规范", pageId: "mascot-merchandise" },
    { section: "IP公仔", title: "IP公仔使用合规说明", pageId: "mascot-compliance" },
    { section: "收尾", title: "总结", pageId: "summary" },
    { section: "收尾", title: "VI物料落地清单", pageId: "material-priority" },
    { section: "收尾", title: "文件输出规范", pageId: "file-output" },
    { section: "收尾", title: "LOGO文件输出规范", pageId: "logo-output" },
    { section: "收尾", title: "VI修改权限说明", pageId: "modification-authority" },
  ];
}

// ========== Summary ==========
function renderSummary(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, "总结", bc);
  const cx = MARGIN + LEFT_BAR_W;

  const vision = sanitizeText(opts.brandVision || fta(bp, ["ph-vision-content","brand-vision-content","vision-content"]));
  if (vision && vision !== "待定") {
    slide.addShape("rect", { x: cx, y: 1.6, w: CONTENT_W, h: 1.4, fill: { color: bc.priLight }, rectRadius: 0.1 });
    slide.addText(`"${vision}"`, { x: cx + 0.3, y: 1.7, w: CONTENT_W - 0.6, h: 1.2, fontSize: 15, italic: true, color: bc.priDark, align: "center", lineSpacingMultiple: 1.5, valign: "middle" });
  }

  const pillars = [
    { label: "一致性", desc: "所有媒介输出必须严格遵守本手册规范，确保品牌在任何触点下都能被精准识别" },
    { label: "专业性", desc: "通过标准化的视觉语言建立客户信任，展现品牌作为行业专家的专业形象" },
    { label: "持续性", desc: "VI 系统是品牌长期发展的核心无形资产，是品牌价值持续积累的视觉载体" },
  ];
  let yPos = 3.5;
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    slide.addShape("roundRect", { x: cx + 0.2, y: yPos, w: 0.5, h: 0.5, fill: { color: bc.pri }, rectRadius: 0.25 });
    slide.addText(`${i + 1}`, { x: cx + 0.2, y: yPos, w: 0.5, h: 0.5, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
    slide.addText(p.label, { x: cx + 0.9, y: yPos, w: 2.5, h: 0.45, fontSize: 17, bold: true, color: bc.pri });
    slide.addText(p.desc, { x: cx + 0.9, y: yPos + 0.5, w: CONTENT_W - 1.1, h: 0.7, fontSize: 14, color: "555555", lineSpacingMultiple: 1.5 });
    yPos += 1.6;
  }
  // 客群感知 — closingCustomerPerception
  const perception = sanitizeText(opts.closingCustomerPerception || "");
  if (perception) {
    slide.addShape("rect", { x: cx, y: yPos + 0.3, w: CONTENT_W, h: 0.04, fill: { color: bc.acc } });
    slide.addText("客群感知", { x: cx, y: yPos + 0.45, w: CONTENT_W, h: 0.4, fontSize: 17, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });
    slide.addShape("rect", { x: cx, y: yPos + 0.9, w: CONTENT_W, h: 1.0, fill: { color: bc.priLight }, rectRadius: 0.08 });
    slide.addText(perception, { x: cx + 0.2, y: yPos + 0.95, w: CONTENT_W - 0.4, h: 0.9, fontSize: 13, color: bc.priDark, lineSpacingMultiple: 1.4, valign: "middle" });
  }
}

// ========== Generic ==========

async function renderMascotGallery(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): Promise<void> {
  const emo = opts.mascotEmotions;
  const sc = opts.mascotScenes;
  const threeView = opts.mascotThreeViewData;
  if (!emo && !sc && !threeView) { renderGeneric(slide, bp, opts, bc); return; }

  const emoKeys = emo ? Object.keys(emo) : [];
  const scKeys = sc ? Object.keys(sc) : [];
  const totalSlides = 1 + (emoKeys.length > 0 ? 1 : 0) + (scKeys.length > 0 ? Math.ceil(scKeys.length / 3) : 0);

  // Slide 1: 3-view sheet + emotions
  addSlideBase(slide, bp, bc);

  // Title
  const title = bp.elements?.find((e: any) => e.id === 'mascot-gallery-title')?.content || '公仔展示';
  slide.addText(title, { x: MARGIN, y: 0.4, w: CONTENT_W, h: 0.6, fontSize: 24, bold: true, color: bc.pri, fontFace: 'Noto Sans SC' });

  // Decorative line
  slide.addShape('rect', { x: MARGIN, y: 1.1, w: 1.2, h: 0.04, fill: { color: bc.sec }, rectRadius: 0.02 });

  // Mascot name & style
  const nameEl = bp.elements?.find((e: any) => e.id === 'mascot-name')?.content || '';
  const styleEl = bp.elements?.find((e: any) => e.id === 'mascot-style-info')?.content || '';
  if (nameEl) slide.addText(nameEl, { x: MARGIN, y: 1.3, w: CONTENT_W, h: 0.35, fontSize: 16, bold: true, color: '333333', fontFace: 'Noto Sans SC' });
  if (styleEl) slide.addText(styleEl, { x: MARGIN, y: 1.65, w: CONTENT_W, h: 0.3, fontSize: 12, color: '666666', fontFace: 'Noto Sans SC' });

  let yPos = 2.1;

  // 3-view sheet
  if (threeView) {
    slide.addText('三视图', { x: MARGIN, y: yPos, w: CONTENT_W, h: 0.35, fontSize: 14, bold: true, color: bc.pri, fontFace: 'Noto Sans SC' });
    const vw = 6.0, vh = 2.0;
    {
      const f = fitInBox(threeView, (SW - vw) / 2, yPos + 0.4, vw, vh);
      slide.addImage({ data: normImg(threeView), x: f.x, y: f.y, w: f.w, h: f.h });
    }
    yPos += vh + 0.6;
  }

  // Emotion gallery
  if (emoKeys.length > 0) {
    if (yPos > 6.0) { yPos = 2.0; }
    slide.addText('表情库', { x: MARGIN, y: yPos, w: CONTENT_W, h: 0.35, fontSize: 14, bold: true, color: bc.pri, fontFace: 'Noto Sans SC' });
    yPos += 0.4;
    const emoSize = 1.2, emoGap = 0.15, emoStartX = MARGIN;
    const maxPerRow = Math.floor(CONTENT_W / (emoSize + emoGap));
    emoKeys.forEach((key, i) => {
      const col = i % maxPerRow;
      const row = Math.floor(i / maxPerRow);
      const ex = emoStartX + col * (emoSize + emoGap);
      const ey = yPos + row * (emoSize + 0.35);
      const b64 = emo![key];
      if (b64) {
        const f = fitInBox(b64, ex, ey, emoSize, emoSize);
        slide.addImage({ data: normImg(b64), x: f.x, y: f.y, w: f.w, h: f.h });
        slide.addText(key, { x: ex, y: ey + emoSize + 0.02, w: emoSize, h: 0.3, fontSize: 8, color: '666666', align: 'center', fontFace: 'Noto Sans SC' });
      }
    });
  }

  // Scene images grid
  if (scKeys.length > 0) {
    yPos += 0.3;
    if (yPos > 6.2) yPos = 2.0;
    slide.addText('应用场景', { x: MARGIN, y: yPos, w: CONTENT_W, h: 0.35, fontSize: 14, bold: true, color: bc.pri, fontFace: 'Noto Sans SC' });
    yPos += 0.4;
    const scSize = 1.5, scGap = 0.15, scStartX = MARGIN;
    const maxPerRow2 = Math.floor(CONTENT_W / (scSize + scGap));
    scKeys.forEach((key, i) => {
      const col = i % maxPerRow2;
      const row = Math.floor(i / maxPerRow2);
      const ex = scStartX + col * (scSize + scGap);
      const ey = yPos + row * (scSize + 0.35);
      const b64 = sc![key];
      if (b64) {
        const f = fitInBox(b64, ex, ey, scSize, scSize);
        slide.addImage({ data: normImg(b64), x: f.x, y: f.y, w: f.w, h: f.h });
        slide.addText(key, { x: ex, y: ey + scSize + 0.02, w: scSize, h: 0.3, fontSize: 8, color: '666666', align: 'center', fontFace: 'Noto Sans SC' });
      }
    });
  }
}

// ========== IP 五章页渲染（整改：消费 mascot* 字段，确保各页都有图）==========
// 文字块以「标题 + 正文」双列卡片排版，图片放在下半区，避免与正文重叠。
function renderMascotTextPairs(slide: PptxGenJS.Slide, bp: PageBlueprint, bc: BC, startY: number, contentWidthRatio = 1): number {
  const textEls = bp.elements.filter((el) => el.type === "text" && el.content && !el.id.endsWith("-title"));
  const pairs: { title: string; body: string }[] = [];
  for (let i = 0; i + 1 < textEls.length; i += 2) {
    pairs.push({ title: textEls[i].content || "", body: textEls[i + 1].content || "" });
  }
  if (textEls.length % 2 === 1 && textEls.length > 0) {
    pairs.push({ title: textEls[textEls.length - 1].content || "", body: "" });
  }
  if (pairs.length === 0) return startY;

  const gap = 0.15;
  const cardH = 1.05;
  const cardW = (CONTENT_W * contentWidthRatio - gap) / 2;
  const rows = Math.ceil(pairs.length / 2);

  pairs.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + LEFT_BAR_W + col * (cardW + gap);
    const y = startY + row * (cardH + 0.12);
    slide.addShape("rect", { x, y, w: cardW, h: cardH, fill: { color: "FAFAFA" }, line: { color: "E8E8E8", width: 0.3 }, rectRadius: 0.06 });
    slide.addShape("rect", { x, y, w: 0.06, h: cardH, fill: { color: bc.pri }, rectRadius: 0.03 });
    slide.addText(p.title, { x: x + 0.16, y: y + 0.08, w: cardW - 0.3, h: 0.3, fontSize: 10.5, bold: true, color: bc.pri, fontFace: "Noto Sans SC", valign: "top" });
    slide.addText(p.body, { x: x + 0.16, y: y + 0.42, w: cardW - 0.3, h: cardH - 0.5, fontSize: 9, color: "555555", valign: "top", lineSpacingMultiple: 1.15, fontFace: "Noto Sans SC" });
  });

  return startY + rows * (cardH + 0.12) - 0.12;
}

function renderMascotChapterPage(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || bp.pageId, bc);

  // 双列文字卡片，图片从文字结束位置开始
  const textEnd = renderMascotTextPairs(slide, bp, bc, 1.55);
  const startY = Math.min(Math.max(textEnd + 0.15, 3.2), 7.6);
  if (bp.pageId === "mascot-threeview") {
    // 工单 091（P26）：页面按 正/侧/背 三张单图布局（Chris 要求拆分展示）；
    // 合拼版仍保留在 mascotAssets.threeView 供下载/后续使用；
    // 拆分视图不足时才回退合拼横版，再回退正面图。
    const views = (opts.mascotSplitViews || []).filter((v) => isUsableImageRef(v)).slice(0, MASCOT_VIEW_MIN);
    if (views.length >= MASCOT_VIEW_MIN) {
      renderMascotSplitGrid(slide, views, "三视图", startY, bc, MASCOT_VIEW_MIN);
    } else {
      const sheet = (opts.mascotThreeViewData || "").trim();
      if (isUsableImageRef(sheet)) {
        const vw = CONTENT_W;
        const vh = Math.min(vw * (1194 / 3152), SH - startY - 0.4);
        const f = fitInBox(sheet, MARGIN + LEFT_BAR_W, startY, vw, vh);
        slide.addImage({ data: normImg(sheet), x: f.x, y: f.y, w: f.w, h: f.h });
      } else if (opts.mascotData) {
        const vw = 3.2, vh = Math.min(SH - startY - 0.5, 4.6);
        const f = fitInBox(opts.mascotData, (SW - vw) / 2, startY, vw, vh);
        slide.addImage({ data: normImg(opts.mascotData), x: f.x, y: f.y, w: f.w, h: f.h });
      }
    }
  } else if (bp.pageId === "mascot-emotions") {
    // 工单 086-R4：表情库 6 个，A4 竖版 3×2 网格，列数随素材数量数据驱动。
    const emotionCount = Object.keys(opts.mascotEmotions || {}).filter((k) => k && isUsableImageRef(opts.mascotEmotions?.[k])).length;
    renderMascotRecordGrid(slide, opts.mascotEmotions, "表情库", startY, bc, emotionCount <= 6 ? 3 : 4);
  } else if (bp.pageId === "mascot-scenes") {
    // A4 竖版 2×2 场景网格：完整展示 4 个真实应用场景，不再截断为 3 个。
    renderMascotRecordGrid(slide, opts.mascotScenes, "场景应用", startY, bc, 2);
  } else if (bp.pageId === "mascot-usage") {
    if (opts.mascotSplitViews && opts.mascotSplitViews.length > 0) {
      renderMascotSplitGrid(slide, opts.mascotSplitViews, "分视图", startY, bc);
    } else if (opts.mascotData) {
      const vw = 3.2, vh = Math.min(SH - startY - 0.5, 4.6);
      slide.addImage({ data: normImg(opts.mascotData), x: (SW - vw) / 2, y: startY, w: vw, h: vh, sizing: { type: "contain", w: vw, h: vh } });
    }
  } else if (bp.pageId === "mascot-positioning") {
    const posImg = opts.mascotData || opts.mascotThreeViewData || opts.mascotSplitViews?.[0];
    if (posImg) {
      const vw = 3.4, vh = Math.min(SH - startY - 0.5, 4.0);
      const f = fitInBox(posImg, (SW - vw) / 2, startY, vw, vh);
      slide.addImage({ data: normImg(posImg), x: f.x, y: f.y, w: f.w, h: f.h });
    }
  }
}

function renderMascotSupportPage(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || bp.pageId, bc);

  // 工单 091（P30）：规范文字双栏占左 64%，公仔示例独立成右列专区，互不遮挡。
  renderMascotTextPairs(slide, bp, bc, 1.55, 0.64);
  const supportImg = opts.mascotData || opts.mascotThreeViewData || opts.mascotSplitViews?.[0];
  if (supportImg) {
    const imgX = MARGIN + LEFT_BAR_W + CONTENT_W * 0.64 + 0.25;
    const imgW = CONTENT_W * 0.36 - 0.25;
    const imgH = Math.min(SH - 1.9 - 1.55, 5.8);
    const imgY = 1.55 + (SH - 1.55 - imgH) / 2 - 0.4;
    slide.addShape("rect", { x: imgX, y: imgY - 0.15, w: imgW, h: imgH + 0.3, fill: { color: "F5F5F5" }, line: { color: "E8E8E8", width: 0.3 }, rectRadius: 0.1 });
    {
      const f = fitInBox(supportImg, imgX, imgY, imgW, imgH);
      slide.addImage({ data: normImg(supportImg), x: f.x, y: f.y, w: f.w, h: f.h });
    }
  } else {
    slide.addShape("rect", { x: MARGIN + LEFT_BAR_W, y: 6.2, w: CONTENT_W, h: 0.8, fill: { color: "FDECEA" }, rectRadius: 0.06 });
    slide.addText("素材待补，禁止交付", { x: MARGIN + LEFT_BAR_W, y: 6.2, w: CONTENT_W, h: 0.8, fontSize: 16, bold: true, color: "CC3333", align: "center", valign: "middle" });
  }
}

function renderMascotRecordGrid(
  slide: PptxGenJS.Slide,
  rec: Record<string, string> | null | undefined,
  title: string,
  yStart: number,
  bc: BC,
  cols = 4
): void {
  if (!rec) return;
  const keys = Object.keys(rec).filter((k) => k && isUsableImageRef(rec[k]));
  if (!keys.length) return;
  slide.addText(title, { x: MARGIN + LEFT_BAR_W, y: yStart, w: CONTENT_W, h: 0.35, fontSize: 14, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });
  const yPos = yStart + 0.4;
  const gap = 0.14, startX = MARGIN + LEFT_BAR_W;
  const safeCols = Math.max(1, Math.min(cols, keys.length));
  const rows = Math.ceil(keys.length / safeCols);
  const widthForCols = (CONTENT_W - (safeCols - 1) * gap) / safeCols;
  const heightForRows = (SH - 1.05 - yStart - 0.4) / rows - 0.32;
  const size = Math.max(0.9, Math.min(safeCols >= 3 ? 1.45 : 2.35, widthForCols, heightForRows));
  keys.forEach((key, i) => {
    const col = i % safeCols;
    const row = Math.floor(i / safeCols);
    const ex = startX + col * (size + gap);
    const ey = yPos + row * (size + 0.35);
    const b64 = rec[key];
    if (b64) {
      slide.addImage({ data: normImg(b64), x: ex, y: ey, w: size, h: size, sizing: { type: "contain", w: size, h: size } });
      slide.addText(key, { x: ex, y: ey + size + 0.02, w: size, h: 0.3, fontSize: 8, color: "666666", align: "center", fontFace: "Noto Sans SC" });
    }
  });
}

function renderMascotSplitGrid(
  slide: PptxGenJS.Slide,
  views: string[] | null | undefined,
  title: string,
  yStart: number,
  bc: BC,
  cols = 3
): void {
  const usable = (views || []).filter((v) => isUsableImageRef(v));
  if (!usable.length) return;
  slide.addText(title, { x: MARGIN + LEFT_BAR_W, y: yStart, w: CONTENT_W, h: 0.35, fontSize: 14, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });
  const yPos = yStart + 0.4;
  const gap = 0.2, startX = MARGIN + LEFT_BAR_W;
  const safeCols = Math.max(1, Math.min(cols, usable.length));
  const rows = Math.ceil(usable.length / safeCols);
  const widthForCols = (CONTENT_W - (safeCols - 1) * gap) / safeCols;
  const heightForRows = (SH - 1.05 - yStart - 0.4) / rows - 0.35;
  const size = Math.max(1.0, Math.min(2.0, widthForCols, heightForRows));
  usable.forEach((b64, i) => {
    const col = i % safeCols;
    const row = Math.floor(i / safeCols);
    const ex = startX + col * (size + gap);
    const ey = yPos + row * (size + 0.35);
    if (b64) {
      const f = fitInBox(b64, ex, ey, size, size);
      slide.addImage({ data: normImg(b64), x: f.x, y: f.y, w: f.w, h: f.h });
    }
  });
}

function renderGeneric(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || bp.pageId, bc);
  let yPos = 1.8;
  for (const el of bp.elements) {
    if (el.type === "text" && el.content) {
      const fs = el.fontSize ? Math.max(11, Math.round(el.fontSize * 0.7)) : 13;
      slide.addText(el.content, { x: MARGIN + LEFT_BAR_W, y: yPos, w: CONTENT_W, h: 0.5, fontSize: fs, bold: (el.fontWeight || 400) >= 600, color: "333333" });
      yPos += 0.6;
    }
  }
}


// ---- LOGO网格制图规范 ----
function renderLogoGrid(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, bp.label || "LOGO网格制图规范", bc);
  const cx = MARGIN + LEFT_BAR_W;
  const companyName = opts.companyName || "品牌";
  const aiLogo = opts.aiLogoData || (opts.logoData ? normImg(opts.logoData) : undefined);

  // 网格区域
  const gridX = cx + 0.8;
  const gridY = 1.5;
  const gridW = 5.0;
  const gridH = 5.8;
  const step = gridW / 10;  // 10x10 grid

  // 单位说明
  slide.addText("1 格 = 5mm · 整图建议尺寸 50mm x 50mm", {
    x: gridX, y: gridY - 0.32, w: gridW, h: 0.25,
    fontSize: 9, bold: true, color: bc.pri, align: "center",
  });

  // 绘制网格线
  for (let i = 0; i <= 10; i++) {
    const pos = gridX + i * step;
    const isCenter = i === 5;
    const lineW = isCenter ? 0.014 : 0.005;
    // 竖线
    slide.addShape("rect", { x: pos, y: gridY, w: lineW, h: gridH, fill: { color: isCenter ? bc.pri : "DDDDDD" } });
    // 横线
    slide.addShape("rect", { x: gridX, y: gridY + i * step, w: gridW, h: lineW, fill: { color: isCenter ? bc.pri : "DDDDDD" } });
    // 刻度标注（上下左右）
    if (i % 2 === 0) {
      const labelX = (i * 10).toString();
      slide.addText(labelX, { x: pos - 0.15, y: gridY + gridH + 0.05, w: 0.3, h: 0.25, fontSize: 7, color: "999999", align: "center" });
      slide.addText(labelX, { x: gridX - 0.4, y: gridY + i * step - 0.12, w: 0.35, h: 0.25, fontSize: 7, color: "999999", align: "right" });
    }
  }

  // LOGO 外接虚线框
  slide.addShape("rect", {
    x: gridX, y: gridY, w: gridW, h: gridH,
    fill: { type: "none" },
    line: { color: bc.pri, width: 1, dashType: "dash" },
  });

  // 关键尺寸辅助线：图形高度（右侧竖向尺寸线）
  const dimX = gridX + gridW + 0.18;
  slide.addShape("rect", { x: dimX, y: gridY, w: 0.008, h: gridH, fill: { color: bc.sec } });
  slide.addShape("rect", { x: dimX - 0.06, y: gridY, w: 0.13, h: 0.008, fill: { color: bc.sec } });
  slide.addShape("rect", { x: dimX - 0.06, y: gridY + gridH, w: 0.13, h: 0.008, fill: { color: bc.sec } });
  slide.addText("图形高度 50mm", {
    x: dimX + 0.12, y: gridY + gridH / 2 - 0.55, w: 0.85, h: 1.1,
    fontSize: 7, color: bc.sec, align: "left", valign: "middle", lineSpacingMultiple: 1.1,
  });

  // 文字基线
  const baselineY = gridY + gridH * 0.72;
  slide.addShape("rect", { x: gridX, y: baselineY, w: gridW, h: 0.008, fill: { color: bc.sec } });
  slide.addText("文字基线", {
    x: gridX - 0.55, y: baselineY - 0.12, w: 0.5, h: 0.25,
    fontSize: 7, color: bc.sec, align: "right",
  });

  // 笔画中心线标注
  slide.addText("笔画中心线", {
    x: gridX + gridW / 2 - 0.5, y: gridY - 0.12, w: 1.0, h: 0.25,
    fontSize: 7, color: bc.pri, align: "center",
  });

  // 网格单位标注
  slide.addText("X", { x: gridX + gridW / 2 - 0.15, y: gridY + gridH + 0.35, w: 0.3, h: 0.25, fontSize: 9, color: bc.pri, bold: true, align: "center" });
  slide.addText("Y", { x: gridX - 0.5, y: gridY + gridH / 2 - 0.12, w: 0.3, h: 0.25, fontSize: 9, color: bc.pri, bold: true, align: "center" });

  // 物理尺寸标注（0 / 10mm / 20mm / 30mm / 40mm / 50mm）
  for (let i = 0; i <= 10; i += 2) {
    const pos = gridX + i * step;
    const label = i === 0 ? "0" : (i * 10) + "mm";
    slide.addText(label, {
      x: pos - 0.3, y: gridY + gridH + 0.62, w: 0.6, h: 0.22,
      fontSize: 7, color: "777777", align: "center",
    });
  }
  slide.addShape("rect", { x: gridX, y: gridY + gridH + 0.52, w: gridW, h: 0.008, fill: { color: "AAAAAA" } });

  // LOGO居中放置 — maintain aspect ratio (PptxGenJS 4.x ignores sizing)
  if (aiLogo) {
    const maxW = 2.0;
    const maxH = 1.5;
    const sz = getPngSize(aiLogo as string);
    const fit = sz ? fitContain(sz.w, sz.h, maxW, maxH) : { w: maxW, h: maxH };
    slide.addImage({
      data: aiLogo,
      x: gridX + (gridW - fit.w) / 2,
      y: gridY + (gridH - fit.h) / 2,
      w: fit.w,
      h: fit.h,
    });
  }
  // 底部说明
  slide.addText("Logo 标准网格 10x10 单位，1 格 = 5mm，标准尺寸 50mm x 50mm，缩放时按网格等比。", {
    x: gridX, y: gridY + gridH + 0.9, w: gridW, h: 0.55,
    fontSize: 11, color: "777777", align: "center", lineSpacingMultiple: 1.25,
  });
}


// ---- 字体版权说明 ----
function renderFontCopyright(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || "字体版权说明", bc);
  const cx = MARGIN + LEFT_BAR_W;
  let y = 1.6;

  const fonts = [
    { name: "思源黑体 / Noto Sans SC", license: "SIL Open Font License 1.1", usage: "免费商用", desc: "由Google与Adobe联合发布的开源字体，无需额外授权" },
    { name: "思源宋体 / Noto Serif SC", license: "SIL Open Font License 1.1", usage: "免费商用", desc: "由Google与Adobe联合发布的开源字体，无需额外授权" },
    { name: "Montserrat", license: "SIL Open Font License 1.1", usage: "免费商用", desc: "经典几何无衬线英文字体，Google Fonts开源项目" },
    { name: "Open Sans", license: "Apache License 2.0", usage: "免费商用", desc: "高可读性人文主义英文字体，适用于正文排版" },
  ];

  for (const f of fonts) {
    slide.addShape("rect", { x: cx, y, w: 0.12, h: 1.4, fill: { color: bc.pri }, rectRadius: 0.03 });
    slide.addText(f.name, { x: cx + 0.3, y: y + 0.05, w: CONTENT_W - 0.4, h: 0.45, fontSize: 18, bold: true, color: bc.pri });
    slide.addText([{ text: "许可协议：", options: { bold: true } }, { text: f.license }], { x: cx + 0.3, y: y + 0.5, w: CONTENT_W - 0.4, h: 0.35, fontSize: 13, color: "555555" });
    slide.addText([{ text: "商用状态：", options: { bold: true, color: "2E7D32" } }, { text: f.usage + " — " + f.desc, options: { color: "2E7D32" } }], { x: cx + 0.3, y: y + 0.85, w: CONTENT_W - 0.4, h: 0.35, fontSize: 13, color: "2E7D32" });
    slide.addText([{ text: "结论：以上字体均可免费商用，无需额外授权。", options: { bold: true, color: "1565C0" } }], { x: cx + 0.3, y: y + 1.2, w: CONTENT_W - 0.4, h: 0.3, fontSize: 12 });
    y += 2.0;
  }

  // 底部警告
  slide.addShape("rect", { x: cx, y: y + 0.3, w: CONTENT_W, h: 0.8, fill: { color: "FFF3E0" }, rectRadius: 0.08 });
  slide.addText([{ text: "⚠ 重要提示：", options: { bold: true, color: "E65100", fontSize: 13 } }, { text: "禁止在商业物料中使用未经授权的商业字体（如微软雅黑、方正系列等），否则可能面临字体版权侵权诉讼。本VI手册所列字体均已确认为免费商用字体。", options: { color: "E65100", fontSize: 12 } }], { x: cx + 0.2, y: y + 0.4, w: CONTENT_W - 0.4, h: 0.6, fontSize: 12, color: "E65100" });
}


// ---- 辅助图形禁用案例 ----
function drawAuxDemoStripes(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, bc: BC, barCount = 4): void {
  for (let i = 0; i < barCount; i++) {
    const bw = w / barCount;
    slide.addShape("rect", {
      x: x + i * bw, y, w: bw * 0.55, h,
      fill: { color: i % 2 === 0 ? bc.pri : bc.sec, transparency: 20 },
    });
  }
}

/**
 * 工单 086-R1：文件输出规范页——保留蓝图内容并补导出分辨率数值
 * （印刷 300dpi / 喷绘 150dpi / 数字 72-150dpi / Logo 矢量不限）。
 */
function renderFileOutput(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  renderGeneric(slide, bp, opts, bc);
  const cx = MARGIN + LEFT_BAR_W;
  const y = 8.1;
  slide.addShape("rect", { x: cx, y: y, w: 0.1, h: 0.35, fill: { color: bc.pri }, rectRadius: 0.03 });
  slide.addText("导出分辨率标准", { x: cx + 0.25, y: y, w: 4, h: 0.35, fontSize: 15, bold: true, color: bc.pri, fontFace: "Noto Sans SC" });
  const rows = [
    [{ text: "用途", options: { fontSize: 10, bold: true, color: "FFFFFF" } }, { text: "分辨率", options: { fontSize: 10, bold: true, color: "FFFFFF" } }],
    [{ text: "印刷", options: { fontSize: 10, color: "333333" } }, { text: "300 dpi（CMYK）", options: { fontSize: 10, color: "333333" } }],
    [{ text: "喷绘/展架", options: { fontSize: 10, color: "333333" } }, { text: "150 dpi（按实际尺寸）", options: { fontSize: 10, color: "333333" } }],
    [{ text: "数字媒体（屏幕）", options: { fontSize: 10, color: "333333" } }, { text: "72–150 dpi（RGB）", options: { fontSize: 10, color: "333333" } }],
    [{ text: "LOGO 源文件", options: { fontSize: 10, color: "333333" } }, { text: "矢量格式，分辨率不限", options: { fontSize: 10, color: "333333" } }],
  ];
  slide.addTable(rows, { x: cx, y: y + 0.45, w: CONTENT_W, colW: [3.2, 3.87], border: { pt: 0.5, color: "E0E0E0" }, rowH: [0.32, 0.32, 0.32, 0.32, 0.32], autoPage: false });
}

function renderAuxGraphicsMisuse(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || "辅助图形禁用规范", bc);
  const cx = MARGIN + LEFT_BAR_W;
  let y = 1.5;

  const misuses = [
    { title: "禁止拉伸变形", desc: "不得对辅助图形进行非等比缩放，纹样比例失真破坏品牌精致感", icon: "\u2715" },
    { title: "禁止局部裁切", desc: "不得单独裁切辅助图形的局部纹样，需保持完整图案结构", icon: "\u2715" },
    { title: "禁止随意换色", desc: "不得使用品牌色以外的颜色替换辅助图形，破坏色彩体系一致性", icon: "\u2715" },
    { title: "禁止多层杂乱叠加", desc: "辅助图形叠加不超过两层，避免视觉混乱降低品牌识别度", icon: "\u2715" },
    { title: "禁止旋转倾斜", desc: "条纹组合必须保持水平/垂直方向，点阵组合不得旋转", icon: "\u2715" },
    { title: "禁止扭曲特效", desc: "不得添加非规范的扭曲、模糊、3D等滤镜效果", icon: "\u2715" },
  ];

  for (let i = 0; i < misuses.length; i++) {
    const hasDemo = i < 3;
    const textW = hasDemo ? CONTENT_W - 2.9 : CONTENT_W - 0.5;
    slide.addShape("rect", { x: cx, y, w: 0.12, h: 1.5, fill: { color: bc.pri }, rectRadius: 0.03 });
    slide.addText(misuses[i].icon + " " + misuses[i].title, { x: cx + 0.35, y: y + 0.05, w: textW, h: 0.45, fontSize: 15, bold: true, color: "CC3333" });
    slide.addText(misuses[i].desc, { x: cx + 0.35, y: y + 0.5, w: textW, h: 0.8, fontSize: 12, color: "555555", lineSpacing: 18 });

    if (hasDemo) {
      const demoX = cx + CONTENT_W - 2.6;
      const demoY = y + 0.12;
      const demoW = 1.05, demoH = 1.15;
      slide.addText("错误", { x: demoX, y: demoY - 0.08, w: demoW, h: 0.22, fontSize: 9, bold: true, color: "DC2626", align: "center" });
      slide.addText("正确", { x: demoX + demoW + 0.15, y: demoY - 0.08, w: demoW, h: 0.22, fontSize: 9, bold: true, color: "16A34A", align: "center" });
      slide.addShape("rect", { x: demoX, y: demoY + 0.12, w: demoW, h: demoH, fill: { color: "FEF2F2" }, line: { color: "FECACA", width: 0.5 }, rectRadius: 0.04 });
      slide.addShape("rect", { x: demoX + demoW + 0.15, y: demoY + 0.12, w: demoW, h: demoH, fill: { color: "F0FDF4" }, line: { color: "BBF7D0", width: 0.5 }, rectRadius: 0.04 });

      if (i === 0) {
        // 拉伸变形：错误=横向压扁条纹，正确=等比条纹
        drawAuxDemoStripes(slide, demoX + 0.08, demoY + 0.35, demoW - 0.16, demoH * 0.3, bc, 4);
        drawAuxDemoStripes(slide, demoX + demoW + 0.23, demoY + 0.25, demoW - 0.3, demoH * 0.6, bc, 4);
      } else if (i === 1) {
        // 透明度超标：错误=80% 几乎消失，正确=25%
        slide.addShape("rect", { x: demoX + 0.25, y: demoY + 0.4, w: demoW - 0.5, h: demoH * 0.5, fill: { color: bc.pri, transparency: 80 } });
        slide.addShape("rect", { x: demoX + demoW + 0.4, y: demoY + 0.4, w: demoW - 0.5, h: demoH * 0.5, fill: { color: bc.pri, transparency: 25 } });
      } else {
        // 局部裁切：错误=切掉一半纹样，正确=完整纹样
        drawAuxDemoStripes(slide, demoX + 0.08, demoY + 0.4, (demoW - 0.16) / 2, demoH * 0.45, bc, 2);
        drawAuxDemoStripes(slide, demoX + demoW + 0.23, demoY + 0.4, demoW - 0.3, demoH * 0.45, bc, 4);
      }
    }

    y += 1.7;
  }

  slide.addShape("rect", { x: cx, y: 10.5, w: CONTENT_W, h: 0.6, fill: { color: "FFF3E0" }, rectRadius: 0.06 });
  slide.addText("辅助图形是品牌视觉的延伸，规范使用确保品牌调性统一。以上为常见的错误用法，门店及设计师应严格避免。", {
    x: cx + 0.2, y: 10.6, w: CONTENT_W - 0.4, h: 0.45, fontSize: 11, color: "E65100",
  });
}

// ---- 色彩使用禁忌 ----
function renderColorTaboos(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || "色彩使用规范", bc);
  const cx = MARGIN + LEFT_BAR_W;
  let y = 1.5;

  // 工单 086-R1：区分「品牌标准色」（LOGO/核心识别）与「品牌基底色」（大面积铺陈），
  // 消除与标准色彩规范页（P8）的表述矛盾。
  const rules = [
    { title: "品牌标准色仅作核心识别", desc: (COLOR_NAME_MAP[bc.pri] || "品牌标准色") + " #" + bc.pri + " 用于 LOGO 与核心识别；大面积画面请使用品牌基底色（辅助色/留白），标准色占比建议不超过 20%，避免压迫感并保持调性统一。", icon: "⚠" },
    { title: "三色搭配比例", desc: "主色 10-25% / 辅助色 15-30% / 背景留白 50-70%。保持视觉呼吸感与层次。", icon: "📐" },
    { title: "禁止搭配色", desc: "避免与高饱和度绿色、荧光色、纯黑 #000000 混搭，破坏品牌温柔轻奢质感。", icon: "🚫" },
    { title: "单色印刷规范", desc: "黑白/单色印刷时使用灰度版本，保留品牌色明度阶梯。主色→70%灰、辅助色→50%灰、强调色→30%灰。", icon: "🖨" },
  ];

  for (let i = 0; i < rules.length; i++) {
    slide.addShape("rect", { x: cx, y, w: 0.12, h: 1.3, fill: { color: bc.pri }, rectRadius: 0.03 });
    slide.addText(rules[i].icon + " " + rules[i].title, { x: cx + 0.35, y: y + 0.05, w: CONTENT_W - 0.5, h: 0.45, fontSize: 15, bold: true, color: "333333" });
    slide.addText(rules[i].desc, { x: cx + 0.35, y: y + 0.45, w: CONTENT_W - 0.5, h: 0.75, fontSize: 11, color: "555555", lineSpacing: 16 });
    y += 1.5;
  }

  // 三色灰度对照（单色印刷参考）
  const logoColors = resolveLogoColors(opts);
  const grayRow = [
    ...(logoColors?.navy ? [{ label: logoColors.navy.name + " → 70% 灰", color: logoColors.navy.hex, gray: "B3B3B3" }] : []),
    ...(logoColors?.gold ? [{ label: logoColors.gold.name + " → 50% 灰", color: logoColors.gold.hex, gray: "808080" }] : []),
    { label: "品牌标准色 → 70% 灰", color: bc.pri, gray: "B3B3B3" },
    { label: "辅助色 → 50% 灰", color: bc.sec, gray: "808080" },
    { label: "强调色 → 30% 灰", color: bc.acc, gray: "4D4D4D" },
  ].slice(0, 3);
  slide.addText("三色灰度对照（单色印刷参考）", { x: cx, y: 7.55, w: CONTENT_W, h: 0.35, fontSize: 15, bold: true, color: bc.pri });
  const grayW = (CONTENT_W - 0.4) / 3;
  for (let i = 0; i < grayRow.length; i++) {
    const gx = cx + i * (grayW + 0.2);
    slide.addShape("rect", { x: gx, y: 7.95, w: grayW / 2, h: 0.45, fill: { color: grayRow[i].color }, rectRadius: 0.03 });
    slide.addShape("rect", { x: gx + grayW / 2, y: 7.95, w: grayW / 2, h: 0.45, fill: { color: grayRow[i].gray }, rectRadius: 0.03 });
    slide.addText(grayRow[i].label, { x: gx, y: 8.45, w: grayW, h: 0.3, fontSize: 9, color: "555555", align: "center" });
  }

  slide.addShape("rect", { x: cx, y: 8.95, w: CONTENT_W, h: 0.6, fill: { color: "FFF3E0" }, rectRadius: 0.06 });
  slide.addText(sanitizeColorNames("色彩规范的核心原则：温柔不刺眼，精致不廉价。如有特殊场景色彩需求，须向品牌总部提交审核。"), {
    x: cx + 0.2, y: 9.05, w: CONTENT_W - 0.4, h: 0.45, fontSize: 11, color: "E65100",
  });
}

// ---- VI物料落地优先级清单 ----
function renderMaterialPriority(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || "VI物料落地清单", bc);
  const cx = MARGIN + LEFT_BAR_W;

  const items: Array<{priority: string; category: string; desc: string; color: string}> = opts.materialPriorityList && opts.materialPriorityList.length > 0
    ? opts.materialPriorityList.map(function(m) {
        const colorMap: Record<string, string> = { "\u5FC5\u505A": "C62828", "\u5EFA\u8BAE": "E67E22", "\u53EF\u9009": "2E7D32" };
        return { priority: m.priority, category: m.category, desc: m.description, color: colorMap[m.priority] || "999999" };
      })
    : (function() {
        const rawItems = getIndustryMaterials(opts.industry).map(function(m) { return { priority: m.priority, category: m.category, desc: m.desc, color: m.color }; });
        return rawItems.filter(function(item) {
          const cleaned = cleanDirtyWords(item.category + " " + item.desc, opts.industry || "");
          return !cleaned.cleaned;
        });
      })();

  // 图例
  slide.addShape("rect", { x: cx, y: 1.4, w: 0.25, h: 0.25, fill: { color: "C62828" }, rectRadius: 0.04 });
  slide.addText("必做", { x: cx + 0.35, y: 1.4, w: 0.6, h: 0.25, fontSize: 10, bold: true, color: "333333" });
  slide.addShape("rect", { x: cx + 1.2, y: 1.4, w: 0.25, h: 0.25, fill: { color: "E67E22" }, rectRadius: 0.04 });
  slide.addText("建议", { x: cx + 1.55, y: 1.4, w: 0.6, h: 0.25, fontSize: 10, bold: true, color: "333333" });
  slide.addShape("rect", { x: cx + 2.4, y: 1.4, w: 0.25, h: 0.25, fill: { color: "2E7D32" }, rectRadius: 0.04 });
  slide.addText("可选", { x: cx + 2.75, y: 1.4, w: 0.6, h: 0.25, fontSize: 10, bold: true, color: "333333" });

  // 表格头
  const colW = [0.8, 1.6, 4.67];
  const headers = ["优先级", "物料", "说明"];
  slide.addShape("rect", { x: cx, y: 1.75, w: CONTENT_W, h: 0.4, fill: { color: bc.pri } });
  let hx = cx;
  for (let i = 0; i < headers.length; i++) {
    slide.addText(headers[i], { x: hx, y: 1.75, w: colW[i], h: 0.4, fontSize: 11, bold: true, color: "FFFFFF", align: "center" });
    hx += colW[i];
  }

  // 数据行
  for (let i = 0; i < items.length; i++) {
    const rowY = 2.15 + i * 0.5;
    const bgColor = i % 2 === 0 ? "FAFAFA" : "FFFFFF";
    slide.addShape("rect", { x: cx, y: rowY, w: CONTENT_W, h: 0.5, fill: { color: bgColor }, line: { color: "EEEEEE", width: 0.3 } });

    // Priority badge
    slide.addShape("rect", { x: cx + 0.1, y: rowY + 0.08, w: 0.6, h: 0.34, fill: { color: items[i].color }, rectRadius: 0.06 });
    slide.addText(items[i].priority, { x: cx + 0.1, y: rowY + 0.08, w: 0.6, h: 0.34, fontSize: 9, bold: true, color: "FFFFFF", align: "center" });

    slide.addText(items[i].category, { x: cx + 0.85, y: rowY + 0.08, w: 1.5, h: 0.34, fontSize: 11, bold: true, color: "333333" });
    slide.addText(items[i].desc, { x: cx + 2.45, y: rowY + 0.08, w: 4.5, h: 0.34, fontSize: 10, color: "666666" });
  }

  // 工单 086-R1：有 IP 版时展示行业 IP 应用触点（丽人/美业规则表，可复用、无品牌写死）。
  if (opts.mascotData) {
    const ipRules = getIndustryIpApplicationRules(opts.industry);
    slide.addShape("rect", { x: cx, y: 7.3, w: CONTENT_W, h: 1.0, fill: { color: "FDF2F8" }, rectRadius: 0.06 });
    slide.addText("IP 应用触点（" + (opts.industry || "通用") + "）", {
      x: cx + 0.2, y: 7.38, w: CONTENT_W - 0.4, h: 0.3, fontSize: 10, bold: true, color: "B03A66",
    });
    slide.addText("线上：" + ipRules.online.join(" / ") + "\n线下：" + ipRules.offline.join(" / "), {
      x: cx + 0.2, y: 7.66, w: CONTENT_W - 0.4, h: 0.58, fontSize: 8.5, color: "8A4A63", lineSpacingMultiple: 1.15,
    });
    slide.addText("门店分批落地建议：首批完成必做物料，第二批补齐建议物料，第三批按需扩展可选物料。具体清单根据行业动态配置。", {
      x: cx, y: 8.4, w: CONTENT_W, h: 0.3, fontSize: 11, color: "999999", align: "center",
    });
  } else {
    slide.addText("门店分批落地建议：首批完成必做物料，第二批补齐建议物料，第三批按需扩展可选物料。具体清单根据行业动态配置。", {
      x: cx, y: 7.35, w: CONTENT_W, h: 0.3, fontSize: 11, color: "999999", align: "center",
    });
  }
}


// ---- 线上数字应用 ----
function renderDigitalMedia(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, bp.label || "线上数字应用", bc);
  const cx = MARGIN + LEFT_BAR_W;
  let y = 1.5;

  for (const el of bp.elements) {
    if (el.type !== "text" || !el.content || el.id.endsWith("-title") || el.id.startsWith("dm-spec-")) continue;
    const isHead = /dm-h-\d+/.test(el.id);
    slide.addText(el.content, {
      x: cx + 0.1, y, w: CONTENT_W - 0.2, h: isHead ? 0.3 : 0.4,
      fontSize: isHead ? 11 : 9.5, bold: isHead, color: isHead ? bc.pri : "555555",
      valign: "top", lineSpacingMultiple: 1.15, fontFace: "Noto Sans SC",
    });
    y += isHead ? 0.34 : 0.44;
  }

  // 标准模板示意
  const sy = Math.max(y + 0.25, 4.7);
  const avatarW = 1.35, avatarH = 1.35;
  const ax = cx + 0.2;
  slide.addShape("rect", { x: ax, y: sy, w: avatarW, h: avatarH, fill: { color: "F7F7F7" }, line: { color: bc.pri, width: 0.75, dashType: "dash" }, rectRadius: 0.08 });
  slide.addShape("ellipse", { x: ax + 0.17, y: sy + 0.17, w: 1.0, h: 1.0, fill: { type: "none" }, line: { color: bc.pri, width: 0.75, dashType: "dash" } });
  slide.addShape("ellipse", { x: ax + 0.45, y: sy + 0.45, w: 0.45, h: 0.45, fill: { color: bc.pri, transparency: 25 } });
  // 工单 086-R1：有 IP 版统一「公仔+LOGO」口径（头像=公仔头部、封面=公仔+LOGO、Banner=LOGO主+公仔辅）
  slide.addText(opts.mascotData ? "IP头像 1024x1024px\n公仔头部·圆形安全区 80%" : "社媒头像 1024x1024px\n圆形安全区 80%", { x: ax - 0.2, y: sy + avatarH + 0.05, w: avatarW + 0.4, h: 0.5, fontSize: 8, color: "666666", align: "center", fontFace: "Noto Sans SC" });

  const vx = ax + 1.75, vw = 0.9, vh = 1.35;
  slide.addShape("rect", { x: vx, y: sy, w: vw, h: vh, fill: { color: "F7F7F7" }, line: { color: bc.pri, width: 0.75, dashType: "dash" }, rectRadius: 0.05 });
  slide.addShape("rect", { x: vx + vw - 0.34, y: sy + 0.1, w: 0.24, h: 0.18, fill: { color: bc.pri, transparency: 25 } });
  slide.addText("LOGO", { x: vx + vw - 0.34, y: sy + 0.11, w: 0.24, h: 0.16, fontSize: 6, bold: true, color: "FFFFFF", align: "center", fontFace: "Noto Sans SC" });
  slide.addText(opts.mascotData ? "IP封面 1080x1920px\n公仔+LOGO·右上角" : "短视频封面 1080x1920px\nLOGO 右上角", { x: vx - 0.25, y: sy + vh + 0.05, w: vw + 0.5, h: 0.5, fontSize: 8, color: "666666", align: "center", fontFace: "Noto Sans SC" });

  const bx = ax + 2.95, bw = 2.35, bh = 1.32;
  slide.addShape("rect", { x: bx, y: sy, w: bw, h: bh, fill: { color: "F7F7F7" }, line: { color: bc.pri, width: 0.75, dashType: "dash" }, rectRadius: 0.06 });
  slide.addShape("rect", { x: bx + 0.15, y: sy + bh / 2 - 0.14, w: 0.5, h: 0.28, fill: { color: bc.pri, transparency: 25 } });
  slide.addText("LOGO", { x: bx + 0.15, y: sy + bh / 2 - 0.12, w: 0.5, h: 0.24, fontSize: 7, bold: true, color: "FFFFFF", align: "center", fontFace: "Noto Sans SC" });
  slide.addText(opts.mascotData ? "IP Banner 1920x1080px\nLOGO 主·公仔辅" : "网页 Banner 1920x1080px\nLOGO 左侧 10% 区域", { x: bx - 0.4, y: sy + bh + 0.05, w: bw + 0.8, h: 0.5, fontSize: 8, color: "666666", align: "center", fontFace: "Noto Sans SC" });

  // 底部排版坐标卡文本
  const specs = getMaterialSpecs("digital-media", industry);
  const ipNote = opts.mascotData ? "IP 版统一口径：头像=公仔头部，封面=公仔+LOGO，Banner=LOGO 主视觉+公仔辅助。\n" : "";
  slide.addText(ipNote + specs.map((s) => "排版坐标卡：" + s.name + " " + s.size + "，LOGO " + s.logoPosition + "，LOGO " + s.logoSize + "，安全区 " + s.safeZone + "。").join("\n"), {
    x: cx, y: sy + 1.95, w: CONTENT_W, h: 1.2,
    fontSize: 9, color: "555555", valign: "top", lineSpacingMultiple: 1.4, fontFace: "Noto Sans SC",
  });
}

// ---- 导视系统 ----
function renderWayfinding(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || "导视系统", bc);
  const cx = MARGIN + LEFT_BAR_W;
  const companyName = opts.companyName || "品牌";
  const logoForScene = opts.aiLogoData || opts.logoData;

  // 三列布局：门头招牌 | 室内指示牌 | 收银台标识
  const colW = (CONTENT_W - 0.4) / 3;
  const colH = 5.5;
  const startY = 1.6;

  const items = [
    {
      title: "门头招牌",
      icon: "🏪",
      specs: [
        "位置：门店正上方居中",
        "尺寸：宽高比建议 3:1 至 5:1",
        "材质：亚克力发光字 / 金属字",
        "配色：品牌主色底+白色字",
        "照明：内置LED灯带，色温3000K",
        "Logo置于招牌左上角",
      ],
    },
    {
      title: "室内指示牌",
      icon: "🧭",
      specs: [
        "楼层牌：电梯口上方30cm",
        "房间号：门右侧墙面，高度1.5m",
        "尺寸：楼层牌 30×15cm",
        "房间牌 20×10cm",
        "材质：亚克力/拉丝金属",
        "字体：思源黑体 Bold",
      ],
    },
    {
      title: "收银台标识",
      icon: "💳",
      specs: [
        "位置：收银台正前方或上方",
        "尺寸：40×15cm 横式",
        "内容：品牌名 + 收银/服务台",
        "材质：亚克力UV印刷",
        "配色：主色底+白色字",
        "可增加品牌辅助图形底纹",
      ],
    },
  ];

  for (let i = 0; i < items.length; i++) {
    const x = cx + i * (colW + 0.2);
    const y = startY;
    const item = items[i];

    // 卡片背景
    slide.addShape("rect", {
      x, y, w: colW, h: colH,
      fill: { color: "FAFAFA" },
      line: { color: "E8E8E8", width: 0.5 },
      rectRadius: 0.1,
    });

    // 顶部品牌色装饰
    slide.addShape("rect", {
      x, y, w: colW, h: 0.08,
      fill: { color: bc.pri }, rectRadius: 0.04,
    });

    // 标题区域
    slide.addText(item.icon + " " + item.title, {
      x: x + 0.15, y: y + 0.2, w: colW - 0.3, h: 0.5,
      fontSize: 18, bold: true, color: bc.pri, fontFace: "Noto Sans SC",
    });

    // 分隔线
    slide.addShape("rect", {
      x: x + 0.15, y: y + 0.75, w: colW - 0.3, h: 0.03,
      fill: { color: bc.acc },
    });

    // Logo示意 (卡片内左上角小Logo)
    if (logoForScene) {
      slide.addImage({
        data: normImg(logoForScene),
        x: x + 0.15, y: y + 0.9, w: 0.6, h: 0.6,
        sizing: { type: "contain", w: 0.6, h: 0.6 },
        transparency: 15,
      });
    }

    // 规格说明列表
    const specText = item.specs.map(s => "• " + s).join("\n");
    slide.addText(specText, {
      x: x + 0.15, y: y + 1.65, w: colW - 0.3, h: 3.5,
      fontSize: 12, color: "444444", lineSpacingMultiple: 1.5, valign: "top",
      fontFace: "Noto Sans SC",
    });
  }

  // 导视门牌标准模板示意（300 x 150mm 比例框）
  slide.addText("导视门牌标准模板 300 x 150mm", {
    x: cx, y: startY + colH + 0.15, w: CONTENT_W, h: 0.3,
    fontSize: 13, bold: true, color: bc.pri, align: "center", fontFace: "Noto Sans SC",
  });
  const signW = 3.0, signH = 1.5;
  const signX = (SW - signW) / 2, signY = startY + colH + 0.5;
  slide.addShape("rect", { x: signX, y: signY, w: signW, h: signH, fill: { color: "F7F7F7" }, line: { color: bc.pri, width: 0.75, dashType: "dash" }, rectRadius: 0.06 });
  if (logoForScene) {
    slide.addImage({
      data: normImg(logoForScene),
      x: signX + 0.15, y: signY + 0.15, w: 0.5, h: 0.5,
      sizing: { type: "contain", w: 0.5, h: 0.5 },
      transparency: 10,
    });
  } else {
    slide.addShape("rect", { x: signX + 0.15, y: signY + 0.15, w: 0.45, h: 0.3, fill: { color: bc.pri, transparency: 25 }, rectRadius: 0.02 });
    slide.addText("LOGO", { x: signX + 0.15, y: signY + 0.17, w: 0.45, h: 0.2, fontSize: 7, bold: true, color: "FFFFFF", align: "center", fontFace: "Noto Sans SC" });
  }
  slide.addText("安全区 8mm · LOGO 左上角 · LOGO 高度 ≤ 30mm", {
    x: cx, y: signY + signH + 0.05, w: CONTENT_W, h: 0.3,
    fontSize: 10, color: "666666", align: "center", fontFace: "Noto Sans SC",
  });

  // 底部说明
  slide.addText("导视系统是品牌在物理空间中的重要触点，统一规范的导视设计提升门店专业度与客户体验。", {
    // 工单 036：说明文字改放门牌框与“安全区”说明下方（框外），避免横穿 300×150mm 框。
    x: cx, y: signY + signH + 0.45, w: CONTENT_W, h: 0.3,
    fontSize: 12, color: "888888", align: "center",
  });
}


// ========== 工具函数 ==========
function hx(c: string): string { return c.replace("#", "").toUpperCase(); }
function normImg(d: string): string { if (d.startsWith("data:")) return d; if (d.startsWith("image/")) return `data:${d}`; return `data:image/png;base64,${d}`; }

// PptxGenJS 4.x dropped "sizing". Parse PNG dimensions from base64 to calculate
// correct w/h that maintain aspect ratio within a max bounding box.
function getPngSize(b64: string): { w: number; h: number } | null {
  try {
    const raw = (b64.split(";base64,").pop() || b64).replace(/\s/g, "");
    const buf = Buffer.from(raw, "base64");
    if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch { return null; }
}
function fitContain(iw: number, ih: number, mw: number, mh: number): { w: number; h: number } {
  const s = Math.min(mw / iw, mh / ih);
  return { w: iw * s, h: ih * s };
}
function darken(hex: string): string {
  const c = hex.replace("#", "");
  const r = Math.max(0, parseInt(c.slice(0, 2), 16) - 60);
  const g = Math.max(0, parseInt(c.slice(2, 4), 16) - 60);
  const b = Math.max(0, parseInt(c.slice(4, 6), 16) - 60);
  return [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function lighten(hex: string): string {
  const c = hex.replace("#", "");
  const r = Math.min(255, parseInt(c.slice(0, 2), 16) + 120);
  const g = Math.min(255, parseInt(c.slice(2, 4), 16) + 120);
  const b = Math.min(255, parseInt(c.slice(4, 6), 16) + 120);
  return [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 200;
}
function hex2rgb(hex: string): { r: number; g: number; b: number } | null {
  const c = hex.replace("#", "");
  if (c.length < 6) return null;
  return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
}
function rgb2cmyk(rgb: { r: number; g: number; b: number }): { c: number; m: number; y: number; k: number } | null {
  const r1 = rgb.r / 255, g1 = rgb.g / 255, b1 = rgb.b / 255;
  const k = 1 - Math.max(r1, g1, b1);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: Math.round(((1 - r1 - k) / (1 - k)) * 100), m: Math.round(((1 - g1 - k) / (1 - k)) * 100), y: Math.round(((1 - b1 - k) / (1 - k)) * 100), k: Math.round(k * 100) };
}
function fta(bp: PageBlueprint, ids: string[]): string {
  for (const id of ids) { const el = bp.elements.find(e => e.id === id); if (el?.content) return el.content; }
  for (const id of ids) { const el = bp.elements.find(e => e.id?.includes(id)); if (el?.content) return el.content; }
  return "";
  slide.addShape("rect", { x: 0, y: SH - 0.1, w: SW, h: 0.1, fill: { color: bc.acc } });
}

// ---- LOGO文件输出规范 ----
function renderLogoOutput(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || "LOGO文件输出规范", bc);
  const cx = MARGIN + LEFT_BAR_W;
  let y = 1.6;

  if (opts.logoOutputSpec) {
    // 渲染 content_patch 的 LOGO 输出规范
    const text = sanitizeText(opts.logoOutputSpec);
    slide.addText(text, {
      x: cx + 0.1, y, w: CONTENT_W - 0.2, h: 9.5,
      fontSize: 12, color: "444444", lineSpacingMultiple: 1.5, valign: "top",
    });
    return;
  }

  // 默认表格（data only, no content_patch）
  slide.addText("LOGO文件交付格式", { x: cx, y: 1.5, w: CONTENT_W, h: 0.4, fontSize: 18, bold: true, color: bc.pri });
  y = 2.1;
  const specItems = [
    { format: "AI矢量文件", use: "印刷品/喷绘/修改", name: "Logo_品牌名.ai" },
    { format: "透明底PNG", use: "线上宣传/PPT/网页", name: "Logo_品牌名_透明底.png" },
    { format: "白色底JPG", use: "快速预览/社交配图", name: "Logo_品牌名.jpg" },
    { format: "单色稿(黑)", use: "黑白印刷/传真/票据", name: "Logo_品牌名_单色黑.png" },
    { format: "反白稿(白)", use: "深色背景应用", name: "Logo_品牌名_反白.png" },
  ];
  const colWs = [1.5, 2.5, 3.0];
  const headers = ["文件格式", "适用场景", "文件命名"];
  slide.addShape("rect", { x: cx, y, w: CONTENT_W, h: 0.35, fill: { color: bc.pri } });
  let hx = cx;
  for (let i = 0; i < headers.length; i++) {
    slide.addText(headers[i], { x: hx, y, w: colWs[i], h: 0.35, fontSize: 11, bold: true, color: "FFFFFF", align: "center" });
    hx += colWs[i];
  }
  y += 0.35;
  for (let i = 0; i < specItems.length; i++) {
    const bgColor = i % 2 === 0 ? "FAFAFA" : "FFFFFF";
    slide.addShape("rect", { x: cx, y, w: CONTENT_W, h: 0.35, fill: { color: bgColor }, line: { color: "EEEEEE", width: 0.3 } });
    hx = cx;
    const vals = [specItems[i].format, specItems[i].use, specItems[i].name];
    for (let j = 0; j < vals.length; j++) {
      slide.addText(vals[j], { x: hx, y, w: colWs[j], h: 0.35, fontSize: 10, color: "444444", align: "center" });
      hx += colWs[j];
    }
    y += 0.35;
  }
  slide.addText("注意：AI源文件由品牌总部保管，门店及合作方仅使用交付的PNG/JPG成品文件。", {
    x: cx, y: y + 0.2, w: CONTENT_W, h: 0.3, fontSize: 10, color: "999999", align: "center",
  });
}function renderModificationAuthority(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, bp.label || "VI修改权限说明", bc);
  const cx = MARGIN + LEFT_BAR_W;
  let y = 1.6;

  if (opts.modificationAuthority) {
    // 渲染 content_patch 的修改权限说明
    const text = sanitizeText(opts.modificationAuthority);
    slide.addText(text, {
      x: cx + 0.1, y, w: CONTENT_W - 0.2, h: 9.5,
      fontSize: 13, color: "444444", lineSpacingMultiple: 1.6, valign: "top",
    });
    // 底部提示
    slide.addShape("rect", { x: cx, y: 8.5, w: CONTENT_W, h: 0.6, fill: { color: "FFF3E0" }, rectRadius: 0.06 });
    slide.addText("严格遵守VI规范是品牌建设的基石。统一=专业，随意修改=品牌稀释。", {
      x: cx + 0.2, y: 8.55, w: CONTENT_W - 0.4, h: 0.5, fontSize: 11, color: "E65100", align: "center",
    });
    return;
  }

  // 默认内容
  slide.addText("VI修改权限说明", { x: cx, y: 1.5, w: CONTENT_W, h: 0.4, fontSize: 18, bold: true, color: bc.pri });
  y = 2.2;
  const rules = [
    "1. 仅品牌总部有权调整VI规范，包括LOGO、色彩、字体、辅助图形等。",
    "2. 各门店严格按照本手册执行，不得自行修改LOGO颜色/比例。",
    "3. 特殊场景需适配的，须向品牌总部提交申请，由总部出具适配方案。",
    "4. 违规修改造成的品牌形象损失由门店自行承担。",
  ];
  for (const r of rules) {
    slide.addShape("rect", { x: cx, y, w: 0.12, h: 0.6, fill: { color: bc.pri }, rectRadius: 0.03 });
    slide.addText(r, { x: cx + 0.3, y, w: CONTENT_W - 0.4, h: 0.6, fontSize: 13, color: "444444" });
    y += 0.8;
  }
  slide.addShape("rect", { x: cx, y: y + 0.3, w: CONTENT_W, h: 0.6, fill: { color: "FFF3E0" }, rectRadius: 0.06 });
  slide.addText("严格遵守VI规范是品牌建设的基石。统一=专业，随意修改=品牌稀释。", {
    x: cx + 0.2, y: y + 0.35, w: CONTENT_W - 0.4, h: 0.5, fontSize: 11, color: "E65100", align: "center",
  });
}












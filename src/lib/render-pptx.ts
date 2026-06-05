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
import type { PageBlueprint } from "./page-planner";

const SW = 8.27;
const SH = 11.69;
const MARGIN = 0.7;
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
  brandVision?: string;
  coreValues?: string;
  targetMarket?: string;
  logoPhilosophy?: string;
  mascotPhilosophy?: string;
  sceneImages?: Record<string, string>;
  sceneLabels?: Record<string, string>;  // V9: AI返回的动态标签
}

// ========== 行业类型 ==========
type IndustryType = "restaurant" | "beverage" | "beauty" | "retail" | "education" | "general";

function getIndustryType(industry?: string): IndustryType {
  if (!industry) return "general";
  const s = industry.toLowerCase();
  // V7: 饮品优先判断（椰子水、茶饮等容易混入餐饮）
  if (/椰|椰子|椰汁|茶|咖啡|饮|奶茶|果汁|酒|酒吧|饮品|奶茶店|气泡|矿泉|纯净水/.test(s)) return "beverage";
  if (/餐|食|面|火锅|烧烤|烘焙|饺子|包子|炒菜|饭店|小吃|饭馆|海鲜|川菜|粤菜|湘菜|鲁菜|馆|外卖/.test(s)) return "restaurant";
  if (/美容|美发|理发|美甲|spa|沙龙|造型|护肤|美体|美睫/.test(s)) return "beauty";
  if (/零售|超市|便利|商店|杂货|服装|鞋|饰品|母婴|数码/.test(s)) return "retail";
  if (/教育|培训|学|课|幼儿园|托管|辅导/.test(s)) return "education";
  return "general";
}

// 行业默认色（与route.ts保持一致）
const INDUSTRY_BC: Record<IndustryType, { pri: string; sec: string; acc: string }> = {
  restaurant: { pri: "2E7D32", sec: "E65100", acc: "F9A825" },
  beverage:   { pri: "00695C", sec: "D84315", acc: "FFB300" },
  beauty:     { pri: "AD1457", sec: "6A1B9A", acc: "F48FB1" },
  retail:     { pri: "1565C0", sec: "EF6C00", acc: "78909C" },
  education:  { pri: "283593", sec: "00897B", acc: "FF8F00" },
  general:    { pri: "37474F", sec: "00897B", acc: "FFB300" },
};

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

  // V6: 按行业给默认色，不再用Google蓝！
  const industry = getIndustryType(opts.industry);
  const def = INDUSTRY_BC[industry];
  console.log(`[resolveBC] Using industry defaults for ${industry}: ${def.pri}`);
  return {
    pri: def.pri, sec: def.sec, acc: def.acc,
    priDark: darken(def.pri), priLight: lighten(def.pri),
  };
}

// ========== 行业场景配置 ==========
interface SceneConfig { title: string; desc: string; }

function getSceneConfigs(industry: IndustryType): Record<string, SceneConfig> {
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
      packaging: { title: "美容包装系统", desc: "产品与礼品物料的品牌化呈现" },
      marketing: { title: "美容营销系统", desc: "门店宣传与客户维护物料" },
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
    general: {
      stationery: { title: "办公应用系统", desc: "品牌在商务场景中的标准化应用" },
      packaging: { title: "产品包装系统", desc: "品牌主色调贯穿包装设计" },
      marketing: { title: "营销展示系统", desc: "场景化品牌视觉应用" },
    },
  };
  return configs[industry] || configs.general;
}

// ========== 主渲染入口 ==========
export async function renderPptx(blueprints: PageBlueprint[], options: RenderPptxOptions = {}): Promise<PptxGenJS> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4_PORTRAIT", width: SW, height: SH });
  pptx.layout = "A4_PORTRAIT";
  pptx.author = "Brand Brain";
  const cn = options.companyName || "品牌";
  pptx.subject = `${cn} VI 规范手册`;
  pptx.title = `${cn} 品牌视觉识别系统（VI）规范手册`;
  const bc = resolveBC(options, blueprints);
  const industry = getIndustryType(options.industry);
  const sceneImages = options.sceneImages || {};

  console.log(`[render-pptx] V6 | ${blueprints.length} pages | industry=${industry} | sceneImages=${Object.keys(sceneImages).length}`);

  for (const bp of blueprints) {
    const slide = pptx.addSlide();
    renderSlide(slide, bp, options, bc, industry, sceneImages);
  }
  return pptx;
}

export async function renderPptxToBuffer(blueprints: PageBlueprint[], options: RenderPptxOptions = {}): Promise<Buffer> {
  const pptx = await renderPptx(blueprints, options);
  const base64 = await pptx.write({ outputType: "base64" }) as string;
  return Buffer.from(base64, "base64");
}

const PAGE_ORDER = ["cover","toc","brand-philosophy","logo-interpretation","brand-colors","typography","basic-spec","stationery","packaging","marketing","summary","closing"];

function renderSlide(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType, sceneImages: Record<string, string>): void {
  switch (bp.pageId) {
    case "cover": renderCover(slide, bp, opts, bc); break;
    case "closing": renderClosing(slide, bp, opts, bc); break;
    case "toc": renderTableOfContents(slide, bp, opts, bc, industry); break;
    case "brand-philosophy": renderPhilosophy(slide, bp, opts, bc); break;
    case "logo-interpretation": renderLogoPage(slide, bp, opts, bc); break;
    case "brand-colors": renderColors(slide, bp, opts, bc); break;
    case "typography": renderTypography(slide, bp, opts, bc); break;
    case "basic-spec": renderBasicSpec(slide, bp, opts, bc); break;
    case "stationery": renderScene(slide, bp, opts, "stationery", bc, industry, sceneImages); break;
    case "packaging": renderScene(slide, bp, opts, "packaging", bc, industry, sceneImages); break;
    case "marketing": renderScene(slide, bp, opts, "marketing", bc, industry, sceneImages); break;
    case "summary": renderSummary(slide, bp, opts, bc); break;
    default: renderGeneric(slide, bp, opts, bc);
  }
  // 页码（封面/封底/目录不加）
  if (bp.pageId !== "cover" && bp.pageId !== "closing" && bp.pageId !== "toc") {
    const idx = PAGE_ORDER.indexOf(bp.pageId);
    slide.addText(`${idx > 0 ? idx : ""}`, { x: SW - MARGIN - 0.5, y: SH - 0.55, w: 0.5, h: 0.3, fontSize: 9, color: "BBBBBB", align: "right" });
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
  slide.addText(title, { x: MARGIN + LEFT_BAR_W, y: 0.5, w: CONTENT_W - LEFT_BAR_W, h: 0.7, fontSize: 24, bold: true, color: bc.priDark, fontFace: "Microsoft YaHei" });
  // 标题下装饰线
  slide.addShape("rect", { x: MARGIN + LEFT_BAR_W, y: 1.25, w: 2.0, h: 0.05, fill: { color: bc.acc } });
  // 底部品牌色细线
  slide.addShape("rect", { x: 0, y: SH - 0.06, w: SW, h: 0.06, fill: { color: bc.pri } });
}

// ========== Cover ==========
function renderCover(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  const cn = fta(bp, ["cover-company-name","company-name"]) || opts.companyName || "品牌";
  slide.background = { fill: bc.pri };
  // 顶部金色线
  slide.addShape("rect", { x: 0, y: 0, w: SW, h: 0.08, fill: { color: bc.acc } });

  // Logo — 大幅居中
  if (opts.logoData) {
    slide.addImage({ data: normImg(opts.logoData), x: (SW - 3.0) / 2, y: 1.0, w: 3.0, h: 3.0, sizing: { type: "contain", w: 3.0, h: 3.0 } });
  } else {
    slide.addShape("rect", { x: (SW - 3.5) / 2, y: 1.4, w: 3.5, h: 1.8, fill: { color: "FFFFFF" }, rectRadius: 0.15, shadow: { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 } });
  }

  // 品牌名 — 封面38pt
  slide.addText(cn, { x: MARGIN, y: 4.2, w: CONTENT_W, h: 1.0, fontSize: 38, bold: true, color: "FFFFFF", align: "center", fontFace: "Microsoft YaHei" });
  // 金色分隔线
  slide.addShape("rect", { x: (SW - 3.0) / 2, y: 5.4, w: 3.0, h: 0.04, fill: { color: bc.acc } });
  // 副标题
  slide.addText("品牌视觉识别系统（VI）规范手册", { x: MARGIN, y: 5.7, w: CONTENT_W, h: 0.6, fontSize: 20, bold: true, color: "FFFFFF", align: "center", transparency: 5 });
  slide.addText("VISUAL IDENTITY GUIDELINES", { x: MARGIN, y: 6.4, w: CONTENT_W, h: 0.4, fontSize: 14, color: "FFFFFF", align: "center", transparency: 20, charSpacing: 5 });

  // IP公仔 — 右下角
  if (opts.mascotData) {
    slide.addImage({ data: normImg(opts.mascotData), x: SW - 3.8, y: 7.2, w: 3.2, h: 3.0, sizing: { type: "contain", w: 3.2, h: 3.0 }, transparency: 5 });
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
    slide.addImage({ data: normImg(opts.mascotData), x: (SW - 2.5) / 2, y: SH / 2 + 0.5, w: 2.5, h: 2.8, sizing: { type: "contain", w: 2.5, h: 2.8 }, transparency: 10 });
  }
  slide.addText(`如有疑问，请联系 ${cn}`, { x: MARGIN, y: SH - 1.5, w: CONTENT_W, h: 0.4, fontSize: 12, color: "FFFFFF", align: "center", transparency: 30 });
  slide.addShape("rect", { x: 0, y: SH - 0.1, w: SW, h: 0.1, fill: { color: bc.acc } });
}

// ========== Brand Philosophy — V6: 直接用opts字段 ==========
function renderPhilosophy(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, "品牌核心理念", bc);

  // V6: 优先用opts直接传入的数据，不依赖blueprint元素匹配
  const sections = [
    { label: "品牌愿景", content: opts.brandVision || fta(bp, ["ph-vision-content","brand-vision-content","vision-content"]) || "待品牌方补充" },
    { label: "核心价值", content: opts.coreValues || fta(bp, ["ph-values-content","core-values-content","values-content"]) || "待品牌方补充" },
    { label: "目标市场", content: opts.targetMarket || fta(bp, ["ph-market-content","target-market-content","market-content"]) || "待品牌方补充" },
  ];

  let yPos = 1.8;
  for (const s of sections) {
    slide.addShape("rect", { x: MARGIN + LEFT_BAR_W, y: yPos, w: 0.12, h: 2.0, fill: { color: bc.pri }, rectRadius: 0.03 });
    slide.addText(s.label, { x: MARGIN + LEFT_BAR_W + 0.3, y: yPos + 0.1, w: CONTENT_W - 0.5, h: 0.5, fontSize: 17, bold: true, color: bc.pri, fontFace: "Microsoft YaHei" });
    slide.addText(s.content, { x: MARGIN + LEFT_BAR_W + 0.3, y: yPos + 0.7, w: CONTENT_W - 0.5, h: 1.0, fontSize: 13, color: "444444", lineSpacingMultiple: 1.6, valign: "top" });
    yPos += 2.4;
  }

  // IP公仔 — 右下角半透明装饰
  if (opts.mascotData) {
    slide.addImage({ data: normImg(opts.mascotData), x: SW - 2.2, y: SH - 3.5, w: 1.8, h: 2.2, sizing: { type: "contain", w: 1.8, h: 2.2 }, transparency: 70 });
  }
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
function renderLogoPage(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, "标识诠释", bc);

  // Logo展示区 — 居中放大
  const logoW = 3.5, logoH = 3.5;
  if (opts.logoData) {
    slide.addShape("rect", { x: (SW - logoW - 0.6) / 2, y: 1.6, w: logoW + 0.6, h: logoH + 0.6, fill: { color: "F5F5F5" }, rectRadius: 0.1 });
    slide.addImage({ data: normImg(opts.logoData), x: (SW - logoW) / 2, y: 1.9, w: logoW, h: logoH, sizing: { type: "contain", w: logoW, h: logoH } });
  } else {
    slide.addShape("rect", { x: (SW - 3.5) / 2, y: 1.6, w: 3.5, h: 3.5, fill: { color: "F5F5F5" }, rectRadius: 0.1 });
  }

  // V12: 品牌故事叙事
  const philosophy = opts.logoPhilosophy || fta(bp, ["logo-philosophy","logo-meaning","logo-concept"]) || "Logo 凝练了品牌核心视觉要素，体现品牌独特识别性。";
  slide.addShape("rect", { x: MARGIN + LEFT_BAR_W, y: 5.6, w: 0.08, h: 1.8, fill: { color: bc.pri }, rectRadius: 0.03 });
  slide.addText("设计理念", { x: MARGIN + LEFT_BAR_W + 0.25, y: 5.6, w: CONTENT_W - 0.3, h: 0.45, fontSize: 17, bold: true, color: bc.pri, fontFace: "Microsoft YaHei" });
  slide.addText(philosophy, { x: MARGIN + LEFT_BAR_W + 0.25, y: 6.1, w: CONTENT_W - 0.3, h: 1.3, fontSize: 13, color: "444444", lineSpacingMultiple: 1.6 });
  // 核心视觉要素
  const kwY = 7.5;
  slide.addText("核心视觉要素", { x: MARGIN + LEFT_BAR_W, y: kwY, w: CONTENT_W, h: 0.4, fontSize: 14, bold: true, color: bc.pri });
  const keywords = extractKeywords(philosophy);
  const kwW = (CONTENT_W - 0.2) / 3;
  for (let ki = 0; ki < Math.min(keywords.length, 3); ki++) {
    const kx = MARGIN + LEFT_BAR_W + ki * (kwW + 0.1);
    slide.addShape("oval", { x: kx, y: kwY + 0.5, w: 0.6, h: 0.6, fill: { color: bc.pri } });
    slide.addText(String(ki + 1), { x: kx, y: kwY + 0.5, w: 0.6, h: 0.6, fontSize: 14, color: "FFFFFF", align: "center", valign: "middle", bold: true });
    slide.addText(keywords[ki], { x: kx + 0.7, y: kwY + 0.5, w: kwW - 0.7, h: 0.6, fontSize: 12, color: "333333", valign: "middle" });
  }

  // IP公仔区域
  if (opts.mascotData) {
    slide.addText("IP 角色介绍", { x: MARGIN + LEFT_BAR_W, y: 8.0, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.pri });
    const ipW = 2.2, ipH = 2.6;
    slide.addShape("rect", { x: (SW - ipW - 0.4) / 2, y: 8.5, w: ipW + 0.4, h: ipH + 0.2, fill: { color: "F5F5F5" }, rectRadius: 0.08 });
    slide.addImage({ data: normImg(opts.mascotData), x: (SW - ipW) / 2, y: 8.6, w: ipW, h: ipH, sizing: { type: "contain", w: ipW, h: ipH } });
    const mascotDesc = opts.mascotPhilosophy || fta(bp, ["mascot-philosophy","mascot-meaning","ip-intro"]) || "品牌IP公仔，承载品牌个性与亲和力。";
    slide.addText(mascotDesc, { x: MARGIN + LEFT_BAR_W, y: SH - 1.0, w: CONTENT_W, h: 0.5, fontSize: 11, color: "666666", align: "center", lineSpacingMultiple: 1.4 });
  }
}

// ========== Brand Colors ==========
function renderColors(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, "标准色彩规范", bc);

  const colors = [
    { hex: bc.pri, label: "品牌主色", name: "Primary" },
    { hex: bc.sec, label: "辅助色", name: "Secondary" },
    { hex: bc.acc, label: "强调色", name: "Accent" },
  ];
  const blockW = 2.0, blockH = 2.4, gap = 0.3;
  const totalW = blockW * 3 + gap * 2;
  const startX = (SW - totalW) / 2;
  const startY = 1.6;

  // V12: 圆形色卡
  const circleSize = 2.0;
  const circleGap = 0.6;
  const circleTotalW = circleSize * 3 + circleGap * 2;
  const circleStartX = (SW - circleTotalW) / 2;

  for (let i = 0; i < 3; i++) {
    const c = colors[i];
    const x = circleStartX + i * (circleSize + circleGap);
    const isWhite = c.hex === "FFFFFF" || c.hex === "FFF";
    slide.addShape("oval", {
      x, y: startY, w: circleSize, h: circleSize,
      fill: { color: c.hex },
      line: isWhite ? { color: "CCCCCC", width: 1 } : undefined,
      shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.1 },
    });
    const textColor = isLight(c.hex) ? "333333" : "FFFFFF";
    // V12: 圆形色卡标签
    slide.addText(c.name, { x, y: startY + 0.3, w: circleSize, h: 0.4, fontSize: 13, color: textColor, align: "center", transparency: 40 });
    slide.addText(c.label, { x, y: startY + circleSize + 0.15, w: circleSize, h: 0.4, fontSize: 13, bold: true, color: "333333", align: "center" });
    slide.addText(`#${c.hex}`, { x, y: startY + circleSize + 0.55, w: circleSize, h: 0.3, fontSize: 12, color: "555555", align: "center" });
    const rgb = hex2rgb(c.hex);
    if (rgb) {
      slide.addText(`RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`, { x, y: startY + circleSize + 0.85, w: circleSize, h: 0.3, fontSize: 11, color: "777777", align: "center" });
      const cmyk = rgb2cmyk(rgb);
      if (cmyk) slide.addText(`CMYK: ${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`, { x, y: startY + circleSize + 1.15, w: circleSize, h: 0.3, fontSize: 11, color: "777777", align: "center" });
    }
  }

  // 色彩组合
  const comboY = startY + circleSize + 1.8;
  slide.addText("色彩组合示例", { x: MARGIN + LEFT_BAR_W, y: comboY, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.pri });
  const combos = [
    { colors: [bc.pri, bc.sec], label: "主色 + 辅助色" },
    { colors: ["FFFFFF", bc.acc], label: "白底 + 强调色" },
    { colors: [bc.priDark, "FFFFFF"], label: "深主色 + 白底" },
  ];
  const comboW = 2.0, comboH = 0.8;
  for (let i = 0; i < combos.length; i++) {
    const cx = startX + i * (comboW + gap);
    const halfW = comboW / 2;
    slide.addShape("rect", { x: cx, y: comboY + 0.6, w: halfW, h: comboH, fill: { color: combos[i].colors[0] }, line: combos[i].colors[0] === "FFFFFF" ? { color: "E0E0E0", width: 0.5 } : undefined });
    slide.addShape("rect", { x: cx + halfW, y: comboY + 0.6, w: halfW, h: comboH, fill: { color: combos[i].colors[1] }, line: combos[i].colors[1] === "FFFFFF" ? { color: "E0E0E0", width: 0.5 } : undefined });
    slide.addText(combos[i].label, { x: cx, y: comboY + 0.6 + comboH + 0.1, w: comboW, h: 0.3, fontSize: 11, color: "555555", align: "center" });
  }
}

// ========== Typography ==========
function renderTypography(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, "字体系统", bc);
  const cx = MARGIN + LEFT_BAR_W;
  let yPos = 1.6;

  // 中文字体
  slide.addShape("rect", { x: cx, y: yPos, w: 0.12, h: 1.5, fill: { color: bc.pri }, rectRadius: 0.03 });
  slide.addText("中文字体", { x: cx + 0.3, y: yPos + 0.1, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.pri });
  slide.addText("标题字体：思源黑体 / Noto Sans SC", { x: cx + 0.3, y: yPos + 0.6, w: CONTENT_W, h: 0.35, fontSize: 13, color: "444444" });
  slide.addText("正文字体：思源宋体 / Noto Serif SC", { x: cx + 0.3, y: yPos + 0.95, w: CONTENT_W, h: 0.35, fontSize: 13, color: "444444" });
  yPos += 2.0;

  // 英文字体
  slide.addShape("rect", { x: cx, y: yPos, w: 0.12, h: 1.5, fill: { color: bc.sec }, rectRadius: 0.03 });
  slide.addText("英文字体", { x: cx + 0.3, y: yPos + 0.1, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.sec });
  slide.addText("Brand Font: Montserrat", { x: cx + 0.3, y: yPos + 0.6, w: CONTENT_W, h: 0.35, fontSize: 13, color: "444444" });
  slide.addText("Body Font: Open Sans", { x: cx + 0.3, y: yPos + 0.95, w: CONTENT_W, h: 0.35, fontSize: 13, color: "444444" });
  yPos += 2.0;

  // 字号层级
  slide.addText("字号层级规范", { x: cx, y: yPos, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.pri });
  const rows = [
    [{ text: "层级", options: { fontSize: 11, bold: true, color: "FFFFFF" } }, { text: "字号", options: { fontSize: 11, bold: true, color: "FFFFFF" } }, { text: "应用场景", options: { fontSize: 11, bold: true, color: "FFFFFF" } }],
    [{ text: "一级标题", options: { fontSize: 11, color: "333333" } }, { text: "36-40pt", options: { fontSize: 11, color: "333333" } }, { text: "封面标题", options: { fontSize: 11, color: "333333" } }],
    [{ text: "二级标题", options: { fontSize: 11, color: "333333" } }, { text: "22-26pt", options: { fontSize: 11, color: "333333" } }, { text: "章节标题", options: { fontSize: 11, color: "333333" } }],
    [{ text: "三级标题", options: { fontSize: 11, color: "333333" } }, { text: "16-18pt", options: { fontSize: 11, color: "333333" } }, { text: "小标题/栏目", options: { fontSize: 11, color: "333333" } }],
    [{ text: "正文", options: { fontSize: 11, color: "333333" } }, { text: "13-14pt", options: { fontSize: 11, color: "333333" } }, { text: "正文说明", options: { fontSize: 11, color: "333333" } }],
    [{ text: "辅助文字", options: { fontSize: 11, color: "333333" } }, { text: "11pt", options: { fontSize: 11, color: "333333" } }, { text: "注释/标注/页码", options: { fontSize: 11, color: "333333" } }],
  ];
  slide.addTable(rows, { x: cx, y: yPos + 0.55, w: CONTENT_W, colW: [2.0, 2.0, 3.07], border: { pt: 0.5, color: "E0E0E0" }, rowH: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4], autoPage: false });
}

// ========== Basic Spec ==========
function renderBasicSpec(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, "基础规范", bc);
  const cx = MARGIN + LEFT_BAR_W;

  // Logo保护空间
  slide.addText("LOGO 保护空间", { x: cx, y: 1.6, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.pri });
  slide.addText("LOGO 四周保留至少 15% 保护空间，不可被任何元素遮挡或裁切", { x: cx, y: 2.1, w: CONTENT_W, h: 0.4, fontSize: 13, color: "555555" });

  const demoSize = 2.8;
  const demoX = (SW - demoSize) / 2;
  const demoY = 2.8;
  slide.addShape("rect", { x: demoX - 0.35, y: demoY - 0.35, w: demoSize + 0.7, h: demoSize + 0.7, fill: { color: "F5F5F5" }, rectRadius: 0.05, line: { color: "E0E0E0", width: 0.5, dashType: "dash" } });
  if (opts.logoData) {
    slide.addImage({ data: normImg(opts.logoData), x: demoX, y: demoY, w: demoSize, h: demoSize, sizing: { type: "contain", w: demoSize, h: demoSize } });
  }
  slide.addText("15% 保护空间", { x: demoX - 0.35, y: demoY + demoSize + 0.15, w: demoSize + 0.7, h: 0.3, fontSize: 11, color: "999999", align: "center" });

  // 最小尺寸
  slide.addText("最小尺寸规范", { x: cx, y: 6.5, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.pri });
  const rows = [
    [{ text: "应用场景", options: { fontSize: 11, bold: true, color: "FFFFFF" } }, { text: "最小宽度", options: { fontSize: 11, bold: true, color: "FFFFFF" } }, { text: "说明", options: { fontSize: 11, bold: true, color: "FFFFFF" } }],
    [{ text: "印刷品", options: { fontSize: 11, color: "333333" } }, { text: "30mm", options: { fontSize: 11, color: "333333" } }, { text: "名片/信封等印刷物料", options: { fontSize: 11, color: "333333" } }],
    [{ text: "数字媒体", options: { fontSize: 11, color: "333333" } }, { text: "80px", options: { fontSize: 11, color: "333333" } }, { text: "网站/App 等数字媒介", options: { fontSize: 11, color: "333333" } }],
    [{ text: "户外广告", options: { fontSize: 11, color: "333333" } }, { text: "200mm", options: { fontSize: 11, color: "333333" } }, { text: "广告牌/展架等大尺寸场景", options: { fontSize: 11, color: "333333" } }],
  ];
  slide.addTable(rows, { x: cx, y: 7.1, w: CONTENT_W, colW: [2.0, 2.0, 3.07], border: { pt: 0.5, color: "E0E0E0" }, rowH: [0.4, 0.4, 0.4, 0.4], autoPage: false });
}

// ========== 场景页 — V6: AI写实图 + 降级色块 ==========
function renderScene(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, type: string, bc: BC, industry: IndustryType, sceneImages: Record<string, string>): void {
  const configs = getSceneConfigs(industry);
  const config = configs[type] || { title: type, desc: "" };
  addContentFrame(slide, config.title, bc);
  const cx = MARGIN + LEFT_BAR_W;
  slide.addText(config.desc, { x: cx, y: 1.4, w: CONTENT_W, h: 0.4, fontSize: 13, color: "666666" });

  // 获取该场景类型的AI图片
  const pageImages = Object.entries(sceneImages).filter(([k]) => k.startsWith(type));

  if (pageImages.length > 0) {
    // ===== V6: 有AI写实图，展示图片 =====
    renderSceneWithImages(slide, opts, bc, type, industry, pageImages, cx);
  } else {
    // ===== 降级: 无AI图，回退到色块方案 =====
    renderSceneFallback(slide, opts, bc, type, industry, cx);
  }
}

/** V6: 使用AI写实图的场景页 */
function renderSceneWithImages(
  slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC,
  type: string, industry: IndustryType,
  pageImages: [string, string][], cx: number
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
      slide.addImage({
        data: normImg(imgData),
        x: imgX, y: startY, w: imgW, h: imgH,
        sizing: { type: "cover", w: imgW, h: imgH },
        rounding: true,
      });

      // 品牌色底部条
      slide.addShape("rect", { x: imgX, y: startY + imgH - 0.08, w: imgW, h: 0.08, fill: { color: bc.pri, transparency: 30 } });

      // 标注文字
      const label = sceneLabels[key] || labels[i] || key;
      slide.addText(label, { x: imgX, y: startY + imgH + 0.1, w: imgW, h: 0.35, fontSize: 13, bold: true, color: "333333", align: "center" });
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
      slide.addImage({
        data: normImg(imgData),
        x: imgX, y: imgY, w: colW, h: imgH,
        sizing: { type: "cover", w: colW, h: imgH },
        rounding: true,
      });

      // 品牌色底部条
      slide.addShape("rect", { x: imgX, y: imgY + imgH - 0.06, w: colW, h: 0.06, fill: { color: bc.pri, transparency: 30 } });

      // 标注
      const label = sceneLabels[key] || labels[i] || key;
      slide.addText(label, { x: imgX, y: imgY + imgH + 0.08, w: colW, h: 0.3, fontSize: 11, color: "555555", align: "center" });

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

/** 降级：无AI图时的色块方案 */
function renderSceneFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, industry: IndustryType, cx: number): void {
  switch (industry) {
    case "restaurant": renderRestaurantFallback(slide, opts, bc, type, cx); break;
    case "beverage": renderBeverageFallback(slide, opts, bc, type, cx); break;
    case "beauty": renderBeautyFallback(slide, opts, bc, type, cx); break;
    case "retail": renderRetailFallback(slide, opts, bc, type, cx); break;
    default: renderGeneralFallback(slide, opts, bc, type, cx);
  }
}

// ========== 餐饮降级 ==========
function renderRestaurantFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    // 餐巾纸套
    const nw = 4.5, nh = 1.8, nx = (SW - nw) / 2, ny = 2.2;
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: "FFFFFF" }, rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.1 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: bc.pri, transparency: 8 }, rectRadius: 0.06 });
    slide.addShape("rect", { x: nx, y: ny, w: 0.12, h: nh, fill: { color: bc.priDark } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: nx + 0.3, y: ny + 0.2, w: 1.3, h: 0.8, sizing: { type: "contain", w: 1.3, h: 0.8 } });
    slide.addText(opts.companyName || "品牌", { x: nx + 1.8, y: ny + 0.2, w: 2.2, h: 0.5, fontSize: 17, bold: true, color: "333333" });
    slide.addText("优质餐巾纸 · 用心服务", { x: nx + 1.8, y: ny + 0.8, w: 2.2, h: 0.35, fontSize: 11, color: "888888" });
    slide.addShape("rect", { x: nx + 0.3, y: ny + nh - 0.35, w: nw - 0.6, h: 0.04, fill: { color: bc.acc } });
    slide.addText("餐巾纸套", { x: nx, y: ny + nh + 0.1, w: nw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    // 外卖袋
    const bw = 3.5, bh = 4.2, bx = (SW - bw) / 2, by = 2.2;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 } });
    slide.addShape("line", { x: bx + 0.8, y: by - 0.3, w: 0, h: 0.4, line: { color: bc.priDark, width: 2.5 } });
    slide.addShape("line", { x: bx + bw - 0.8, y: by - 0.3, w: 0, h: 0.4, line: { color: bc.priDark, width: 2.5 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.25, fill: { color: bc.priDark }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.5, y: by + 0.6, w: 2.5, h: 2.0, sizing: { type: "contain", w: 2.5, h: 2.0 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("外卖袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    // 促销海报
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.2;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.45, fill: { color: bc.pri }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 1.2, y: py + 0.5, w: 2.0, h: 1.5, sizing: { type: "contain", w: 2.0, h: 1.5 } });
    slide.addText("限时特惠", { x: px + 0.5, y: py + ph * 0.45 + 0.3, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "333333" });
    slide.addText("会员专享优惠活动", { x: px + 0.5, y: py + ph * 0.45 + 1.0, w: pw - 1.0, h: 0.4, fontSize: 13, color: "888888" });
    slide.addShape("rect", { x: px + 0.5, y: py + ph * 0.45 + 1.6, w: 1.5, h: 0.04, fill: { color: bc.acc } });
    slide.addText("促销海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 茶饮降级 ==========
function renderBeverageFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const cw = 3.0, ch = 4.5, cX = (SW - cw) / 2, cy = 2.0;
    slide.addShape("rect", { x: cX, y: cy, w: cw, h: ch, fill: { color: bc.priLight }, rectRadius: 0.1, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.12 } });
    slide.addShape("rect", { x: cX, y: cy, w: cw, h: ch * 0.4, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addShape("ellipse", { x: cX + cw / 2 - 0.7, y: cy + 0.3, w: 1.4, h: 1.4, fill: { color: "FFFFFF" }, line: { color: "E0E0E0", width: 0.5 } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: cX + cw / 2 - 0.5, y: cy + 0.5, w: 1.0, h: 1.0, sizing: { type: "contain", w: 1.0, h: 1.0 } });
    slide.addText(opts.companyName || "品牌", { x: cX, y: cy + 2.0, w: cw, h: 0.4, fontSize: 17, bold: true, color: "333333", align: "center" });
    slide.addShape("rect", { x: cX + 0.5, y: cy + 2.6, w: cw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("外带杯 / 杯套", { x: cX, y: cy + ch + 0.1, w: cw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.0, bx = (SW - bw) / 2, by = 2.2;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.25, fill: { color: bc.priDark }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.5, y: by + 0.6, w: 2.5, h: 2.0, sizing: { type: "contain", w: 2.5, h: 2.0 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("手提袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 4.0, ph = 5.5, px = (SW - pw) / 2, py = 2.2;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 } });
    slide.addText("限时优惠", { x: px + 0.5, y: py + 0.5, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: px + 0.5, y: py + 1.3, w: pw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("第二杯半价", { x: px, y: py + 1.6, w: pw, h: 0.4, fontSize: 17, color: "FFFFFF", align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 0.6, y: py + 2.5, w: 1.8, h: 1.0, sizing: { type: "contain", w: 1.8, h: 1.0 }, transparency: 10 });
    slide.addText("促销卡", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 美容降级 ==========
function renderBeautyFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const aw = 3.8, ah = 2.4, ax = (SW - aw) / 2, ay = 2.0;
    slide.addShape("rect", { x: ax, y: ay, w: aw, h: ah, fill: { color: "FFFFFF" }, rectRadius: 0.1, shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.1 }, line: { color: bc.pri, width: 1 } });
    slide.addShape("rect", { x: ax, y: ay, w: aw, h: 0.08, fill: { color: bc.pri } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: ax + 0.3, y: ay + 0.2, w: 1.0, h: 0.6, sizing: { type: "contain", w: 1.0, h: 0.6 } });
    slide.addText("预约卡", { x: ax + 1.5, y: ay + 0.2, w: 2.0, h: 0.4, fontSize: 17, bold: true, color: bc.pri });
    slide.addText("预约日期：____年____月____日\n预约项目：________________\n预约技师：________________", { x: ax + 0.3, y: ay + 1.0, w: aw - 0.6, h: 1.0, fontSize: 11, color: "666666", lineSpacingMultiple: 1.6 });
    slide.addText("预约卡", { x: ax, y: ay + ah + 0.1, w: aw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const gw = 3.2, gh = 4.0, gx = (SW - gw) / 2, gy = 2.0;
    slide.addShape("rect", { x: gx, y: gy, w: gw, h: gh, fill: { color: bc.priLight }, rectRadius: 0.08, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.1 }, line: { color: bc.pri, width: 1 } });
    slide.addShape("rect", { x: gx, y: gy, w: gw, h: 0.2, fill: { color: bc.pri } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: gx + 0.5, y: gy + 0.6, w: 2.2, h: 1.5, sizing: { type: "contain", w: 2.2, h: 1.5 }, transparency: 5 });
    slide.addText("礼品袋", { x: gx, y: gy + gh + 0.1, w: gw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 3.5, ph = 5.5, px = 0.8, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.12 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 1.0, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addText("服务价目表", { x: px, y: py + 0.2, w: pw, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", align: "center" });
    slide.addText("促销海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 零售降级 ==========
function renderRetailFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const nw = 3.8, nh = 2.4, nx = (SW - nw) / 2, ny = 2.0;
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.1 }, line: { color: "E8E8E8", width: 0.3 } });
    slide.addShape("rect", { x: nx, y: ny, w: 0.12, h: nh, fill: { color: bc.pri } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: nx + 0.3, y: ny + 0.2, w: 1.3, h: 0.8, sizing: { type: "contain", w: 1.3, h: 0.8 } });
    slide.addText("名片", { x: nx, y: ny + nh + 0.1, w: nw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.0, bx = (SW - bw) / 2, by = 2.2;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.25, fill: { color: bc.priDark }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.5, y: by + 0.6, w: 2.5, h: 1.8, sizing: { type: "contain", w: 2.5, h: 1.8 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.6, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.2, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("购物袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.45, fill: { color: bc.pri }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 1.2, y: py + 0.5, w: 2.0, h: 1.5, sizing: { type: "contain", w: 2.0, h: 1.5 } });
    slide.addText("限时特惠", { x: px + 0.5, y: py + ph * 0.45 + 0.3, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "333333" });
    slide.addText("促销海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 通用降级 ==========
function renderGeneralFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const nw = 3.8, nh = 2.4, nx = (SW - nw) / 2, ny = 2.2;
    slide.addShape("rect", { x: nx, y: ny, w: nw, h: nh, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.12 }, line: { color: "E8E8E8", width: 0.3 } });
    slide.addShape("rect", { x: nx, y: ny, w: 0.12, h: nh, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: nx + 0.3, y: ny + 0.25, w: 1.5, h: 0.8, sizing: { type: "contain", w: 1.5, h: 0.8 } });
    slide.addText("名片", { x: nx, y: ny + nh + 0.1, w: nw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.0, bx = (SW - bw) / 2, by = 2.2;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.5, y: by + 0.6, w: 2.5, h: 2.0, sizing: { type: "contain", w: 2.5, h: 2.0 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("手提袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.2;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.45, fill: { color: bc.pri }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 1.2, y: py + 0.5, w: 2.0, h: 1.5, sizing: { type: "contain", w: 2.0, h: 1.5 } });
    slide.addText("品牌宣传", { x: px + 0.5, y: py + ph * 0.45 + 0.3, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "333333" });
    slide.addText("海报 / 宣传页", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== Table of Contents — V7新增 ==========
function renderTableOfContents(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, "目录", bc);
  const cn = opts.companyName || "品牌";
  const cx = MARGIN + LEFT_BAR_W + 0.5;

  // 品牌名
  slide.addText(cn, { x: cx, y: 1.6, w: CONTENT_W, h: 0.5, fontSize: 17, bold: true, color: bc.pri, fontFace: "Microsoft YaHei" });
  slide.addShape("rect", { x: cx, y: 2.15, w: 1.5, h: 0.04, fill: { color: bc.acc } });

  // 目录项
  const tocItems = getTocItems(industry);
  let yPos = 2.6;
  for (let i = 0; i < tocItems.length; i++) {
    const item = tocItems[i];
    const numStr = String(i + 1).padStart(2, "0");
    // 序号
    slide.addText(numStr, { x: cx, y: yPos, w: 0.6, h: 0.5, fontSize: 13, bold: true, color: bc.pri, fontFace: "Microsoft YaHei" });
    // 标题
    slide.addText(item.title, { x: cx + 0.7, y: yPos, w: CONTENT_W - 1.5, h: 0.5, fontSize: 13, color: "333333", fontFace: "Microsoft YaHei" });
    // 点线
    slide.addText("....................................................................................", { x: cx + 0.7, y: yPos, w: CONTENT_W - 1.5, h: 0.5, fontSize: 9, color: "CCCCCC", align: "right" });
    // 页码
    slide.addText(`${i + 2}`, { x: cx + CONTENT_W - 0.6, y: yPos, w: 0.6, h: 0.5, fontSize: 13, color: "999999", align: "right" });
    yPos += 0.6;
  }

  // 底部品牌色装饰
  slide.addShape("rect", { x: cx, y: yPos + 0.5, w: 3.0, h: 0.08, fill: { color: bc.pri, transparency: 40 } });
}

function getTocItems(industry: IndustryType): { title: string }[] {
  const baseItems = [
    { title: "品牌核心理念" },
    { title: "标识诠释" },
    { title: "标准色彩规范" },
    { title: "字体系统" },
    { title: "基础规范" },
  ];
  const sceneItems: Record<IndustryType, { title: string }[]> = {
    restaurant: [{ title: "餐饮应用系统" }, { title: "餐饮包装系统" }, { title: "餐饮营销系统" }],
    beverage: [{ title: "饮品应用系统" }, { title: "饮品包装系统" }, { title: "饮品营销系统" }],
    beauty: [{ title: "美容应用系统" }, { title: "美容包装系统" }, { title: "美容营销系统" }],
    retail: [{ title: "零售应用系统" }, { title: "零售包装系统" }, { title: "零售营销系统" }],
    education: [{ title: "教育应用系统" }, { title: "教育包装系统" }, { title: "教育营销系统" }],
    general: [{ title: "办公应用系统" }, { title: "产品包装系统" }, { title: "营销展示系统" }],
  };
  const endItems = [
    { title: "总结" },
  ];
  return [...baseItems, ...(sceneItems[industry] || sceneItems.general), ...endItems];
}

// ========== Summary ==========
function renderSummary(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC): void {
  addContentFrame(slide, "总结", bc);
  const cx = MARGIN + LEFT_BAR_W;

  const vision = opts.brandVision || fta(bp, ["ph-vision-content","brand-vision-content","vision-content"]);
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
    slide.addText(p.desc, { x: cx + 0.9, y: yPos + 0.5, w: CONTENT_W - 1.1, h: 0.7, fontSize: 13, color: "555555", lineSpacingMultiple: 1.5 });
    yPos += 1.6;
  }
}

// ========== Generic ==========
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

// ========== 工具函数 ==========
function hx(c: string): string { return c.replace("#", "").toUpperCase(); }
function normImg(d: string): string { return d.startsWith("data:") ? d : `data:image/png;base64,${d}`; }
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
}

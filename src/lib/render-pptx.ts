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
  aiLogoData?: string;  // V14: AI生成的组合Logo图(base64)
}

// ========== 行业类型 ==========
type IndustryType = "restaurant" | "fastfood" | "beverage" | "beauty" | "fashion" | "mother_baby" | "wedding" | "fitness" | "pharmacy" | "pet" | "retail" | "education" | "general";

function getIndustryType(industry?: string): IndustryType {
  if (!industry) return "general";
  const s = industry.toLowerCase();
  // V13: 行业匹配优先级 — 越具体越靠前
  if (/美容|美发|理发|美甲|spa|沙龙|造型|护肤|美体|美睫|剪发|烫发/.test(s)) return "beauty";
  if (/婚|婚庆|婚纱|摄影|影楼|照相|写真|跟拍|司仪/.test(s)) return "wedding";
  if (/药|诊所|中医|牙科|骨科|推拿|针灸|理疗|药房|大药房/.test(s)) return "pharmacy";
  if (/宠物|猫咖|狗咖|水族/.test(s)) return "pet";
  if (/健身|瑜伽|武术|搏击|游泳|运动|跆拳道|舞蹈|普拉提/.test(s)) return "fitness";
  if (/母婴|儿童|婴儿|奶粉|早教|月子|孕妇|宝宝/.test(s)) return "mother_baby";
  if (/服装|鞋|帽|服饰|女装|男装|内衣|皮具|箱包|裁缝|西装|潮牌/.test(s)) return "fashion";
  if (/椰|椰子|椰汁|茶|咖啡|饮|奶茶|果汁|酒|酒吧|饮品|奶茶店|气泡|矿泉|纯净水/.test(s)) return "beverage";
  // V14: 二级格式优先匹配
  if (s.includes(":")) {
    const [cat, sub] = s.split(":");
    if (cat === "美食") {
      if (/小吃快餐|速食|快餐/.test(sub)) return "fastfood";
      return "restaurant";
    }
    if (cat === "饮品") return "beverage";
    if (cat === "丽人") return "beauty";
    if (cat === "购物") {
      if (/服装|鞋帽/.test(sub)) return "fashion";
      if (/母婴|儿童/.test(sub)) return "mother_baby";
      return "retail";
    }
    if (cat === "生活服务") {
      if (/婚庆|摄影/.test(sub)) return "wedding";
      if (/宠物/.test(sub)) return "pet";
      return "general";
    }
    if (cat === "运动健身") return "fitness";
    if (cat === "教育培训") return "education";
    if (cat === "医疗保健") return "pharmacy";
  }
  // V14: fastfood在restaurant之前匹配
  if (/小吃快餐|速食|快餐|汉堡|炸鸡|盒饭|盖浇/.test(s)) return "fastfood";
  if (/餐|食|面|火锅|烧烤|烘焙|饺子|包子|炒菜|饭店|小吃|饭馆|海鲜|川菜|粤菜|湘菜|鲁菜|馆|外卖/.test(s)) return "restaurant";
  if (/零售|超市|便利|商店|杂货|数码/.test(s)) return "retail";
  if (/教育|培训|学|课|幼儿园|托管|辅导/.test(s)) return "education";
  return "general";
}

// 行业默认色（与route.ts保持一致）
const INDUSTRY_BC: Record<IndustryType, { pri: string; sec: string; acc: string }> = {
  restaurant: { pri: "2E7D32", sec: "E65100", acc: "F9A825" },
  fastfood:  { pri: "D32F2F", sec: "F9A825", acc: "FFFFFF" },
  beverage:   { pri: "00695C", sec: "D84315", acc: "FFB300" },
  beauty:     { pri: "E8576C", sec: "9B72CF", acc: "F0D5A8" },
  fashion:    { pri: "1A1A2E", sec: "C9A96E", acc: "E8D5B7" },
  mother_baby:{ pri: "E8836B", sec: "5B9EA6", acc: "F5C6AA" },
  wedding:    { pri: "8B6F4E", sec: "D4A574", acc: "F5E6D3" },
  fitness:    { pri: "D32F2F", sec: "1B5E20", acc: "FFC107" },
  pharmacy:   { pri: "1565C0", sec: "2E7D32", acc: "BBDEFB" },
  pet:        { pri: "FF8F00", sec: "5D4037", acc: "FFE082" },
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

const PAGE_ORDER = ["cover","toc","brand-philosophy","logo-interpretation","logo-variations","logo-misuse","auxiliary-graphics","brand-colors","typography","basic-spec","stationery","packaging","marketing","summary","closing"];

function renderSlide(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType, sceneImages: Record<string, string>): void {
  switch (bp.pageId) {
    case "cover": renderCover(slide, bp, opts, bc, industry); break;
    case "closing": renderClosing(slide, bp, opts, bc); break;
    case "toc": renderTableOfContents(slide, bp, opts, bc, industry); break;
    case "brand-philosophy": renderPhilosophy(slide, bp, opts, bc); break;
    case "logo-interpretation": renderLogoPage(slide, bp, opts, bc, industry); break;
    case "logo-variations": renderLogoVariations(slide, bp, opts, bc, industry); break;
    case "logo-misuse": renderLogoMisuse(slide, bp, opts, bc, industry); break;
    case "auxiliary-graphics": renderAuxiliaryGraphics(slide, bp, opts, bc, industry); break;
    case "brand-colors": renderColors(slide, bp, opts, bc); break;
    case "typography": renderTypography(slide, bp, opts, bc); break;
    case "basic-spec": renderBasicSpec(slide, bp, opts, bc, industry); break;
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

function addComboLogo(slide: PptxGenJS.Slide, text: string, x: number, y: number, w: number, h: number, bc: BC, industry: IndustryType, opts: { fontSize?: number; color?: string; layout?: "vertical"|"horizontal"; showLine?: boolean; aiLogoData?: string } = {}): void {
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

    const textY = iconTop + iconSize + 0.25;
    const textH = h - iconSize - 0.5;
    slide.addText(text, {
      x, y: textY, w, h: Math.max(textH, 0.5),
      fontSize: fs,
      bold: true,
      color: clr,
      align: "center",
      valign: "top",
      fontFace: "Microsoft YaHei",
      charSpacing: fs > 20 ? 10 : 4,
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
    slide.addText(text, {
      x: x + iconSize + 0.15, y, w: w - iconSize - 0.15, h,
      fontSize: fs,
      bold: true,
      color: clr,
      align: "left",
      valign: "middle",
      fontFace: "Microsoft YaHei",
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
    slide.addText(cn, { x: MARGIN, y: 4.2, w: CONTENT_W, h: 1.0, fontSize: 38, bold: true, color: "FFFFFF", align: "center", fontFace: "Microsoft YaHei" });
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
function renderLogoPage(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, "标识诠释", bc);

  // Logo展示区 — 居中放大
  const logoW = 3.5, logoH = 3.5;
  if (opts.logoData) {
    slide.addShape("rect", { x: (SW - logoW - 0.6) / 2, y: 1.6, w: logoW + 0.6, h: logoH + 0.6, fill: { color: "F5F5F5" }, rectRadius: 0.1 });
    slide.addImage({ data: normImg(opts.logoData), x: (SW - logoW) / 2, y: 1.9, w: logoW, h: logoH, sizing: { type: "contain", w: logoW, h: logoH } });
  } else {
    // V13: 无Logo图时渲染字标
    slide.addShape("rect", { x: (SW - 3.5) / 2, y: 1.6, w: 3.5, h: 3.5, fill: { color: "F5F5F5" }, rectRadius: 0.1 });
    // 组合Logo展示 = 行业图标 + 品牌名字标
    addComboLogo(slide, opts.companyName || "品牌", (SW - 3.5) / 2, 1.2, 3.5, 3.8, bc, industry, { fontSize: 40, color: bc.pri, layout: "vertical", aiLogoData: opts.aiLogoData });
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
    slide.addShape("ellipse", { x: kx, y: kwY + 0.5, w: 0.6, h: 0.6, fill: { color: bc.pri } });
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
// ---- Logo组合规范 ----
function renderLogoVariations(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, bp.label || "Logo组合规范", bc);
  const cx = MARGIN + LEFT_BAR_W;
  const companyName = opts.companyName || "品牌";
  const aiLogo = opts.aiLogoData || (opts.logoData ? normImg(opts.logoData) : undefined);

  // 2x2 grid of logo variations
  const variations = [
    { label: "横式组合", col: 0, row: 0, layout: "horizontal" as const, invert: false, bg: "F5F5F5" },
    { label: "竖式组合", col: 1, row: 0, layout: "vertical" as const, invert: false, bg: "F5F5F5" },
    { label: "反白稿（深底）", col: 0, row: 1, layout: "vertical" as const, invert: true, bg: "" },
    { label: "单色稿", col: 1, row: 1, layout: "vertical" as const, invert: false, bg: "FFFFFF" },
  ];

  const gap = 0.2;
  const cellW = (CONTENT_W - gap) / 2;
  const cellH = 2.6;

  for (const v of variations) {
    const x = cx + v.col * (cellW + gap);
    const y = 1.6 + v.row * (cellH + 0.15);

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
    addComboLogo(slide, companyName, x + 0.3, y + 0.2, cellW - 0.6, cellH - 0.9, bc, industry, {
      fontSize: v.layout === "horizontal" ? 14 : 18,
      color: logoColor,
      layout: v.layout,
      showLine: true,
      aiLogoData: aiLogo,
    });

    // Label
    slide.addText(v.label, {
      x, y: y + cellH - 0.45, w: cellW, h: 0.35,
      fontSize: 12, bold: true,
      color: v.invert ? "CCCCCC" : "666666",
      align: "center",
    });
  }

  // Bottom note
  slide.addText("Logo在不同背景和应用场景下应选用合适的组合形式，确保识别性与美观性。", {
    x: cx, y: 7.2, w: CONTENT_W, h: 0.3,
    fontSize: 11, color: "888888", align: "center",
  });
}

// ---- Logo误用规范 ----
function renderLogoMisuse(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, bp.label || "Logo误用规范", bc);
  const cx = MARGIN + LEFT_BAR_W;
  const companyName = opts.companyName || "品牌";
  const aiLogo = opts.aiLogoData || (opts.logoData ? normImg(opts.logoData) : null);

  const misuses = [
    { title: "禁止拉伸", desc: "不得对Logo进行\n非等比缩放", distortion: "stretch" },
    { title: "禁止旋转", desc: "不得旋转\nLogo角度", distortion: "rotate" },
    { title: "禁止换色", desc: "不得使用非标准色\n替换Logo颜色", distortion: "recolor" },
    { title: "禁止描边", desc: "不得给Logo\n添加描边效果", distortion: "outline" },
    { title: "禁止加阴影", desc: "不得添加非规范\n投影效果", distortion: "shadow" },
    { title: "禁止改字体", desc: "不得更改Logo\n中的字体样式", distortion: "font" },
  ];

  for (let i = 0; i < misuses.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = cx + col * (CONTENT_W / 3 + 0.1);
    const y = 1.5 + row * 2.6;
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
    const logoW = w * 0.55;
    const logoH = w * 0.55;
    const logoX = x + (w - logoW) / 2;
    const logoY = y + 0.15;

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
          fontSize: 11, italic: true, color: "FF6600", align: "center", fontFace: "Comic Sans MS",
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
      x, y: y + h - 0.65, w, h: 0.35,
      fontSize: 14, bold: true, color: bc.pri, align: "center",
    });

    // Description
    slide.addText(misuses[i].desc, {
      x: x + 0.1, y: y + h - 0.35, w: w - 0.2, h: 0.35,
      fontSize: 10, color: "888888", align: "center", lineSpacingMultiple: 1.2,
    });
  }

  // Footer warning
  slide.addText("以上误用方式将严重损害品牌形象，所有应用必须严格遵守本规范。", {
    x: cx, y: 7.0, w: CONTENT_W, h: 0.4,
    fontSize: 12, bold: true, color: bc.pri, align: "center",
  });
}

// ---- 辅助图形 V24: 按行业定制 ----
function renderAuxiliaryGraphics(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
  addContentFrame(slide, bp.label || "辅助图形", bc);
  const cx = MARGIN + LEFT_BAR_W;

  // Intro text
  slide.addText("辅助图形是品牌视觉系统的重要组成部分，用于丰富视觉层次、强化品牌识别。", {
    x: cx, y: 1.4, w: CONTENT_W, h: 0.4,
    fontSize: 13, color: "666666",
  });

  const halfW = (CONTENT_W - 0.3) / 2;
  const patternH = 2.5;

  // ---- Pattern 1: Primary auxiliary graphic (industry-specific) ----
  const p1x = cx;
  const p1y = 2.0;
  slide.addShape("rect", {
    x: p1x, y: p1y, w: halfW, h: patternH,
    fill: { color: "F5F5F5" }, rectRadius: 0.1,
  });

  const p1Label: string = drawPrimaryPattern(slide, p1x, p1y, halfW, patternH, bc, industry);

  slide.addText(`主辅助图形 — ${p1Label}`, {
    x: p1x, y: p1y + patternH + 0.1, w: halfW, h: 0.3,
    fontSize: 12, bold: true, color: "444444", align: "center",
  });

  // ---- Pattern 2: Secondary auxiliary graphic (industry-specific) ----
  const p2x = cx + halfW + 0.3;
  const p2y = 2.0;
  slide.addShape("rect", {
    x: p2x, y: p2y, w: halfW, h: patternH,
    fill: { color: "F5F5F5" }, rectRadius: 0.1,
  });

  const p2Label: string = drawSecondaryPattern(slide, p2x, p2y, halfW, patternH, bc, industry);

  slide.addText(`次辅助图形 — ${p2Label}`, {
    x: p2x, y: p2y + patternH + 0.1, w: halfW, h: 0.3,
    fontSize: 12, bold: true, color: "444444", align: "center",
  });

  // Usage section
  const usageExamples = getAuxUsageExamples(industry);
  slide.addText("应用场景", {
    x: cx, y: 5.3, w: CONTENT_W, h: 0.35,
    fontSize: 16, bold: true, color: bc.pri,
  });

  slide.addText(usageExamples, {
    x: cx + 0.2, y: 5.7, w: CONTENT_W - 0.4, h: 1.2,
    fontSize: 12, color: "555555", lineSpacingMultiple: 1.6,
  });

  slide.addText("辅助图形可按比例缩放，但不可改变比例关系或旋转角度。建议透明度使用10%-40%。", {
    x: cx, y: 7.0, w: CONTENT_W, h: 0.3,
    fontSize: 11, color: "888888", align: "center",
  });
}

// V24: Industry-specific primary auxiliary graphic
function drawPrimaryPattern(slide: PptxGenJS.Slide, px: number, py: number, pw: number, ph: number, bc: BC, industry: IndustryType): string {
  switch (industry) {
    case "fastfood": {
      // Concentric arcs — bun curves, warmth
      const colors = [bc.pri, bc.sec, bc.acc, bc.pri, bc.sec];
      for (let i = 0; i < 5; i++) {
        slide.addShape("arc", {
          x: px + pw * 0.15 + i * pw * 0.12, y: py + ph * 0.1,
          w: pw * 0.6 - i * pw * 0.08, h: ph * 0.8 - i * ph * 0.08,
          fill: { color: colors[i], transparency: 55 },
          rectRadius: 0.05,
        });
      }
      return "弧线组合";
    }
    case "restaurant": {
      // Flowing cloud/traditional motif
      const colors = [bc.pri, bc.sec, bc.acc, bc.pri];
      for (let i = 0; i < 4; i++) {
        slide.addShape("ellipse", {
          x: px + 0.15 + i * pw * 0.2, y: py + ph * 0.2 + (i % 2) * ph * 0.15,
          w: pw * 0.25, h: pw * 0.25,
          fill: { color: colors[i], transparency: 50 },
        });
        slide.addShape("ellipse", {
          x: px + 0.15 + i * pw * 0.2 + pw * 0.08, y: py + ph * 0.1 + (i % 2) * ph * 0.1,
          w: pw * 0.2, h: pw * 0.2,
          fill: { color: colors[i], transparency: 65 },
        });
      }
      return "祥云组合";
    }
    case "beverage": {
      // Bubble circles
      const colors = [bc.pri, bc.sec, bc.acc];
      const sizes = [0.5, 0.35, 0.4, 0.3, 0.45, 0.25, 0.35];
      const positions = [[0.1,0.15],[0.45,0.1],[0.25,0.45],[0.6,0.35],[0.15,0.65],[0.55,0.6],[0.35,0.3]];
      for (let i = 0; i < 7; i++) {
        slide.addShape("ellipse", {
          x: px + positions[i][0] * pw, y: py + positions[i][1] * ph,
          w: sizes[i], h: sizes[i],
          fill: { color: colors[i % 3], transparency: 45 },
        });
      }
      return "气泡组合";
    }
    case "beauty": {
      // Flower petals
      const colors = [bc.pri, bc.sec, bc.acc, bc.pri, bc.sec, bc.acc];
      const cx0 = px + pw * 0.5, cy0 = py + ph * 0.5;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        slide.addShape("ellipse", {
          x: cx0 + Math.cos(angle) * pw * 0.18 - 0.15, y: cy0 + Math.sin(angle) * ph * 0.18 - 0.15,
          w: 0.4, h: 0.25,
          fill: { color: colors[i], transparency: 50 },
          rotate: Math.round(angle * 180 / Math.PI),
        });
      }
      return "花瓣组合";
    }
    case "fashion": {
      // Geometric triangles
      const colors = [bc.pri, bc.sec, bc.acc, bc.pri, bc.sec];
      for (let i = 0; i < 5; i++) {
        slide.addShape("triangle", {
          x: px + 0.1 + i * pw * 0.17, y: py + ph * 0.15,
          w: pw * 0.18, h: ph * 0.7,
          fill: { color: colors[i], transparency: 55 },
          flipV: i % 2 === 1,
        });
      }
      return "三角组合";
    }
    case "pharmacy": {
      // Cross/plus pattern
      const colors = [bc.pri, bc.sec, bc.acc];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const bx = px + 0.15 + c * pw * 0.22;
          const by = py + 0.2 + r * ph * 0.28;
          const s = 0.12;
          slide.addShape("rect", { x: bx + s*0.3, y: by, w: s*0.5, h: s*1.2, fill: { color: colors[(r+c)%3], transparency: 45 } });
          slide.addShape("rect", { x: bx, y: by + s*0.3, w: s*1.2, h: s*0.5, fill: { color: colors[(r+c)%3], transparency: 45 } });
        }
      }
      return "十字组合";
    }
    case "fitness": {
      // Dynamic diagonal stripes
      const colors = [bc.pri, bc.sec, bc.acc, bc.pri, bc.sec, bc.acc, bc.pri];
      for (let i = 0; i < 7; i++) {
        slide.addShape("rect", {
          x: px + i * pw * 0.12, y: py,
          w: pw * 0.06, h: ph,
          fill: { color: colors[i], transparency: 50 },
          rotate: 30,
        });
      }
      return "斜线组合";
    }
    case "wedding": {
      // Overlapping circles
      const colors = [bc.pri, bc.sec, bc.acc];
      const rings = [[0.2,0.2],[0.4,0.25],[0.55,0.15],[0.3,0.5],[0.5,0.45]];
      for (let i = 0; i < rings.length; i++) {
        slide.addShape("ellipse", {
          x: px + rings[i][0] * pw, y: py + rings[i][1] * ph,
          w: 0.5, h: 0.5,
          fill: { color: colors[i % 3], transparency: 55 },
          line: { color: colors[i % 3], width: 1.5, transparency: 30 },
        });
      }
      return "圆环组合";
    }
    default: {
      // Default: diagonal stripes
      const stripeColors = [bc.pri, bc.sec, bc.acc, bc.pri, bc.sec];
      for (let s = 0; s < 5; s++) {
        slide.addShape("rect", {
          x: px + s * (pw / 5), y: py,
          w: pw / 8, h: ph,
          fill: { color: stripeColors[s], transparency: 60 },
          rectRadius: 0.02,
        });
      }
      return "条纹组合";
    }
  }
}

// V24: Industry-specific secondary auxiliary graphic
function drawSecondaryPattern(slide: PptxGenJS.Slide, px: number, py: number, pw: number, ph: number, bc: BC, industry: IndustryType): string {
  switch (industry) {
    case "fastfood": {
      // Wave / steam lines
      const colors = [bc.sec, bc.pri, bc.acc, bc.sec, bc.pri];
      for (let i = 0; i < 5; i++) {
        const yOff = py + 0.2 + i * (ph - 0.4) / 4;
        for (let j = 0; j < 3; j++) {
          slide.addShape("ellipse", {
            x: px + 0.15 + j * pw * 0.28, y: yOff,
            w: pw * 0.22, h: ph * 0.08,
            fill: { color: colors[i], transparency: 55 },
            rectRadius: 0.03,
          });
        }
      }
      return "波浪组合";
    }
    case "restaurant": {
      // Coin / copper motif
      const colors = [bc.sec, bc.pri, bc.acc, bc.sec];
      for (let i = 0; i < 4; i++) {
        const cx0 = px + pw * (0.2 + (i % 2) * 0.45);
        const cy0 = py + ph * (0.2 + Math.floor(i / 2) * 0.4);
        slide.addShape("ellipse", {
          x: cx0 - 0.25, y: cy0 - 0.25, w: 0.5, h: 0.5,
          fill: { color: colors[i], transparency: 50 },
          line: { color: colors[i], width: 1, transparency: 30 },
        });
        slide.addShape("ellipse", {
          x: cx0 - 0.12, y: cy0 - 0.12, w: 0.24, h: 0.24,
          fill: { color: colors[i], transparency: 70 },
          line: { color: colors[i], width: 0.5, transparency: 50 },
        });
      }
      return "铜钱组合";
    }
    case "beverage": {
      // Ripple rings
      const colors = [bc.sec, bc.pri, bc.acc];
      const center = [px + pw * 0.5, py + ph * 0.5];
      for (let i = 3; i >= 0; i--) {
        const sz = 0.3 + i * 0.35;
        slide.addShape("ellipse", {
          x: center[0] - sz/2, y: center[1] - sz/2,
          w: sz, h: sz,
          fill: { color: colors[i % 3], transparency: 60 + i * 5 },
          line: { color: colors[i % 3], width: 0.75, transparency: 40 },
        });
      }
      return "涟漪组合";
    }
    case "beauty": {
      // Elegant curved lines
      const colors = [bc.sec, bc.pri, bc.acc, bc.sec];
      for (let i = 0; i < 4; i++) {
        slide.addShape("arc", {
          x: px + 0.1 + i * pw * 0.2, y: py + 0.1 + i * ph * 0.15,
          w: pw * 0.35, h: ph * 0.4,
          fill: { color: colors[i], transparency: 55 },
          rectRadius: 0.05,
        });
      }
      return "弧线组合";
    }
    case "fashion": {
      // Diamond / rhombus grid
      const colors = [bc.sec, bc.pri, bc.acc];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          slide.addShape("diamond", {
            x: px + 0.15 + c * pw * 0.3, y: py + 0.2 + r * ph * 0.25,
            w: pw * 0.22, h: ph * 0.2,
            fill: { color: colors[(r + c) % 3], transparency: 50 },
          });
        }
      }
      return "菱形组合";
    }
    case "pharmacy": {
      // DNA helix dots
      const colors = [bc.sec, bc.pri, bc.acc];
      for (let i = 0; i < 8; i++) {
        const x1 = px + 0.15 + i * pw * 0.1;
        const y1 = py + ph * 0.3 + Math.sin(i * 0.8) * ph * 0.25;
        const y2 = py + ph * 0.7 - Math.sin(i * 0.8) * ph * 0.25;
        slide.addShape("ellipse", {
          x: x1, y: y1, w: 0.18, h: 0.18,
          fill: { color: colors[i % 3], transparency: 45 },
        });
        slide.addShape("ellipse", {
          x: x1, y: y2, w: 0.18, h: 0.18,
          fill: { color: colors[(i + 1) % 3], transparency: 45 },
        });
      }
      return "螺旋组合";
    }
    case "fitness": {
      // Lightning bolt shapes
      const colors = [bc.sec, bc.pri, bc.acc, bc.sec];
      for (let i = 0; i < 4; i++) {
        slide.addShape("rect", {
          x: px + 0.1 + i * pw * 0.22, y: py + ph * 0.2,
          w: pw * 0.15, h: ph * 0.6,
          fill: { color: colors[i], transparency: 50 },
          rotate: i % 2 === 0 ? -15 : 15,
        });
      }
      return "闪电组合";
    }
    case "wedding": {
      // Heart-like overlapping circles
      const colors = [bc.sec, bc.pri, bc.acc, bc.sec, bc.pri];
      const positions = [[0.15,0.2],[0.35,0.15],[0.55,0.2],[0.25,0.5],[0.45,0.55]];
      for (let i = 0; i < positions.length; i++) {
        slide.addShape("ellipse", {
          x: px + positions[i][0] * pw, y: py + positions[i][1] * ph,
          w: 0.35, h: 0.35,
          fill: { color: colors[i], transparency: 55 },
        });
      }
      return "圆点组合";
    }
    default: {
      // Default: dot grid
      const dotColors = [bc.sec, bc.pri, bc.acc];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) {
          slide.addShape("ellipse", {
            x: px + 0.2 + c * 0.55, y: py + 0.2 + r * 0.55,
            w: 0.25, h: 0.25,
            fill: { color: dotColors[(r + c) % 3], transparency: 50 },
          });
        }
      }
      return "点阵组合";
    }
  }
}

// V24: Industry-specific usage examples
function getAuxUsageExamples(industry: IndustryType): string {
  const examples: Record<string, string> = {
    fastfood: "1. 外卖包装袋底纹\n2. 菜单页眉装饰线\n3. 店铺招牌边框纹样\n4. 员工围裙装饰带\n5. 促销海报背景纹理",
    restaurant: "1. 菜单封面装饰纹样\n2. 餐垫纸背景图案\n3. 外卖袋底部纹样\n4. 名片背面背景\n5. 店铺墙面装饰",
    beverage: "1. 杯套装饰纹样\n2. 菜单页眉装饰线\n3. 外卖袋底部纹样\n4. 社交媒体封面装饰\n5. 店铺墙面装饰",
    beauty: "1. 产品包装装饰线\n2. 名片背面背景\n3. 预约卡装饰纹样\n4. 社交媒体封面装饰\n5. 店铺橱窗装饰",
    fashion: "1. 吊牌装饰纹样\n2. 购物袋底纹\n3. 名片背面背景\n4. 社交媒体封面装饰\n5. 包装盒侧面纹样",
    pharmacy: "1. 药袋装饰线\n2. 处方笺页眉纹样\n3. 保健品类包装装饰\n4. 名片背面背景\n5. 店铺招牌边框",
    fitness: "1. 会员卡装饰纹样\n2. 课程表页眉装饰\n3. 运动毛巾边框\n4. 社交媒体封面装饰\n5. 场馆墙面装饰",
    wedding: "1. 请柬装饰纹样\n2. 喜糖盒底部纹样\n3. 名片背面背景\n4. 社交媒体封面装饰\n5. 婚礼现场装饰",
  };
  return examples[industry] || "1. 文档/手册页眉装饰线\n2. 包装袋底部纹样\n3. 名片背面背景\n4. 社交媒体封面装饰\n5. 店铺墙面装饰纹样";
}

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
    slide.addShape("ellipse", {
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
function renderBasicSpec(slide: PptxGenJS.Slide, bp: PageBlueprint, opts: RenderPptxOptions, bc: BC, industry: IndustryType): void {
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
  } else {
    // V13: 无Logo图时渲染字标
    // 组合Logo在保护空间展示
    addComboLogo(slide, opts.companyName || "品牌", demoX, demoY, demoSize, demoSize, bc, industry, { fontSize: 22, color: bc.pri, layout: "vertical", showLine: true, aiLogoData: opts.aiLogoData });
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


// ========== 服装降级 ==========
function renderFashionFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const tw = 2.5, th = 4.0, tx = (SW - tw) / 2, ty = 2.2;
    slide.addShape("rect", { x: tx, y: ty, w: tw, h: th, fill: { color: "FFFFFF" }, rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.1 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("ellipse", { x: tx + tw / 2 - 0.12, y: ty + 0.2, w: 0.24, h: 0.24, fill: { color: "FFFFFF" }, line: { color: bc.pri, width: 1 } });
    slide.addShape("rect", { x: tx, y: ty, w: tw, h: 0.08, fill: { color: bc.pri } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: tx + 0.4, y: ty + 0.6, w: 1.7, h: 1.2, sizing: { type: "contain", w: 1.7, h: 1.2 } });
    slide.addText(opts.companyName || "品牌", { x: tx, y: ty + 2.0, w: tw, h: 0.4, fontSize: 15, bold: true, color: "333333", align: "center" });
    slide.addShape("rect", { x: tx + 0.4, y: ty + 2.5, w: tw - 0.8, h: 0.04, fill: { color: bc.acc } });
    slide.addText("服装吊牌", { x: tx, y: ty + th + 0.1, w: tw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.2, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.2, fill: { color: bc.priDark }, rectRadius: 0.05 });
    slide.addShape("line", { x: bx + 0.8, y: by - 0.3, w: 0, h: 0.4, line: { color: bc.sec, width: 2 } });
    slide.addShape("line", { x: bx + bw - 0.8, y: by - 0.3, w: 0, h: 0.4, line: { color: bc.sec, width: 2 } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.6, y: by + 0.8, w: 2.3, h: 1.8, sizing: { type: "contain", w: 2.3, h: 1.8 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("购物袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.2;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.5, fill: { color: bc.pri }, rectRadius: 0.05 });
    slide.addText("NEW ARRIVAL", { x: px + 0.5, y: py + 0.5, w: 3.0, h: 0.6, fontSize: 22, bold: true, color: bc.sec });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 1.5, y: py + 1.5, w: 1.5, h: 0.8, sizing: { type: "contain", w: 1.5, h: 0.8 }, transparency: 10 });
    slide.addText("新品上市", { x: px + 0.5, y: py + ph * 0.5 + 0.4, w: pw - 1.0, h: 0.6, fontSize: 20, bold: true, color: "333333" });
    slide.addText("新品海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 母婴降级 ==========
function renderMotherBabyFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const sw = 3.8, sh = 2.2, sx = (SW - sw) / 2, sy = 2.2;
    slide.addShape("rect", { x: sx, y: sy, w: sw, h: sh, fill: { color: bc.priLight }, rectRadius: 0.12, shadow: { type: "outer", blur: 4, offset: 2, color: "000000", opacity: 0.08 } });
    slide.addShape("rect", { x: sx, y: sy, w: sw, h: 0.08, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: sx + 0.3, y: sy + 0.3, w: 1.2, h: 0.8, sizing: { type: "contain", w: 1.2, h: 0.8 } });
    slide.addText(opts.companyName || "品牌", { x: sx + 1.6, y: sy + 0.3, w: 2.0, h: 0.4, fontSize: 15, bold: true, color: bc.pri });
    slide.addText("安全认证", { x: sx + 0.3, y: sy + 1.2, w: sw - 0.6, h: 0.3, fontSize: 11, color: "666666" });
    slide.addText("安全认证贴", { x: sx, y: sy + sh + 0.1, w: sw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.0, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: 0.1, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.12 } });
    slide.addShape("rect", { x: bx + 0.2, y: by + 0.2, w: bw - 0.4, h: 0.3, fill: { color: bc.acc }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.5, y: by + 0.8, w: 2.5, h: 2.0, sizing: { type: "contain", w: 2.5, h: 2.0 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 3.0, w: bw, h: 0.4, fontSize: 15, bold: true, color: "FFFFFF", align: "center" });
    slide.addText("母婴礼盒", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 3.5, ph = 5.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.1, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.1 }, line: { color: bc.pri, width: 1 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 1.2, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addText("妈妈推荐", { x: px, y: py + 0.3, w: pw, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 0.6, y: py + 1.6, w: 2.3, h: 1.5, sizing: { type: "contain", w: 2.3, h: 1.5 } });
    slide.addText("推荐卡", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 婚庆降级 ==========
function renderWeddingFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const cw = 4.5, ch = 3.0, cx2 = (SW - cw) / 2, cy = 2.0;
    slide.addShape("rect", { x: cx2, y: cy, w: cw, h: ch, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 }, line: { color: bc.sec, width: 1 } });
    slide.addShape("rect", { x: cx2 + 0.2, y: cy + 0.2, w: cw - 0.4, h: ch - 0.4, fill: { color: "FFFFFF" }, rectRadius: 0.04, line: { color: bc.pri, width: 0.5, dashType: "dash" } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: cx2 + 1.5, y: cy + 0.4, w: 1.5, h: 0.8, sizing: { type: "contain", w: 1.5, h: 0.8 } });
    slide.addText("婚礼邀请", { x: cx2, y: cy + 1.4, w: cw, h: 0.5, fontSize: 22, bold: true, color: bc.pri, align: "center" });
    slide.addShape("rect", { x: cx2 + 1.0, y: cy + 2.1, w: cw - 2.0, h: 0.04, fill: { color: bc.sec } });
    slide.addText("请柬", { x: cx2, y: cy + ch + 0.1, w: cw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.0, bh = 3.5, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.priLight }, rectRadius: 0.1, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.1 }, line: { color: bc.sec, width: 1 } });
    slide.addShape("rect", { x: bx + 0.15, y: by + 0.15, w: bw - 0.3, h: 0.6, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.5, y: by + 1.0, w: 2.0, h: 1.2, sizing: { type: "contain", w: 2.0, h: 1.2 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.4, w: bw, h: 0.4, fontSize: 14, bold: true, color: bc.pri, align: "center" });
    slide.addText("喜糖盒", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 3.5, ph = 5.5, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 }, line: { color: bc.pri, width: 0.5 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph * 0.4, fill: { color: bc.priLight }, rectRadius: 0.05 });
    slide.addText("婚礼策划", { x: px + 0.3, y: py + 0.5, w: pw - 0.6, h: 0.5, fontSize: 20, bold: true, color: bc.pri, align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 0.5, y: py + 2.6, w: 2.5, h: 1.5, sizing: { type: "contain", w: 2.5, h: 1.5 } });
    slide.addText("展架", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 健身降级 ==========
function renderFitnessFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const cw = 4.5, ch = 2.6, cx2 = (SW - cw) / 2, cy = 2.2;
    slide.addShape("rect", { x: cx2, y: cy, w: cw, h: ch, fill: { color: bc.pri }, rectRadius: 0.1, shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.15 } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: cx2 + 0.3, y: cy + 0.2, w: 1.2, h: 0.8, sizing: { type: "contain", w: 1.2, h: 0.8 } });
    slide.addText("MEMBERSHIP", { x: cx2 + 1.6, y: cy + 0.2, w: 2.5, h: 0.4, fontSize: 13, bold: true, color: bc.acc });
    slide.addText(opts.companyName || "品牌", { x: cx2 + 1.6, y: cy + 0.6, w: 2.5, h: 0.3, fontSize: 11, color: "FFFFFF" });
    slide.addShape("rect", { x: cx2 + 0.3, y: cy + 1.4, w: cw - 0.6, h: 0.04, fill: { color: bc.acc } });
    slide.addText("会员卡", { x: cx2, y: cy + ch + 0.1, w: cw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.0, bh = 4.5, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: "FFFFFF" }, rectRadius: 0.15, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.1 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 1.5, fill: { color: bc.pri }, rectRadius: 0.08 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.5, y: by + 0.2, w: 2.0, h: 1.0, sizing: { type: "contain", w: 2.0, h: 1.0 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 1.8, w: bw, h: 0.4, fontSize: 15, bold: true, color: "333333", align: "center" });
    slide.addText("运动水杯", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.15 } });
    slide.addText("FITNESS", { x: px + 0.5, y: py + 0.5, w: pw - 1.0, h: 0.8, fontSize: 32, bold: true, color: "FFFFFF" });
    slide.addShape("rect", { x: px + 0.5, y: py + 1.5, w: pw - 1.0, h: 0.04, fill: { color: bc.acc } });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 1.0, y: py + 2.0, w: 2.5, h: 1.5, sizing: { type: "contain", w: 2.5, h: 1.5 }, transparency: 10 });
    slide.addText("新会员限时特惠", { x: px + 0.5, y: py + 4.0, w: pw - 1.0, h: 0.4, fontSize: 15, color: bc.acc });
    slide.addText("健身海报", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 药店降级 ==========
function renderPharmacyFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const pw = 4.5, ph = 3.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.06, shadow: { type: "outer", blur: 4, offset: 2, color: "000000", opacity: 0.08 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 0.5, fill: { color: bc.pri }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 0.2, y: py + 0.08, w: 0.35, h: 0.35, sizing: { type: "contain", w: 0.35, h: 0.35 } });
    slide.addText("处方笺", { x: px + 0.6, y: py + 0.08, w: 2.0, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });
    slide.addText("姓名：______ 诊断：______", { x: px + 0.3, y: py + 0.8, w: pw - 0.6, h: 0.8, fontSize: 11, color: "666666", lineSpacingMultiple: 1.6 });
    slide.addText("处方笺", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.0, bh = 4.0, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: "FFFFFF" }, rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.1 }, line: { color: bc.pri, width: 1 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.8, fill: { color: bc.priLight }, rectRadius: 0.04 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.3, y: by + 0.1, w: 0.6, h: 0.6, sizing: { type: "contain", w: 0.6, h: 0.6 } });
    slide.addText(opts.companyName || "品牌", { x: bx + 1.0, y: by + 0.15, w: 1.8, h: 0.3, fontSize: 13, bold: true, color: bc.pri });
    slide.addText("用法用量：____________", { x: bx + 0.3, y: by + 1.2, w: bw - 0.6, h: 0.8, fontSize: 10, color: "666666", lineSpacingMultiple: 1.6 });
    slide.addText("药袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 4.5, ph = 6.0, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: "FFFFFF" }, rectRadius: 0.08, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.1 }, line: { color: "E0E0E0", width: 0.3 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 1.5, fill: { color: bc.pri }, rectRadius: 0.05 });
    slide.addText("健康资讯", { x: px + 0.5, y: py + 0.3, w: pw - 1.0, h: 0.6, fontSize: 22, bold: true, color: "FFFFFF", align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 1.2, y: py + 1.8, w: 2.0, h: 1.5, sizing: { type: "contain", w: 2.0, h: 1.5 } });
    slide.addText("专业值得信赖", { x: px + 0.5, y: py + 3.8, w: pw - 1.0, h: 0.4, fontSize: 15, color: bc.pri, align: "center" });
    slide.addText("宣传单", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  }
}

// ========== 宠物降级 ==========
function renderPetFallback(slide: PptxGenJS.Slide, opts: RenderPptxOptions, bc: BC, type: string, cx: number): void {
  if (type === "stationery") {
    const cw = 4.0, ch = 2.6, cx2 = (SW - cw) / 2, cy = 2.2;
    slide.addShape("rect", { x: cx2, y: cy, w: cw, h: ch, fill: { color: "FFFFFF" }, rectRadius: 0.1, shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.1 }, line: { color: bc.pri, width: 1 } });
    slide.addShape("rect", { x: cx2, y: cy, w: cw, h: 0.6, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addText("疫苗记录卡", { x: cx2 + 0.3, y: cy + 0.1, w: 3.0, h: 0.4, fontSize: 15, bold: true, color: "FFFFFF" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: cx2 + cw - 1.0, y: cy + 0.1, w: 0.4, h: 0.4, sizing: { type: "contain", w: 0.4, h: 0.4 } });
    slide.addText("宠物名：______ 品种：______", { x: cx2 + 0.3, y: cy + 0.9, w: cw - 0.6, h: 0.8, fontSize: 10, color: "666666", lineSpacingMultiple: 1.6 });
    slide.addText("疫苗卡", { x: cx2, y: cy + ch + 0.1, w: cw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else if (type === "packaging") {
    const bw = 3.5, bh = 4.5, bx = (SW - bw) / 2, by = 2.0;
    slide.addShape("rect", { x: bx, y: by, w: bw, h: bh, fill: { color: bc.pri }, rectRadius: 0.08, shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.12 } });
    slide.addShape("rect", { x: bx, y: by, w: bw, h: 0.25, fill: { color: bc.priDark }, rectRadius: 0.05 });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: bx + 0.5, y: by + 0.6, w: 2.5, h: 2.0, sizing: { type: "contain", w: 2.5, h: 2.0 } });
    slide.addText(opts.companyName || "品牌", { x: bx, y: by + 2.8, w: bw, h: 0.5, fontSize: 17, bold: true, color: "FFFFFF", align: "center" });
    slide.addShape("rect", { x: bx + 0.5, y: by + 3.5, w: bw - 1.0, h: 0.04, fill: { color: bc.acc } });
    slide.addText("宠物食品袋", { x: bx, y: by + bh + 0.1, w: bw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
  } else {
    const pw = 4.0, ph = 5.5, px = (SW - pw) / 2, py = 2.0;
    slide.addShape("rect", { x: px, y: py, w: pw, h: ph, fill: { color: bc.priLight }, rectRadius: 0.1, shadow: { type: "outer", blur: 6, offset: 3, color: "000000", opacity: 0.1 }, line: { color: bc.pri, width: 0.5 } });
    slide.addShape("rect", { x: px, y: py, w: pw, h: 0.8, fill: { color: bc.pri }, rectRadius: 0.06 });
    slide.addText("服务价目", { x: px, y: py + 0.15, w: pw, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", align: "center" });
    if (opts.logoData) slide.addImage({ data: normImg(opts.logoData), x: px + 1.0, y: py + 1.2, w: 2.0, h: 1.5, sizing: { type: "contain", w: 2.0, h: 1.5 } });
    slide.addText("洗澡 · 寄养 · 美容 · 疫苗", { x: px + 0.3, y: py + 3.2, w: pw - 0.6, h: 0.3, fontSize: 12, color: "666666", align: "center" });
    slide.addText("服务价目表", { x: px, y: py + ph + 0.1, w: pw, h: 0.3, fontSize: 11, color: "999999", align: "center" });
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
    { title: "Logo组合规范" },
    { title: "Logo误用规范" },
    { title: "辅助图形" },
    { title: "标准色彩规范" },
    { title: "字体系统" },
    { title: "基础规范" },
  ];
  const sceneItems: Record<IndustryType, { title: string }[]> = {
    restaurant: [{ title: "餐饮应用系统" }, { title: "餐饮包装系统" }, { title: "餐饮营销系统" }],
    beverage: [{ title: "饮品应用系统" }, { title: "饮品包装系统" }, { title: "饮品营销系统" }],
    beauty: [{ title: "美容应用系统" }, { title: "美容包装系统" }, { title: "美容营销系统" }],
    fashion: [{ title: "时尚应用系统" }, { title: "时尚包装系统" }, { title: "时尚营销系统" }],
    mother_baby: [{ title: "母婴应用系统" }, { title: "母婴包装系统" }, { title: "母婴营销系统" }],
    wedding: [{ title: "婚庆应用系统" }, { title: "婚庆包装系统" }, { title: "婚庆营销系统" }],
    fitness: [{ title: "运动应用系统" }, { title: "运动包装系统" }, { title: "运动营销系统" }],
    pharmacy: [{ title: "医药应用系统" }, { title: "医药包装系统" }, { title: "医药营销系统" }],
    pet: [{ title: "宠物应用系统" }, { title: "宠物包装系统" }, { title: "宠物营销系统" }],
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

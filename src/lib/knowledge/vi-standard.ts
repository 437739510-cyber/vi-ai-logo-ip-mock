/**
 * VI Manual Professional Standards
 * Comprehensive specification templates for all VI manual modules.
 * Uses \${paramName} placeholders aligned with param-bus field names.
 */

// ---- Brand Philosophy Templates ----

export interface BrandPhilosophyTemplate {
  section: string;
  template: string;
  placeholders: string[];
}

export const BRAND_PHILOSOPHY: Record<string, BrandPhilosophyTemplate> = {
  positioning: {
    section: "品牌定位",
    template: `\${brandName}是一个专注于\${industry}领域的品牌，以\${brandPositioning}为核心定位，为\${targetMarket}提供\${mainProducts}。`,
    placeholders: ["brandName", "industry", "brandPositioning", "targetMarket", "mainProducts"],
  },
  vision: {
    section: "品牌愿景",
    template: `\${refinedBrandVision}`,
    placeholders: ["refinedBrandVision"],
  },
  mission: {
    section: "品牌使命",
    template: `通过\${coreValues}，为\${targetMarket}创造\${brandHighlight || "独特的品牌价值"}。`,
    placeholders: ["coreValues", "targetMarket", "brandHighlight"],
  },
  values: {
    section: "核心价值观",
    template: `\${refinedCoreValues}`,
    placeholders: ["refinedCoreValues"],
  },
  tone: {
    section: "品牌调性",
    template: `品牌调性关键词：\${brandToneKeywords?.join("、") || ""}。整体风格偏向\${visualStyleSuggestion}`,
    placeholders: ["brandToneKeywords", "visualStyleSuggestion"],
  },
  slogan: {
    section: "品牌Slogan",
    template: `基于品牌定位"\${brandPositioning}"，结合\${industry}行业特性，提炼简短有力的品牌口号。`,
    placeholders: ["brandPositioning", "industry"],
  },
};

// ---- Logo Standard Specifications ----

export interface LogoStandardTemplate {
  section: string;
  rules: string[];
}

export const LOGO_STANDARDS: LogoStandardTemplate[] = [
  {
    section: "网格制图",
    rules: [
      "外框轮廓宽高比例：\${gridRatio}（如10:8网格单位）",
      "圆角半径：\${cornerRadius} 网格单位",
      "核心图形元素坐标：(\${elementX}, \${elementY}) 网格坐标",
      "核心元素尺寸：\${elementW}x\${elementH} 网格单位",
      "标准字与图形最小间距：\${textGap} 网格单位",
      "字号对应：\${fontSize} 网格单位",
    ],
  },
  {
    section: "最小使用尺寸",
    rules: [
      "印刷品最小高度：15mm",
      "数字屏幕最小高度：48px",
      "户外广告最小高度：200mm",
      "名片/信纸等小物料最小高度：10mm（仅图形标）",
    ],
  },
  {
    section: "安全空间",
    rules: [
      "保护空间范围：≥ 15% Logo高度（以Logo高度为基准）",
      "保护空间内不得放置任何文字、图形、装饰元素",
      "多个Logo并置时，间距 ≥ 2倍保护空间",
    ],
  },
  {
    section: "6种组合形式适用场景",
    rules: [
      "横式组合（图形+文字左右排列）→ 名片、信纸、网站导航",
      "竖式组合（图形+文字上下排列）→ 招牌、海报、竖版广告",
      "反白稿（深色背景白色版本）→ 深色背景物料、夜间展示",
      "单色稿（单色印刷版本）→ 单据、传真件、单色印刷品",
      "图形标单独使用（仅Logo图形）→ App图标、社交媒体头像",
      "文字标单独使用（仅标准字）→ 文档页眉、小尺寸标签",
    ],
  },
];

// ---- Color Specifications ----

export const COLOR_STANDARDS = {
  ratioRule: "品牌主色占比60%，辅助色占比30%，强调色占比10%（平面印刷场景）",
  colorTypes: {
    primary: { label: "品牌主色", ratio: "60%", hex: "\${colorPalette[0].hex}", cmyk: "\${colorPalette[0].cmyk}", pantone: "\${colorPalette[0].pantone}", meaning: "\${colorPalette[0].meaning}" },
    secondary: { label: "辅助色", ratio: "30%", hex: "\${colorPalette[1].hex}", cmyk: "\${colorPalette[1].cmyk}", pantone: "\${colorPalette[1].pantone}", meaning: "\${colorPalette[1].meaning}" },
    accent: { label: "强调色", ratio: "10%", hex: "\${colorPalette[2].hex}", cmyk: "\${colorPalette[2].cmyk}", pantone: "\${colorPalette[2].pantone}", meaning: "\${colorPalette[2].meaning}" },
  },
  taboos: [
    "禁止在低对比度背景上使用品牌色",
    "禁止将强调色作为大面主色使用",
    "禁止在未经授权的情况下修改色值",
    "白色(#FFFFFF)不可作为强调色（在白色背景上不可见）",
    "黑色文字使用K=100单黑，大面积黑色使用C30/M20/Y20/K100富黑",
  ],
};

// ---- Auxiliary Graphics ----

export const AUXILIARY_GRAPHICS_STANDARDS = {
  ratioRules: {
    stripe: "条纹组合：条纹宽度与间距比例 = 1:2",
    dot: "点阵组合：圆点直径与点间距比例 = 1:3",
    scaleConstraint: "缩放必须等比锁定比例，禁止单方向拉伸",
  },
  applicationScenarios: [
    { name: "名片背面底纹", opacity: "20%", description: "作为名片背面的装饰底纹，降低透明度以保证文字可读性" },
    { name: "手提袋底部装饰", opacity: "30%", description: "位于手提袋底部区域，作为品牌装饰元素" },
    { name: "信纸页眉/页脚", opacity: "15%", description: "信纸页眉或页脚的装饰线条/图形" },
    { name: "包装盒内衬", opacity: "25%", description: "包装盒内部衬纸的装饰图案" },
    { name: "宣传单页背景", opacity: "10%", description: "作为宣传单页大面积背景的淡色装饰" },
  ],
  regionalLink: "至少1组辅助图形需衍生自 regionalAssets.visualSymbols 中的地域元素，标注元素来源与视觉风格",
};

// ---- Font Specifications ----

export const FONT_STANDARDS = {
  hierarchy: [
    { level: "H1 主标题", font: "\${fontSuggestions.chinese.title.font}", weight: "\${fontSuggestions.chinese.title.weight}", size: "28-36pt", lineHeight: "1.2", letterSpacing: "0" },
    { level: "H2 次级标题", font: "\${fontSuggestions.chinese.title.font}", weight: "Medium", size: "20-24pt", lineHeight: "1.3", letterSpacing: "0" },
    { level: "正文", font: "\${fontSuggestions.chinese.body.font}", weight: "\${fontSuggestions.chinese.body.weight}", size: "9-11pt", lineHeight: "1.6", letterSpacing: "0" },
    { level: "数字/价格", font: "\${fontSuggestions.numbersAndPrices.font}", weight: "\${fontSuggestions.numbersAndPrices.weight}", size: "12-16pt", lineHeight: "1.4", letterSpacing: "0" },
    { level: "英文标题", font: "\${fontSuggestions.english.title.font}", weight: "\${fontSuggestions.english.title.weight}", size: "24-32pt", lineHeight: "1.2", letterSpacing: "-0.5" },
    { level: "英文正文", font: "\${fontSuggestions.english.body.font}", weight: "\${fontSuggestions.english.body.weight}", size: "9-11pt", lineHeight: "1.5", letterSpacing: "0" },
  ],
  copyright: "\${fontSuggestions.copyrightInfo}",
};

// ---- IP/Mascot Specifications ----

export const MASCOT_USAGE_STANDARDS = {
  scenarios: [
    "品牌宣传物料 — 海报、宣传单页、社交媒体配图",
    "产品包装 — 包装盒、手提袋上的IP形象装饰",
    "空间展示 — 店面橱窗、店内立牌、展架",
    "数字媒体 — 网页Banner、App开屏、表情包",
  ],
  proportionRules: [
    "IP形象缩放必须等比锁定，禁止单方向拉伸",
    "IP与Logo组合时，IP高度 ≤ Logo高度的2倍",
    "IP单独使用时，最小高度 ≥ 15mm（印刷）/ 48px（数字）",
  ],
  deformationTaboos: [
    "禁止修改IP形象的颜色",
    "禁止更改IP形象的面部比例",
    "禁止给IP形象添加未经授权的配件/服装",
    "禁止将IP形象旋转、镜像翻转",
    "禁止在低分辨率下使用（<72dpi）",
  ],
};

// ---- Application System Specifications ----

export interface AppSystemTemplate {
  material: string;
  size: string;
  material_recommendation: string;
  process: string;
  logo_placement: string;
  bleed: string;
}

export const APP_SYSTEM_STANDARDS: AppSystemTemplate[] = [
  { material: "名片", size: "90x54mm", material_recommendation: "铜版纸300g / 哑粉纸250g", process: "四色印刷 + 覆亚膜 / 局部UV", logo_placement: "正面左上角或居中，Logo边距>=15%宽度", bleed: "3mm" },
  { material: "信纸", size: "210x297mm (A4)", material_recommendation: "双胶纸100g / 道林纸120g", process: "单色或双色印刷", logo_placement: "页眉居中或左上角，距顶边>=15mm", bleed: "3mm" },
  { material: "信封(中式)", size: "220x110mm", material_recommendation: "牛皮纸120g / 双胶纸100g", process: "单色印刷", logo_placement: "正面左下角或背面封口处", bleed: "3mm" },
  { material: "信封(西式)", size: "229x162mm", material_recommendation: "双胶纸120g", process: "单色印刷", logo_placement: "正面左上角", bleed: "3mm" },
  { material: "手提袋(中号)", size: "320x270x80mm", material_recommendation: "白卡纸250g / 牛皮纸150g", process: "四色印刷 + 覆膜 / 烫金/银", logo_placement: "正面居中，距边缘>=15%宽度", bleed: "3mm" },
  { material: "手提袋(大号)", size: "400x330x100mm", material_recommendation: "白卡纸300g / 牛皮纸180g", process: "四色印刷 + 覆膜，棉绳提手", logo_placement: "正面居中", bleed: "3mm" },
  { material: "包装盒(小)", size: "150x100x50mm", material_recommendation: "白卡纸300g + 内衬", process: "四色印刷 + 覆亚膜, 磁吸翻盖", logo_placement: "盒盖正面居中", bleed: "3mm" },
  { material: "包装盒(中)", size: "250x180x80mm", material_recommendation: "灰板裱白卡 + 绸布内衬", process: "四色印刷 + 烫金Logo + 覆亚膜", logo_placement: "盒盖正面居中", bleed: "3mm" },
  { material: "菜单/价目表", size: "210x297mm (A4) 或 148x210mm (A5)", material_recommendation: "铜版纸200g / 哑粉纸157g", process: "四色印刷 + 覆亚膜", logo_placement: "封面居中或左上角", bleed: "3mm" },
  { material: "宣传单页", size: "210x297mm (A4)", material_recommendation: "铜版纸157g / 双胶纸128g", process: "四色印刷双面", logo_placement: "正面右上角或背面页脚", bleed: "3mm" },
  { material: "海报", size: "297x420mm (A3) 或 420x594mm (A2)", material_recommendation: "铜版纸200g / PP纸", process: "四色印刷 + 覆光膜 / 喷绘", logo_placement: "底部居中或右下角", bleed: "3mm" },
  { material: "纸杯", size: "口径80mm 底径55mm 高95mm", material_recommendation: "食品级淋膜纸 260g", process: "柔版印刷 1-2色", logo_placement: "杯身正面居中", bleed: "3mm" },
  { material: "员工服装(T恤)", size: "按尺码表", material_recommendation: "纯棉180g", process: "丝网印刷 / 热转印", logo_placement: "左胸或后背居中", bleed: "N/A" },
  { material: "围裙", size: "均码 70x90cm", material_recommendation: "帆布/牛仔布", process: "丝网印刷 / 刺绣", logo_placement: "胸前居中", bleed: "N/A" },
  { material: "店面招牌", size: "按店面尺寸定制", material_recommendation: "亚克力3mm + 铝塑板 / 发光字", process: "UV打印 / 吸塑发光", logo_placement: "居中或左侧", bleed: "N/A" },
  { material: "车贴", size: "按车型定制", material_recommendation: "车贴专用PVC", process: "户外写真 + 覆水晶膜", logo_placement: "车门居中", bleed: "N/A" },
];

// Re-export VIStandard interface (keep backward compat)
export interface VIStandard {
  logoSpecs: string[];
  colorSystem: { primary: string; secondary: string; accent: string };
  fontHierarchy: string[];
  applicationPriority: string[];
  commonErrors: string[];
}

export const VI_STANDARD_DEFAULT: VIStandard = {
  logoSpecs: [
    "6种组合形式（横式/竖式/反白/单色/图形标/文字标）",
    "网格制图标注（宽高比例/圆角半径/元素坐标/字号网格单位）",
    "保护空间>=15% Logo高度",
    "最小尺寸：印刷>=15mm / 数字>=48px / 户外>=200mm",
  ],
  colorSystem: {
    primary: "品牌主色 — 占比60%，定义品牌第一识别色",
    secondary: "辅助色 — 占比30%，用于次级信息与背景",
    accent: "强调色 — 占比10%，用于CTA与重点突出",
  },
  fontHierarchy: [
    "标题：中文字体 Bold 用于H1-H2",
    "正文：中文字体 Regular 用于段落与说明",
    "数字与价格：等宽或加粗字体",
  ],
  applicationPriority: [
    "必做：名片/信纸/手提袋/店面招牌",
    "建议：包装盒/价签/员工服装/宣传单页",
    "可选：纸杯/雨伞/车贴/社交媒体模板",
  ],
  commonErrors: [
    "Logo拉伸变形", "更改品牌色值", "字体未授权商用",
    "保护空间不足", "低对比度背景使用",
    "添加未授权特效（描边/阴影/渐变）",
    "多Logo尺寸不统一", "在复杂纹理上直接放置",
  ],
};

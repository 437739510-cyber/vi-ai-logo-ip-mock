// @ts-nocheck
/**
 * Page Planner — 设计决策引擎
 *
 * 核心大脑：
 * 输入客户资料 + 素材认知 + 设计规则 + 参考模板
 * 输出每页的 PageBlueprint（施工图）
 *
 * 数据流：
 *   clientInfo + assetAnalysis + designRules + referenceTemplate
 *   → Rule Matching → Conflict Resolution → Page Orchestration
 *   → PageBlueprint[]
 */
import { getRulesForPage, sortRulesByPriority, applyRuleConstraints, validateBlueprintAgainstRules, type DesignRule } from "./design-rules";
import { getTemplate, findBestMatchingTemplates, type Template, type PageAnalysis } from "./template-library";
import { planLayoutWithAI, type AILayoutContext } from "./ai-layout-planner";
import { generateMascotCharacter, type BrandMascotInfo, type MascotCharacter } from "../../../scripts/mascot-character-prompt";
import { validateMascotBrandAlignment } from "../../../scripts/mascot-brand-check";
import { IndustryCategory } from "../ip/mascot-optimization";

// ========== 类型定义 ==========

/** 页面元素 */
export type PageElementType =
  | "logo"
  | "text"
  | "ip-mascot"
  | "color-swatch"
  | "decoration"
  | "image"
  | "table"
  | "divider"
  | "threeview";

/** 单个页面元素 */
export interface PageElement {
  type: PageElementType;
  /** 唯一标识 */
  id: string;
  /** 内容（文本、图片URL等） */
  content?: string;
  /** 位置 & 尺寸 */
  position: "top-center" | "center" | "bottom-center" | "bottom-right" | "left" | "right";
  /** X 百分比 (0-100) */
  xPct?: number;
  /** Y 百分比 (0-100) */
  yPct?: number;
  /** 宽度百分比 (0-100) */
  widthPct?: number;
  /** 高度百分比 (0-100) */
  heightPct?: number;
  /** 上边距 (px) */
  marginTop?: number;
  /** 下边距 */
  marginBottom?: number;
  /** 左边距 */
  marginLeft?: number;
  /** 右边距 */
  marginRight?: number;
  /** 字体大小 */
  fontSize?: number;
  /** 字重 */
  fontWeight?: number;
  /** 颜色 */
  color?: string;
  /** 不透明度 */
  opacity?: number;
  /** 是否带阴影 */
  shadow?: boolean;
  /** 子元素列表（用于复合元素） */
  children?: PageElement[];
  /** 扩展参数 */
  params?: Record<string, any>;
}

/** 背景定义 */
export interface PageBackground {
  type: "solid" | "gradient" | "image" | "pattern";
  primaryColor: string;
  secondaryColor?: string;
  generatePrompt?: string;
  decorations?: string[];
}

/** 页面施工图 */
export interface PageBlueprint {
  pageId: string;
  label: string;
  background: PageBackground;
  elements: PageElement[];
  /** 引用的设计规则 */
  appliedRules: string[];
  /** 引用的模板信息 */
  templateRef?: string;
  /** 质量阈值 */
  qualityThreshold: number;
}

/** Page Planner 输入 */
export interface PagePlannerInput {
  /** 客户资料 */
  clientInfo: {
    companyName: string;
    brandVision: string;
    coreValues: string;
    targetMarket: string;
    logoPhilosophy?: string;
    mascotPhilosophy?: string;
    industry?: string;
  };
  /** 品牌颜色 */
  brandColors: {
    primary: { hex: string; name?: string; cmyk?: string };
    secondary: { hex: string; name?: string; cmyk?: string };
    accent: { hex: string; name?: string; cmyk?: string };
  };
  /** 素材分析 */
  assetAnalysis?: {
    logo?: {
      hasLogo: boolean;
      logoUrl?: string;
      elements?: string[];
      styleTags?: string[];
      meaning?: string;
      extractedColors?: { hex: string; name?: string }[];
    };
    mascot?: {
      hasMascot: boolean;
      mascotUrl?: string;
      isThreeView?: boolean;
      splitViews?: string[];
      name?: string;
      style?: string;
      personality?: string;
      description?: string;
      labels?: string[];
    };
  };
  /** 参考模板 ID（可选） */
  templateId?: string;
  /** 所有页面是否生成 */
  generateAll?: boolean;
  /** 指定生成哪些页 */
  pageIds?: string[];
}

// ========== 11 页默认文案 ==========

const PAGE_LABELS: Record<string, string> = {
  cover: "品牌视觉识别系统 (VI) 规范手册",
  toc: "目录",
  "brand-philosophy": "品牌核心理念",
  "logo-interpretation": "标识诠释",
  "logo-variations": "Logo组合规范",
  "logo-grid": "LOGO网格制图规范",
  "logo-misuse": "Logo使用规范",
  "auxiliary-graphics": "辅助图形",
  "aux-graphics-misuse": "辅助图形禁用规范",
  "font-copyright": "字体版权说明",
  "brand-colors": "标准色彩规范",
  "color-taboos": "色彩使用规范",
  typography: "字体系统",
  "basic-spec": "基础规范",
  stationery: "办公应用系统",
  packaging: "产品包装系统",
  marketing: "营销展示系统",
  summary: "总结",
  "material-priority": "VI物料落地清单",
  closing: "感谢观看",
  "digital-media": "线上数字应用",
  "wayfinding": "导视系统",
  "logo-output": "LOGO文件输出规范",
  "file-output": "文件输出规范",
  "modification-authority": "VI修改权限说明",
};

// 行业类型映射

// 行业定制场景页标题
const INDUSTRY_SCENE_LABELS: Record<string, { stationery: string; packaging: string; marketing: string }> = {
  general:     { stationery: "办公应用系统", packaging: "产品包装系统", marketing: "营销展示系统" },
  restaurant:  { stationery: "餐饮应用系统", packaging: "餐饮包装系统", marketing: "餐饮营销系统" },
  beverage:    { stationery: "饮品应用系统", packaging: "饮品包装系统", marketing: "饮品营销系统" },
  beauty:      { stationery: "美业应用系统", packaging: "美业包装系统", marketing: "美业营销系统" },
  education:   { stationery: "教育应用系统", packaging: "教育包装系统", marketing: "教育营销系统" },
  technology:  { stationery: "科技应用系统", packaging: "科技包装系统", marketing: "科技营销系统" },
  healthcare:  { stationery: "健康应用系统", packaging: "健康包装系统", marketing: "健康营销系统" },
  maternal_child: { stationery: "母婴应用系统", packaging: "母婴包装系统", marketing: "母婴营销系统" },
  retail:      { stationery: "零售应用系统", packaging: "零售包装系统", marketing: "零售营销系统" },
  cultural:    { stationery: "文创应用系统", packaging: "文创包装系统", marketing: "文创营销系统" },
  financial:   { stationery: "金融应用系统", packaging: "金融包装系统", marketing: "金融营销系统" },
  fashion:     { stationery: "时尚应用系统", packaging: "时尚包装系统", marketing: "时尚营销系统" },
  sports:      { stationery: "运动应用系统", packaging: "运动包装系统", marketing: "运动营销系统" },
  hospitality: { stationery: "旅宿应用系统", packaging: "旅宿包装系统", marketing: "旅宿营销系统" },
  real_estate: { stationery: "地产应用系统", packaging: "地产包装系统", marketing: "地产营销系统" },
  legal:       { stationery: "专业应用系统", packaging: "专业包装系统", marketing: "专业营销系统" },
};

// 行业定制场景页描述
const INDUSTRY_SCENE_DESCS: Record<string, { stationery: string; packaging: string; marketing: string }> = {
  general:     { stationery: "品牌在商务场景中的标准化应用", packaging: "产品包装与物料的品牌化呈现", marketing: "宣传与促销物料" },
  restaurant:  { stationery: "品牌在餐饮场景中的标准化应用", packaging: "餐饮食具与外带物料的品牌化呈现", marketing: "门店宣传与促销物料" },
  beverage:    { stationery: "品牌在饮品场景中的标准化应用", packaging: "饮品杯具与外带物料的品牌化呈现", marketing: "门店宣传与促销物料" },
  beauty:      { stationery: "品牌在美业场景中的标准化应用", packaging: "美业产品与礼盒的品牌化呈现", marketing: "门店宣传与会员招募物料" },
  education:   { stationery: "品牌在教育场景中的标准化应用", packaging: "教材与课程物料的品牌化呈现", marketing: "招生宣传与活动物料" },
  technology:  { stationery: "品牌在科技场景中的标准化应用", packaging: "科技产品与物料的品牌化呈现", marketing: "科技宣传与促销物料" },
  healthcare:  { stationery: "品牌在健康场景中的标准化应用", packaging: "健康产品与物料的品牌化呈现", marketing: "健康宣传与促销物料" },
  maternal_child: { stationery: "品牌在母婴场景中的标准化应用", packaging: "母婴产品与包装的品牌化呈现", marketing: "母婴宣传与促销物料" },
  retail:      { stationery: "品牌在零售场景中的标准化应用", packaging: "商品包装与手提袋的品牌化呈现", marketing: "促销活动与宣传物料" },
  cultural:    { stationery: "品牌在文创场景中的标准化应用", packaging: "文创产品与物料的品牌化呈现", marketing: "文创宣传与活动物料" },
  financial:   { stationery: "品牌在金融场景中的标准化应用", packaging: "金融产品与物料的品牌化呈现", marketing: "金融宣传与促销物料" },
  fashion:     { stationery: "品牌在时尚场景中的标准化应用", packaging: "时尚产品与包装的品牌化呈现", marketing: "时尚宣传与展示物料" },
  sports:      { stationery: "品牌在运动场景中的标准化应用", packaging: "运动产品与物料的品牌化呈现", marketing: "运动宣传与活动物料" },
  hospitality: { stationery: "品牌在旅宿场景中的标准化应用", packaging: "旅宿物料与包装的品牌化呈现", marketing: "旅宿宣传与促销物料" },
  real_estate: { stationery: "品牌在地产场景中的标准化应用", packaging: "地产物料与包装的品牌化呈现", marketing: "地产宣传与促销物料" },
  legal:       { stationery: "品牌在专业场景中的标准化应用", packaging: "专业服务物料的品牌化呈现", marketing: "专业服务宣传与促销物料" },
};

// ========== 核心引擎 ==========

/**
 * 主入口：根据输入生成所有页面的 PageBlueprint
 */
export async function planPages(input: PagePlannerInput): Promise<PageBlueprint[]> {
  const pageIds = input.pageIds || [
    "cover", "toc", "brand-philosophy", "logo-interpretation", "logo-variations",
    "logo-grid",
    "auxiliary-graphics", "aux-graphics-misuse", "brand-colors",
    "color-taboos",
    "typography", "font-copyright", "basic-spec", "logo-misuse", "stationery", "packaging",
    "marketing", "digital-media", "wayfinding", "summary", "material-priority", "file-output", "logo-output", "modification-authority", "closing",
  ];

  // 加载参考模板（如果有）
  let template: Template | null = null;
  let perPageAnalysis: Record<string, PageAnalysis> = {};
  if (input.templateId) {
    template = await getTemplate(input.templateId);
    if (template) {
      perPageAnalysis = template.extractedSystem.perPageMapping;
    }
  } else if (input.clientInfo.industry) {
    // 尝试按行业自动匹配模板
    const matches = await findBestMatchingTemplates(input.clientInfo.industry, [], 1);
    if (matches.length > 0 && matches[0].matchScore >= 40) {
      template = await getTemplate(matches[0].template.templateId);
      if (template) {
        perPageAnalysis = template.extractedSystem.perPageMapping;
      }
    }
  }

  const blueprints: PageBlueprint[] = [];

  for (const pageId of pageIds) {
    const blueprint = await planSinglePage(pageId, input, template, perPageAnalysis);
    blueprints.push(blueprint);
  }

  // 整改 #7：当 hasMascot 为真（或本流程默认开启）时，默认追加完整 IP 公仔章节（5 段），
  // 插入到「封底」之前，不再仅塞单页 gallery。
  const includeMascot =
    input.assetAnalysis?.mascot?.hasMascot ??
    (input as any).includeMascotChapter ??
    (input.clientInfo as any).wantMascot === 'yes' ??
    false;
  if (includeMascot) {
    const mascotPages = await buildMascotChapter(input);
    const closingIdx = blueprints.findIndex((b) => b.pageId === "closing");
    if (closingIdx >= 0) {
      blueprints.splice(closingIdx, 0, ...mascotPages);
    } else {
      blueprints.push(...mascotPages);
    }
  }

  return blueprints;
}

// ========== IP 公仔章节（整改 #7） ==========

const MASCOT_CHAPTER_PAGES = [
  "mascot-positioning",
  "mascot-threeview",
  "mascot-emotions",
  "mascot-scenes",
  "mascot-usage",
  "mascot-misuse",
  "mascot-merchandise",
  "mascot-compliance",
];

/**
 * 构建完整 IP 公仔章节（5 段）：角色定位 / 三视图 / 表情库 / 场景应用 / 使用规范。
 * 使用最新 mascot-prompt-strategy 约束（无角 / 帽顶小金球 / 手持千层底布鞋）。
 */
async function buildMascotChapter(input: PagePlannerInput): Promise<PageBlueprint[]> {
  const pri = input.brandColors.primary;
  const sec = input.brandColors.secondary;
  const acc = input.brandColors.accent;
  const mascotName = input.assetAnalysis?.mascot?.name || "品牌IP公仔";
  const hasMascotArt = !!input.assetAnalysis?.mascot?.hasMascot;

  // Try to get dynamic character data from DeepSeek
  let setting = "品牌IP公仔，风格与品牌视觉方向一致";
  let personality = "品牌调性相匹配的个性特征";
  let usageScenes = "手册封面/封底、品牌故事页、门店招牌、会员卡、社媒头像、包装礼盒";
  try {
    const brandInfo: BrandMascotInfo = {
      companyName: input.clientInfo.companyName,
      industry: input.clientInfo.industry || "",
      mainProduct: input.clientInfo.brandVision || "",
      brandTone: [input.clientInfo.coreValues].filter(Boolean),
      brandColors: input.brandColors,
    };
    const character = await generateMascotCharacter(brandInfo);
    if (character) {
      setting = character.setting;
      personality = character.personality;
      usageScenes = character.usageScenes;
    }
  } catch {
    // fallback to generic text
  }

  const misuseRules = [
    { rule: "禁止拉伸变形（非等比缩放），须保持公仔原始宽高比例", correct: "等比缩放，保持比例协调" },
    { rule: "禁止更改品牌色，所有公仔配色须严格使用品牌标准色", correct: "严格使用品牌标准色" },
    { rule: "禁止拆分LOGO或公仔元素单独使用，所有元素需整体呈现", correct: "LOGO+公仔整体呈现" },
    { rule: "禁止旋转公仔角度超过规范允许范围", correct: "保持正面/标准方向" },
    { rule: "禁止添加非规范装饰（角、翅膀、道具等额外元素）", correct: "保持简洁原始形象" },
    { rule: "禁止修改公仔表情超出规范范围", correct: "使用表情库标准表情" },
    { rule: "禁止AI重绘替换角色设定", correct: "基于原始设定延展" },
    { rule: "禁止低对比背景使用，公仔与背景色对比度需≥3:1", correct: "确保背景对比度≥3:1" },
    { rule: "禁止截取五官/肢体单独商用", correct: "公仔完整形象呈现" },
    { rule: "禁止更换肢体动作拼接", correct: "使用标准姿态和动作" },
    { rule: "禁止在非授权场景使用趣味衍生形象", correct: "仅限品牌授权渠道" },
    { rule: "禁止在合同、公章等严肃场景使用公仔形象", correct: "严肃场景使用文字LOGO" },
  ];

  const pages: { pageId: string; label: string; blocks: { title: string; body: string }[] }[] = [
    {
      pageId: "mascot-positioning",
      label: "IP角色定位",
      blocks: [
        { title: "角色名称", body: mascotName },
        { title: "角色设定", body: setting },
        { title: "性格与调性", body: personality },
        { title: "适用场景", body: usageScenes },
      ],
    },
    {
      pageId: "mascot-threeview",
      label: "IP三视图",
      blocks: [
        { title: "三视图规范", body: "提供正面/侧面/背面三视图，统一比例与配色，确保跨物料一致性。角色风格：" + setting },
        { title: "绘制要求", body: "纯白底、无场景；角色外观基于品牌色系，禁止添加非规范装饰元素。" },
        { title: "比例规范", body: "头身比建议 1:1.5 ~ 1:2.5，总高度以品牌实际设定为准（约20-35cm）。" },
        { title: "最小使用尺寸", body: "印刷 15mm / 数字媒介 48px / 小礼品/周边 10mm" },
        { title: "安全留白", body: "公仔四周保留 ≥ 公仔高度 10% 的留白空间，确保在任何媒介上不被裁切或遮挡。" },
        { title: "三视图制图要求", body: "正面/侧面/背面需统一比例线，标注头部高度、身体宽度、总高度等关键尺寸。" },
      ],
    },
    {
      pageId: "mascot-emotions",
      label: "IP表情库",
      blocks: [
        { title: "基础表情", body: "微笑/欢迎/专注/惊喜/安心/开心/引导/俏皮，至少8款，保持角色比例与配色一致。每款表情需统一眼睛大小、嘴型弧度范围。" },
        { title: "使用说明", body: "门店迎宾用「欢迎」，包装说明用「安心」，社媒互动用「微笑」，节日促销用「开心」，导航指引用「引导」，节日限定用「俏皮」。" },
      ],
    },
    {
      pageId: "mascot-scenes",
      label: "IP场景应用",
      blocks: [
        { title: "门店场景", body: "迎宾/导购/收银：公仔占比≤30%，站位靠入口或收银台附近。" },
        { title: "办公场景", body: "会议/协作/客服：公仔占比≤20%，色调柔和，突出专业感。" },
        { title: "活动场景", body: "促销/节日/新品发布：公仔占比可放大至40%，搭配醒目配色。" },
        { title: "线上场景", body: "社媒互动/直播/短视频：公仔占比≤25%，配合动态表情使用。" },
      ],
    },
    {
      pageId: "mascot-usage",
      label: "IP使用规范",
      blocks: [
        { title: "色彩规范", body: "IP配色须严格使用品牌标准色，不得自行更改色值。单色/灰度版本按灰度值公式 R*0.299 + G*0.587 + B*0.114 转换，保留明暗层次，不得反转。" },
        { title: "最小尺寸与留白", body: "印刷最小 15mm，数字最小 48px，小礼品/周边最小 10mm。公仔四周保留充足留白，与Logo同享保护空间规则。" },
        { title: "单色/灰度版本", body: "适用于报纸广告、印章、单色喷绘等低成本的灰度印刷媒介。灰度值按公式转换，确保灰度版本与彩色版本视觉重量一致。" },
      ],
    },
    {
      pageId: "mascot-misuse",
      label: "IP公仔禁用规范",
      blocks: misuseRules.map((m) => ({
        title: m.rule,
        body: "正确: " + m.correct,
      })),
    },
    {
      pageId: "mascot-merchandise",
      label: "IP公仔衍生品使用规范",
      blocks: [
        { title: "文创类", body: "手办：最小高度30mm，头部比例可适当放大（Q版）。抱枕：公仔形象占比 ≤ 60%，居中或偏左排版。帆布袋：公仔居于袋面上方40%区域，下方留白放LOGO。" },
        { title: "线下门店", body: "立牌：高度 ≥ 120cm，公仔全身展示。灯箱：公仔占比 ≤ 50%，搭配品牌标语。展架：公仔居于视觉中心位置，辅助信息环绕排版。" },
        { title: "线上媒介", body: "头像：圆形裁切保留头部+标志性特征。表情包：gif动图时长≤3秒，帧率≥12fps，尺寸统一。视频封面：公仔居于左下1/4区域，右侧留白排版文字。" },
        { title: "材质适配提示", body: "金属材质：适合蚀刻或浮雕工艺，线条需简化。布艺材质：适合刺绣或印花工艺，颜色对比度可适当提高。亚克力材质：适合背喷或UV印刷，注意透明区域留白处理。" },
      ],
    },
    {
      pageId: "mascot-compliance",
      label: "IP公仔使用合规说明",
      blocks: [
        { title: "版权归属声明", body: "IP公仔形象版权归 " + (input.clientInfo.companyName || "品牌方") + " 所有，未经授权不得复制、修改、传播或商业使用。" },
        { title: "授权使用范围", body: "品牌自有渠道（官网、社媒、门店物料）以及书面授权的合作伙伴。任何超出此范围的使用均需另行申请授权。" },
        { title: "外部修改限制", body: "未经品牌方书面授权，任何个人或组织不得对公仔形象进行修改、变体创作或二次开发。" },
        { title: "不可商用场景", body: "禁止在竞品品牌宣传、政治活动与选举、宗教传播与仪式、成人内容与不雅场景中使用公仔形象。" },
        { title: "授权期限与地域", body: "授权使用期限和地域范围以授权协议为准，到期自动终止。" },
        { title: "违例处理方式", body: "对于违反本合规说明的行为，品牌方保留追究法律责任的权利。" },
      ],
    },
  ];

  return pages.map((p) => {
    const elements: PageElement[] = [];
    elements.push({
      type: "text", id: p.pageId + "-title", content: p.label,
      position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30,
    });
    elements.push({
      type: "divider", id: p.pageId + "-divider", position: "center",
      widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15,
    });
    let y = 120;
    p.blocks.forEach((b, i) => {
      elements.push({
        type: "text", id: p.pageId + "-h-" + i, content: b.title,
        position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex,
        marginTop: y, marginLeft: 60, params: { align: "left" },
      });
      elements.push({
        type: "text", id: p.pageId + "-b-" + i, content: b.body,
        position: "top-center", fontSize: 12, color: "#444",
        marginTop: y + 28, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 },
      });
      y += 95;
    });
    if (hasMascotArt) {
      elements.push({
        type: "ip-mascot", id: p.pageId + "-mascot",
        position: "bottom-right", widthPct: 12, heightPct: 15,
        marginRight: 30, marginBottom: 30, opacity: 0.7,
      });
    }
    return {
      pageId: p.pageId,
      label: p.label,
      background: { type: "solid", primaryColor: "#FFFFFF", secondaryColor: sec.hex },
      elements,
      appliedRules: [],
      qualityThreshold: 70,
    };
  });
}


/**
 * 规划单个页面
 */
async function planSinglePage(
  pageId: string,
  input: PagePlannerInput,
  template: Template | null,
  perPageAnalysis: Record<string, PageAnalysis>
): Promise<PageBlueprint> {
  const companyName = input.clientInfo.companyName || "品牌名称";
  const pri = input.brandColors.primary;
  const sec = input.brandColors.secondary;
  const acc = input.brandColors.accent;
  const hasLogo = input.assetAnalysis?.logo?.hasLogo ?? false;
  const hasMascot = input.assetAnalysis?.mascot?.hasMascot ?? false;
  const isThreeView = input.assetAnalysis?.mascot?.isThreeView ?? false;
  const mascotName = input.assetAnalysis?.mascot?.name || "";
  const mascotStyle = input.assetAnalysis?.mascot?.style || "";
  const mascotPersonality = input.assetAnalysis?.mascot?.personality || "";
  const logoElements = input.assetAnalysis?.logo?.elements || [];
  const logoMeaning = input.assetAnalysis?.logo?.meaning || "";
  const logoStyleTags = input.assetAnalysis?.logo?.styleTags || [];

  // 获取参考模板该页分析
  const pageRef: PageAnalysis | undefined = perPageAnalysis[pageId];

  // 获取设计规则
  const rules = getRulesForPage(pageId);
  const sortedRules = sortRulesByPriority(rules);

  // Phase 10: 尝试 AI 布局优先（仅关键页面，其余走硬编码fallback以节省时间）
  const AI_LAYOUT_PAGES = new Set(["cover", "logo-interpretation", "summary"]);
  let aiElements = null;
  if (AI_LAYOUT_PAGES.has(pageId)) {
    try {
      // 8秒超时，避免单页卡太久
      aiElements = await Promise.race([
        planLayoutWithAI(pageId, {
          industry: input.clientInfo.industry,
          companyName,
          brandVision: input.clientInfo.brandVision,
          coreValues: input.clientInfo.coreValues,
          targetMarket: input.clientInfo.targetMarket,
          hasLogo,
          logoElements,
          logoMeaning,
          logoStyleTags,
          hasMascot,
          mascotName,
          mascotStyle,
          mascotPersonality,
          brandColors: input.brandColors,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
    } catch {
      // AI 失败，走 fallback
    }
  }

  // 构建蓝图
  const blueprint = buildBlueprint(pageId, {
    companyName, pri, sec, acc, hasLogo, hasMascot,
    isThreeView, mascotName, mascotStyle, mascotPersonality,
    logoElements, logoMeaning, logoStyleTags,
    clientInfo: input.clientInfo,
    rules: sortedRules,
    pageRef,
    aiElements,
    industryType: input.clientInfo.industry || "general",
  });

  return blueprint;
}

// ========== 蓝图构建 ==========

export interface BuildContext {
  companyName: string;
  pri: { hex: string; name?: string };
  sec: { hex: string; name?: string };
  acc: { hex: string; name?: string };
  hasLogo: boolean;
  hasMascot: boolean;
  isThreeView: boolean;
  mascotName: string;
  mascotStyle: string;
  mascotPersonality: string;
  logoElements: string[];
  logoMeaning: string;
  logoStyleTags: string[];
  clientInfo: PagePlannerInput["clientInfo"];
  rules: DesignRule[];
  pageRef?: PageAnalysis;
  aiElements?: PageElement[] | null;
}

function buildBlueprint(pageId: string, ctx: BuildContext): PageBlueprint {
  const label =
    false
      ? "门店导视系统"
      : PAGE_LABELS[pageId] || pageId;
  const appliedRules = ctx.rules.map(r => r.id);
  const qualityThreshold = 70;

  const background = buildBackground(pageId, ctx);
  let elements: PageElement[];
  if (ctx.aiElements && ctx.aiElements.length > 0) {
    elements = ctx.aiElements;
  } else {
    elements = buildElements(pageId, ctx);
  }

  // Phase 9: Apply rule constraints to elements (clamp sizes, enforce colors, etc.)
  const constrainedElements = applyRuleConstraints(elements, ctx.rules);


  return {
    pageId,
    label,
    background,
    elements: constrainedElements,
    appliedRules,
    qualityThreshold,
  };
}

// ========== 背景生成 ==========

export function buildBackground(pageId: string, ctx: BuildContext): PageBackground {
  const { pri, sec, acc, pageRef } = ctx;

  // 参考模板优先：如果模板有分析，直接使用模板布局风格
  if (pageRef?.layout) {
    return {
      type: "gradient",
      primaryColor: pri.hex,
      secondaryColor: sec.hex,
      generatePrompt: buildBackgroundPrompt(pageId, ctx),
      decorations: extractDecorations(pageRef),
    };
  }

  // 默认按页面类型构建背景
  switch (pageId) {
    case "cover":
      return {
        type: "gradient",
        primaryColor: pri.hex,
        secondaryColor: sec.hex,
        generatePrompt: `企业VI手册封面背景，品牌色${pri.hex}渐变，简洁高级感，轻微光晕，无文字无LOGO无人物，商务风格`,
      };
    case "closing":
      return {
        type: "gradient",
        primaryColor: pri.hex,
        secondaryColor: acc.hex,
        generatePrompt: `企业VI手册封底背景，品牌色${pri.hex}渐变，简洁质感，无文字无LOGO`,
      };
    case "brand-philosophy":
    case "summary":
      return {
        type: "solid",
        primaryColor: "#FFFFFF",
        secondaryColor: sec.hex,
        generatePrompt: `企业VI手册内页背景，白色底，轻微品牌色${sec.hex}装饰，简洁商务，无文字无LOGO`,
      };
    case "stationery":
    case "packaging":
    case "marketing":
      return {
        type: "image",
        primaryColor: pri.hex,
        generatePrompt: buildScenePrompt(pageId, ctx),
      };
    default:
      return {
        type: "solid",
        primaryColor: "#FFFFFF",
        generatePrompt: `企业VI手册内页背景，白色底色，简洁商务，无文字无LOGO`,
      };
  }
}

/** 生成场景类页面的 prompt */
function buildScenePrompt(pageId: string, ctx: BuildContext): string {
  const { pri, companyName, pageRef } = ctx;
  let prompt = "";

  if (pageRef?.visualMood) {
    prompt += `风格参考：${pageRef.visualMood}。`;
  }
  if (pageRef?.colorPalette) {
    prompt += `色彩方案：${pageRef.colorPalette}。`;
  }

  switch (pageId) {
    case "stationery":
      prompt += `企业VI办公应用场景，品牌色${pri.hex}，包含名片、信封、信纸，商务专业摄影风格，高清，无文字无LOGO`;
      break;
    case "packaging":
      prompt += `企业产品包装场景，品牌色${pri.hex}为主色调，产品展示，专业产品摄影风格，高清，无文字无LOGO`;
      break;
    case "marketing":
      prompt += `品牌营销海报场景，品牌色${pri.hex}，${companyName}品牌调性，现代设计感，高清，无文字`;
      break;
  }
  return prompt;
}

/** 生成背景图的 DeepSeek prompt */
function buildBackgroundPrompt(pageId: string, ctx: BuildContext): string {
  const { pri, sec, companyName, pageRef } = ctx;
  let prompt = `企业VI手册${PAGE_LABELS[pageId]}页面背景`;

  if (pageRef) {
    if (pageRef.visualMood) prompt += `，视觉风格：${pageRef.visualMood}`;
    if (pageRef.colorPalette) prompt += `，色彩方案：${pageRef.colorPalette}`;
  }

  prompt += `，品牌色${pri.hex}${sec.hex}，简洁商务质感，无文字无LOGO无人物`;
  return prompt;
}

/** 从参考分析中提取装饰元素类型 */
function extractDecorations(pageRef?: PageAnalysis): string[] {
  if (!pageRef) return ["corner-accents", "thin-divider"];
  const decons: string[] = [];
  const layout = (pageRef.layout || "").toLowerCase();
  if (layout.includes("线条") || layout.includes("line")) decons.push("thin-divider");
  if (layout.includes("角标") || layout.includes("corner")) decons.push("corner-accents");
  if (layout.includes("底纹") || layout.includes("纹理")) decons.push("subtle-texture");
  if (layout.includes("渐变")) decons.push("gradient-overlay");
  if (decons.length === 0) decons.push("thin-divider", "corner-accents");
  return decons;
}

// ========== 元素生成 ==========

function buildElements(pageId: string, ctx: BuildContext): PageElement[] {
  switch (pageId) {
    case "cover": return buildCoverElements(ctx);
    case "brand-philosophy": return buildPhilosophyElements(ctx);
    case "logo-interpretation": return buildLogoInterpElements(ctx);
    case "logo-variations": return buildLogoVariationsElements(ctx);
    case "logo-misuse": return buildLogoMisuseElements(ctx);
    case "aux-graphics-misuse": return buildAuxGraphicsMisuseElements(ctx);
    case "logo-grid": return buildLogoGridElements(ctx);
    case "auxiliary-graphics": return buildAuxiliaryGraphicsElements(ctx);
    case "brand-colors": return buildColorElements(ctx);
    case "color-taboos": return buildColorTaboosElements(ctx);
    case "typography": return buildTypographyElements(ctx);
    case "basic-spec": return buildBasicSpecElements(ctx);
    case "stationery": return buildStationeryElements(ctx);
    case "packaging": return buildPackagingElements(ctx);
    case "marketing": return buildMarketingElements(ctx);
    case "font-copyright": return buildFontCopyrightElements(ctx);
    case "summary": return buildSummaryElements(ctx);
    case "digital-media": return buildDigitalMediaElements(ctx);
    case "wayfinding": return [{ type: "custom" as const, id: "wayfinding-placeholder", content: PAGE_LABELS["wayfinding"] }];
    case "material-priority": return buildMaterialPriorityElements(ctx);
    case "file-output": return buildFileOutputElements(ctx);
    case "logo-output": return [{
      type: "custom" as const, id: "logo-output-placeholder",
      content: PAGE_LABELS["logo-output"]
    }];
    case "modification-authority": return [{
      type: "custom" as const, id: "mod-auth-placeholder",
      content: PAGE_LABELS["modification-authority"]
    }];
    case "closing": return buildClosingElements(ctx);
    default: return [];
  }
}

// ---- 封面 ----

function buildCoverElements(ctx: BuildContext): PageElement[] {
  const { companyName, hasLogo, hasMascot, isThreeView } = ctx;
  const elements: PageElement[] = [];
  let yOffset = 60;

  // 顶部装饰条
  elements.push({
    type: "decoration", id: "cover-top-bar",
    position: "top-center", widthPct: 100, heightPct: 1,
    color: ctx.acc.hex, params: { barType: "thin" },
  });

  // LOGO
  if (hasLogo) {
    elements.push({
      type: "logo", id: "cover-logo",
      position: "top-center", widthPct: 40, heightPct: 18,
      marginTop: yOffset, shadow: true,
    });
    yOffset = 60 + 180 + 30;
  } else {
    yOffset = 120;
  }

  // 分隔线
  elements.push({
    type: "divider", id: "cover-divider-1",
    position: "center",
    color: ctx.acc.hex, opacity: 0.4,
    marginTop: yOffset, widthPct: 50,
    params: { lineWidth: 1 },
  });
  yOffset += 30;

  // 公司名
  const nameSize = companyName.length > 8 ? 40 : 48;
  elements.push({
    type: "text", id: "cover-company-name",
    content: companyName,
    position: "center", fontSize: nameSize, fontWeight: 700,
    color: "#FFFFFF", marginTop: yOffset, shadow: true,
  });
  yOffset += nameSize + 20;

  // 副标题
  elements.push({
    type: "text", id: "cover-subtitle",
    content: "品牌视觉识别系统 (VI) 规范手册",
    position: "center", fontSize: 22, fontWeight: 500,
    color: "#FFFFFF", opacity: 0.9, marginTop: yOffset,
  });

  // 英文副标题
  elements.push({
    type: "text", id: "cover-subtitle-en",
    content: "VISUAL IDENTITY GUIDELINES",
    position: "center", fontSize: 14, fontWeight: 300,
    color: "#FFFFFF", opacity: 0.6,
    marginTop: yOffset + 30, params: { letterSpacing: 3 },
  });

  // 底部信息
  elements.push({
    type: "text", id: "cover-bottom-info",
    content: "品牌管理部  ·  v1.0  ·  2026",
    position: "bottom-center", fontSize: 14,
    color: "#FFFFFF", opacity: 0.7, marginBottom: 40,
  });

  // IP 公仔（右下角）
  if (hasMascot) {
    elements.push({
      type: "ip-mascot", id: "cover-mascot",
      position: "bottom-right",
      widthPct: isThreeView ? 15 : 20,
      heightPct: isThreeView ? 18 : 22,
      marginRight: 40, marginBottom: 40, opacity: 0.9,
      params: { view: "front" },
    });
  }

  return elements;
}

// ---- 品牌核心理念 ----

function buildPhilosophyElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, clientInfo, hasMascot } = ctx;
  const elements: PageElement[] = [];

  // 标题
  elements.push({ type: "text", id: "ph-title", content: PAGE_LABELS["brand-philosophy"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  // 分隔线
  elements.push({ type: "divider", id: "ph-divider-top",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  // 三个板块
  const sections = [
    { id: "vision", label: "品牌愿景", content: clientInfo.brandVision || "待定" },
    { id: "values", label: "核心价值", content: clientInfo.coreValues || "待定" },
    { id: "market", label: "目标市场", content: clientInfo.targetMarket || "待定" },
  ];

  sections.forEach((s, i) => {
    const yBase = 140 + i * 240;

    // 板块标头
    elements.push({ type: "text", id: `ph-${s.id}-label`,
      content: s.label, position: "top-center",
      fontSize: 16, fontWeight: 700, color: pri.hex,
      marginTop: yBase, marginLeft: 80, params: { align: "left" },
    });

    // 板块内容
    elements.push({ type: "text", id: `ph-${s.id}-content`,
      content: s.content, position: "top-center",
      fontSize: 14, fontWeight: 400, color: "#444",
      marginTop: yBase + 30, marginLeft: 40, marginRight: 40,
      params: { align: "left", lineHeight: 1.5 },
    });

    // 分隔线
    if (i < sections.length - 1) {
      elements.push({ type: "divider", id: `ph-div-${s.id}`,
        position: "center", widthPct: 60, color: acc.hex, opacity: 0.2,
        marginTop: yBase + 180,
      });
    }
  });

  // IP 装饰右下角
  if (hasMascot) {
    elements.push({ type: "ip-mascot", id: "ph-mascot",
      position: "bottom-right", widthPct: 12, heightPct: 15,
      marginRight: 30, marginBottom: 30, opacity: 0.6,
    });
  }

  return elements;
}

// ---- 标识诠释 ----

function buildLogoInterpElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, sec, logoElements, logoMeaning, logoStyleTags, hasLogo, hasMascot, mascotName, mascotStyle, mascotPersonality, mascotPhilosophy } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "li-title", content: PAGE_LABELS["logo-interpretation"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "li-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  let yPos = 130;

  // LOGO 设计理念
  if (hasLogo) {
    // LOGO 图
    elements.push({ type: "logo", id: "li-logo-image",
      position: "left", widthPct: 25, heightPct: 20,
      marginTop: yPos, marginLeft: 60, });

    // 元素拆解
    if (logoElements.length > 0) {
      elements.push({ type: "text", id: "li-elements-title",
        content: "设计元素拆解", position: "right",
        fontSize: 14, fontWeight: 700, color: pri.hex,
        marginTop: yPos, marginRight: 80, });

      elements.push({ type: "text", id: "li-elements",
        content: logoElements.map((e, i) => `${i + 1}. ${e}`).join("\n"),
        position: "right", fontSize: 12, fontWeight: 400, color: "#555",
        marginTop: yPos + 25, marginRight: 80,
        params: { align: "left", lineHeight: 1.6 },
      });
    }

    if (logoMeaning) {
      yPos += 60;
      elements.push({ type: "divider", id: "li-div-1",
        position: "center", widthPct: 70, color: sec.hex, opacity: 0.3, marginTop: yPos });

      elements.push({ type: "text", id: "li-meaning-title",
        content: "设计含义", position: "top-center",
        fontSize: 14, fontWeight: 600, color: pri.hex,
        marginTop: yPos + 20, marginLeft: 80 });

      elements.push({ type: "text", id: "li-meaning",
        content: logoMeaning, position: "top-center",
        fontSize: 13, fontWeight: 400, color: "#444",
        marginTop: yPos + 45, marginLeft: 40, marginRight: 40,
        params: { align: "left", lineHeight: 1.5 },
      });
    }

    if (logoStyleTags.length > 0) {
      elements.push({ type: "text", id: "li-styles",
        content: `风格标签：${logoStyleTags.join("、")}`,
        position: "bottom-center", fontSize: 11,
        color: "#888", marginBottom: 120,
      });
    }
  }

  // IP 角色介绍
  if (hasMascot && mascotName) {
    const mascotY = 480;
    elements.push({ type: "divider", id: "li-div-ip",
      position: "center", widthPct: 70, color: acc.hex, opacity: 0.3, marginTop: mascotY });

    elements.push({ type: "text", id: "li-ip-title",
      content: "IP 角色介绍", position: "top-center",
      fontSize: 16, fontWeight: 700, color: pri.hex,
      marginTop: mascotY + 20 });

    elements.push({ type: "text", id: "li-ip-name",
      content: `角色名称：${mascotName}`,
      position: "top-center", fontSize: 14, fontWeight: 500,
      color: "#333", marginTop: mascotY + 50, marginLeft: 80,
      params: { align: "left" },
    });

    if (mascotStyle || mascotPersonality) {
      elements.push({ type: "text", id: "li-ip-desc",
        content: [mascotStyle, mascotPersonality].filter(Boolean).join(" · "),
        position: "top-center", fontSize: 13,
        color: "#555", marginTop: mascotY + 75, marginLeft: 80,
        params: { align: "left" },
      });
    }

    if (mascotPhilosophy) {
      elements.push({ type: "text", id: "li-ip-philosophy-title",
        content: "设计理念",
        position: "top-center", fontSize: 14, fontWeight: 600, color: pri.hex,
        marginTop: mascotY + 100, marginLeft: 80,
        params: { align: "left" },
      });
      elements.push({ type: "text", id: "li-ip-philosophy",
        content: mascotPhilosophy,
        position: "top-center", fontSize: 12, fontWeight: 400, color: "#555",
        marginTop: mascotY + 125, marginLeft: 40, marginRight: 40,
        params: { align: "left", lineHeight: 1.5 },
      });
    }
  }

  return elements;
}


// ---- Logo组合规范 ----

function buildLogoVariationsElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc, hasLogo } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "lv-title", content: PAGE_LABELS["logo-variations"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "lv-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  if (hasLogo) {
    // 4 variations in 2x2 grid
    const variations = [
      { id: "horizontal", label: "横式组合", col: 0, row: 0, bgDark: false },
      { id: "vertical", label: "竖式组合", col: 1, row: 0, bgDark: false },
      { id: "inverted", label: "反白稿（深底）", col: 0, row: 1, bgDark: true },
      { id: "monochrome", label: "单色稿", col: 1, row: 1, bgDark: false },
    ];

    for (const v of variations) {
      const xBase = v.col === 0 ? 80 : 510;
      const yBase = v.row === 0 ? 120 : 340;

      elements.push({ type: "decoration", id: `lv-bg-${v.id}`,
        position: "absolute", widthPct: 40, heightPct: 25,
        marginLeft: xBase, marginTop: yBase,
        color: v.bgDark ? pri.hex : "#F5F5F5",
        params: { shape: "rounded-rect" },
      });

      elements.push({ type: "logo", id: `lv-${v.id}`,
        position: "absolute", widthPct: 25, heightPct: 18,
        marginLeft: xBase + 100, marginTop: yBase + 30,
        shadow: !v.bgDark,
        params: { variation: v.id, bgDark: v.bgDark },
      });

      elements.push({ type: "text", id: `lv-label-${v.id}`,
        content: v.label, position: "absolute",
        fontSize: 12, fontWeight: 500, color: v.bgDark ? "#FFFFFF" : "#666",
        marginLeft: xBase + 80, marginTop: yBase + 180,
        params: { align: "center" },
      });
    }

    elements.push({ type: "text", id: "lv-note",
      content: "Logo在不同背景和应用场景下应选用合适的组合形式，确保识别性与美观性。",
      position: "bottom-center", fontSize: 11, color: "#888",
      marginBottom: 80, params: { align: "center" },
    });
  } else {
    elements.push({ type: "text", id: "lv-no-logo",
      content: "本品牌使用AI生成Logo，建议后续完善横式/竖式/反白/单色稿。",
      position: "center", fontSize: 13, color: "#888", marginTop: 200,
      params: { align: "center" },
    });
  }

  return elements;
}

// ---- Logo误用规范 ----

function buildLogoMisuseElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "lm-title", content: PAGE_LABELS["logo-misuse"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "lm-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  const misuses = [
    { title: "禁止拉伸", desc: "不得对Logo进行\n非等比缩放" },
    { title: "禁止旋转", desc: "不得旋转\nLogo角度" },
    { title: "禁止换色", desc: "不得使用非标准色\n替换Logo颜色" },
    { title: "禁止描边", desc: "不得给Logo\n添加描边效果" },
    { title: "禁止加阴影", desc: "不得添加非规范\n投影效果" },
    { title: "禁止改字体", desc: "不得更改Logo\n中的字体样式" },
  ];

  for (let i = 0; i < misuses.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const xBase = col === 0 ? 50 : col === 1 ? 310 : 570;
    const yBase = 110 + row * 230;

    // Red X box
    elements.push({ type: "decoration", id: `lm-box-${i}`,
      position: "absolute", widthPct: 28, heightPct: 24,
      marginLeft: xBase, marginTop: yBase,
      color: "#FEF2F2", params: { shape: "rounded-rect", borderColor: "#FECACA" },
    });

    elements.push({ type: "text", id: `lm-x-${i}`,
      content: "\u2715", position: "absolute",
      fontSize: 32, fontWeight: 700, color: "#EF4444",
      marginLeft: xBase + 95, marginTop: yBase + 20,
      params: { align: "center" },
    });

    elements.push({ type: "text", id: `lm-t-${i}`,
      content: misuses[i].title, position: "absolute",
      fontSize: 14, fontWeight: 700, color: "#DC2626",
      marginLeft: xBase + 20, marginTop: yBase + 80,
      params: { align: "center" },
    });

    elements.push({ type: "text", id: `lm-d-${i}`,
      content: misuses[i].desc, position: "absolute",
      fontSize: 11, fontWeight: 400, color: "#888",
      marginLeft: xBase + 10, marginTop: yBase + 110,
      marginRight: 10, params: { align: "center", lineHeight: 1.6 },
    });
  }

  elements.push({ type: "text", id: "lm-footer",
    content: "以上误用方式将严重损害品牌形象，所有应用必须严格遵守本规范。",
    position: "bottom-center", fontSize: 12, fontWeight: 600, color: pri.hex,
    marginBottom: 60, params: { align: "center" },
  });

  return elements;
}

// ---- 辅助图形 ----

function buildAuxiliaryGraphicsElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "ag-title", content: PAGE_LABELS["auxiliary-graphics"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "ag-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  // Intro
  elements.push({ type: "text", id: "ag-intro",
    content: "辅助图形是品牌视觉系统的重要组成部分，用于丰富视觉层次、强化品牌识别。",
    position: "top-center", fontSize: 13, color: "#666",
    marginTop: 100, marginLeft: 40, marginRight: 40,
    params: { align: "left", lineHeight: 1.6 },
  });

  // Pattern 1: Stripes
  elements.push({ type: "decoration", id: "ag-pattern-1",
    position: "left", widthPct: 42, heightPct: 22,
    marginTop: 160, marginLeft: 50,
    color: pri.hex, params: { patternType: "stripes", secondaryColor: sec.hex, accentColor: acc.hex },
  });
  elements.push({ type: "text", id: "ag-p1-label",
    content: "主辅助图形 \u2014 条纹组合", position: "left",
    fontSize: 12, fontWeight: 500, color: "#444",
    marginTop: 380, marginLeft: 70,
  });

  // Pattern 2: Dots
  elements.push({ type: "decoration", id: "ag-pattern-2",
    position: "right", widthPct: 42, heightPct: 22,
    marginTop: 160, marginRight: 50,
    color: sec.hex, params: { patternType: "dots", secondaryColor: pri.hex, accentColor: acc.hex },
  });
  elements.push({ type: "text", id: "ag-p2-label",
    content: "次辅助图形 \u2014 点阵组合", position: "right",
    fontSize: 12, fontWeight: 500, color: "#444",
    marginTop: 380, marginRight: 70,
  });

  // Usage
  elements.push({ type: "text", id: "ag-usage-title",
    content: "应用场景", position: "top-center",
    fontSize: 16, fontWeight: 700, color: pri.hex, marginTop: 440,
  });

  elements.push({ type: "text", id: "ag-usage-list",
    content: "1. 文档/手册页眉装饰线\n2. 包装袋底部纹样\n3. 名片背面背景\n4. 社交媒体封面装饰\n5. 店铺墙面装饰纹样",
    position: "top-center", fontSize: 12, color: "#555",
    marginTop: 475, marginLeft: 40, marginRight: 40,
    params: { align: "left", lineHeight: 1.8 },
  });

  elements.push({ type: "text", id: "ag-note",
    content: "辅助图形可按比例缩放，但不可改变比例关系或旋转角度。建议透明度使用10%-40%。",
    position: "bottom-center", fontSize: 11, color: "#888",
    marginBottom: 60, params: { align: "center" },
  });

  return elements;
}

// ---- 标准色彩规范 ----

function buildColorElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "bc-title", content: PAGE_LABELS["brand-colors"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "bc-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  // 三色块
  const colors = [
    { id: "primary", label: "主色", hex: pri.hex, name: pri.name || "品牌主色" },
    { id: "secondary", label: "辅助色", hex: sec.hex, name: sec.name || "辅助色" },
    { id: "accent", label: "强调色", hex: acc.hex, name: acc.name || "强调色" },
  ];

  colors.forEach((c, i) => {
    const xBase = 80 + i * 300;
    elements.push({
      type: "color-swatch", id: `bc-${c.id}`,
      position: "top-center",
      widthPct: 22, heightPct: 18,
      marginTop: 120, marginLeft: xBase,
      color: c.hex,
      params: { label: c.label, name: c.name, hex: c.hex },
    });
  });

  return elements;
}

// ---- 字体系统 ----

function buildTypographyElements(ctx: BuildContext): PageElement[] {
  const { pri, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "ty-title", content: PAGE_LABELS["typography"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "ty-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  // 中文 / 英文 两块
  const sections = [
    { id: "zh", lang: "中文字体", brand: "思源黑体 / Noto Sans SC", body: "思源宋体 / Noto Serif SC" },
    { id: "en", lang: "英文字体", brand: "Montserrat", body: "Open Sans" },
  ];

  sections.forEach((s, i) => {
    const yBase = 150 + i * 300;
    elements.push({ type: "text", id: `ty-${s.id}-title`,
      content: s.lang, position: "top-center",
      fontSize: 16, fontWeight: 700, color: pri.hex,
      marginTop: yBase, marginLeft: 80, params: { align: "left" },
    });
    elements.push({ type: "text", id: `ty-${s.id}-brand`,
      content: `品牌字体：${s.brand}`,
      position: "top-center", fontSize: 14, color: "#444",
      marginTop: yBase + 30, marginLeft: 80, params: { align: "left" },
    });
    elements.push({ type: "text", id: `ty-${s.id}-body`,
      content: `正文字体：${s.body}`,
      position: "top-center", fontSize: 14, color: "#666",
      marginTop: yBase + 55, marginLeft: 80, params: { align: "left" },
    });
  });

  // 字号层级表
  elements.push({ type: "table", id: "ty-hierarchy",
    position: "bottom-center",
    widthPct: 60, heightPct: 15,
    marginBottom: 40,
    params: {
      headers: ["层级", "字号", "字重", "用途"],
      rows: [
        ["H1 / 标题", "24pt", "Bold 700", "页面主标题"],
        ["H2 / 副标题", "16pt", "Medium 500", "段落标题"],
        ["正文", "12pt", "Regular 400", "正文内容"],
        ["说明", "10pt", "Light 300", "注释说明"],
      ],
    },
  });

  return elements;
}

// ---- 基础规范 ----

function buildBasicSpecElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, hasLogo } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "bs-title", content: PAGE_LABELS["basic-spec"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "bs-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  if (hasLogo) {
    // LOGO 保护空间示意
    elements.push({ type: "logo", id: "bs-logo",
      position: "center", widthPct: 30, heightPct: 20,
      marginTop: 130, shadow: true,
      params: { showClearSpace: true, clearSpaceRatio: 0.15 },
    });
    elements.push({ type: "text", id: "bs-clearspace",
      content: "LOGO 四周保留至少 15% 保护空间，不可被任何元素遮挡或裁切",
      position: "bottom-center", fontSize: 12, color: "#666",
      marginBottom: 200, params: { align: "center" },
    });
  }

  // 最小尺寸
  elements.push({ type: "table", id: "bs-min-sizes",
    position: "bottom-center",
    widthPct: 50, heightPct: 12,
    marginBottom: 80,
    params: {
      headers: ["场景", "最小尺寸"],
      rows: [
        ["印刷", "8mm (0.31 in)"],
        ["屏幕", "24px"],
      ],
    },
  });

  return elements;
}

// ---- 办公应用系统 ----


function buildDigitalMediaElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc } = ctx;
  const elements: PageElement[] = [
    { type: "text", id: "dm-title", content: PAGE_LABELS["digital-media"], position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 },
    { type: "divider", id: "dm-divider", position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 },
    { type: "text", id: "dm-h-0", content: "社媒头像/封面模板规范", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 100, marginLeft: 60, params: { align: "left" } },
    { type: "text", id: "dm-b-0", content: "头像采用圆形裁切，公仔头部居中，直径不低于128px。封面模板统一1920×1080分辨率，文字区域须在安全区内。", position: "top-center", fontSize: 12, color: "#444", marginTop: 128, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 } },
    { type: "text", id: "dm-h-1", content: "短视频封面排版规范", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 200, marginLeft: 60, params: { align: "left" } },
    { type: "text", id: "dm-b-1", content: "封面1080×1920竖版，公仔居左中1/3区域，右上/下留白排版标题。品牌色条置于底部20%区域。", position: "top-center", fontSize: 12, color: "#444", marginTop: 228, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 } },
    { type: "text", id: "dm-h-2", content: "网站/App图标使用规范", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 300, marginLeft: 60, params: { align: "left" } },
    { type: "text", id: "dm-b-2", content: "图标使用简化版公仔头像，去除复杂细节。最小32×32px，白底或透明底，四周保留4px圆角裁切区域。", position: "top-center", fontSize: 12, color: "#444", marginTop: 328, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 } },
    { type: "text", id: "dm-h-3", content: "邮件签名/Banner排版规范", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 400, marginLeft: 60, params: { align: "left" } },
    { type: "text", id: "dm-b-3", content: "签名档公仔宽高比1:1，右侧排版姓名+联系方式。Banner采用16:9比例，公仔居中偏左，右侧留白放置品牌标语。", position: "top-center", fontSize: 12, color: "#444", marginTop: 428, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 } },
  ];
  return elements;
}


function buildFileOutputElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc } = ctx;
  const elements: PageElement[] = [
    { type: "text", id: "fo-title", content: PAGE_LABELS["file-output"], position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 },
    { type: "divider", id: "fo-divider", position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 },
    { type: "text", id: "fo-h-0", content: "源文件格式要求", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 100, marginLeft: 60, params: { align: "left" } },
    { type: "text", id: "fo-b-0", content: "源文件须提供PSD或AI分层格式，保留矢量路径与文字图层。所有图形元素须独立分层，禁止合并栅格化后交付。", position: "top-center", fontSize: 12, color: "#444", marginTop: 128, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 } },
    { type: "text", id: "fo-h-1", content: "导出分辨率标准", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 200, marginLeft: 60, params: { align: "left" } },
    { type: "table", id: "fo-resolution", position: "top-center", widthPct: 50, heightPct: 10, marginTop: 235, marginLeft: 60, params: { headers: ["场景", "分辨率"], rows: [["印刷", "300dpi"], ["喷绘", "150dpi"], ["屏幕", "72dpi"]] } },
    { type: "text", id: "fo-h-2", content: "色值模式规范", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 310, marginLeft: 60, params: { align: "left" } },
    { type: "text", id: "fo-b-2", content: "印刷物料使用CMYK模式，数字屏幕使用RGB模式。Logo与品牌色须同时提供CMYK和RGB两套色值参考。", position: "top-center", fontSize: 12, color: "#444", marginTop: 338, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 } },
    { type: "text", id: "fo-h-3", content: "字体转曲/嵌入要求", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 410, marginLeft: 60, params: { align: "left" } },
    { type: "text", id: "fo-b-3", content: "交付前所有文字须转为轮廓（转曲），或嵌入完整字体文件。禁止使用系统默认字体替代品牌指定字体。", position: "top-center", fontSize: 12, color: "#444", marginTop: 438, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 } },
    { type: "text", id: "fo-h-4", content: "文件命名规范", position: "top-center", fontSize: 15, fontWeight: 700, color: pri.hex, marginTop: 510, marginLeft: 60, params: { align: "left" } },
    { type: "text", id: "fo-b-4", content: "格式：品牌名_物料类型_版本号_日期（例：BrandName_Logo_v1.0_20260731）。禁止使用默认文件名或含空格的特殊路径。", position: "top-center", fontSize: 12, color: "#444", marginTop: 538, marginLeft: 60, marginRight: 60, params: { align: "left", lineHeight: 1.5 } },
  ];
  return elements;
}

function buildStationeryElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, hasLogo, hasMascot } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "st-title", content: (INDUSTRY_SCENE_LABELS[ctx.industryType || "general"]?.stationery || PAGE_LABELS["stationery"]),
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "st-divider",
    position: "center", widthPct: 30, color: sec.hex, opacity: 0.6, marginTop: 15 });

  // 设计规范说明
  elements.push({ type: "text", id: "st-desc",
    content: (INDUSTRY_SCENE_DESCS[ctx.industryType || "general"]?.stationery || "品牌在商务场景中的标准化应用"),
    position: "top-center", fontSize: 13, color: "#666",
    marginTop: 120, marginLeft: 60, marginRight: 60,
    params: { align: "left", lineHeight: 1.5 },
  });

  // 场景图区域（由通义万相生成）
  elements.push({ type: "image", id: "st-scene",
    position: "center", widthPct: 70, heightPct: 35,
    marginTop: 180,
    params: { sceneType: (ctx.industryType || "general") + "-stationery" },
  });

  if (hasMascot) {
    elements.push({ type: "ip-mascot", id: "st-mascot",
      position: "bottom-right", widthPct: 10, heightPct: 12,
      marginRight: 30, marginBottom: 30, opacity: 0.7,
      params: { view: "front" },
    });
  }

  return elements;
}

// ---- 产品包装系统 ----

function buildPackagingElements(ctx: BuildContext): PageElement[] {
  const { pri, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "pk-title", content: (INDUSTRY_SCENE_LABELS[ctx.industryType || "general"]?.packaging || PAGE_LABELS["packaging"]),
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "pk-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  elements.push({ type: "text", id: "pk-desc",
    content: (INDUSTRY_SCENE_DESCS[ctx.industryType || "general"]?.packaging || "产品包装与物料的品牌化呈现"),
    position: "top-center", fontSize: 13, color: "#666",
    marginTop: 120, marginLeft: 60, marginRight: 60,
    params: { align: "left" },
  });

  // 场景区
  elements.push({ type: "image", id: "pk-scene",
    position: "center", widthPct: 65, heightPct: 35,
    marginTop: 180,
    params: { sceneType: (ctx.industryType || "general") + "-packaging" },
  });

  return elements;
}

// ---- 营销展示系统 ----

function buildMarketingElements(ctx: BuildContext): PageElement[] {
  const { pri, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "mk-title", content: (INDUSTRY_SCENE_LABELS[ctx.industryType || "general"]?.marketing || PAGE_LABELS["marketing"]),
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "mk-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  elements.push({ type: "text", id: "mk-desc",
    content: (INDUSTRY_SCENE_DESCS[ctx.industryType || "general"]?.marketing || "宣传与促销物料"),
    position: "top-center", fontSize: 13, color: "#666",
    marginTop: 120, marginLeft: 60, marginRight: 60,
    params: { align: "left" },
  });

  elements.push({ type: "image", id: "mk-scene",
    position: "center", widthPct: 65, heightPct: 35,
    marginTop: 180,
    params: { sceneType: (ctx.industryType || "general") + "-marketing" },
  });

  return elements;
}

// ---- 总结 ----

function buildSummaryElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, sec, clientInfo, hasMascot } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "su-title", content: PAGE_LABELS["summary"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "su-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  elements.push({ type: "text", id: "su-vision",
    content: clientInfo.brandVision || "构建统一的品牌视觉资产",
    position: "center", fontSize: 16, fontWeight: 500, color: "#333",
    marginTop: 130, marginLeft: 60, marginRight: 60,
    params: { align: "center", lineHeight: 1.6, italic: true },
  });

  // 三大原则
  const principles = [
    { label: "一致性", desc: "所有媒介输出必须严格遵守本手册规范，确保品牌在任何触点下都能被精准识别" },
    { label: "专业性", desc: "通过标准化的视觉语言建立客户信任，展现品牌作为行业专家的专业形象" },
    { label: "持续性", desc: "VI 系统是品牌长期发展的核心无形资产，是品牌价值持续积累的视觉载体" },
  ];

  principles.forEach((p, i) => {
    const yBase = 250 + i * 180;
    elements.push({ type: "decoration", id: `su-prin-${i}-icon`,
      position: "top-center",
      widthPct: 4, heightPct: 6,
      marginTop: yBase, marginLeft: 80,
      color: [pri.hex, sec.hex, acc.hex][i],
      params: { shape: "circle" },
    });
    elements.push({ type: "text", id: `su-prin-${i}-label`,
      content: p.label, position: "top-center",
      fontSize: 15, fontWeight: 700, color: [pri.hex, sec.hex, acc.hex][i],
      marginTop: yBase, marginLeft: 130, params: { align: "left" },
    });
    elements.push({ type: "text", id: `su-prin-${i}-desc`,
      content: p.desc, position: "top-center",
      fontSize: 12, color: "#555",
      marginTop: yBase + 25, marginLeft: 130, marginRight: 80,
      params: { align: "left", lineHeight: 1.4 },
    });
  });

  // 核心价值回顾
  if (clientInfo.coreValues) {
    elements.push({ type: "text", id: "su-corevalues",
      content: `核心价值：${clientInfo.coreValues}`,
      position: "bottom-center", fontSize: 13,
      color: "#888", marginBottom: 100,
    });
  }

  if (hasMascot) {
    elements.push({ type: "ip-mascot", id: "su-mascot",
      position: "bottom-right", widthPct: 10, heightPct: 12,
      marginRight: 30, marginBottom: 30, opacity: 0.5,
    });
  }

  return elements;
}

// ---- 感谢观看 ----


function buildAuxGraphicsMisuseElements(ctx: BuildContext): PageElement[] {
  return [{ type: "text", id: "agm-title", content: "辅助图形禁用规范", style: { fontSize: 24, bold: true, color: ctx.pri.hex } }];
}

function buildColorTaboosElements(ctx: BuildContext): PageElement[] {
  return [{ type: "text", id: "ct-title", content: "色彩使用规范", style: { fontSize: 24, bold: true, color: ctx.pri.hex } }];
}

function buildMaterialPriorityElements(ctx: BuildContext): PageElement[] {
  return [{ type: "text", id: "mp-title", content: "VI物料落地清单", style: { fontSize: 24, bold: true, color: ctx.pri.hex } }];
}
function buildClosingElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, companyName, hasMascot } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "cl-title", content: PAGE_LABELS["closing"],
    position: "center", fontSize: 36, fontWeight: 700,
    color: "#FFFFFF", marginTop: 300, shadow: true });

  elements.push({ type: "text", id: "cl-subtitle",
    content: `${companyName} · 品牌视觉识别系统 (VI) 规范手册`,
    position: "center", fontSize: 16,
    color: "#FFFFFF", opacity: 0.6, marginTop: 380,
  });

  elements.push({ type: "text", id: "cl-contact",
    content: "如有疑问，请咨询品牌管理部",
    position: "bottom-center", fontSize: 13,
    color: "#FFFFFF", opacity: 0.5, marginBottom: 100,
  });

  // 底部装饰条
  elements.push({ type: "decoration", id: "cl-bottom-bar",
    position: "bottom-center", widthPct: 100, heightPct: 1,
    color: acc.hex, marginBottom: 0,
    params: { barType: "thick" },
  });

  if (hasMascot) {
    elements.push({ type: "ip-mascot", id: "cl-mascot",
      position: "center", widthPct: 14, heightPct: 16,
      marginTop: 440, opacity: 0.8,
    });
  }

  return elements;
}

function buildLogoGridElements(ctx: BuildContext): PageElement[] {
  const { pri, acc } = ctx;
  const elements: PageElement[] = [];
  elements.push({ type: "text", id: "lg-title", content: PAGE_LABELS["logo-grid"], position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });
  elements.push({ type: "divider", id: "lg-divider", position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });
  // 真实 LOGO 网格制图元素（渲染层 renderLogoGrid 将据此绘制 10×10 网格 + Logo + 尺寸标注）
  elements.push({
    type: "logo-grid" as any,
    id: "lg-grid",
    position: "center",
    widthPct: 55,
    heightPct: 55,
    marginTop: 80,
    color: pri.hex,
    params: { gridCols: 10, gridRows: 10, label: "LOGO网格制图规范", showLogo: true, showDimensions: true, showClearSpace: true },
  });
  elements.push({
    type: "text", id: "lg-note",
    content: "LOGO 居中置于 10×10 标准网格，标注外框比例、坐标与最小尺寸；四周保留 15% 保护空间。",
    position: "top-center", fontSize: 12, color: "#666", marginTop: 480, marginLeft: 60, marginRight: 60,
    params: { align: "left", lineHeight: 1.5 },
  });
  return elements;
}

function buildFontCopyrightElements(ctx: BuildContext): PageElement[] {
  const elements: PageElement[] = [];
  elements.push({ type: "text", id: "fc-title", content: PAGE_LABELS["font-copyright"], style: { fontSize: 24, bold: true, color: ctx.pri.hex } });
  elements.push({ type: "divider", id: "fc-divider" });
  elements.push({ type: "text", id: "fc-noto-sans", content: "思源黑体 Noto Sans SC — SIL开源免费商用", style: { fontSize: 14 } });
  elements.push({ type: "text", id: "fc-noto-serif", content: "思源宋体 Noto Serif SC — SIL开源免费商用", style: { fontSize: 14 } });
  elements.push({ type: "text", id: "fc-montserrat", content: "Montserrat — SIL开源免费商用", style: { fontSize: 14 } });
  elements.push({ type: "text", id: "fc-opensans", content: "Open Sans — Apache 2.0免费商用", style: { fontSize: 14 } });
  elements.push({ type: "warning", id: "fc-warning", content: "禁止使用微软雅黑、方正等未授权商业字体，避免侵权诉讼", style: { fontSize: 12, color: "#FF6600" } });
  return elements;
}

// ========== 验证工具 ==========

/**
 * 将 PageBlueprint 转为可读文本（用于调试/记录）
 */
export function blueprintToSummary(bp: PageBlueprint): string {
  return [
    `[${bp.pageId}] ${bp.label}`,
    `  背景: ${bp.background.type} (主色: ${bp.background.primaryColor})`,
    `  元素: ${bp.elements.length} 个`,
    `  规则: ${bp.appliedRules.length} 条`,
    `  阈值: ${bp.qualityThreshold}`,
  ].join("\n");
}

/**
 * 检查 Blueprint 是否满足最小质量要求
 */
export function validateBlueprint(bp: PageBlueprint): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // 必须有背景
  if (!bp.background.primaryColor) {
    issues.push("缺少背景主色");
  }

  // 必须有元素
  if (bp.elements.length === 0) {
    issues.push("页面没有任何元素");
  }

  // 标题页必须有标题
  const titleElements = bp.elements.filter(e => e.type === "text" && e.id.includes("title"));
  if (titleElements.length === 0 && bp.pageId !== "stationery" && bp.pageId !== "packaging" && bp.pageId !== "marketing") {
    issues.push("缺少标题元素");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}






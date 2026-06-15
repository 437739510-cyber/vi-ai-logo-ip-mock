import type { PageBlueprint, PageElement } from "./page-planner";

/**
 * 设计规则库 (Design Rules)
 *
 * 把你的专业设计 know-how 转成代码可执行的规则集合。
 * 规则分为三层：
 *   1. 共用规则 — 所有页面都必须遵守
 *   2. 页面专属规则 — 每种页面类型自己的规则
 *   3. 规则优先级 — 当多条规则冲突时按优先级选择
 *
 * 规则优先级：参考手册规则 > 行业通用规则 > 系统默认规则
 */

// ========== 类型定义 ==========

/** 规则强度 */
export type RulePriority = "must" | "should" | "nice";

/** 单条规则 */
export interface DesignRule {
  id: string;
  /** 规则所属的页面类型（"all" 表示所有页面） */
  pageType: string | "all";
  priority: RulePriority;
  description: string;
  /** 规则的具体内容（SVG 参数或文案说明） */
  params?: Record<string, any>;
}

/** 规则验证结果 */
export interface RuleValidation {
  passed: boolean;
  ruleId: string;
  message: string;
}

// ========== 共用规则（所有页面适用） ==========

const COMMON_RULES: DesignRule[] = [
  {
    id: "common-brand-color-dominance",
    pageType: "all",
    priority: "must",
    description: "品牌色占页面 60% 以上面积（背景/色块/装饰线）",
    params: { brandColorRatio: 0.6 },
  },
  {
    id: "common-max-font-weights",
    pageType: "all",
    priority: "should",
    description: "一页不超过 3 种字重",
    params: { maxWeights: 3 },
  },
  {
    id: "common-logo-clear-space",
    pageType: "all",
    priority: "must",
    description: "LOGO 四周保留至少 15% 页面宽度的保护空间，不可被任何元素遮挡或裁切",
    params: { clearSpaceRatio: 0.15 },
  },
  {
    id: "common-text-contrast",
    pageType: "all",
    priority: "must",
    description: "所有文本必须有足够对比度：深色背景用浅色文字，浅色背景用深色文字",
  },
  {
    id: "common-page-margin",
    pageType: "all",
    priority: "should",
    description: "页面边缘保留 5%-10% 的留白，不放置关键信息",
    params: { marginRatio: { min: 0.05, max: 0.1 } },
  },
  {
    id: "common-decoration-subtle",
    pageType: "all",
    priority: "should",
    description: "装饰元素（线条/色块/角落标志）不得遮挡主要信息，颜色使用辅助色或强调色",
    params: { decorationOpacity: 0.3 },
  },
  {
    id: "common-max-one-ip",
    pageType: "all",
    priority: "should",
    description: "每页最多使用一个 IP 公仔视图，避免画面杂乱",
  },
];

// ========== 页面专属规则 ==========

const COVER_RULES: DesignRule[] = [
  {
    id: "cover-logo-centered",
    pageType: "cover",
    priority: "must",
    description: "LOGO 居中放置，宽度占页面 35%-50%",
    params: { position: "top-center", widthPct: { min: 35, max: 50 }, marginTop: 60 },
  },
  {
    id: "cover-logo-no-crop",
    pageType: "cover",
    priority: "must",
    description: "完整展示 LOGO，不可裁切、不可变形、不可被遮挡",
  },
  {
    id: "cover-dark-bg",
    pageType: "cover",
    priority: "should",
    description: "深色品牌色背景 + 白色文字（主色饱和度 > 50% 时使用）",
    params: { bgType: "brand-dark", textColor: "#FFFFFF" },
  },
  {
    id: "cover-company-name",
    pageType: "cover",
    priority: "must",
    description: "公司名 40-48px 加粗，位于 LOGO 下方",
    params: { fontSize: { min: 40, max: 48 }, fontWeight: 700 },
  },
  {
    id: "cover-subtitle",
    pageType: "cover",
    priority: "should",
    description: "副标题'品牌视觉识别系统 (VI) 规范手册'，22px 中等字重，位于公司名下方",
    params: { fontSize: 22, fontWeight: 500 },
  },
  {
    id: "cover-ip-position",
    pageType: "cover",
    priority: "should",
    description: "IP 公仔最多占页面 1/4，置于右下角，不遮挡文字。如果用三视图则只使用正面视图",
    params: { maxSizePct: 25, position: "bottom-right" },
  },
  {
    id: "cover-bottom-info",
    pageType: "cover",
    priority: "should",
    description: "底部显示部门 + 版本 + 年份信息，14px，居中对齐",
    params: { fontSize: 14, position: "bottom-center" },
  },
];

const BRAND_PHILOSOPHY_RULES: DesignRule[] = [
  {
    id: "philosophy-show-all",
    pageType: "brand-philosophy",
    priority: "must",
    description: "必须展示品牌愿景 + 核心价值 + 目标市场（从客户资料读取）",
  },
  {
    id: "philosophy-divider",
    pageType: "brand-philosophy",
    priority: "should",
    description: "三个板块之间用辅助色分隔线隔开",
    params: { dividerColor: "accent", dividerWidth: 2 },
  },
  {
    id: "philosophy-title-size",
    pageType: "brand-philosophy",
    priority: "should",
    description: "页面标题 24px，板块标题 16px 加粗，正文 13px",
    params: { pageTitleSize: 24, sectionTitleSize: 16, bodySize: 13 },
  },
  {
    id: "philosophy-ip-decorative",
    pageType: "brand-philosophy",
    priority: "nice",
    description: "有 IP 公仔时放在右下角做装饰元素（缩小的正面视图）",
    params: { mascotSizePct: 15, position: "bottom-right", opacity: 0.7 },
  },
];

const LOGO_INTERPRETATION_RULES: DesignRule[] = [
  {
    id: "logo-interp-show-elements",
    pageType: "logo-interpretation",
    priority: "should",
    description: "有 LOGO 元素分析结果时展示元素拆解（元素名称列 + 说明文字）",
  },
  {
    id: "logo-interp-show-ip",
    pageType: "logo-interpretation",
    priority: "nice",
    description: "有 IP 分析结果时展示角色介绍（名字 + 性格 + 风格）",
  },
  {
    id: "logo-interp-callout-style",
    pageType: "logo-interpretation",
    priority: "should",
    description: "元素拆解使用引线和标注风格展示",
  },
];

const BRAND_COLORS_RULES: DesignRule[] = [
  {
    id: "colors-show-exact",
    pageType: "brand-colors",
    priority: "must",
    description: "必须显示精确的 HEX 值。有 CMYK/RGB 时同时显示",
  },
  {
    id: "colors-layout",
    pageType: "brand-colors",
    priority: "should",
    description: "主色 / 辅助色 / 强调色 分三个色块排列，尺寸一致，间距均匀",
    params: { swatchSize: "large", arrangement: "horizontal" },
  },
  {
    id: "colors-ref-follow",
    pageType: "brand-colors",
    priority: "nice",
    description: "有参考手册时按照参考的色彩页面布局来排",
  },
];

const TYPOGRAPHY_RULES: DesignRule[] = [
  {
    id: "typo-show-chinese",
    pageType: "typography",
    priority: "must",
    description: "展示中文字体名称（品牌字体 + 通用字体）",
  },
  {
    id: "typo-show-english",
    pageType: "typography",
    priority: "should",
    description: "展示英文字体名称",
  },
  {
    id: "typo-size-hierarchy",
    pageType: "typography",
    priority: "should",
    description: "展示字号层级表（H1/H2/正文/说明）",
  },
  {
    id: "typo-example-text",
    pageType: "typography",
    priority: "nice",
    description: "每种字体附上示例文本展示效果",
  },
];

const BASIC_SPEC_RULES: DesignRule[] = [
  {
    id: "basic-clear-space",
    pageType: "basic-spec",
    priority: "must",
    description: "展示 LOGO 保护空间说明（四周空出比例）",
  },
  {
    id: "basic-min-sizes",
    pageType: "basic-spec",
    priority: "should",
    description: "展示最小使用尺寸（印刷/屏幕分别说明）",
  },
  {
    id: "basic-ref-follow",
    pageType: "basic-spec",
    priority: "nice",
    description: "有参考手册时按照参考的规范页布局",
  },
  {
    id: "basic-correct-vs-wrong",
    pageType: "basic-spec",
    priority: "nice",
    description: "展示正确用法 vs 错误用法对比",
  },
];

const STATIONERY_RULES: DesignRule[] = [
  {
    id: "stationery-scenes",
    pageType: "stationery",
    priority: "should",
    description: "生成名片 + 信纸 + PPT 模板三种应用场景的展示图",
  },
  {
    id: "stationery-brand-usage",
    pageType: "stationery",
    priority: "must",
    description: "所有应用品使用品牌色 + LOGO，风格统一",
  },
  {
    id: "stationery-ip-mini",
    pageType: "stationery",
    priority: "nice",
    description: "有名片时可在名片上放置缩小版的 IP 公仔（正面视图）",
  },
];

const PACKAGING_RULES: DesignRule[] = [
  {
    id: "packaging-scene",
    pageType: "packaging",
    priority: "should",
    description: "生成产品包装场景图，突出产品 + 品牌",
  },
  {
    id: "packaging-brand-color",
    pageType: "packaging",
    priority: "must",
    description: "使用品牌色作为包装主色调",
  },
  {
    id: "packaging-spec-text",
    pageType: "packaging",
    priority: "should",
    description: "标注设计规范说明文字",
  },
];

const MARKETING_RULES: DesignRule[] = [
  {
    id: "marketing-poster",
    pageType: "marketing",
    priority: "should",
    description: "生成营销海报场景图，品牌色 + 卖点文案",
  },
  {
    id: "marketing-ip-action",
    pageType: "marketing",
    priority: "nice",
    description: "有 IP 公仔时让 IP 在场景中展示（手持产品/指引手势等）",
  },
  {
    id: "marketing-spec-text",
    pageType: "marketing",
    priority: "should",
    description: "标注设计规范说明文字",
  },
];

const SUMMARY_RULES: DesignRule[] = [
  {
    id: "summary-vision",
    pageType: "summary",
    priority: "must",
    description: "展示品牌定位语句（引用客户填写的品牌愿景）",
  },
  {
    id: "summary-core-values",
    pageType: "summary",
    priority: "should",
    description: "核心价值回顾",
  },
  {
    id: "summary-three-principles",
    pageType: "summary",
    priority: "should",
    description: "展示三大原则：一致性、专业性、持续性",
  },
];

const CLOSING_RULES: DesignRule[] = [
  {
    id: "closing-info",
    pageType: "closing",
    priority: "must",
    description: "显示公司名 + 版权 + 年份",
  },
  {
    id: "closing-decoration",
    pageType: "closing",
    priority: "should",
    description: "底部装饰条使用强调色",
    params: { barColor: "accent", barHeight: 6 },
  },
  {
    id: "closing-ip-center",
    pageType: "closing",
    priority: "nice",
    description: "有 IP 公仔时居中放置（缩小版，不遮挡文字）",
    params: { mascotSizePct: 18, position: "center" },
  },
];

// ========== 所有规则汇总 ==========

const THREE_VIEW_RULES: DesignRule[] = [
  {
    id: "threeview-only-if-exists",
    pageType: "threeview",
    priority: "must",
    description: "仅当 IP 公仔检测为三视图时才生成此页",
  },
  {
    id: "threeview-layout",
    pageType: "threeview",
    priority: "must",
    description: "正面 / 侧面 / 背面 三张视图并排展示，每张标注视图名称",
    params: { layout: "horizontal", views: ["正面", "侧面", "背面"] },
  },
];

export const ALL_RULES: Record<string, DesignRule[]> = {
  all: COMMON_RULES,
  cover: COVER_RULES,
  "brand-philosophy": BRAND_PHILOSOPHY_RULES,
  "logo-interpretation": LOGO_INTERPRETATION_RULES,
  "brand-colors": BRAND_COLORS_RULES,
  typography: TYPOGRAPHY_RULES,
  "basic-spec": BASIC_SPEC_RULES,
  stationery: STATIONERY_RULES,
  packaging: PACKAGING_RULES,
  marketing: MARKETING_RULES,
  summary: SUMMARY_RULES,
  closing: CLOSING_RULES,
  threeview: THREE_VIEW_RULES,
};

// ========== 工具函数 ==========

/** 获取某页面类型的所有规则（含共用规则） */
export function getRulesForPage(pageType: string): DesignRule[] {
  const common = ALL_RULES["all"] || [];
  const specific = ALL_RULES[pageType] || [];
  return [...common, ...specific];
}

/** 按优先级排序规则（must > should > nice） */
export function sortRulesByPriority(rules: DesignRule[]): DesignRule[] {
  const order: Record<RulePriority, number> = { must: 0, should: 1, nice: 2 };
  return [...rules].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * 检查生成的页面是否符合规则。
 * 实际实现：对 PageBlueprint 逐条验证（由 Phase 9 升级）
 */
/**
 * 规则验证器映射：rule.id → 验证函数
 */
type RuleChecker = (rule: DesignRule, blueprint: PageBlueprint, pageType: string) => RuleValidation;

const RULE_CHECKERS: Record<string, RuleChecker> = {};

/** 通用检查：元素是否存在于页面 */
function hasElementOfType(blueprint: PageBlueprint, type: string, idHint?: string): boolean {
  return blueprint.elements.some(e => e.type === type && (!idHint || e.id.includes(idHint)));
}

/** 注册规则验证器 */
function registerChecker(ruleIdPattern: string, checker: RuleChecker) {
  RULE_CHECKERS[ruleIdPattern] = checker;
}

// ========== 注册各个规则的验证器 ==========

registerChecker("common-max-font-weights", (rule, bp) => {
  const weights = new Set(bp.elements.filter(e => e.fontWeight).map(e => e.fontWeight!));
  const max = rule.params?.maxWeights ?? 3;
  const passed = weights.size <= max;
  return { ruleId: rule.id, passed, message: passed
    ? "字重数量 " + weights.size + " 种，未超过 " + max + " 种限制"
    : "字重数量 " + weights.size + " 种，超过 " + max + " 种限制" };
});

registerChecker("common-page-margin", (rule, bp) => {
  const hasMargin = bp.elements.some(e =>
    (e.marginTop && e.marginTop >= 30) || (e.marginBottom && e.marginBottom >= 30)
  );
  return { ruleId: rule.id, passed: hasMargin,
    message: hasMargin ? "页面边距充足" : "页面边距可能不足" };
});

registerChecker("common-max-one-ip", (rule, bp) => {
  const count = bp.elements.filter(e => e.type === "ip-mascot").length;
  const passed = count <= 1;
  return { ruleId: rule.id, passed,
    message: passed ? "IP 公仔 " + count + " 个，合规" : "IP 公仔 " + count + " 个，超过 1 个限制" };
});

registerChecker("cover-logo-centered", (rule, bp) => {
  const logoEl = bp.elements.find(e => e.type === "logo" && e.id.includes("logo"));
  if (!logoEl) return { ruleId: rule.id, passed: true, message: "无 LOGO 元素，跳过" };
  const minW = rule.params?.widthPct?.min ?? 35;
  const maxW = rule.params?.widthPct?.max ?? 50;
  const wp = logoEl.widthPct;
  const passed = wp !== undefined && wp >= minW && wp <= maxW;
  return { ruleId: rule.id, passed,
    message: passed ? "LOGO 宽度 " + wp + "%，在 " + minW + "-" + maxW + "% 范围内"
      : "LOGO 宽度 " + wp + "%，不在 " + minW + "-" + maxW + "% 范围内" };
});

registerChecker("cover-company-name", (rule, bp) => {
  const nameEl = bp.elements.find(e => e.type === "text" && e.id.includes("company-name"));
  if (!nameEl) return { ruleId: rule.id, passed: false, message: "缺少公司名元素" };
  const minSize = rule.params?.fontSize?.min ?? 40;
  const maxSize = rule.params?.fontSize?.max ?? 48;
  const fs = nameEl.fontSize;
  const passed = fs !== undefined && fs >= minSize && fs <= maxSize;
  return { ruleId: rule.id, passed,
    message: passed ? "公司名字号 " + fs + "px，在 " + minSize + "-" + maxSize + "px 范围内"
      : "公司名字号 " + fs + "px，不在 " + minSize + "-" + maxSize + "px 范围内" };
});

registerChecker("cover-ip-position", (rule, bp) => {
  const ipEl = bp.elements.find(e => e.type === "ip-mascot" && e.id.includes("mascot"));
  if (!ipEl) return { ruleId: rule.id, passed: true, message: "无 IP 公仔，跳过" };
  const maxSize = rule.params?.maxSizePct ?? 25;
  const wp = ipEl.widthPct;
  const passed = wp === undefined || wp <= maxSize;
  return { ruleId: rule.id, passed,
    message: passed ? "IP 尺寸 " + wp + "%，未超过 " + maxSize + "%"
      : "IP 尺寸 " + wp + "%，超过 " + maxSize + "% 限制" };
});

registerChecker("brand-colors-layout", (rule, bp) => {
  const swatches = bp.elements.filter(e => e.type === "color-swatch");
  const passed = swatches.length >= 2;
  return { ruleId: rule.id, passed,
    message: passed ? "色块 " + swatches.length + " 个，已展示" : "色块不足 2 个" };
});

/**
 * 检查 Blueprint 是否符合所有适用规则
 */
export function validateBlueprintAgainstRules(
  blueprint: PageBlueprint,
  pageType: string
): { valid: boolean; results: RuleValidation[] } {
  const rules = getRulesForPage(pageType);
  const results: RuleValidation[] = [];

  for (const rule of rules) {
    const checker = RULE_CHECKERS[rule.id];
    let result: RuleValidation;

    if (checker) {
      result = checker(rule, blueprint, pageType);
    } else {
      result = {
        ruleId: rule.id,
        passed: true,
        message: "[" + rule.priority + "] " + rule.description,
      };
    }

    results.push(result);
  }

  const valid = results.every(r => r.passed);
  return { valid, results };
}

// ========== 约束应用 ==========

/**
 * 根据规则 params 调整元素的属性值，返回修正后的元素列表
 */
export function applyRuleConstraints(
  elements: PageElement[],
  rules: DesignRule[]
): PageElement[] {
  return elements.map(el => {
    const constrained = { ...el };

    for (const rule of rules) {
      const params = rule.params;
      if (!params) continue;

      // 夹紧宽度
      const wRange = params.widthPct;
      if (wRange && typeof wRange === "object" && constrained.widthPct !== undefined) {
        const min = wRange.min ?? 0;
        const max = wRange.max ?? 100;
        constrained.widthPct = Math.max(min, Math.min(max, constrained.widthPct));
      }

      // 夹紧字号
      const fsRange = params.fontSize;
      if (fsRange && typeof fsRange === "object" && constrained.fontSize !== undefined) {
        const min = fsRange.min ?? 8;
        const max = fsRange.max ?? 72;
        constrained.fontSize = Math.max(min, Math.min(max, constrained.fontSize));
      }

      // 夹紧 IP 尺寸
      const maxSize = params.maxSizePct;
      if (maxSize && typeof maxSize === "number" && constrained.widthPct !== undefined) {
        constrained.widthPct = Math.min(constrained.widthPct, maxSize);
      }

      // 强制字体颜色
      if (params.textColor && el.type === "text" && el.id.includes("cover")) {
        constrained.color = params.textColor as string;
      }
    }

    return constrained;
  });
}

/**
 * （保留兼容）旧版验证入口
 */
export function validatePageAgainstRules(
  pageType: string,
  pageParams: Record<string, any>
): RuleValidation[] {
  return [];
}


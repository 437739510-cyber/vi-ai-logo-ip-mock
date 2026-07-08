/**
 * Anti-Pattern Library
 * Known error patterns from past VI manual generations.
 * Feeds into QC checks and prompt constraints.
 */
export interface AntiPattern {
  errorId: string;
  errorLevel: "critical" | "warning" | "info";
  errorType: "硬错误" | "假规范" | "资产风险" | "内容错配";
  errorFeature: string;
  /** QC check function name or issue ID that detects this error */
  detectRule: string;
  /** Prompt constraint to prevent this error in future generations */
  promptConstraint: string;
  /** Human-readable fix guidance appended to QC error messages */
  fixGuide: string;
  occurrenceCount: number;
  firstFound: string;
}

// ---- Hard Errors (6) ----

// ---- Fake Specs (4) ----

export const ANTI_PATTERNS: AntiPattern[] = [
  // ====== Hard Errors ======
  {
    errorId: "ERR_COLOR_001",
    errorLevel: "critical",
    errorType: "硬错误",
    errorFeature: "色值与颜色名称不匹配（如#37474F标注为玫瑰红而非深灰蓝）",
    detectRule: "QC01",
    promptConstraint: "每个HEX色值对应的颜色名称必须准确，禁止色值与名称矛盾",
    fixGuide: "核实HEX色值对应的标准颜色名称，如#37474F应为深灰蓝而非玫瑰红",
    occurrenceCount: 0,
    firstFound: "",
  },
  {
    errorId: "ERR_FONT_001",
    errorLevel: "critical",
    errorType: "硬错误",
    errorFeature: "字体名称拼写错误（如Montserra而非Montserrat）",
    detectRule: "QC04",
    promptConstraint: "所有英文字体名称必须使用官方标准拼写",
    fixGuide: "修正字体名称为官方标准拼写，如Montserra→Montserrat",
    occurrenceCount: 0,
    firstFound: "",
  },
  {
    errorId: "ERR_PLACEHOLDER_001",
    errorLevel: "critical",
    errorType: "硬错误",
    errorFeature: "模板占位符残留（如自定义填写、待补充等）",
    detectRule: "A02",
    promptConstraint: "严禁输出任何模板占位符文本",
    fixGuide: "删除所有占位符文本，替换为实际内容",
    occurrenceCount: 0,
    firstFound: "",
  },
  {
    errorId: "ERR_TOC_001",
    errorLevel: "critical",
    errorType: "硬错误",
    errorFeature: "目录与正文标题不一致",
    detectRule: "QC03",
    promptConstraint: "目录条目与正文标题必须完全一致",
    fixGuide: "逐条比对目录与正文标题，确保完全一致（含标点符号）",
    occurrenceCount: 0,
    firstFound: "",
  },
  {
    errorId: "ERR_COLOR_002",
    errorLevel: "critical",
    errorType: "硬错误",
    errorFeature: "色彩占比规则上下文矛盾（如平面印刷与空间展示混用占比）",
    detectRule: "B02",
    promptConstraint: "区分平面/空间场景，标注不同占比规则",
    fixGuide: "补充场景分类说明：平面印刷60:30:10，空间展示可调整比例",
    occurrenceCount: 0,
    firstFound: "",
  },
  {
    errorId: "ERR_STORY_001",
    errorLevel: "critical",
    errorType: "内容错配",
    errorFeature: "品牌故事与目标市场内容大段重复",
    detectRule: "Q01",
    promptConstraint: "品牌故事叙事化，目标市场客观描述，各有侧重",
    fixGuide: "品牌故事用叙事化语言讲创立初衷；目标市场用客观数据描述客户画像与消费场景，确保两者内容不重复",
    occurrenceCount: 0,
    firstFound: "",
  },

  // ====== Fake Specs ======
  {
    errorId: "ERR_FAKE_001",
    errorLevel: "warning",
    errorType: "假规范",
    errorFeature: "Logo模块无网格制图参数（宽高比/圆角半径/元素坐标/间距）",
    detectRule: "QC01",
    promptConstraint: "网格制图页必须标注宽高比/圆角/坐标/间距",
    fixGuide: "补充完整网格参数：外框宽高比、圆角半径网格单位数、核心元素(x,y)坐标、字号网格单位数、标准字与图形最小间距",
    occurrenceCount: 0,
    firstFound: "",
  },
  {
    errorId: "ERR_FAKE_002",
    errorLevel: "warning",
    errorType: "假规范",
    errorFeature: "色彩模块仅含HEX色值，缺少CMYK和Pantone",
    detectRule: "QC01",
    promptConstraint: "每个颜色必须含HEX/RGB/CMYK/Pantone四套色值",
    fixGuide: "为每个颜色补充CMYK（印刷适配值）和Pantone（哑光铜版纸标准）色号",
    occurrenceCount: 0,
    firstFound: "",
  },
  {
    errorId: "ERR_FAKE_003",
    errorLevel: "warning",
    errorType: "假规范",
    errorFeature: "应用物料无尺寸/材质/印刷工艺标注",
    detectRule: "B01",
    promptConstraint: "每个物料必须标注尺寸、材质、工艺",
    fixGuide: "为每个物料补充：标准尺寸（mm）、推荐材质（如铜版纸157g）、印刷工艺（如四色印刷+覆亚膜）",
    occurrenceCount: 0,
    firstFound: "",
  },
  {
    errorId: "ERR_FAKE_004",
    errorLevel: "warning",
    errorType: "假规范",
    errorFeature: "无Logo保护空间和分场景最小尺寸说明",
    detectRule: "B03",
    promptConstraint: "必须标注15%保护空间和分场景最小尺寸",
    fixGuide: "补充保护空间标准（>=15% Logo高度）和分场景最小尺寸（印刷>=15mm/数字>=48px/户外>=200mm）",
    occurrenceCount: 0,
    firstFound: "",
  },
];

/**
 * Increment the occurrence count for a known error pattern.
 * In-memory only; persistence to DB/file is P2 work.
 */
export function incrementErrorCount(errorId: string): void {
  const pattern = ANTI_PATTERNS.find(p => p.errorId === errorId);
  if (pattern) pattern.occurrenceCount++;
}

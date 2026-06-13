// ========== 枚举 / 常量 ==========

export type ProjectStatus =
  | "submitted"      // 已提交
  | "payment_uploaded" // 已上传付款截图
  | "paid"           // 已付款
  | "confirmed"      // 需求已确认
  | "ai_analysis"    // AI 分析中
  | "designing"      // 设计制作中
  | "reviewing"      // 审核中
  | "delivered";     // 已交付

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  submitted: "已提交",
  payment_uploaded: "待确认付款",
  paid: "已付款",
  confirmed: "需求已确认",
  ai_analysis: "AI 分析中",
  designing: "设计制作中",
  reviewing: "审核中",
  delivered: "已交付",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  submitted: "bg-neutral-100 text-neutral-700",
  payment_uploaded: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  confirmed: "bg-blue-100 text-blue-700",
  ai_analysis: "bg-purple-100 text-purple-700",
  designing: "bg-amber-100 text-amber-700",
  reviewing: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
};

export type ReferenceMode = "strong" | "weak" | "none";

export const REFERENCE_MODE_LABELS: Record<ReferenceMode, string> = {
  strong: "强参考",
  weak: "弱参考",
  none: "不参考",
};

export type SubmissionStatus = "submitted" | "contacted" | "confirmed" | "closed";

export type Industry =
  | "科技/互联网"
  | "餐饮/食品"
  | "零售/电商"
  | "教育/培训"
  | "医疗/健康"
  | "金融/法律"
  | "文化/传媒"
  | "制造业"
  | "其他";

export type BudgetRange = "100以下" | "100-300" | "300-500" | "500以上" | "待定";

// ========== 核心接口（项目/客户/提交） ==========

export interface LogoAsset {
  fileName: string;
  url: string;
  size: number;
}

export interface MascotAsset {
  name: string;
  personality?: string;
  files: { fileName: string; url: string; size: number }[];
}

export interface ReferenceManual {
  fileName: string;
  url: string;
  size: number;
  pageCount: number;
  isReferenceEnabled: boolean;
  referenceMode: ReferenceMode;
}

export interface Submission {
  id: string;
  clientName: string;
  companyName: string;
  phone: string;
  email?: string;
  wechat?: string;
  industry: Industry;
  budgetRange?: BudgetRange;
  description?: string;
  brandVision: string;
  coreValues: string;
  targetMarket: string;
  logoPhilosophy?: string;
  mascotPhilosophy?: string;
  brandColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  logoAssets: LogoAsset[];
  mascotAssets: MascotAsset[];
  referenceManual?: ReferenceManual;
  status: SubmissionStatus;
  submittedAt: string;
}

export interface Employee {
  employeeId: string;
  name: string;
  role: "sales" | "designer" | "admin";
  avatar?: string;
}

export interface TimelineEntry {
  status: ProjectStatus;
  timestamp: string;
  note?: string;
}

export interface Project {
  id: string;
  submissionId: string;
  status: ProjectStatus;
  assignedTo: Employee | null;
  clientName?: string;
  studentName?: string;
  studentId?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
  brandColors?: string;
  name?: string;
  industry?: string;
  logoUrl?: string;
  description?: string;
}

export interface PlanPreviewUrls {
  cover: string;
  colorPage: string;
  fontPage: string;
  appPage: string;
}

export interface AiGenerationPlan {
  id: string;
  projectId: string;
  styleLabel: string;
  thumbnailUrl: string;
  previewUrls: PlanPreviewUrls;
  referenceUsed: boolean;
  referenceMode: ReferenceMode;
  isFavorited: boolean;
  generatedAt: string;
  /** AI 生成的配色方案 */
  colorPalette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** AI 推荐的字体搭配 */
  fontPairing?: {
    heading: string;
    body: string;
  };
  /** 方案风格描述 */
  description?: string;
}

export interface Favorite {
  id: string;
  employeeId: string;
  planId: string;
  projectId: string;
  clientIndustry: Industry;
  styleLabel: string;
  thumbnailUrl: string;
  notes?: string;
  collectedAt: string;
}

// ========== 通用页面 Props ==========

export interface PageState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  total: number;
}

export interface ProjectFilters {
  status: ProjectStatus | "all";
  search: string;
}


// ============================================================
// VI 手册完整类型定义
// 基于真实 VI 手册参考文件重构，覆盖基础系统+应用系统
// 参考来源：Ark Gene、智方增长科技、山仁视听、爱加蓓心理、禅道院
// ============================================================

// ---- 通用子类型 ----

/** 完整品牌色（含 CMYK/RGB/HEX + 使用说明） */
export interface BrandColor {
  name: string;
  hex: string;
  cmyk: string;
  rgb: string;
  usage?: string; // 使用场景说明，如"用于核心品牌元素和重要信息"
}

/** 字体规格 */
export interface FontSpec {
  font: string;       // 字体名称，如"Noto Sans SC"
  weights: number[];  // 可用字重，如 [700, 500]
  style?: string;     // 样式描述，如"定制创意字体"
}

/** 字号层级 */
export interface FontSizeLevel {
  level: string;      // 层级名称，如"主标题 / H1"
  fontSize: string;   // 字号，如"36pt"
  fontWeight: number; // 字重
  lineHeight?: string; // 行高
  usage: string;      // 使用场景
}

// ---- 1. Logo 规范 ----

/** 标准组合（横版/竖版） */
export interface StandardCombination {
  type: "horizontal" | "vertical";
  label: string;           // "横版标识"
  imageUrl: string;
  description: string;     // "优先使用：商务传播/官网..."
  priority: "primary" | "secondary";
}

/** 最小尺寸条目 */
export interface MinimumSize {
  scenario: string;   // "印刷图形"
  minSize: string;    // "8mm"
  note: string;       // 说明
}

/** 错误用法示例 */
export interface IncorrectUsage {
  title: string;      // "改变标识颜色"
  imageUrl?: string;  // 错误示例图
  description: string; // 说明
}

/** Logo 规范（VI 手册第一章） */
export interface LogoSpecs {
  /** 1.1 标识诠释 */
  explanation: string;          // 含义说明
  conceptKeywords: string[];    // 核心理念关键词

  /** 1.2 标准组合 */
  standardCombinations: StandardCombination[];

  /** 1.3 网格比例 */
  gridSpec: {
    imageUrl: string;           // 网格比例图
    proportions: string;        // "8X x 3.5X"
    baseUnit: string;           // "X 为基础测量单位"
    description: string;
  };

  /** 1.4 最小尺寸和保护空间 */
  clearSpace: {
    rule: string;               // "1X-1.5X"
    minimumSizes: MinimumSize[];
  };

  /** 1.5 标识颜色 */
  logoColors: BrandColor[];

  /** 1.6 单色黑标识 */
  monochromeBlack: {
    imageUrl: string;
    usageRules: string;
  } | null;

  /** 1.7 反白标识 */
  reversedOut: {
    imageUrl: string;
    usageRules: string;
  } | null;

  /** 1.8 背景控制 */
  backgroundControl: {
    allowedBackgrounds: string[];
    prohibitedBackgrounds: string[];
    grayscaleGuideUrl?: string;  // 灰度背景对照图
  };

  /** 1.9 错误用法 */
  incorrectUsages: IncorrectUsage[];

  /** 1.10 品牌架构（可选） */
  brandArchitecture?: {
    model: string;              // "单一品牌识别体系"
    rules: string;
  };
}

// ---- 2. 色彩系统 ----

/** 色彩层级规则 */
export interface ColorHierarchy {
  level: string;       // "主色"
  colors: string[];    // 色名列表
  usage: string;       // 使用场景
}

/** 品牌色彩系统 */
export interface BrandColorSystem {
  /** 主色 / 辅助色 / 强调色 */
  primary: BrandColor;
  secondary: BrandColor;
  accent: BrandColor;
  neutrals: BrandColor[];

  /** 2.1 色彩优先使用级 */
  hierarchy: ColorHierarchy[];

  /** 2.2 配色原则 */
  matchingRules: string;
}

// ---- 3. 字体规范 ----

/** 字体规范（中/英文） */
export interface Typography {
  chinese: {
    brandFont: FontSpec;       // 专用字体
    bodyFont: FontSpec;        // 通用字体
    sizeHierarchy: FontSizeLevel[];
  };
  english: {
    brandFont: FontSpec;
    bodyFont: FontSpec;
    sizeHierarchy: FontSizeLevel[];
  };
  /** 字体使用原则 */
  principles: string[];
}

// ---- 4. 辅助图形 ----

/** 辅助图形条目 */
export interface AuxiliaryGraphic {
  name: string;
  imageUrl: string;
  applicationRules: string; // 如何应用
}

/** 辅助图形系统 */
export interface AuxiliarySystem {
  concept: string;             // 设计理念
  graphics: AuxiliaryGraphic[];
}

// ---- 5. 应用系统 ----

/** 应用场景条目 */
export interface ApplicationItem {
  type: string;       // "business_card"
  label: string;      // "名片"
  imageUrl: string;   // 设计效果图
  specs: string;      // "90x54mm, 300DPI"
  designRules: string; // 设计规范说明
}

/** 应用系统（VI 手册第五章） */
export interface ApplicationSystem {
  office: ApplicationItem[];     // 办公用品
  signage: ApplicationItem[];    // 外部标识
  packaging?: ApplicationItem[]; // 产品包装
  digital: ApplicationItem[];    // 数字媒体
  promotional?: ApplicationItem[]; // 宣传物料
}

// ---- 6. IP 规范（可选） ----

/** IP 角色 */
export interface IPCharacter {
  name: string;
  personality: string;
  standardPoseUrl: string;  // 标准姿势
  expressionUrls: string[]; // 表情集
  actionUrls?: string[];    // 动作姿势
  colorSpecs: string;       // 色彩规范
}

// ---- 完整 VI 手册 ----

/** VI 手册完整数据（重构版，覆盖真实 VI 手册全部内容） */
export interface ViManual {
  id: string;
  projectId: string;

  /** 封面 */
  cover: {
    title: string;
    subtitle?: string;
    version: string;
    date: string;
    companyName: string;
  };

  /** 目录 */
  tableOfContents: {
    chapter: string;   // "1. Logo 规范"
    pages: string[];   // 子节列表
  }[];

  /** 1. Logo 规范 */
  logoSpecs: LogoSpecs;

  /** 2. 品牌色彩系统 */
  brandColors: BrandColorSystem;

  /** 3. 字体规范 */
  typography: Typography;

  /** 4. 辅助图形 */
  auxiliaryGraphics: AuxiliarySystem;

  /** 5. 应用系统 */
  applications: ApplicationSystem;

  /** 6. IP 规范（可选） */
  ipCharacters?: IPCharacter[];

  /** 参考分析（AI 生成时的中间数据） */
  referenceAnalysis?: {
    used: boolean;
    extractedColors: string[];
    extractedFonts: string[];
    styleSummary: string;
    analysisConfidence: number;
  };
}

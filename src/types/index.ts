// ========== 枚举 / 常量 ==========

export type ProjectStatus =
  | "submitted"      // 已提交
  | "confirmed"      // 需求已确认
  | "ai_analysis"    // AI 分析中
  | "designing"      // 设计制作中
  | "reviewing"      // 审核中
  | "delivered";     // 已交付

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  submitted: "已提交",
  confirmed: "需求已确认",
  ai_analysis: "AI 分析中",
  designing: "设计制作中",
  reviewing: "审核中",
  delivered: "已交付",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  submitted: "bg-neutral-100 text-neutral-700",
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

export type SubmissionStatus =
  | "submitted"
  | "contacted"
  | "confirmed"
  | "closed";

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

export type BudgetRange =
  | "3000以下"
  | "3000-5000"
  | "5000-10000"
  | "10000-30000"
  | "30000以上"
  | "待定";

// ========== 核心接口 ==========

/** 客户上传的 Logo 素材 */
export interface LogoAsset {
  fileName: string;
  url: string;
  size: number; // bytes
}

/** 客户上传的 IP 公仔素材 */
export interface MascotAsset {
  name: string;
  personality?: string;
  files: { fileName: string; url: string; size: number }[];
}

/** 客户上传的参考 VI 手册 */
export interface ReferenceManual {
  fileName: string;
  url: string;
  size: number;
  pageCount: number;
  isReferenceEnabled: boolean;
  referenceMode: ReferenceMode;
}

/** 客户提交记录 */
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
  logoAssets: LogoAsset[];
  mascotAssets: MascotAsset[];
  referenceManual?: ReferenceManual;
  status: SubmissionStatus;
  submittedAt: string; // ISO timestamp
}

/** 员工信息 */
export interface Employee {
  employeeId: string;
  name: string;
  role: "sales" | "designer" | "admin";
  avatar?: string;
}

/** 项目时间线节点 */
export interface TimelineEntry {
  status: ProjectStatus;
  timestamp: string;
  note?: string;
}

/** 内部项目 */
export interface Project {
  id: string;
  submissionId: string;
  status: ProjectStatus;
  assignedTo: Employee | null;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
}

/** AI 生成方案预览图 */
export interface PlanPreviewUrls {
  cover: string;
  colorPage: string;
  fontPage: string;
  appPage: string;
}

/** AI 生成方案 */
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
}

/** 品牌色 */
export interface BrandColor {
  name: string;
  hex: string;
  cmyk?: string;
  rgb?: string;
}

/** VI 手册字体规范 */
export interface TypographySpec {
  font: string;
  weights: number[];
}

/** VI 手册字体 */
export interface Typography {
  chinese: {
    heading: TypographySpec;
    body: TypographySpec;
  };
  english: {
    heading: TypographySpec;
    body: TypographySpec;
  };
}

/** Logo 变体 */
export interface LogoVariant {
  name: string;
  src: string;
}

/** 辅助图形 */
export interface AuxiliaryGraphic {
  name: string;
  src: string;
}

/** VI 应用场景 */
export interface ApplicationMockup {
  type: string;
  label: string;
  mockupUrl: string;
  specs?: string;
}

/** 参考手册分析结果 */
export interface ReferenceAnalysis {
  used: boolean;
  extractedColors: string[];
  extractedFonts: string[];
  styleSummary: string;
  analysisConfidence: number;
}

/** VI 手册完整数据 */
export interface ViManual {
  id: string;
  projectId: string;
  cover: {
    title: string;
    subtitle?: string;
    version: string;
    date: string;
    companyName: string;
  };
  brandColors: {
    primary: BrandColor;
    secondary: BrandColor;
    accent: BrandColor;
    neutrals: BrandColor[];
  };
  typography: Typography;
  logoVariants: LogoVariant[];
  auxiliaryGraphics: AuxiliaryGraphic[];
  applications: ApplicationMockup[];
  referenceAnalysis?: ReferenceAnalysis;
}

/** 收藏记录 */
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

// ========== 页面 Props ==========

/** 通用页面状态 */
export interface PageState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/** 筛选/分页参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  total: number;
}

/** 项目列表筛选 */
export interface ProjectFilters {
  status: ProjectStatus | "all";
  search: string;
}

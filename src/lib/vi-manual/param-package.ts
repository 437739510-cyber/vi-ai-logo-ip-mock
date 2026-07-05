/**
 * UnifiedParamPackage — 全链路唯一参数包类型定义
 *
 * 所有模块通过 param-bus.ts 读写，禁止直接修改底层对象。
 * 项目创建 → 品牌分析 → Logo 生成 → VI 手册渲染 → 全链路色值/字体/参数同源。
 *
 * M1.1: 类型定义
 */

// ── 子类型 ──────────────────────────────────────────────

export interface ColorDef {
  /** 中文名称 (e.g. "品牌主色") */
  name: string;
  /** 英文名称 (e.g. "Primary") */
  nameEn: string;
  /** HEX 色值 (e.g. "#C0392B") */
  hex: string;
  /** RGB 色值 (e.g. "192,57,43") */
  rgb: string;
  /** CMYK 色值 (e.g. "0,70,78,25") */
  cmyk: string;
  /** 色彩含义说明 */
  meaning: string;
}

export interface FontDef {
  /** 字体中文名 (e.g. "思源黑体") */
  name: string;
  /** 字体英文名 (e.g. "Source Han Sans SC") */
  nameEn: string;
  /** 字重 (e.g. "Regular", "Bold") */
  weight: string;
  /** 版权协议 */
  license: string;
  /** 用途 (e.g. "标题", "正文", "装饰") */
  usage: string;
}

export interface GraphicDef {
  /** 图形名称 */
  name: string;
  /** 图形描述 */
  description: string;
  /** 应用场景列表 */
  usage: string[];
  /** 使用约束 (e.g. "透明度 10%-40%, 比例固定 1:3") */
  constraints: string;
}

export interface LogoVariant {
  /** 变体类型 */
  type: "horizontal" | "vertical" | "single-color" | "reverse-white" | "badge" | "icon";
  /** 变体图片 URL (Supabase Storage) */
  imageUrl: string;
  /** 存储路径 */
  storagePath: string;
}

export interface LogoSpec {
  /** 保护空间 */
  safetyMargin: {
    unit: string;         // e.g. "%"
    value: number;        // e.g. 15
    description: string;  // e.g. "Logo 四周保留至少 15% 保护空间"
  };
  /** 最小尺寸 */
  minSizes: {
    print: string;        // e.g. "15mm"
    digital: string;      // e.g. "40px"
    outdoor: string;      // e.g. "200mm"
  };
  /** Logo 变体列表 */
  variants: LogoVariant[];
  /** 当前选中 Logo 索引 */
  selectedIndex: number;
  /** 当前选中 Logo URL */
  selectedUrl: string;
}

// ── 主类型 ──────────────────────────────────────────────

export interface UnifiedParamPackage {
  /** 元信息 */
  meta: {
    projectId: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  };

  /** 品牌基础信息 */
  brand: {
    companyName: string;
    /** 一级行业 (e.g. "餐饮") */
    industry: string;
    /** 二级细分业态 (e.g. "面馆", "花艺", "海鲜") */
    subIndustry: string;
    province: string;
    city: string;
    brandVision: string;
    coreValues: string;
    targetMarket: string;
    /** 品牌调性关键词 (3-5 个) */
    brandToneKeywords: string[];
    /** 视觉风格建议 */
    visualStyle: string;
  };

  /** 色彩系统 */
  colors: {
    primary: ColorDef;
    secondary: ColorDef;
    accent: ColorDef;
  };

  /** 字体系统 */
  fonts: {
    heading: FontDef;
    body: FontDef;
    decorative: FontDef;
  };

  /** Logo 规范 */
  logo: LogoSpec;

  /** 辅助图形 */
  graphics: {
    primary: GraphicDef;
    secondary: GraphicDef;
  };

  /** 物料清单 (分三级) */
  materials: {
    required: string[];   // 必做
    suggested: string[];  // 建议
    optional: string[];   // 可选
  };

  /** 行业隔离数据 */
  isolation: {
    /** 行业词包 key (e.g. "noodle_shop") */
    industryKey: string;
    /** 跨行业禁止词汇 */
    forbiddenWords: string[];
    /** 场景章节标题 */
    sceneCategories: {
      application: string;
      packaging: string;
      marketing: string;
      wayfinding: string;
    };
  };
}

// ── 工厂函数 ────────────────────────────────────────────

/** 创建空参数包 (仅 meta 填充) */
export function createEmptyParamPackage(projectId: string): UnifiedParamPackage {
  const now = new Date().toISOString();
  return {
    meta: { projectId, version: 1, createdAt: now, updatedAt: now },
    brand: {
      companyName: "", industry: "", subIndustry: "",
      province: "", city: "", brandVision: "", coreValues: "", targetMarket: "",
      brandToneKeywords: [], visualStyle: "",
    },
    colors: {
      primary:   { name: "", nameEn: "", hex: "", rgb: "", cmyk: "", meaning: "" },
      secondary: { name: "", nameEn: "", hex: "", rgb: "", cmyk: "", meaning: "" },
      accent:    { name: "", nameEn: "", hex: "", rgb: "", cmyk: "", meaning: "" },
    },
    fonts: {
      heading:    { name: "", nameEn: "", weight: "", license: "", usage: "" },
      body:       { name: "", nameEn: "", weight: "", license: "", usage: "" },
      decorative: { name: "", nameEn: "", weight: "", license: "", usage: "" },
    },
    logo: {
      safetyMargin: { unit: "%", value: 15, description: "" },
      minSizes: { print: "", digital: "", outdoor: "" },
      variants: [], selectedIndex: 0, selectedUrl: "",
    },
    graphics: {
      primary:   { name: "", description: "", usage: [], constraints: "" },
      secondary: { name: "", description: "", usage: [], constraints: "" },
    },
    materials: { required: [], suggested: [], optional: [] },
    isolation: {
      industryKey: "",
      forbiddenWords: [],
      sceneCategories: { application: "", packaging: "", marketing: "", wayfinding: "" },
    },
  };
}
/**
 * 行业物料映射表
 * 核心逻辑：不同行业的VI手册模块内容必须按行业定制
 * 面馆的"办公应用"= 餐巾纸包装+筷子套+外卖袋，不是信封信纸
 * 每个行业每个模块都要符合实际使用场景
 */

export type IndustryCategory =
  | "restaurant"      // 餐饮/面馆
  | "cafe"           // 咖啡/茶饮
  | "retail"         // 零售/商超
  | "beauty"         // 美容/美发
  | "education"      // 教育/培训
  | "healthcare"     // 医疗/健康
  | "hotel"          // 酒店/民宿
  | "fashion"        // 服装/时尚
  | "auto"           // 汽车服务
  | "tech"           // 科技/互联网
  | "general";       // 通用

export interface ModuleMaterial {
  moduleId: string;
  moduleName: string;
  materials: string[];        // 该行业下这个模块的实际物料
  description: string;        // 给AI的提示描述
  layoutHint?: "landscape" | "portrait" | "auto";  // 版式建议
}

export interface IndustryMapping {
  industry: IndustryCategory;
  label: string;
  modules: ModuleMaterial[];
}

const INDUSTRY_MAP: IndustryMapping[] = [
  {
    industry: "restaurant",
    label: "餐饮/面馆",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["餐巾纸包装", "筷子套", "外卖袋", "打包盒贴纸", "小票夹", "桌牌"],
        description: "餐饮行业的办公应用不是信封信纸，而是直接面向消费者的包装物料：餐巾纸包装印logo、筷子套、外卖袋、打包盒贴纸、桌牌等",
        layoutHint: "landscape",
      },
      {
        moduleId: "signage",
        moduleName: "导视系统",
        materials: ["门头招牌", "灯箱", "价目表", "取餐号牌", "区域指示牌"],
        description: "餐厅导视重点是门头、价目表和取餐指示，不是办公楼那种楼层指引",
        layoutHint: "portrait",
      },
      {
        moduleId: "packaging",
        moduleName: "包装系统",
        materials: ["外卖餐盒", "手提袋", "一次性杯套", "酱料包", "密封贴"],
        description: "餐饮包装系统以食品包装为核心，外卖餐盒、手提袋、杯套、酱料包",
        layoutHint: "landscape",
      },
      {
        moduleId: "uniform",
        moduleName: "员工制服",
        materials: ["厨师服", "围裙", "服务员工服", "帽子", "胸牌"],
        description: "餐饮员工制服重点是厨师服、围裙和服务员工服",
      },
      {
        moduleId: "environment",
        moduleName: "环境应用",
        materials: ["墙面装饰", "菜单展板", "窗贴", "地贴引导", "挂画"],
        description: "餐厅环境应用是墙面菜单展板、窗贴、装饰画等营造就餐氛围的物料",
      },
    ],
  },
  {
    industry: "cafe",
    label: "咖啡/茶饮",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["杯套", "杯垫", "纸巾包装", "外卖袋", "会员卡", "积分卡"],
        description: "咖啡茶饮的办公应用是杯套、杯垫、纸巾包装、外卖袋、会员卡",
        layoutHint: "landscape",
      },
      {
        moduleId: "signage",
        moduleName: "导视系统",
        materials: ["门头招牌", "菜单灯箱", "出品区标识", "Wi-Fi牌", "洗手间指示"],
        description: "咖啡店导视重点是菜单灯箱和出品区标识",
      },
      {
        moduleId: "packaging",
        moduleName: "包装系统",
        materials: ["咖啡杯", "奶茶杯", "纸袋", "隔热套", "吸管贴纸", "封口贴"],
        description: "咖啡茶饮包装以饮品杯为核心，配套纸袋和吸管贴纸",
        layoutHint: "landscape",
      },
    ],
  },
  {
    industry: "retail",
    label: "零售/商超",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["购物袋", "价签", "收银台贴纸", "会员卡", "促销单页", "商品标签"],
        description: "零售行业的办公应用是购物袋、价签、促销单页、商品标签",
        layoutHint: "landscape",
      },
      {
        moduleId: "signage",
        moduleName: "导视系统",
        materials: ["店招", "促销吊旗", "分区指示", "收银台标识", "出入口标识"],
        description: "零售导视重点是促销吊旗和分区指示",
      },
      {
        moduleId: "packaging",
        moduleName: "包装系统",
        materials: ["手提袋", "礼品盒", "包装纸", "丝带", "封口贴"],
        description: "零售包装以手提袋和礼品盒为核心",
        layoutHint: "landscape",
      },
    ],
  },
  {
    industry: "beauty",
    label: "美容/美发",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["护理记录卡", "预约卡", "产品标签", "储值卡", "名片", "毛巾绣花"],
        description: "美容美发的办公应用是护理记录卡、预约卡、储值卡、毛巾绣花logo",
      },
      {
        moduleId: "packaging",
        moduleName: "包装系统",
        materials: ["产品包装盒", "护理套装袋", "试用装包装", "面膜包装", "手提袋"],
        description: "美容行业包装以产品包装盒和护理套装袋为核心",
        layoutHint: "landscape",
      },
    ],
  },
  {
    industry: "education",
    label: "教育/培训",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["学生证", "课程表", "荣誉证书", "笔记本", "书包挂件", "成绩单"],
        description: "教育行业的办公应用是学生证、课程表、荣誉证书、笔记本",
      },
      {
        moduleId: "signage",
        moduleName: "导视系统",
        materials: ["班级门牌", "楼层指引", "宣传栏", "荣誉墙", "安全出口标识"],
        description: "教育机构导视重点是班级门牌和楼层指引",
      },
    ],
  },
  {
    industry: "healthcare",
    label: "医疗/健康",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["就诊卡", "处方笺", "病历本", "健康手册", "预约卡", "专家名片"],
        description: "医疗行业的办公应用是就诊卡、处方笺、病历本、健康手册",
      },
      {
        moduleId: "signage",
        moduleName: "导视系统",
        materials: ["科室门牌", "导诊指示", "排队叫号屏", "温馨提示牌", "安全标识"],
        description: "医疗导视重点是科室门牌和导诊指示",
      },
    ],
  },
  {
    industry: "hotel",
    label: "酒店/民宿",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["房卡套", "欢迎卡", "早餐券", "洗衣单", "信纸信封", "便签本"],
        description: "酒店行业的办公应用是房卡套、欢迎卡、早餐券、洗衣单，这里信纸信封确实适用",
      },
      {
        moduleId: "packaging",
        moduleName: "包装系统",
        materials: ["洗护用品瓶", "拖鞋包装", "茶包包装", "欢迎水果篮装饰", "手提袋"],
        description: "酒店包装以洗护用品瓶、拖鞋包装、茶包包装为核心",
      },
    ],
  },
  {
    industry: "fashion",
    label: "服装/时尚",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["吊牌", "尺码贴", "保养卡", "购物袋", "会员卡", "搭配建议卡"],
        description: "服装行业的办公应用是吊牌、尺码贴、保养卡、搭配建议卡",
        layoutHint: "portrait",
      },
      {
        moduleId: "packaging",
        moduleName: "包装系统",
        materials: ["手提袋", "礼品盒", "包装纸", "防尘袋", "吊牌", "封口贴"],
        description: "服装包装以手提袋、防尘袋和礼品盒为核心",
        layoutHint: "landscape",
      },
    ],
  },
  {
    industry: "auto",
    label: "汽车服务",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["保养记录卡", "维修工单", "客户回访卡", "车贴", "年检提醒卡"],
        description: "汽车服务的办公应用是保养记录卡、维修工单、车贴",
      },
      {
        moduleId: "signage",
        moduleName: "导视系统",
        materials: ["工位标识", "服务项目牌", "安全警示", "收费公示", "取车指示"],
        description: "汽车服务导视重点是工位标识和服务项目牌",
      },
    ],
  },
  {
    industry: "tech",
    label: "科技/互联网",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["名片", "信纸信封", "文件夹", "笔记本", "工牌", "贴纸周边"],
        description: "科技行业的办公应用确实包括信纸信封、名片、工牌、笔记本，以及品牌周边贴纸",
      },
      {
        moduleId: "packaging",
        moduleName: "包装系统",
        materials: ["产品包装盒", "数据线包装", "说明书", "感谢卡", "防震填充"],
        description: "科技产品包装以产品包装盒和说明书为核心",
      },
    ],
  },
  {
    industry: "general",
    label: "通用",
    modules: [
      {
        moduleId: "office_stationery",
        moduleName: "办公应用",
        materials: ["名片", "信纸", "信封", "文件夹", "便签", "档案袋"],
        description: "通用办公应用包含基础商务文具：名片、信纸、信封、文件夹",
      },
      {
        moduleId: "signage",
        moduleName: "导视系统",
        materials: ["门牌", "楼层指引", "前台标识", "洗手间指示", "安全出口"],
        description: "通用导视系统包含基础办公场所指示",
      },
      {
        moduleId: "packaging",
        moduleName: "包装系统",
        materials: ["手提袋", "包装盒", "封口贴", "标签", "礼品袋"],
        description: "通用包装系统包含基础手提袋和包装盒",
      },
    ],
  },
];

/**
 * 根据行业获取物料映射
 */
export function getIndustryMapping(industry: string): IndustryMapping {
  const found = INDUSTRY_MAP.find(m => m.industry === industry);
  return found || INDUSTRY_MAP.find(m => m.industry === "general")!;
}

/**
 * 获取某个行业某个模块的物料列表
 */
export function getModuleMaterials(industry: string, moduleId: string): string[] {
  const mapping = getIndustryMapping(industry);
  const mod = mapping.modules.find(m => m.moduleId === moduleId);
  return mod?.materials || [];
}

/**
 * 生成 Decision Layer 行业适配 prompt
 */
export function generateIndustryPrompt(industry: string): string {
  const mapping = getIndustryMapping(industry);
  let prompt = `## 行业适配规则（${mapping.label}）\n\n`;
  prompt += `重要：该客户属于【${mapping.label}】行业，VI手册的每个模块内容必须符合该行业的实际使用场景，不能套用通用模板。\n\n`;
  
  for (const mod of mapping.modules) {
    prompt += `### ${mod.moduleName}（${mod.moduleId}）\n`;
    prompt += `- 实际物料：${mod.materials.join("、")}\n`;
    prompt += `- 设计指导：${mod.description}\n`;
    if (mod.layoutHint && mod.layoutHint !== "auto") {
      prompt += `- 版式建议：${mod.layoutHint === "landscape" ? "横版" : "竖版"}\n`;
    }
    prompt += `\n`;
  }

  prompt += `\n核心原则：\n`;
  prompt += `1. 每个模块生成的页面内容必须是上述行业特定物料，不要出现其他行业的物料\n`;
  prompt += `2. 面馆不要出信封信纸，科技公司不要出筷子套\n`;
  prompt += `3. Logo和IP公仔是受保护资产，保护=不改色不重绘，但排版要大胆放大、满版展示、居中突出、可裁切做装饰\n`;
  
  return prompt;
}

/**
 * 从品牌分析结果中识别行业
 */
export function detectIndustry(brandAnalysis: any): IndustryCategory {
  if (!brandAnalysis) return "general";
  
  const industryProfile = brandAnalysis.industryProfile?.label || "";
  const brandType = brandAnalysis.profile?.brandType || "";
  const text = `${industryProfile} ${brandType}`.toLowerCase();
  
  if (/餐饮|面馆|饭店|火锅|小吃|快餐|酒楼|食/.test(text)) return "restaurant";
  if (/咖啡|茶饮|奶茶|饮品|茶馆/.test(text)) return "cafe";
  if (/零售|商超|超市|便利|百货/.test(text)) return "retail";
  if (/美容|美发|美甲|沙龙|护肤/.test(text)) return "beauty";
  if (/教育|培训|学校|幼教|留学/.test(text)) return "education";
  if (/医疗|健康|诊所|牙科|中医|康复/.test(text)) return "healthcare";
  if (/酒店|民宿|客栈|旅馆/.test(text)) return "hotel";
  if (/服装|时尚|服饰|潮牌|定制/.test(text)) return "fashion";
  if (/汽车|汽修|车|4s|洗车/.test(text)) return "auto";
  if (/科技|互联网|软件|数据|ai|智能/.test(text)) return "tech";
  
  return "general";
}

export { INDUSTRY_MAP };

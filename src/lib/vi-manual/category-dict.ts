// 20 Industry Word Dictionaries for VI Manual Quality Check
// Source: Hermes handoff 2026-07-04 Part 4
// V2: Added INDUSTRY_DICTS fallback to getIndustryIsolation() for granular matching

import forbiddenWordsData from "@/lib/brand/forbidden-words.json";

export interface IndustryIsolation {
  label: string;
  keywords: string[];
  forbiddenWords: string[];
  positiveMaterials: string[];
  sceneCategories: { application: string; packaging: string; marketing: string; wayfinding: string };
}

export interface IndustryDict {
  category_key: string;
  category_name: string;
  positive_materials: string[];
  forbidden_words: string[];
  keywords?: string[];
  /** 场景系统标题（应用/包装/营销/导视），整改 #2 用于鞋履类品牌的精准命名 */
  scene_categories?: { application: string; packaging: string; marketing: string; wayfinding: string };
}

export const INDUSTRY_DICTS: IndustryDict[] = [
  {
    category_key: "qipao_custom",
    category_name: "旗袍高级定制",
    positive_materials: ["量体记录卡", "面料色卡册", "旗袍礼盒", "防尘袋", "产品吊牌", "盘扣", "定制合同"],
    forbidden_words: ["美容", "护肤", "医美", "面膜", "精油", "仪器", "疗程", "美甲", "美睫", "菜品", "锅底"],
  },
  {
    category_key: "nail_salon",
    category_name: "美甲美睫沙龙",
    positive_materials: ["价目表", "美甲色卡", "会员储值卡", "客袍", "工具消毒盒", "美睫展示板", "预约登记本"],
    forbidden_words: ["旗袍", "面料", "剪裁", "菜品", "锅底", "咖啡", "烘焙", "医疗器械", "注射液"],
  },
  {
    category_key: "skin_management",
    category_name: "皮肤管理中心",
    positive_materials: ["疗程卡", "产品套盒", "美容师工服", "面诊记录表", "价目手册", "护肤瓶贴", "VIP会员卡"],
    forbidden_words: ["旗袍", "面料", "菜品", "火锅", "烘焙", "奶茶", "盘扣", "刺绣", "猫粮", "狗粮"],
  },
  {
    category_key: "hair_salon",
    category_name: "美发沙龙",
    positive_materials: ["价目表", "剪发围布", "会员卡", "烫染价目牌", "洗护产品标签", "技师工牌", "储值卡"],
    forbidden_words: ["旗袍", "面料", "菜品", "锅底", "美甲", "美睫", "咖啡", "烘焙", "瑜伽垫"],
  },
  {
    category_key: "gym_studio",
    category_name: "健身工作室",
    positive_materials: ["会员卡", "私教课表", "运动毛巾", "器械标识", "更衣室门牌", "体验卡", "体能评估表"],
    forbidden_words: ["旗袍", "面料", "美容", "护肤", "菜品", "火锅", "美甲", "绘本", "教材"],
  },
  {
    category_key: "yoga_studio",
    category_name: "瑜伽普拉提馆",
    positive_materials: ["会员卡", "课表海报", "瑜伽垫标识", "更衣室门牌", "体验卡", "私教协议", "辅具标签"],
    forbidden_words: ["旗袍", "面料", "火锅", "烧烤", "美甲", "美睫", "器械", "猫粮", "狗粮"],
  },
  {
    category_key: "coffee_shop",
    category_name: "独立咖啡店",
    positive_materials: ["纸杯", "杯套", "菜单", "打包袋", "杯贴", "积分卡", "咖啡豆包装", "点单立牌"],
    forbidden_words: ["旗袍", "面料", "美容", "护肤", "疗程", "美甲", "盘扣", "刺绣", "教材", "绘本"],
  },
  {
    category_key: "milk_tea",
    category_name: "茶饮奶茶店",
    positive_materials: ["奶茶杯", "杯套", "点单菜单", "打包袋", "封口膜", "储值卡", "杯贴", "外卖餐贴"],
    forbidden_words: ["旗袍", "面料", "美容", "医美", "疗程", "美甲", "盘扣", "瑜伽垫", "器械"],
  },
  {
    category_key: "bakery",
    category_name: "烘焙面包店",
    positive_materials: ["包装盒", "打包袋", "蛋糕围边", "价签", "会员卡", "吐司袋", "饼干罐贴", "生日蛋糕盒"],
    forbidden_words: ["旗袍", "面料", "美容", "护肤", "疗程", "美甲", "火锅", "烧烤", "器械"],
    keywords: ["烘焙", "面包", "蛋糕", "甜品", "吐司", "饼干", "西点"]
  },
  {
    category_key: "chinese_fast_food",
    category_name: "中式快餐",
    positive_materials: ["点餐单", "餐盒", "打包袋", "桌面立牌", "员工工牌", "会员卡", "外卖贴纸", "餐垫纸"],
    forbidden_words: ["旗袍", "面料", "美容", "护肤", "美甲", "美睫", "疗程", "盘扣", "刺绣", "瑜伽垫"],
  },
  {
    category_key: "hotpot",
    category_name: "火锅餐饮店",
    positive_materials: ["菜单", "餐具套", "围裙", "点餐码立牌", "蘸料台标识", "储值卡", "纸巾盒", "包间门牌"],
    forbidden_words: ["旗袍", "面料", "美容", "医美", "疗程", "美甲", "盘扣", "刺绣", "猫粮", "狗粮"],
  },
  {
    category_key: "flower_shop",
    category_name: "花艺鲜花店",
    positive_materials: ["花盒", "包装纸", "贺卡", "手提花袋", "养护卡", "名片", "花束标签", "花篮卡片"],
    forbidden_words: ["旗袍", "面料", "美容", "护肤", "火锅", "烧烤", "美甲", "器械", "疗程"],
  },
  {
    category_key: "pet_shop",
    category_name: "宠物生活馆",
    positive_materials: ["美容价目表", "宠物粮包装袋", "会员卡", "洗澡服务卡", "寄养协议", "宠物牌", "洗护标签"],
    forbidden_words: ["旗袍", "面料", "火锅", "奶茶", "烘焙", "教材", "绘本"],
  },
  {
    category_key: "maternity_baby",
    category_name: "母婴生活馆",
    positive_materials: ["产品价签", "会员卡", "纸尿裤包装贴", "游泳次卡", "导购工牌", "奶粉罐贴", "育儿手册"],
    forbidden_words: ["旗袍", "面料", "火锅", "烧烤", "美甲", "美睫", "医美", "器械", "烟酒"],
  },
  {
    category_key: "kids_education",
    category_name: "少儿艺术培训",
    positive_materials: ["招生简章", "课时卡", "教室门牌", "学员证", "活动海报", "教材封面", "家长通知书"],
    forbidden_words: ["旗袍", "面料", "火锅", "奶茶", "美容", "美甲", "烟酒", "医美", "器械"],
  },
  {
    category_key: "photo_studio",
    category_name: "人像摄影工作室",
    positive_materials: ["价目套系册", "预约单", "相框logo贴", "名片", "客片袋", "选片单", "证件照袋"],
    forbidden_words: ["旗袍", "面料", "火锅", "烧烤", "美容", "疗程", "美甲", "器械", "猫粮"],
  },
  {
    category_key: "bookstore",
    category_name: "书店文创店",
    positive_materials: ["书签", "购物袋", "图书印章", "会员卡", "文创产品标签", "书单海报", "咖啡杯贴"],
    forbidden_words: ["旗袍", "面料", "火锅", "烧烤", "美容", "医美", "美甲", "器械", "疗程"],
  },
  {
    category_key: "boutique_homestay",
    category_name: "精品民宿",
    positive_materials: ["房卡套", "欢迎卡", "洗漱用品包装", "导视门牌", "伴手礼袋", "早餐餐牌", "入住须知"],
    forbidden_words: ["旗袍", "面料", "美容", "医美", "疗程", "美甲", "火锅", "器械", "教材"],
  },
  {
    category_key: "dental_clinic",
    category_name: "口腔牙科诊所",
    positive_materials: ["就诊卡", "价目表", "诊室门牌", "病历本封皮", "洁牙套餐卡", "预约单", "医护工牌"],
    forbidden_words: ["旗袍", "面料", "火锅", "奶茶", "烘焙", "美甲", "美睫", "瑜伽垫"],
  },
  {
    category_key: "car_beauty",
    category_name: "汽车美容店",
    positive_materials: ["价目表", "施工单", "会员卡", "车窗贴纸", "工位标识", "洗车次卡", "镀膜套餐卡"],
    forbidden_words: ["旗袍", "面料", "护肤", "火锅", "奶茶", "美甲", "绘本", "教材"],
  },
  {
    category_key: "noodle_shop",
    category_name: "面馆/快餐",
    positive_materials: ["菜单", "门头招牌", "打包袋", "餐盒", "员工工服", "工牌", "纸巾盒", "价目表", "会员储值卡", "外卖贴纸"],
    forbidden_words: ["美容", "护肤", "医美", "面膜", "精油", "疗程", "美甲", "美睫", "护肤品", "瓶身标签", "口红", "粉底"],
    keywords: ["面馆", "面食", "刀削面", "快餐", "拉面", "拌面", "炒面"]
  },
  {
    category_key: "cloth_shoes",
    category_name: "老北京布鞋",
    positive_materials: ["布鞋礼盒", "手提袋", "鞋盒", "门店招牌", "工服", "会员卡", "防尘袋", "鞋拔", "鞋垫包装"],
    forbidden_words: ["时尚", "服装", "T台", "潮流", "美容", "餐饮", "护肤", "美甲", "奶茶", "烘焙"],
    keywords: ["布鞋", "千层底", "手工布鞋", "老北京布鞋", "鞋履", "传统布鞋"],
    scene_categories: { application: "布鞋应用系统", packaging: "布鞋包装系统", marketing: "门店营销系统", wayfinding: "门店导视系统" }
  },
  {
    category_key: "traditional_footwear",
    category_name: "传统鞋履",
    positive_materials: ["布鞋礼盒", "手提袋", "鞋盒", "门店招牌", "工服", "会员卡", "防尘袋", "鞋拔", "鞋垫包装"],
    forbidden_words: ["时尚", "服装", "T台", "潮流", "美容", "餐饮", "护肤", "美甲", "奶茶", "烘焙"],
    keywords: ["鞋履", "传统手工鞋", "千层底", "布鞋"],
    scene_categories: { application: "布鞋应用系统", packaging: "布鞋包装系统", marketing: "门店营销系统", wayfinding: "门店导视系统" }
  }
];

/** Fuzzy match main product to industry category */
export function getCategoryDict(mainProduct: string): IndustryDict | null {
  const matched = INDUSTRY_DICTS.find(d =>
    d.positive_materials.some(m => {
      const stem = m.replace(/[卡袋盒贴牌套册签纸布单证表本]$/, "");
      // 词干过短（如「工」「菜」）易误匹配，要求长度 >= 2
      return (stem.length >= 2 && mainProduct.includes(stem)) ||
        mainProduct.includes(d.category_name.replace(/店|馆|室|所|吧$/, ""));
    }) ||
    d.keywords?.some(kw => mainProduct.includes(kw))
  );
  return matched || null;
}

/** Convert IndustryDict to IndustryIsolation for unified return */
function dictToIsolation(dict: IndustryDict): IndustryIsolation {
  return {
    label: dict.category_name,
    keywords: dict.keywords || [],
    forbiddenWords: dict.forbidden_words,
    positiveMaterials: dict.positive_materials,
    sceneCategories: dict.scene_categories || { application: "应用系统", packaging: "包装系统", marketing: "营销系统", wayfinding: "导视系统" }
  };
}

/** M2.1: Get industry isolation data — three-tier fallback */
export function getIndustryIsolation(industry: string, mainProducts?: string): IndustryIsolation {
  const data = forbiddenWordsData as Record<string, IndustryIsolation>;

  // Tier 1: exact match on label or key in forbidden-words.json
  for (const [key, isolation] of Object.entries(data)) {
    if (industry === isolation.label || industry === key) return isolation;
  }

  // Tier 2: keyword search in forbidden-words.json
  const searchText = (mainProducts || "") + " " + industry;
  for (const [, isolation] of Object.entries(data)) {
    for (const kw of isolation.keywords) {
      if (searchText.includes(kw)) return isolation;
    }
  }

  // Tier 3: granular match via INDUSTRY_DICTS (21 sub-industries)
  const dict = getCategoryDict(mainProducts || industry);
  if (dict) return dictToIsolation(dict);

  // Tier 4: generic fallback
  return {
    label: "通用",
    keywords: [],
    forbiddenWords: [],
    positiveMaterials: ["名片","手提袋","产品包装","店面招牌","营销海报"],
    sceneCategories: { application:"应用系统", packaging:"包装系统", marketing:"营销系统", wayfinding:"导视系统" }
  };
}

/**
 * TICKET-086-R1：行业 IP 应用知识固化（平台可复用，禁止写死品牌名/项目 ID）。
 *
 * 1) getIndustryIpApplicationRules(industry)：丽人/美业线上+线下触点清单，
 *    其他行业回退通用模板（可配置继承）；
 * 2) getIndustrySceneMaterials(industry, pageType)：应用/包装/营销三页的
 *    行业物料映射（美容：项目价目表/产品包装盒/会员卡；餐饮：菜单/打包袋/餐盒；
 *    茶饮：菜单/杯套/手提袋；零售：价签/包装盒/购物袋），未命中返回 null
 *    由调用方回退通用物料表。
 */
import type { MaterialSpec } from "./material-specs";

export interface IpApplicationRuleSet {
  industryKey: string;
  online: string[];
  offline: string[];
}

/** 丽人/美业 IP 应用触点（Chris 专项 + 豆包评审固化，可复用）。 */
const BEAUTY_IP_APPLICATION_RULES: IpApplicationRuleSet = {
  industryKey: "beauty",
  online: ["社媒头像（公仔头部）", "表情包（公仔）", "小红书·朋友圈配图（公仔+LOGO）"],
  offline: [
    "会员卡",
    "护肤品包装",
    "购物袋",
    "门店立牌·海报",
    "周边礼品（笔记本/雨伞/充电宝）",
    "人偶服·快闪引流",
    "毛绒·盲盒",
    "高端定制公仔·年度会员礼",
    "美陈打卡装置",
  ],
};

/** 通用 IP 应用模板（其他行业继承或配置覆盖）。 */
const GENERIC_IP_APPLICATION_RULES: IpApplicationRuleSet = {
  industryKey: "generic",
  online: ["社媒头像", "表情包", "社交平台配图"],
  offline: ["门店立牌·海报", "产品包装", "会员卡", "周边礼品"],
};

/**
 * 行业归一化（仅用于规则查表，与 industry-types 的正规化值兼容）：
 * 丽人/美容/美甲/美业 → beauty；餐饮/面食/快餐 → restaurant；
 * 茶饮/饮品/咖啡 → beverage；零售/商店/电商 → retail；其余 generic。
 */
export function resolveIndustryRuleKey(industry?: string | null): string {
  const value = String(industry || "").toLowerCase();
  if (/丽人|美容|美业|美甲|beauty|fashion|nail/.test(value)) return "beauty";
  if (/餐|面|快餐|fastfood|restaurant|fresh_food/.test(value)) return "restaurant";
  if (/茶|饮|咖啡|beverage|tea/.test(value)) return "beverage";
  if (/零售|商店|电商|retail|shop/.test(value)) return "retail";
  return "generic";
}

export function getIndustryIpApplicationRules(industry?: string | null): IpApplicationRuleSet {
  const key = resolveIndustryRuleKey(industry);
  if (key === "beauty") return BEAUTY_IP_APPLICATION_RULES;
  return GENERIC_IP_APPLICATION_RULES;
}

function spec(id: string, name: string, size: string, logoPosition: string, logoSize: string, safeZone: string): MaterialSpec {
  return { id, name, size, logoPosition, logoSize, safeZone };
}

/** 行业物料映射（P1-6：三页物料坐标卡按行业查表替换硬编码通用模板）。 */
const INDUSTRY_SCENE_MATERIALS: Record<string, Partial<Record<"stationery" | "packaging" | "marketing", MaterialSpec[]>>> = {
  beauty: {
    stationery: [
      spec("beauty-price-list", "项目价目表", "A4 横版", "页眉左上角", "宽度 ≤ 40mm", "四周 5mm"),
      spec("beauty-badge", "员工工牌", "54 x 85mm", "顶部居中", "宽度 ≤ 20mm", "四周 2mm"),
      spec("beauty-signboard", "门头招牌", "3000 x 600mm", "左上角，距边缘 10%", "高度 ≤ 招牌高 15%", "四周 10%"),
    ],
    packaging: [
      spec("beauty-product-box", "产品包装盒", "120 x 80 x 40mm", "正面视觉中心偏上", "LOGO 高度 10-12mm", "四周 3mm"),
      spec("beauty-shopping-bag", "购物袋", "350 x 400 x 120mm", "袋面上方 40% 区域", "宽度 ≤ 袋面宽 60%", "四周 15mm"),
    ],
    marketing: [
      spec("beauty-member-card", "会员卡", "85.5 x 54mm", "正面左上角", "宽度 ≤ 16mm", "四周 2mm"),
      spec("beauty-poster", "门店立牌·海报", "600 x 1600mm", "右上角", "高度 ≤ 80mm", "四周 10%"),
    ],
  },
  restaurant: {
    stationery: [
      spec("restaurant-menu", "菜单/价目表", "A4 横版", "页眉左上角", "宽度 ≤ 40mm", "四周 5mm"),
      spec("restaurant-carry-bag", "打包袋", "350 x 400 x 120mm", "袋面上方 40% 区域", "宽度 ≤ 袋面宽 60%", "四周 15mm"),
    ],
    packaging: [
      spec("restaurant-meal-box", "餐盒", "225 x 175 x 65mm", "盒盖中央", "宽度 ≤ 盒宽 40%", "四周 5mm"),
      spec("restaurant-carry-bag", "打包袋", "350 x 400 x 120mm", "袋面上方 40% 区域", "宽度 ≤ 袋面宽 60%", "四周 15mm"),
    ],
    marketing: [
      spec("restaurant-poster", "宣传海报", "600 x 1600mm", "右上角", "高度 ≤ 80mm", "四周 10%"),
      spec("restaurant-table-tent", "桌面立牌", "210 x 297mm", "顶部居中", "宽度 ≤ 30mm", "四周 5mm"),
    ],
  },
  beverage: {
    stationery: [spec("beverage-menu", "菜单", "A5 竖版", "页眉左上角", "宽度 ≤ 30mm", "四周 5mm")],
    packaging: [
      spec("beverage-cup-sleeve", "杯套", "杯套展开 91 x 55mm", "正面视觉中心偏上", "LOGO 高度 10-12mm", "四周 3mm"),
      spec("beverage-carry-bag", "手提袋", "300 x 380 x 110mm", "袋面上方 40% 区域", "宽度 ≤ 袋面宽 55%", "四周 15mm"),
    ],
    marketing: [
      spec("beverage-poster", "宣传海报", "600 x 1600mm", "右上角", "高度 ≤ 80mm", "四周 10%"),
      spec("beverage-counter-card", "收银台立牌", "150 x 210mm", "顶部居中", "宽度 ≤ 25mm", "四周 5mm"),
    ],
  },
  retail: {
    stationery: [spec("retail-price-tag", "价签", "40 x 25mm", "左上角", "宽度 ≤ 8mm", "四周 1mm")],
    packaging: [
      spec("retail-box", "包装盒", "200 x 150 x 80mm", "正面视觉中心偏上", "宽度 ≤ 盒宽 45%", "四周 8mm"),
      spec("retail-bag", "购物袋", "320 x 380 x 110mm", "袋面上方 40% 区域", "宽度 ≤ 袋面宽 55%", "四周 15mm"),
    ],
    marketing: [
      spec("retail-poster", "促销海报", "600 x 1600mm", "右上角", "高度 ≤ 80mm", "四周 10%"),
      spec("retail-shelf-card", "货架卡", "150 x 210mm", "顶部居中", "宽度 ≤ 25mm", "四周 5mm"),
    ],
  },
};

export function getIndustrySceneMaterials(industry?: string | null, pageType?: string | null): MaterialSpec[] | null {
  const key = resolveIndustryRuleKey(industry);
  const map = INDUSTRY_SCENE_MATERIALS[key];
  if (!map || !pageType) return null;
  const items = map[pageType as "stationery" | "packaging" | "marketing"];
  return items && items.length > 0 ? items : null;
}

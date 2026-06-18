/**
 * Brand Brain — Industry Type Definitions (Shared)
 * 
 * 统一的行业类型定义，供 generate-manual-pptx、render-pptx、analyze-brand 共用
 * 从 generate-manual-pptx/route.ts 提取，避免3处重复定义
 */

export type IndustryType = "restaurant" | "fastfood" | "beverage" | "beauty" | "fashion" | "mother_baby" | "wedding" | "fitness" | "pharmacy" | "pet" | "retail" | "education" | "general";

export function getIndustryType(industry?: string): IndustryType {
  if (!industry) return "general";
  const s = industry.toLowerCase();
  
  // V14: 优先匹配二级格式（一级:二级）
  if (s.includes(":")) {
    const [cat, sub] = s.split(":");
    // 美食
    if (cat === "美食") {
      if (/小吃快餐|速食/.test(sub)) return "fastfood";
      return "restaurant";
    }
    if (cat === "饮品") return "beverage";
    if (cat === "丽人") return "beauty";
    if (cat === "购物") {
      if (/服装|鞋帽/.test(sub)) return "fashion";
      if (/母婴|儿童/.test(sub)) return "mother_baby";
      return "retail";
    }
    if (cat === "生活服务") {
      if (/婚庆|摄影/.test(sub)) return "wedding";
      if (/宠物/.test(sub)) return "pet";
      return "general";
    }
    if (cat === "运动健身") return "fitness";
    if (cat === "教育培训") return "education";
    if (cat === "医疗保健") return "pharmacy";
    if (cat === "汽车服务") return "retail";
    if (cat === "公司企业") return "general";
    return "general";
  }
  
  // V14: 兼容旧版一级格式
  // 1. 美容/美发（在零售之前拦截）
  if (/美容|美发|理发|美甲|spa|沙龙|造型|护肤|美体|美睫|剪发|烫发/.test(s)) return "beauty";
  // 2. 婚庆/摄影
  if (/婚|婚庆|婚纱|摄影|影楼|照相|写真|跟拍|司仪/.test(s)) return "wedding";
  // 3. 药店/诊所（含养生馆、中医馆）
  if (/药|诊所|中医|牙科|骨科|推拿|针灸|理疗|药房|大药房|养生/.test(s)) return "pharmacy";
  // 4. 宠物
  if (/宠物|猫咖|狗咖|水族/.test(s)) return "pet";
  // 5. 健身/运动
  if (/健身|瑜伽|武术|搏击|游泳|运动|跆拳道|舞蹈|普拉提/.test(s)) return "fitness";
  // 6. 母婴/儿童
  if (/母婴|儿童|婴儿|奶粉|早教|月子|孕妇|宝宝/.test(s)) return "mother_baby";
  // 7. 服装/鞋帽
  if (/服装|鞋|帽|服饰|女装|男装|内衣|皮具|箱包|裁缝|西装|潮牌/.test(s)) return "fashion";
  // 8. 饮品/茶饮
  if (/饮品|茶饮|奶茶|咖啡|果汁|椰|椰子|椰汁|酒|酒吧|气泡|矿泉|纯净水/.test(s)) return "beverage";
  // 9. 小吃快餐（V14新增，区别于正餐）
  if (/小吃快餐|速食|快餐|汉堡|炸鸡|盒饭|盖浇/.test(s)) return "fastfood";
  // 10. 餐厅/正餐
  if (/餐厅|正餐|面馆|饭馆|炒菜|海鲜|川菜|粤菜|湘菜|鲁菜|饭店/.test(s)) return "restaurant";
  // 11. 火锅/烧烤
  if (/火锅|串串|烧烤|烘焙|饺子|包子|小吃/.test(s)) return "restaurant";
  // 12. 通用餐饮匹配兜底
  if (/餐饮|餐|食|面|外卖/.test(s)) return "restaurant";
  // 13. 零售/电商
  if (/零售|超市|便利|商店|杂货|数码/.test(s)) return "retail";
  // 14. 教育/培训
  if (/教育|培训|学|课|幼儿园|托管|辅导/.test(s)) return "education";
  return "general";
}

// ========== 行业默认配色 ==========

export const INDUSTRY_DEFAULTS: Record<string, { primary: string; secondary: string; accent: string }> = {
  restaurant:  { primary: "#C62828", secondary: "#F9A825", accent: "#FFFFFF" },  // V95: 餐饮默认中国红+金
  fastfood:    { primary: "#D32F2F", secondary: "#F9A825", accent: "#FFFFFF" },
  beverage:    { primary: "#00695C", secondary: "#D84315", accent: "#FFB300" },
  beauty:      { primary: "#E8576C", secondary: "#9B72CF", accent: "#F0D5A8" },
  fashion:     { primary: "#1A1A2E", secondary: "#C9A96E", accent: "#E8D5B7" },
  mother_baby: { primary: "#E8836B", secondary: "#5B9EA6", accent: "#F5C6AA" },
  wedding:     { primary: "#8B6F4E", secondary: "#D4A574", accent: "#F5E6D3" },
  fitness:     { primary: "#D32F2F", secondary: "#1B5E20", accent: "#FFC107" },
  pharmacy:    { primary: "#1565C0", secondary: "#2E7D32", accent: "#BBDEFB" },
  pet:         { primary: "#FF8F00", secondary: "#5D4037", accent: "#FFE082" },
  retail:      { primary: "#1565C0", secondary: "#EF6C00", accent: "#78909C" },
  education:   { primary: "#283593", secondary: "#00897B", accent: "#FF8F00" },
  general:     { primary: "#37474F", secondary: "#00897B", accent: "#FFB300" },
};

export function getIndustryDefaults(industry?: string): { primary: string; secondary: string; accent: string } {
  const it = getIndustryType(industry);
  return INDUSTRY_DEFAULTS[it] || INDUSTRY_DEFAULTS.general;
}

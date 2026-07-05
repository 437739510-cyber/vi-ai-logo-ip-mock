/**
 * Brand Brain — Industry Type Definitions (Shared)
 * 
 * 统一的行业类型定义，供 generate-manual-pptx、render-pptx、analyze-brand 共用
 * 从 generate-manual-pptx/route.ts 提取，避免3处重复定义
 */

export type IndustryType = "restaurant" | "fastfood" | "beverage" | "beauty" | "fashion" | "mother_baby" | "wedding" | "fitness" | "pharmacy" | "pet" | "retail" | "education" | "fresh_food" | "floral" | "home" | "nail" | "tea" | "general";

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
    if (cat === "医疗保健") {
      if (/养生/.test(sub)) return "beauty";
      return "pharmacy";
    }
    if (cat === "汽车服务") return "retail";
    if (cat === "公司企业") return "general";
    return "general";
  }
  
  // V14: 兼容旧版一级格式
  // 1. 美容/美发（在零售之前拦截）
  if (/美甲|美睫|美足|纹绣/.test(s)) return "nail";
  if (/美容|美发|理发|spa|沙龙|造型|护肤|美体|剪发|烫发|养生/.test(s)) return "beauty";
  // 2. 婚庆/摄影
  if (/婚|婚庆|婚纱|摄影|影楼|照相|写真|跟拍|司仪/.test(s)) return "wedding";
  // 3. 药店/诊所（含中医馆）
  if (/药|诊所|中医|牙科|骨科|推拿|针灸|理疗|药房|大药房/.test(s)) return "pharmacy";
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
  // V97: 新增行业识别
  if (/水果|生鲜|菜场|菜市场|果蔬/.test(s)) return "fresh_food";
  if (/花|花店|花艺|鲜花|花坊/.test(s)) return "floral";
  if (/家居|装饰|装修|建材|家具|厨卫/.test(s)) return "home";
  if (/美甲|美睫|美足|纹绣/.test(s)) return "nail";
  if (/茶业|茶叶|茶馆|茶庄|茶室|茗茶/.test(s)) return "tea";
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
  fresh_food:  { primary: "#2E7D32", secondary: "#F9A825", accent: "#FFFFFF" },
  floral:      { primary: "#C2185B", secondary: "#F48FB1", accent: "#FCE4EC" },
  home:        { primary: "#5D4037", secondary: "#A1887F", accent: "#EFEBE9" },
  nail:        { primary: "#E8576C", secondary: "#9B72CF", accent: "#F0D5A8" },
  tea:         { primary: "#33691E", secondary: "#D4A574", accent: "#F5E6D3" },
  general:     { primary: "#37474F", secondary: "#00897B", accent: "#FFB300" },
};

export function getIndustryDefaults(industry?: string): { primary: string; secondary: string; accent: string } {
  const it = getIndustryType(industry);
  return INDUSTRY_DEFAULTS[it] || INDUSTRY_DEFAULTS.general;
}

// ========== Industry Material Lists (P0 quick fix) ==========

export interface MaterialItem {
  priority: string; // 必做 | 建议 | 可选
  category: string;
  desc: string;
  color: string;
}

export const INDUSTRY_MATERIALS: Record<IndustryType, MaterialItem[]> = {
  restaurant: [
    { priority: '必做', category: '门头招牌', desc: '门头招牌+侧招灯箱，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '员工工服', desc: '厨师服+服务员围裙+工牌，统一门店形象', color: 'C62828' },
    { priority: '必做', category: '菜单价目表', desc: '店内点餐菜单+价目牌，核心消费触点', color: 'C62828' },
    { priority: '必做', category: '打包包装', desc: '打包袋+餐盒+筷子套+外卖贴纸，外带场景品牌露出', color: 'C62828' },
    { priority: '建议', category: '纸巾盒/桌牌', desc: '桌面物料，提升就餐体验与品牌感知', color: 'E67E22' },
    { priority: '建议', category: '会员储值卡', desc: 'VIP卡片设计，客户留存与复购核心触点', color: 'E67E22' },
    { priority: '建议', category: '手提袋/礼盒', desc: '伴手礼包装，社交传播重要载体', color: 'E67E22' },
    { priority: '可选', category: '活动海报/展架', desc: '开业/促销按需制作，非日常必备', color: '2E7D32' },
    { priority: '可选', category: '明档标识/灯箱', desc: '明档厨房标识+菜品灯箱展示', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '门牌/指引立牌/洗手间标识，连锁扩张时统一制作', color: '2E7D32' },
  ],
  fastfood: [
    { priority: '必做', category: '门头招牌', desc: '门头招牌+灯箱，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '员工工服', desc: '员工制服+帽子+工牌，统一门店形象', color: 'C62828' },
    { priority: '必做', category: '点餐牌/菜单', desc: '柜台点餐牌+电子菜单，核心消费触点', color: 'C62828' },
    { priority: '必做', category: '打包包装', desc: '打包袋+汉堡盒+饮料杯+纸巾，外带场景品牌露出', color: 'C62828' },
    { priority: '建议', category: '托盘垫纸', desc: '托盘衬纸，增加品牌触点', color: 'E67E22' },
    { priority: '建议', category: '会员卡/优惠券', desc: '会员体系+优惠券，提升复购', color: 'E67E22' },
    { priority: '建议', category: '外卖贴纸/封口贴', desc: '外卖包装品牌封贴', color: 'E67E22' },
    { priority: '可选', category: '活动展架/海报', desc: '新品推广/促销活动物料', color: '2E7D32' },
    { priority: '可选', category: '车辆广告', desc: '外卖配送车辆车身广告', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内指引/排队引导/取餐标识', color: '2E7D32' },
  ],
  beverage: [
    { priority: '必做', category: '门头招牌', desc: '门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '杯具/杯套', desc: '冷热饮杯+杯套+吸管，产品即品牌载体', color: 'C62828' },
    { priority: '必做', category: '员工工服', desc: '围裙+工牌，统一门店形象', color: 'C62828' },
    { priority: '必做', category: '价目表/菜单', desc: '点单菜单+电子屏价目表', color: 'C62828' },
    { priority: '建议', category: '打包袋/手提袋', desc: '外带包装，社交传播载体', color: 'E67E22' },
    { priority: '建议', category: '会员卡/积分卡', desc: '会员体系，提升复购', color: 'E67E22' },
    { priority: '建议', category: '封口膜/贴纸', desc: '杯口封膜+品牌贴纸', color: 'E67E22' },
    { priority: '可选', category: '活动海报/展架', desc: '新品/季节限定推广物料', color: '2E7D32' },
    { priority: '可选', category: '周边产品', desc: '随行杯/保温杯/帆布袋等品牌周边', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内指引/洗手间标识', color: '2E7D32' },
  ],
  beauty: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招灯箱，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '员工工服', desc: '美容师围裙/制服+名牌，直接影响客户信任感', color: 'C62828' },
    { priority: '必做', category: '产品包装', desc: '护肤品瓶身标签+包装盒，产品即品牌载体', color: 'C62828' },
    { priority: '必做', category: '会员卡', desc: 'VIP卡片设计，客户留存与复购核心触点', color: 'C62828' },
    { priority: '建议', category: '价目表/预约单', desc: '前台标准物料，提升门店专业度', color: 'E67E22' },
    { priority: '建议', category: '手提袋/礼盒', desc: '伴手礼包装，社交传播重要载体', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '小红书/大众点评视觉统一，影响线上获客转化', color: 'E67E22' },
    { priority: '可选', category: '活动海报/展架', desc: '开业/促销按需制作，非日常必备', color: '2E7D32' },
    { priority: '可选', category: '门店软装', desc: '窗帘/墙面/前台摆件，品牌氛围营造', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '门牌/房号牌/指引立牌，连锁扩张时统一制作', color: '2E7D32' },
  ],
  floral: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+橱窗展示，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '花束包装', desc: '花束包装纸/丝带+品牌标签贴纸', color: 'C62828' },
    { priority: '必做', category: '名片/贺卡', desc: '品牌名片+祝福贺卡，社交传播载体', color: 'C62828' },
    { priority: '必做', category: '手提袋', desc: '品牌手提花袋，客户带走即传播', color: 'C62828' },
    { priority: '建议', category: '会员卡', desc: 'VIP/会员卡设计，客户留存与复购', color: 'E67E22' },
    { priority: '建议', category: '花瓶/花篮标签', desc: '花瓶贴标+花篮品牌牌，产品即品牌载体', color: 'E67E22' },
    { priority: '建议', category: '养护卡', desc: '鲜花养护说明卡，增加品牌专业感', color: 'E67E22' },
    { priority: '可选', category: '线上配图模板', desc: '小红书/朋友圈视觉统一', color: '2E7D32' },
    { priority: '可选', category: '节日促销物料', desc: '情人节/母亲节等节日海报+展架', color: '2E7D32' },
    { priority: '可选', category: '围裙/工服', desc: '花艺师工作围裙+工牌', color: '2E7D32' },
  ],
  retail: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+橱窗展示，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '商品价签/吊牌', desc: '商品价格标签+品牌吊牌', color: 'C62828' },
    { priority: '必做', category: '购物袋', desc: '品牌手提袋/塑料袋，客户带走即传播', color: 'C62828' },
    { priority: '必做', category: '名片/工牌', desc: '店员名牌+企业名片', color: 'C62828' },
    { priority: '建议', category: '会员卡', desc: '会员储值卡/积分卡', color: 'E67E22' },
    { priority: '建议', category: '促销海报', desc: '店内促销海报+活动展架', color: 'E67E22' },
    { priority: '建议', category: '包装盒/礼品盒', desc: '品牌包装盒，提升礼品属性', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '员工统一工服', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内分区指引/洗手间标识', color: '2E7D32' },
    { priority: '可选', category: '线上店铺模板', desc: '电商平台店铺视觉统一', color: '2E7D32' },
  ],
  education: [
    { priority: '必做', category: '门头招牌', desc: '校区门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '学员证/校服', desc: '学员证件+校服/书包，行走的品牌载体', color: 'C62828' },
    { priority: '必做', category: '教材封面', desc: '课程教材/练习册封面统一视觉', color: 'C62828' },
    { priority: '必做', category: '招生海报/简章', desc: '招生宣传核心物料', color: 'C62828' },
    { priority: '建议', category: '手提袋/文件袋', desc: '品牌文件袋+手提袋', color: 'E67E22' },
    { priority: '建议', category: '教室门牌/指引', desc: '教室编号牌+楼层指引', color: 'E67E22' },
    { priority: '建议', category: '证书/奖状', desc: '结业证书+获奖证书设计', color: 'E67E22' },
    { priority: '可选', category: '活动展架/横幅', desc: '开学/汇演等活动物料', color: '2E7D32' },
    { priority: '可选', category: '线上推广模板', desc: '公众号/朋友圈招生配图', color: '2E7D32' },
    { priority: '可选', category: '周边礼品', desc: '文具/水杯/书包等品牌周边', color: '2E7D32' },
  ],
  fashion: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+橱窗展示，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '吊牌/标签', desc: '商品品牌吊牌+价格标签', color: 'C62828' },
    { priority: '必做', category: '购物袋', desc: '品牌手提袋/纸袋，客户带走即传播', color: 'C62828' },
    { priority: '必做', category: '名片/会员卡', desc: '品牌名片+VIP会员卡', color: 'C62828' },
    { priority: '建议', category: '橱窗展示', desc: '橱窗陈列+模特搭配展示', color: 'E67E22' },
    { priority: '建议', category: '包装盒/礼盒', desc: '品牌包装盒，提升礼品属性', color: 'E67E22' },
    { priority: '建议', category: '线上店铺模板', desc: '电商平台店铺视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '店员统一工服', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内分区指引/试衣间标识', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '新品/促销按需制作', color: '2E7D32' },
  ],
  mother_baby: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '产品包装', desc: '产品瓶身标签+包装盒，产品即品牌载体', color: 'C62828' },
    { priority: '必做', category: '会员卡', desc: 'VIP会员卡设计，客户留存与复购', color: 'C62828' },
    { priority: '必做', category: '名片/工牌', desc: '导购名牌+企业名片', color: 'C62828' },
    { priority: '建议', category: '手提袋/礼盒', desc: '伴手礼包装，社交传播载体', color: 'E67E22' },
    { priority: '建议', category: '游泳卡/体验卡', desc: '服务体验卡+游泳次卡', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '小红书/朋友圈视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '员工统一工服', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内指引/母婴室标识', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '促销/活动按需制作', color: '2E7D32' },
  ],
  wedding: [
    { priority: '必做', category: '门店招牌', desc: '门店招牌+橱窗展示，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '请柬/贺卡', desc: '婚礼请柬+祝福贺卡，核心传播载体', color: 'C62828' },
    { priority: '必做', category: '伴手礼包装', desc: '伴手礼盒+手提袋，社交传播重要载体', color: 'C62828' },
    { priority: '必做', category: '名片/宣传册', desc: '品牌名片+服务画册', color: 'C62828' },
    { priority: '建议', category: '展示相框/相册', desc: '客片展示相框+相册', color: 'E67E22' },
    { priority: '建议', category: '会员卡/预约卡', desc: '会员体系+预约卡片', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '小红书/朋友圈视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '员工统一工服', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内指引/拍摄区标识', color: '2E7D32' },
    { priority: '可选', category: '活动展架/海报', desc: '婚博会/促销活动物料', color: '2E7D32' },
  ],
  fitness: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '会员卡', desc: '会员卡/次卡设计，核心消费触点', color: 'C62828' },
    { priority: '必做', category: '工服/运动装备', desc: '教练工服+运动毛巾，品牌载体', color: 'C62828' },
    { priority: '必做', category: '价目表/课表', desc: '课程价目表+排课表', color: 'C62828' },
    { priority: '建议', category: '手提袋/运动包', desc: '品牌运动包+手提袋', color: 'E67E22' },
    { priority: '建议', category: '更衣室标识', desc: '更衣室/淋浴间品牌标识', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '大众点评/朋友圈视觉统一', color: 'E67E22' },
    { priority: '可选', category: '器械标识', desc: '健身器械品牌标签', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '场馆指引/分区标识', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '促销/挑战赛活动物料', color: '2E7D32' },
  ],
  pharmacy: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '药品标签/包装', desc: '药品标签+包装盒，产品即品牌载体', color: 'C62828' },
    { priority: '必做', category: '会员卡/就诊卡', desc: '会员卡+就诊卡设计', color: 'C62828' },
    { priority: '必做', category: '名片/工牌', desc: '医师名牌+诊所名片', color: 'C62828' },
    { priority: '建议', category: '手提袋/药袋', desc: '品牌药袋+手提袋', color: 'E67E22' },
    { priority: '建议', category: '病历本/宣传册', desc: '病历本封面+健康宣传册', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '公众号/小程序视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/白大褂', desc: '医师工服+护士服', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '诊室门牌/科室指引', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '健康讲座/义诊活动物料', color: '2E7D32' },
  ],
  pet: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '宠物粮包装', desc: '宠物粮袋+零食包装，产品即品牌载体', color: 'C62828' },
    { priority: '必做', category: '会员卡', desc: '宠物会员卡/洗护卡设计', color: 'C62828' },
    { priority: '必做', category: '名片/工牌', desc: '美容师名牌+店铺名片', color: 'C62828' },
    { priority: '建议', category: '手提袋/礼盒', desc: '宠物用品手提袋+礼盒', color: 'E67E22' },
    { priority: '建议', category: '洗护标签/挂牌', desc: '洗护服务标签+宠物挂牌', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '小红书/朋友圈视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '美容师工服+围裙', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内指引/寄养区标识', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '宠物活动/促销物料', color: '2E7D32' },
  ],
  fresh_food: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '价格标签/价目牌', desc: '商品价格标签+价目牌', color: 'C62828' },
    { priority: '必做', category: '包装袋/盒', desc: '生鲜包装袋+水果盒', color: 'C62828' },
    { priority: '必做', category: '名片/会员卡', desc: '品牌名片+会员卡', color: 'C62828' },
    { priority: '建议', category: '手提袋/礼盒', desc: '品牌手提袋+果篮礼盒', color: 'E67E22' },
    { priority: '建议', category: '贴纸/标签', desc: '水果贴纸+产地标签', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '社区团购/朋友圈视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '员工统一工服+围裙', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内分区指引/品类标识', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '促销/新品推广物料', color: '2E7D32' },
  ],
  home: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+橱窗展示，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '名片/宣传册', desc: '品牌名片+产品画册', color: 'C62828' },
    { priority: '必做', category: '产品标签/吊牌', desc: '产品品牌标签+价格吊牌', color: 'C62828' },
    { priority: '必做', category: '购物袋', desc: '品牌手提袋/纸袋', color: 'C62828' },
    { priority: '建议', category: '包装盒/礼盒', desc: '品牌包装盒，提升礼品属性', color: 'E67E22' },
    { priority: '建议', category: '会员卡', desc: 'VIP会员卡设计', color: 'E67E22' },
    { priority: '建议', category: '线上店铺模板', desc: '电商/小程序视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '店员统一工服', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '展厅指引/体验区标识', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '促销/开业活动物料', color: '2E7D32' },
  ],
  nail: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '价目表/色板卡', desc: '美甲价目表+色板展示卡', color: 'C62828' },
    { priority: '必做', category: '会员卡', desc: 'VIP会员卡设计，客户留存与复购', color: 'C62828' },
    { priority: '必做', category: '名片/预约卡', desc: '品牌名片+预约卡片', color: 'C62828' },
    { priority: '建议', category: '手提袋/礼盒', desc: '伴手礼包装，社交传播载体', color: 'E67E22' },
    { priority: '建议', category: '甲油瓶贴/标签', desc: '甲油瓶身标签+产品贴纸', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '小红书/朋友圈视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '美甲师工服+围裙', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '店内指引/服务区标识', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '促销/节日活动物料', color: '2E7D32' },
  ],
  tea: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '茶具/茶杯', desc: '品牌茶具+茶杯+茶壶，产品即品牌载体', color: 'C62828' },
    { priority: '必做', category: '茶叶包装', desc: '茶叶罐/茶饼包装+标签贴纸', color: 'C62828' },
    { priority: '必做', category: '名片/会员卡', desc: '品牌名片+会员卡', color: 'C62828' },
    { priority: '建议', category: '手提袋/礼盒', desc: '茶礼手提袋+礼盒包装', color: 'E67E22' },
    { priority: '建议', category: '价目表/茶单', desc: '茶品价目表+品茶菜单', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '小红书/朋友圈视觉统一', color: 'E67E22' },
    { priority: '可选', category: '工服/围裙', desc: '茶艺师工服+围裙', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '茶室指引/包间标识', color: '2E7D32' },
    { priority: '可选', category: '活动海报/展架', desc: '茶会/品鉴活动物料', color: '2E7D32' },
  ],
  general: [
    { priority: '必做', category: '门店招牌', desc: '门头招牌+侧招灯箱，品牌线下第一视觉触点', color: 'C62828' },
    { priority: '必做', category: '名片/工牌', desc: '企业名片+员工工牌，商务社交基础物料', color: 'C62828' },
    { priority: '必做', category: '手提袋/包装', desc: '品牌手提袋+产品包装，客户带走即传播', color: 'C62828' },
    { priority: '必做', category: '会员卡', desc: 'VIP卡片设计，客户留存与复购核心触点', color: 'C62828' },
    { priority: '建议', category: '宣传册/价目表', desc: '企业画册+产品价目表，提升专业度', color: 'E67E22' },
    { priority: '建议', category: '工服/围裙', desc: '员工统一工服，提升门店形象', color: 'E67E22' },
    { priority: '建议', category: '线上配图模板', desc: '社交媒体/电商平台视觉统一', color: 'E67E22' },
    { priority: '可选', category: '活动海报/展架', desc: '开业/促销按需制作，非日常必备', color: '2E7D32' },
    { priority: '可选', category: '门店软装', desc: '窗帘/墙面/摆件，品牌氛围营造', color: '2E7D32' },
    { priority: '可选', category: '导视系统', desc: '门牌/指引立牌，连锁扩张时统一制作', color: '2E7D32' },
  ],
};

export function getIndustryMaterials(industry?: string): MaterialItem[] {
  const it = getIndustryType(industry);
  return INDUSTRY_MATERIALS[it] || INDUSTRY_MATERIALS.general;
}

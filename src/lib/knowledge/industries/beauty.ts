/**
 * 美容/美业行业 — 行业素材规范与典型场景
 */
export const BEAUTY_INDUSTRY = {
  industry: "美容/美业",
  subIndustries: ["美容院", "美甲店", "美发沙龙", "皮肤管理", "SPA", "医美诊所", "健身/瑜伽"],
  materialSpecs: {
    required: ["价目表/服务菜单", "会员卡", "产品包装/标签", "员工工作服", "预约卡/名片"],
    optional: ["手提袋/礼品袋", "体验装/试用装包装", "镜面/窗贴", "社交媒体验卡"],
  },
  sceneSpecs: [
    { scene: "前台接待", materials: ["价目表", "会员卡", "名片", "预约本"], notes: "前台物料统一品牌色，会员卡可加烫金/UV工艺" },
    { scene: "服务区域", materials: ["产品陈列架标签", "镜面Logo贴", "床品/毛巾Logo刺绣"], notes: "Logo使用柔和版本，避免干扰客户放松体验" },
    { scene: "产品零售", materials: ["产品包装盒", "手提袋", "产品标签", "试用装"], notes: "包装材质以哑光/珠光为主，体现高端质感" },
    { scene: "店面外观", materials: ["门头招牌", "橱窗展示", "LED屏"], notes: "门头灯光柔和暖色，Logo可用背光/亚克力发光字" },
    { scene: "线上营销", materials: ["社交媒体模板", "团购平台头图", "小程序Banner"], notes: "线上物料Logo最小48px，适配移动端" },
  ],
  colorTendency: {
    palette: "柔和暖色或冷色，偏向女性化/高级感色调，避免过于强烈的颜色",
    primaryTones: ["#E8576C 玫瑰粉 — 女性向美容主力色", "#D4A574 香槟金 — 高端SPA/抗衰", "#6C5B7B 薰衣草紫 — 精油/芳疗"],
    materialPreference: ["哑粉纸 200-300g — 价目表/会员卡", "珠光纸 — 高端产品包装", "PVC 0.38mm — 会员卡/预约卡", "丝绸/缎面 — 产品内衬"],
  },
  wordPack: {
    forbidden: ["最", "第一", "根治", "永久", "100%", "绝对", "保证效果", "无副作用(除非有临床证明)"],
    recommended: ["焕颜", "滋养", "温和", "专业", "定制", "尊享", "焕新", "修护", "舒享", "精致"],
  },
};

export default BEAUTY_INDUSTRY;

/**
 * 大学生合伙人配置（R24 起仅作回退兜底，线上真源 = site_config 表）。
 * 真实口径（Chris 2026-08-22 确认，后台「定价管理」可自改）：
 *   - 提成：新手 72% → 银级 78%（累计 20 单）→ 金级 83%（累计 50 单）；
 *     平台 28/22/17%；分成适用所有产品线（含 VI 与 VI+IP 手册）。
 *   - 产品定价：基础版 ¥19 一次性 / 标准版 ¥49 一次性 / 品牌管家 ¥199/月。
 * 读取优先级：site_config「pricing / commission」→ 本文件兜底。
 */
export const PARTNER_CONFIG = {
  // 分成比例（百分比）
  commission: {
    base: 72,        // 新手提成（%）
    silver: 78,      // 银级合伙人（累计20单后）
    gold: 83,        // 金级合伙人（累计50单后）
    upgradeOrders: {
      silver: 20,    // 晋升银级所需单数
      gold: 50,      // 晋升金级所需单数
    },
  },

  // 客户支付费用（元）；premium = 品牌管家（元/月）
  pricing: {
    basic: 19,       // 基础版：Logo + 简易VI（一次性）
    standard: 49,    // 标准版：Logo + 完整VI手册（一次性）
    premium: 199,    // 品牌管家：持续品牌化内容运营（元/月）
  },

  // 合伙人收益参考（元，按真实口径计算）
  earning: {
    perOrderMin: 13.68,     // 每单最低收入 = 基础版 19 × 72%
    perOrderMax: 165.17,    // 每单最高收入 = 品牌管家 199 × 83%
    monthlyMin: 68.4,       // 月入下限（兼职5单 × 13.68）
    monthlyMax: 3303.4,     // 月入上限（全职20单 × 165.17）
  },

  // 联系方式
  contact: {
    wechat: "BrandBrain2026",  // 合作咨询微信号
  },

  // 培训信息
  training: {
    duration: 30,     // 培训时长（分钟）
  },
};

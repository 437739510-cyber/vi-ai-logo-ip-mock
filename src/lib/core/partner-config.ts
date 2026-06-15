/**
 * 大学生合伙人配置 - 关键数字随时可改
 * 修改后push即可生效，后续迁移到Supabase site_config表做后台管理
 */
export const PARTNER_CONFIG = {
  // 分成比例（百分比）
  commission: {
    base: 30,        // 基础提成（%）
    silver: 40,      // 银级合伙人（完成20单后）
    gold: 50,        // 金级合伙人（完成50单后）
    upgradeOrders: {
      silver: 20,    // 晋升银级所需单数
      gold: 50,      // 晋升金级所需单数
    },
  },

  // 客户支付费用（元）
  pricing: {
    basic: 99,       // 基础版：Logo + 简易VI
    standard: 299,   // 标准版：Logo + 完整VI手册
    premium: 599,    // 高级版：Logo + VI手册 + IP公仔
  },

  // 合伙人收益参考（元）
  earning: {
    perOrderMin: 30,     // 每单最低收入
    perOrderMax: 300,    // 每单最高收入
    monthlyMin: 1500,    // 月入下限（兼职5单）
    monthlyMax: 6000,    // 月入上限（全职20单）
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

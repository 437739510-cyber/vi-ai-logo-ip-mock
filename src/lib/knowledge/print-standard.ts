/**
 * Print Production Standards
 * Universal print specs for all VI manual application systems.
 */
export interface PrintStandard {
  bleed: string;
  logoMargin: string;
  standardSizes: Record<string, string>;
  cmykCalibration: string;
  pantoneMapping: string;
  materials: string[];
}

export const PRINT_STANDARD_DEFAULT: PrintStandard = {
  bleed: "3mm — 所有印刷物料统一出血位",
  logoMargin: "Logo距离物料边缘 >= 15% Logo宽度（以Logo高度为基准）",
  standardSizes: {
    "名片": "90 x 54mm",
    "信纸": "210 x 297mm (A4)",
    "信封-中式": "220 x 110mm",
    "信封-西式": "229 x 162mm",
    "手提袋-中号": "320 x 270 x 80mm",
    "手提袋-大号": "400 x 330 x 100mm",
    "海报-A3": "297 x 420mm",
    "宣传单页-A4": "210 x 297mm",
    "包装盒-小": "150 x 100 x 50mm",
    "包装盒-中": "250 x 180 x 80mm",
    "纸杯-常规": "口径80mm 底径55mm 高95mm",
    "桌牌": "210 x 148mm (A5横)",
  },
  cmykCalibration: "CMYK值必须为印刷适配值（非RGB数学转换）。黑色文字使用K=100单黑，大面积黑色使用C30/M20/Y20/K100富黑。",
  pantoneMapping: "Pantone色号按哑光铜版纸(Coated)标准，优先选用Pantone Solid Coated色卡。金属色使用Pantone Metallic Coated。",
  materials: [
    "铜版纸 157g — 名片/宣传单",
    "铜版纸 250g — 封面/贺卡",
    "哑粉纸 200g — 高端画册内页",
    "白卡纸 300g — 包装盒",
    "牛皮纸 120g — 手提袋",
    "不干胶 — 贴纸/标签",
    "PVC 0.38mm — 会员卡",
    "亚克力 3mm — 招牌/展示架",
  ],
};

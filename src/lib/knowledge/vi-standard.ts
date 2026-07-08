/**
 * VI Manual Professional Standards
 * Core specification skeleton that every VI manual must satisfy.
 */
export interface VIStandard {
  /** Logo spec skeleton: required combo forms and grid standards */
  logoSpecs: string[];
  /** Color system: primary/secondary/accent with ratio ranges */
  colorSystem: { primary: string; secondary: string; accent: string };
  /** Font hierarchy: title/body/numbers font-weight mapping */
  fontHierarchy: string[];
  /** Application priority: required vs optional materials */
  applicationPriority: string[];
  /** Common error checklist */
  commonErrors: string[];
}

/** Default VI standard baseline — used as QC reference */
export const VI_STANDARD_DEFAULT: VIStandard = {
  logoSpecs: [
    "6种组合形式（横式/竖式/反白/单色/图形标/文字标）",
    "网格制图标注（宽高比例/圆角半径/元素坐标/字号网格单位）",
    "保护空间>=15% Logo高度",
    "最小尺寸：印刷>=15mm / 数字>=48px / 户外>=200mm",
  ],
  colorSystem: {
    primary: "品牌主色 — 占比60%，定义品牌第一识别色",
    secondary: "辅助色 — 占比30%，用于次级信息与背景",
    accent: "强调色 — 占比10%，用于CTA与重点突出",
  },
  fontHierarchy: [
    "标题：中文字体 Bold 用于H1-H2",
    "正文：中文字体 Regular 用于段落与说明",
    "数字与价格：等宽或加粗字体",
  ],
  applicationPriority: [
    "必做：名片/信纸/手提袋/店面招牌",
    "建议：包装盒/价签/员工服装/宣传单页",
    "可选：纸杯/雨伞/车贴/社交媒体模板",
  ],
  commonErrors: [
    "Logo拉伸变形",
    "更改品牌色值",
    "字体未授权商用",
    "保护空间不足",
    "低对比度背景使用",
    "添加未授权特效（描边/阴影/渐变）",
    "多Logo尺寸不统一",
    "在复杂纹理上直接放置",
  ],
};
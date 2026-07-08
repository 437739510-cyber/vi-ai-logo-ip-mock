/**
 * IP Mascot Design Standards
 * Specification skeleton for brand mascot/character design.
 */
export interface MascotStandard {
  requiredModules: string[];
  coreGenes: string[];
  viewSpecs: string[];
  massProductionRules: string[];
}

export const MASCOT_STANDARD_DEFAULT: MascotStandard = {
  requiredModules: [
    "01 角色定位与世界观", "02 三视图（正面/侧面/背面）",
    "03 比例尺与网格规范", "04 色彩基因图（主色/辅色/点缀色）",
    "05 面部表情库（>=6种）", "06 动态造型库（>=4种）",
    "07 服装配饰系统", "08 禁止使用规范（>=5项）",
    "09 应用场景示例（>=5个）", "10 延展周边示意", "11 文件交付清单",
  ],
  coreGenes: [
    "脸型比例（长宽比固定）", "五官位置（相对坐标锁定）",
    "身体比例（头身比固定）", "主色值（不可偏离+-5%）",
    "标志性特征（角/耳朵/尾巴位置固定）",
  ],
  viewSpecs: [
    "正面视图", "侧面视图", "背面视图", "3/4角度（可选）",
  ],
  massProductionRules: [
    "无复杂尖角（R角>=2mm）", "无过密细节（线宽>=1mm）",
    "无悬空结构", "分件数<=5件", "底面平整可站立", "颜色<=5色（含白）",
  ],
};
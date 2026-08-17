// @ts-nocheck
/**
 * Mascot Templates - IP公仔章节可复用文本模板库
 *
 * 提供 buildMascotChapter 各子页面需要的规范文本内容。
 * 包含：禁用规则列表、衍生品标准、合规声明、比例规范等。
 * 不含画图/ComfyUI相关代码，仅纯文本模板。
 */

// ========== 禁用规范文本 ==========

/** IP公仔禁用规范 - 12条禁止行为 */
export const MASCOT_MISUSE_RULES: { rule: string; correct: string }[] = [
  { rule: '禁止拉伸变形（非等比缩放），须保持公仔原始宽高比例', correct: '等比缩放，保持比例协调' },
  { rule: '禁止更改品牌色，所有公仔配色须严格使用品牌标准色', correct: '严格使用品牌标准色' },
  { rule: '禁止拆分LOGO或公仔元素单独使用，所有元素需整体呈现', correct: 'LOGO+公仔整体呈现' },
  { rule: '禁止旋转公仔角度超过规范允许范围，保持正面/正侧面/背面方向', correct: '保持正面/标准方向' },
  { rule: '禁止添加非规范装饰（角、翅膀、道具、飘带等额外元素）', correct: '保持简洁原始形象' },
  { rule: '禁止修改公仔表情超出规范范围，保持设定表情库内的表情', correct: '使用表情库标准表情' },
  { rule: '禁止AI重绘替换角色设定，所有变体须基于原始三视图延展', correct: '基于原始设定延展' },
  { rule: '禁止低对比背景使用，公仔与背景色对比度需≥3:1', correct: '确保背景对比度≥3:1' },
  { rule: '禁止截取五官/肢体单独商用，公仔须以完整形象出现', correct: '公仔完整形象呈现' },
  { rule: '禁止更换肢体动作拼接，角色姿态以三视图设定为准', correct: '使用标准姿态和动作' },
  { rule: '禁止在非授权场景使用趣味衍生形象，仅限品牌官方渠道', correct: '仅限品牌授权渠道' },
  { rule: '禁止在合同、公章等严肃场景使用公仔形象', correct: '严肃场景使用文字LOGO' },
];

// ========== 比例与尺寸规范 ==========

/** 三视图比例规范文本 */
export interface ProportionSpec {
  headBodyRatio: string;
  totalHeight: string;
  notes: string;
}

export const DEFAULT_PROPORTION_SPEC: ProportionSpec = {
  headBodyRatio: "1:3.5",
  totalHeight: "约20-35cm（以品牌实际设定为准）",
  notes: "头身比约 1:3~1:4，成熟体态、专业温润、可信赖的东方养生调性，不萌不 Q 版",
};

/** 最小使用尺寸规范 */
export const MIN_USAGE_SIZES = [
  { scene: "印刷", size: "15mm" },
  { scene: "数字媒介", size: "48px" },
  { scene: "小礼品/周边", size: "10mm" },
] as const;

/** 安全留白规范 */
export const SAFE_ZONE_RATIO = "公仔四周保留 >= 公仔高度 10% 的留白空间";

// ========== 单色/灰度规范 ==========

/** 灰度转换公式文字说明 */
export const GRAYSCALE_FORMULA = "灰度值 = R x 0.299 + G x 0.587 + B x 0.114";

/** 单色/灰度场景说明 */
export const GRAYSCALE_SCENES = "适用于报纸广告、印章、单色喷绘等灰度印刷媒介";

// ========== 衍生品规范 ==========

/** 衍生品分类标准 */
export interface MerchandiseCategory {
  category: string;
  items: { name: string; spec: string }[];
}

export const MERCHANDISE_CATEGORIES: MerchandiseCategory[] = [
  {
    category: "文创类",
    items: [
      { name: "手办", spec: "最小高度30mm，头部可 Q 版放大，但头身比不得超过 1:1.8" },
      { name: "抱枕", spec: "公仔形象占比 <= 60%，居中或偏左排版" },
      { name: "帆布袋", spec: "成品 35x40cm，公仔印刷区位于袋面上方 40% 区域，高度 >= 12cm" },
    ],
  },
  {
    category: "线下门店",
    items: [
      { name: "立牌", spec: "高度 >= 120cm，公仔全身占比 >= 70%" },
      { name: "灯箱", spec: "公仔占比 <= 50%，搭配品牌标语" },
      { name: "展架", spec: "公仔居于视觉中心位置，辅助信息环绕排版" },
    ],
  },
  {
    category: "线上媒介",
    items: [
      { name: "头像", spec: "1024x1024px，圆形裁切安全区 80%，保留头部与标志性特征" },
      { name: "表情包", spec: "GIF 尺寸 240x240px 起，透明底，帧率 >= 12fps，时长 <= 3s" },
      { name: "视频封面", spec: "公仔居于左下1/4区域，右侧留白排版文字" },
    ],
  },
];

/** 材质适配提示 */
export const MATERIAL_TIPS = [
  { material: "金属", process: "蚀刻或浮雕工艺，线条需简化避免过细" },
  { material: "布艺", process: "刺绣或印花工艺，颜色对比度可适当提高" },
  { material: "亚克力", process: "背喷或UV印刷，注意透明区域留白处理" },
] as const;

// ========== 合规说明模板 ==========

/** 合规说明章节 */
export interface ComplianceSection {
  title: string;
  getContent: (companyName: string) => string;
}

export const COMPLIANCE_SECTIONS: ComplianceSection[] = [
  {
    title: "版权归属声明",
    getContent: (name) => "IP公仔形象版权归 " + name + " 所有，未经授权不得复制、修改、传播或商业使用。",
  },
  {
    title: "授权使用范围",
    getContent: () => "品牌自有渠道（官网、社媒、门店物料）以及书面授权的合作伙伴。任何超出此范围的使用均需另行申请授权。",
  },
  {
    title: "外部修改限制",
    getContent: () => "未经品牌方书面授权，任何个人或组织不得对公仔形象进行修改、变体创作或二次开发。所有衍生品设计须经品牌方审核确认。",
  },
  {
    title: "不可商用场景",
    getContent: () => "禁止在竞品品牌宣传、政治活动与选举、宗教传播与仪式、成人内容与不雅场景中使用公仔形象。",
  },
  {
    title: "授权期限与地域",
    getContent: () => "授权使用期限和地域范围以授权协议为准，到期自动终止。续期须提前30个工作日提交申请。",
  },
  {
    title: "违例处理方式",
    getContent: () => "对于违反本合规说明的行为，品牌方保留追究法律责任的权利，包括但不限于停止侵权、消除影响、赔偿损失等措施。",
  },
  {
    title: "IP 修改审批流程",
    getContent: () => "门店/合作方提交书面修改申请 → 品牌总部审核角色设定与比例 → 批准后由指定设计方执行 → 完成后归档新版本三视图。",
  },
  {
    title: "对外授权申请模板",
    getContent: () => "申请方 / 品牌名 / 使用场景 / 使用期限 / 地域范围 / 授权费用 / 违规责任（七个字段）。",
  },
  {
    title: "标准商用形象 vs 节日限定形象",
    getContent: () => "标准商用形象：日常门店、包装、社媒长期使用；节日限定形象：仅官方节日活动使用，活动结束后下架，禁止混入标准物料。",
  },
];

// ========== 格式化工具 ==========

/** 生成禁用规则的描述文本行 */
export function formatMisuseMarkdown(rules: { rule: string; correct: string }[]): string {
  return rules.map((r, i) => (i + 1) + ". " + r.rule + "（正确做法：" + r.correct + "）").join("\n");
}

/** 生成衍生品规范概览文本 */
export function formatMerchandiseSummary(categories: MerchandiseCategory[]): string {
  return categories
    .map((cat) => {
      const items = cat.items.map((item) => "  - " + item.name + "：" + item.spec).join("\n");
      return cat.category + "：\n" + items;
    })
    .join("\n\n");
}

/** 生成合规说明完整文本 */
export function formatComplianceText(sections: ComplianceSection[], companyName: string): string {
  return sections.map((s) => "【" + s.title + "】\n" + s.getContent(companyName)).join("\n\n");
}

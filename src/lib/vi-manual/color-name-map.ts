// Auto-generated from quality-check.ts COLOR_NAME_MAP
// Single source of truth for hex-to-Chinese-name mapping
// Used by: QC engine, DESIGN_DIRECTOR_PROMPT, prompt templates

export const COLOR_NAME_MAP: Record<string, string> = {
  "37474F": "深灰蓝",
  "2E7D32": "墨綠",
  "F9A825": "明黄",
  "C62828": "深红",
  "1565C0": "深蓝",
  "6A1B9A": "深紫",
  "1B5E20": "深綠",
  "BF360C": "深橙",
  "0D47A1": "藏蓝",
  "4A148C": "深紫罗兰",
  "880E4F": "深品红",
  "3E2723": "深棕",
  "263238": "深灰",
  "E65100": "橙色",
  "FF6F00": "琥珀",
  "F57F17": "金黄色",
  "827717": "橄榄綠",
  "33691E": "草綠",
  "00695C": "青綠",
  "00838F": "青色",
  "01579B": "天蓝",
  "283593": "酻蓝",
  "4E342E": "咖啡",
  "424242": "炭灰",
  "FF5722": "朱红",
  "E91E63": "玫红",
  "9C27B0": "紫色",
  "673AB7": "紫罗兰",
  "3F51B5": "酻青",
  "2196F3": "蓝色",
  "03A9F4": "浅蓝",
  "00BCD4": "湖蓝",
  "009688": "蓝綠",
  "4CAF50": "綠色",
  "8BC34A": "黄綠",
  "CDDC39": "酸橙",
  "FFC107": "琥珀黄",
  "FF9800": "橘黄",
  "795548": "棕色",
  "607D8B": "蓝灰",
  "B71C1C": "深红",
  "D32F2F": "红色",
  "F44336": "亮红",
  "1976D2": "蓝色",
  "388E3C": "綠色",
  "FBC02D": "明黄",
  "7B1FA2": "紫色",
  "E64A19": "深橙",
  "00796B": "深青綠",
  "5D4037": "深棕",
  "455A64": "蓝灰",
};

/** Generate a compact constraint string for injection into LLM prompts */
export function buildColorNameConstraint(): string {
  const entries = Object.entries(COLOR_NAME_MAP);
  return entries.map(([hex, name]) => `'#${hex}'='${name}'`).join(', ');
}

/**
 * Dirty Word Cleaner — auto-clean cross-industry contamination in AI-generated text
 *
 * M2.7: Hit forbidden words -> auto-replace -> mark as cleaned
 * M5.5: Called before material list generation to filter irrelevant items
 */

import { getIndustryIsolation, type IndustryIsolation } from "./category-dict";

export interface CleanResult {
  cleaned: boolean;
  original: string;
  cleanedText: string;
  replacedWords: string[];
}

/**
 * Clean cross-industry dirty words from AI-generated text.
 * Any matched forbidden word is replaced with "[已过滤]".
 */
export function cleanDirtyWords(
  text: string,
  industry: string,
  mainProducts?: string,
): CleanResult {
  const isolation = getIndustryIsolation(industry, mainProducts);
  const forbiddenWords = isolation.forbiddenWords;
  const replacedWords: string[] = [];
  let cleanedText = text;

  for (const word of forbiddenWords) {
    if (cleanedText.includes(word)) {
      // Replace with marker
      const regex = new RegExp(word, "g");
      const count = (cleanedText.match(regex) || []).length;
      cleanedText = cleanedText.replace(regex, "[已过滤]");
      replacedWords.push(word + "(" + count + "次)");
    }
  }

  return {
    cleaned: replacedWords.length > 0,
    original: text,
    cleanedText,
    replacedWords,
  };
}

/**
 * Filter material list against forbidden words.
 * Returns only materials that don't contain any forbidden word.
 */
export function filterMaterialsByIndustry(
  materials: string[],
  industry: string,
  mainProducts?: string,
): string[] {
  const isolation = getIndustryIsolation(industry, mainProducts);
  const forbiddenWords = isolation.forbiddenWords;

  return materials.filter((m) => {
    const lower = m.toLowerCase();
    return !forbiddenWords.some((fw) => lower.includes(fw.toLowerCase()));
  });
}
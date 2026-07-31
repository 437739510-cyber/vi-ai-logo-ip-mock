/**
 * Brand name normalization for VI manual generation.
 *
 * Only high-confidence fixes are applied so unrelated brand names are never rewritten.
 */
export function normalizeBrandName(name: string): string {
  if (typeof name !== "string") return "";
  return name
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/荼店/g, "奶茶店");
}

/**
 * 工单 065 回归：行业→家族映射收紧（fastfood/fresh_food→restaurant、
 * tea→beverage、nail/fashion→beauty），场景物件表按家族取，减少回退 general。
 * 纯静态+纯函数断言，不生成图、不调 API。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const workerSrc = readFileSync(path.join(root, "scripts/worker.mjs"), "utf8");

const checks: { name: string; pass: boolean; evidence: string }[] = [];
function check(name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}  | 证据: ${evidence}`);
}

check(
  "065-1 worker 含行业→家族映射函数 mascotSceneFamily",
  workerSrc.includes("function mascotSceneFamily(industryType)"),
  "mascotSceneFamily",
);
check(
  "065-2 fastfood/fresh_food → restaurant",
  workerSrc.includes('case "fastfood"') &&
    workerSrc.includes('case "fresh_food"') &&
    workerSrc.includes('return "restaurant";'),
  "fastfood/fresh_food→restaurant",
);
check(
  "065-3 tea → beverage",
  workerSrc.includes('case "tea"') && workerSrc.includes('return "beverage";'),
  "tea→beverage",
);
check(
  "065-4 nail/fashion → beauty",
  workerSrc.includes('case "nail"') &&
    workerSrc.includes('case "fashion"') &&
    workerSrc.includes('return "beauty";'),
  "nail/fashion→beauty",
);
check(
  "065-5 场景提示词按家族取物件（不再按原始行业直查）",
  workerSrc.includes("mascotSceneFamily(industryType)") &&
    workerSrc.includes("MASCOT_SCENE_OBJECTS[family]") &&
    !workerSrc.includes("MASCOT_SCENE_OBJECTS[industryType]"),
  "family 解析 + 物件表按 family",
);
check(
  "065-6 物件表五家族键齐全",
  ["beauty:", "restaurant:", "beverage:", "floral:", "general:"].every((k) => workerSrc.includes(k)),
  "beauty/restaurant/beverage/floral/general",
);
check(
  "065-7 丽人色板默认仍覆盖 nail/fashion",
  workerSrc.includes('industryType === "beauty" || industryType === "nail" || industryType === "fashion"'),
  "isBeautyLikeIndustry 覆盖 nail/fashion",
);

const failed = checks.filter((c) => !c.pass);
console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
if (failed.length) {
  for (const f of failed) console.log("FAILED:", f.name);
}
process.exit(failed.length ? 1 : 0);

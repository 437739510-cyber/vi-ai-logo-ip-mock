/**
 * 工单 068 回归：MASCOT_SCENE_RENDER 含“成年比例”正向描述（防偏 Q 版）。
 * 静态断言（不生成图）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = readFileSync(path.join(root, "scripts/worker.mjs"), "utf8");

const checks: { name: string; pass: boolean; evidence: string }[] = [];
function check(name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}  | 证据: ${evidence}`);
}

check("068-1 含 elegant adult proportions", src.includes("elegant adult proportions"), "MASCOT_SCENE_RENDER");
check("068-2 含 head-to-body ratio 1:4~1:5", src.includes("head-to-body ratio around 1:4 to 1:5"), "ratio 正向锁定");
check("068-3 含 slender mature female figure / elongated limbs", src.includes("slender mature female figure") && src.includes("elongated limbs"), "体型正向描述");
check("068-4 保留成熟体态/五官", src.includes("mature body proportions") && src.includes("clear facial features (eyes, nose, mouth visible)"), "不削弱既有要素");
check("068-5 storefront 物件为空白招牌（无文字）", src.includes("blank signboard above (no text, no letters)"), "B 类公仔场景不画文字招牌（防乱码）");

const failed = checks.filter((c) => !c.pass).length;
console.log(`=== 断言: ${checks.length - failed} passed, ${failed} failed | 退出码: ${failed ? 1 : 0} ===`);
process.exit(failed ? 1 : 0);

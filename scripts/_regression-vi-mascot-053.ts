// 工单 053 回归：00633 基准睁眼/不合掌 6 变体（a~f）
import { readFileSync } from "fs";

const workerSrc = readFileSync(new URL("../scripts/worker.mjs", import.meta.url), "utf8");
const start = workerSrc.indexOf("const mascot053Base");
const end = workerSrc.indexOf("const negativePrompt", start);
const block = workerSrc.slice(start, end);

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, ev = "") {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} | ${ev}`); }
}

check("053-1 6 个变体 a~f 且提示词互不相同", (() => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const prompts = ids.map((id) => {
    const m = block.match(new RegExp(`id: '${id}'[\\s\\S]*?prompt: \`([^\`]+)\``));
    return m ? m[1] : "";
  });
  return ids.every((id) => new RegExp(`id: '${id}'`).test(block)) &&
    prompts.every((p) => p.length > 20) && new Set(prompts).size === 6;
})());
check("053-2 睁眼微笑、无闭眼微笑", block.includes("睁眼微笑") && !block.includes("闭眼微笑"));
check("053-3 手势全部不合掌（无双手合十）", !block.includes("双手合十") &&
  ["一手轻抚胸前", "双手自然垂放身侧", "一手轻扶衣袖", "双手背于身后", "单手自然置于腹前", "一手轻搭腰间"]
    .every((g) => block.includes(g)));
check("053-4 保留 00633 质感（人类女性/无角无耳/玫瑰金色长发/暖米白长袍/玫瑰金镶边/周身散发微光/3D建模风格/Pixar品质/暖白渐变背景/商业级角色设计/全身立姿/成熟优雅成年女性比例）",
  ["人类女性", "无角无耳", "玫瑰金色长发", "暖米白长袍", "玫瑰金镶边", "周身散发微光", "3D建模风格", "Pixar品质", "暖白渐变背景", "商业级角色设计", "全身立姿", "成熟优雅成年女性比例"]
    .every((w) => block.includes(w)));
check("053-5 正面视角保留", block.includes("正面视角"));

console.log(`=== 断言: ${pass} passed, ${fail} failed | 退出码: ${fail ? 1 : 0} ===`);
process.exit(fail ? 1 : 0);

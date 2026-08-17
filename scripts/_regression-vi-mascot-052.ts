// 工单 052 回归：强正向替换策略（全正向中文描述，不用英文否定句；保留成熟比例）
import { readFileSync } from "fs";

const workerSrc = readFileSync(new URL("../scripts/worker.mjs", import.meta.url), "utf8");
const tplSrc = readFileSync(new URL("../src/lib/vi-manual/mascot-templates.ts", import.meta.url), "utf8");

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, ev = "") {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} | ${ev}`); }
}

const styleStart = workerSrc.indexOf("const mascot053Base");
const styleEnd = workerSrc.indexOf("const negativePrompt", styleStart);
const styleBlock = workerSrc.slice(styleStart, styleEnd);

check("052-1 强正向基底：人类女性/无角无耳/玫瑰金色长发/暖米白长袍/成熟优雅成年女性比例/正常成人头身比",
  ["人类女性", "无角无耳", "玫瑰金色长发", "暖米白长袍", "成熟优雅成年女性比例", "正常成人头身比"]
    .every((w) => styleBlock.includes(w)));
check("052-2 提示词无英文否定句（NOT/NO/without/avoid）",
  !/\bNOT\b|\bNO\b|\bwithout\b|\bavoid\b/i.test(styleBlock));
check("052-3 无鹿人/动物特征正向残留（鹿角鹿耳只出现在否定描述语境）",
  styleBlock.includes("无角无耳") && !/头顶一对优雅的鹿角|鹿耳从发间伸出|鹿人公仔/.test(styleBlock));
check("052-4 4 个变体正面提示词互不相同（a/b/c/d）", (() => {
  const ids = ["a", "b", "c", "d"];
  const prompts = ids.map((id) => {
    const m = styleBlock.match(new RegExp(`id: '${id}'[\\s\\S]*?prompt: \`([^\`]+)\``));
    return m ? m[1] : "";
  });
  return prompts.every((p) => p.length > 20) && new Set(prompts).size === 4;
})());
check("052-5 保留女神感/质感要素（微光/长袍/微笑/3D建模/Pixar/商业级角色设计/全身立姿）",
  ["周身散发微光", "暖米白长袍", "微笑", "3D建模风格", "Pixar品质", "商业级角色设计", "全身立姿"]
    .every((w) => styleBlock.includes(w)));
check("052-6 负向词保留标准项（CFG-free 下无效但字段保留）",
  workerSrc.includes("nsfw") && workerSrc.includes("low quality"));
check("052-7 手册比例模板为成熟比例（非 1:2.0）",
  tplSrc.includes("1:3.5") && !tplSrc.includes('headBodyRatio: "1:2.0"'));
check("052-8 手册比例说明无可爱默认方向",
  !/协调、可爱、易于记忆/.test(tplSrc) && tplSrc.includes("成熟体态"));

console.log(`=== 断言: ${pass} passed, ${fail} failed | 退出码: ${fail ? 1 : 0} ===`);
process.exit(fail ? 1 : 0);

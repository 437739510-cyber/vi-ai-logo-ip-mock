// 工单 051 v4 回归：圣洁女神款最小替换（成熟女神感/无动物/玫瑰金主/非Q版萌）
import { readFileSync } from "fs";

const workerSrc = readFileSync(new URL("../scripts/worker.mjs", import.meta.url), "utf8");
const tplSrc = readFileSync(new URL("../src/lib/vi-manual/mascot-templates.ts", import.meta.url), "utf8");

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, ev = "") {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} | ${ev}`); }
}

check("051-1 v4/052 基准提示词（圣洁女神公仔/无角无耳/成熟优雅成年女性比例）",
  workerSrc.includes("圣洁女神公仔") && workerSrc.includes("无角无耳") &&
  workerSrc.includes("成熟优雅成年女性比例"));
check("051-2 v4 负向词完整（chibi/big head/baby face/animal ears/antlers/deer/pink gradient）",
  ["chibi", "big head", "baby face", "kawaii", "cute", "Q-version", "animal ears", "antlers", "deer", "pink gradient"]
    .every((w) => workerSrc.includes(w)));
check("051-3 无旧萌系/鹿人原文残留（cute big eyes/super-deformed chibi/deer-human hybrid/鹿娘/粉白长袍）",
  !/cute big eyes|super-deformed chibi|deer-human hybrid|鹿娘|粉白长袍/.test(workerSrc));
check("051-4 4 个变体正面提示词互不相同（a/b/c/d）", (() => {
  const ids = ["a", "b", "c", "d"];
  const prompts = ids.map((id) => {
    const m = workerSrc.match(new RegExp(`id: '${id}'[\\s\\S]*?prompt: \`([^\`]+)\``));
    return m ? m[1] : "";
  });
  return prompts.every((p) => p.length > 20) && new Set(prompts).size === 4;
})());
check("051-5 保留女神感语义（微笑/周身散发微光/暖米白长袍/玫瑰金镶边）",
  workerSrc.includes("微笑") && workerSrc.includes("周身散发微光") &&
  workerSrc.includes("暖米白长袍") && workerSrc.includes("玫瑰金镶边"));
check("051-6 成熟公仔质感要素（3D建模风格/Pixar品质/柔光/商业级角色设计/全身立姿）",
  workerSrc.includes("3D建模风格") && workerSrc.includes("Pixar品质") &&
  workerSrc.includes("柔光") && workerSrc.includes("商业级角色设计") && workerSrc.includes("全身立姿"));
check("051-7 玫瑰金主色、去粉（玫瑰金为主/暖白渐变背景/负向词含 pink gradient、无粉白渐变）",
  workerSrc.includes("玫瑰金为主") && workerSrc.includes("暖白渐变背景") &&
  workerSrc.includes("pink gradient") && !/粉白渐变/.test(workerSrc));
check("051-8 手册比例模板为成熟比例（非 1:2.0）",
  tplSrc.includes("1:3.5") && !tplSrc.includes('headBodyRatio: "1:2.0"'));
check("051-9 手册比例说明无可爱默认方向",
  !/协调、可爱、易于记忆/.test(tplSrc) && tplSrc.includes("成熟体态"));

console.log(`=== 断言: ${pass} passed, ${fail} failed | 退出码: ${fail ? 1 : 0} ===`);
process.exit(fail ? 1 : 0);

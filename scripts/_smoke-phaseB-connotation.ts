/**
 * TICKET-144 Phase B 在线冒烟：品牌内涵推导链 + 结构化内涵字段（beverage + fitness）。
 *
 * 复用 worker 的 BRAND_ANALYSIS_SYSTEM / buildAnalysisPrompt / parseDeepSeekJSON；
 * 调用底座与 worker 的 callDeepSeek 一致（guardedDeepSeekCall，同一 billing guard）。
 * 只打印分析字段与断言结果，绝不打印/写任何 key/token/.env 值。
 *
 * 运行：npx --no-install tsx scripts/_smoke-phaseB-connotation.ts
 * 断言 a-d：
 *   a) 输出含 brandEssence/storyHook/symbolSystem/colorSystem/fontHierarchy/logoConcept；
 *   b) 每个 symbolSystem[].businessReason 非空；colorSystem[].meaning 非空；
 *      fontHierarchy.display/subhead/body 非空；
 *   c) 两行业 brandEssence 完全不同（不复读）；
 *   d) 原有 colorPalette 仍 3 个、sceneImageSuggestions 仍 5 条、
 *      logoDesignSuggestions.prompts 仍 4 条（兼容）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 加载 .env.local（仅注入 process.env，绝不打印任何值）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error("!! DEEPSEEK_API_KEY 未从 .env.local 加载");
  process.exit(2);
}

interface Fixture {
  label: string;
  clientInfo: any;
}

const fixtures: Fixture[] = [
  {
    label: "beverage 椰岛工坊(椰子水)",
    clientInfo: {
      companyName: "椰岛工坊",
      industry: "beverage",
      mainProducts: "椰子水",
      targetMarket: "健身人群+高端酒店",
      brandVision: "",
      coreValues: "",
      logoTextLanguage: "chinese",
    },
  },
  {
    label: "fitness 铁人健身",
    clientInfo: {
      companyName: "铁人健身",
      industry: "fitness",
      mainProducts: "健身私教/团课",
      targetMarket: "都市白领健身人群",
      brandVision: "",
      coreValues: "",
      logoTextLanguage: "chinese",
    },
  },
];

interface Check {
  name: string;
  pass: boolean;
  evidence: string;
}

const checks: Check[] = [];
function check(name: string, pass: boolean, evidence = "") {
  checks.push({ name, pass, evidence });
  if (!pass) process.exitCode = 1;
}
function nonEmptyStr(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

const REQUIRED_FIELDS = [
  "brandEssence",
  "storyHook",
  "symbolSystem",
  "colorSystem",
  "fontHierarchy",
  "logoConcept",
] as const;

interface AnalysisResult {
  content: string;
  finishReason?: string;
  usage?: any;
}

async function runAnalysis(system: string, clientInfo: any, projectId: string): Promise<AnalysisResult> {
  const { guardedDeepSeekCall } = await import("../src/lib/core/billing/deepseek-guard");
  const { buildAnalysisPrompt } = await import("./worker.mjs");
  const user = buildAnalysisPrompt(clientInfo);
  const resp = await guardedDeepSeekCall({
    route: "worker-brand-analysis",
    projectId,
    requestSummary: "PhaseB connotation smoke",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    body: {
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.5,
      max_tokens: 16384, // 推理模型 reasoning+content 计入预算；4096/8192 实测截断或 content 为空，16384 完整
    },
    timeoutMs: 120000,
  });
  if (!resp.ok) throw new Error(`DeepSeek API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    finishReason: data.choices?.[0]?.finish_reason,
    usage: data.usage,
  };
}

async function main() {
  const { BRAND_ANALYSIS_SYSTEM, parseDeepSeekJSON } = await import("./worker.mjs");
  const results: Record<string, any> = {};

  for (const { label, clientInfo } of fixtures) {
    console.log("\n================ " + label + " ================");
    const { content: raw, finishReason, usage } = await runAnalysis(BRAND_ANALYSIS_SYSTEM, clientInfo, "smoke-phaseB");
    console.log(`  调用诊断: finish_reason=${finishReason ?? "n/a"} usage.output_tokens=${usage?.completion_tokens ?? "n/a"} usage.total_tokens=${usage?.total_tokens ?? "n/a"} (不打印任何 key)`);
    let parsed: any = null;
    try {
      parsed = parseDeepSeekJSON(raw);
    } catch (e) {
      console.error("JSON parse fail:", String(e));
      console.error("RAW[截断]:", raw.slice(0, 300));
    }
    results[label] = parsed;

    // a) 输出含 6 个内涵字段（数组类非空数组 / 对象类存在 / 字符串类非空）
    const missing = REQUIRED_FIELDS.filter((f) => !(f in (parsed || {})));
    const aOk =
      parsed !== null &&
      REQUIRED_FIELDS.every((f) => {
        const v = parsed[f];
        if (Array.isArray(v)) return v.length > 0;
        if (v && typeof v === "object") return true;
        return nonEmptyStr(v);
      });
    check(`a) [${label}] 输出含 6 个内涵字段`, aOk, `missing=${missing.join(",") || "none"}`);

    // b) businessReason / meaning / display-subhead-body 非空
    const symOk =
      Array.isArray(parsed?.symbolSystem) &&
      parsed.symbolSystem.length > 0 &&
      parsed.symbolSystem.every((s: any) => nonEmptyStr(s?.businessReason));
    const colOk =
      Array.isArray(parsed?.colorSystem) &&
      parsed.colorSystem.length > 0 &&
      parsed.colorSystem.every((c: any) => nonEmptyStr(c?.meaning));
    const fontOk =
      parsed?.fontHierarchy &&
      nonEmptyStr(parsed.fontHierarchy.display) &&
      nonEmptyStr(parsed.fontHierarchy.subhead) &&
      nonEmptyStr(parsed.fontHierarchy.body);
    check(
      `b) [${label}] symbolSystem[].businessReason 全非空`,
      symOk,
      `symbols=${Array.isArray(parsed?.symbolSystem) ? parsed.symbolSystem.length : 0}`
    );
    check(
      `b) [${label}] colorSystem[].meaning 全非空`,
      colOk,
      `colors=${Array.isArray(parsed?.colorSystem) ? parsed.colorSystem.length : 0}`
    );
    check(
      `b) [${label}] fontHierarchy.display/subhead/body 非空`,
      fontOk,
      parsed?.fontHierarchy
        ? `display=${nonEmptyStr(parsed.fontHierarchy.display)} subhead=${nonEmptyStr(parsed.fontHierarchy.subhead)} body=${nonEmptyStr(parsed.fontHierarchy.body)}`
        : "fontHierarchy missing"
    );

    // d) 兼容：原字段形状不变
    const palOk = Array.isArray(parsed?.colorPalette) && parsed.colorPalette.length === 3;
    const sceneOk = Array.isArray(parsed?.sceneImageSuggestions) && parsed.sceneImageSuggestions.length === 5;
    const promptsOk =
      Array.isArray(parsed?.logoDesignSuggestions?.prompts) && parsed.logoDesignSuggestions.prompts.length === 4;
    check(`d) [${label}] colorPalette 仍 3 个`, palOk, `len=${Array.isArray(parsed?.colorPalette) ? parsed.colorPalette.length : "n/a"}`);
    check(
      `d) [${label}] sceneImageSuggestions 仍 5 条`,
      sceneOk,
      `len=${Array.isArray(parsed?.sceneImageSuggestions) ? parsed.sceneImageSuggestions.length : "n/a"}`
    );
    check(
      `d) [${label}] logoDesignSuggestions.prompts 仍 4 条`,
      promptsOk,
      `len=${Array.isArray(parsed?.logoDesignSuggestions?.prompts) ? parsed.logoDesignSuggestions.prompts.length : "n/a"}`
    );

    // 附带证据（不计入 a-d）：targetAudience / 版本号 / 颜色一致性
    const taOk =
      Array.isArray(parsed?.sceneImageSuggestions) &&
      parsed.sceneImageSuggestions.every((s: any) => nonEmptyStr(s?.targetAudience));
    console.log(`  附带: sceneImageSuggestions[].targetAudience 全非空=${taOk}`);
    console.log(`  附带: analysisTemplateVersion=${parsed?.analysisTemplateVersion ?? "(缺失)"}`);
    const paletteHexes = new Set((parsed?.colorPalette || []).map((c: any) => String(c?.hex || "").toUpperCase()));
    const colorSystemHexes = (parsed?.colorSystem || []).map((c: any) => String(c?.hex || "").toUpperCase());
    const consistent =
      colorSystemHexes.length > 0 && colorSystemHexes.every((h: string) => paletteHexes.has(h));
    console.log(
      `  附带: colorSystem hex 与 colorPalette 一致=${consistent} (${colorSystemHexes.join(",")} vs [${[...paletteHexes].join(",")}])`
    );
    console.log("--- 内涵字段样例 ---");
    console.log(`  brandEssence: ${parsed?.brandEssence ?? "(缺失)"}`);
    console.log(`  storyHook: ${parsed?.storyHook ?? "(缺失)"}`);
    console.log(`  symbolSystem: ${(parsed?.symbolSystem || []).map((s: any) => s?.symbol).join(" / ")}`);
    console.log(`  colorSystem: ${(parsed?.colorSystem || []).map((c: any) => `${c?.name} ${c?.hex}`).join(" / ")}`);
    console.log(
      `  fontHierarchy: display=${parsed?.fontHierarchy?.display} | subhead=${parsed?.fontHierarchy?.subhead} | body=${parsed?.fontHierarchy?.body}`
    );
    console.log(`  logoConcept: ${parsed?.logoConcept ?? "(缺失)"}`);
  }

  // c) 两行业 brandEssence 完全不同
  const bv = results[fixtures[0].label]?.brandEssence;
  const ft = results[fixtures[1].label]?.brandEssence;
  check(
    "c) 两行业 brandEssence 完全不同",
    nonEmptyStr(bv) && nonEmptyStr(ft) && bv !== ft,
    `beverage="${bv}" fitness="${ft}"`
  );

  console.log("\n=== 144 Phase B 内涵链冒烟 ===");
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.evidence ? `  | 证据: ${c.evidence}` : ""}`);
  }
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  console.log(`=== 断言: ${passed} passed, ${failed} failed | 退出码: ${process.exitCode ?? 0} ===`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("SMOKE ERROR:", e);
  process.exit(1);
});

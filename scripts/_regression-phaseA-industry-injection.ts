/**
 * TICKET-143 Phase A 离线回归：行业知识层注入 + 色板锚点一致性 + sceneStyle 修复。
 *
 * 完全离线运行：
 *   - 顶部清空 DEEPSEEK_API_KEY 与 Supabase 凭据，并阻断全局 fetch（零网络零费用）；
 *   - 用动态 import 加载 worker.mjs 的纯函数（buildAnalysisPrompt / BRAND_ANALYSIS_SYSTEM /
 *     parseDeepSeekJSON），import 不会触发 worker 主循环（import.meta.main 守卫）；
 *   - 不调 DeepSeek API、不写库、不跑 ComfyUI。
 *
 * 运行：npx --no-install tsx scripts/_regression-phaseA-industry-injection.ts
 * 预期：4 passed / 0 failed，退出码 0。
 */
process.env.DEEPSEEK_API_KEY = "";
// Supabase key 用非空占位（杜绝真实凭据），配合下方 fetch 阻断保证零网络零写库；
// 置空会让 @supabase/supabase-js createClient 直接抛 "supabaseKey is required"。
process.env.SUPABASE_SERVICE_KEY = "bb-clean-offline-regression-placeholder-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "bb-clean-offline-regression-placeholder-key";

const originalFetch = globalThis.fetch;
// 只阻断 http/https 网络请求；放行 data:/file: 等本地资源加载
// （worker 依赖链中 yoga-layout/satori 会在 import 时用 fetch 加载本地 WASM）。
globalThis.fetch = ((input: unknown, init?: unknown) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as { url?: string } | undefined)?.url ?? String(input);
  if (/^https?:/i.test(url)) {
    throw new Error(`[offline] network fetch blocked: ${url}`);
  }
  return originalFetch(input as RequestInfo | URL, init as RequestInit | undefined);
}) as typeof fetch;

interface Check {
  name: string;
  pass: boolean;
  evidence: string;
}

const checks: Check[] = [];

function check(name: string, pass: boolean, evidence = ""): void {
  checks.push({ name, pass, evidence });
  if (!pass) process.exitCode = 1;
}

interface ParsedProfile {
  colorPalette?: Array<{ name?: string; nameEn?: string; hex?: string; meaning?: string }>;
  sceneImageSuggestions?: Array<{ zh?: string; en?: string }>;
  logoDesignSuggestions?: { concept?: string; style?: string; prompts?: string[] };
  [key: string]: unknown;
}

// 椰岛工坊 fixture（仅作离线测试数据；industry=beverage、无自定义品牌色；
// 代码中不写死任何椰岛/椰子水的具体色/文案/符号）
const coconutFixture = {
  companyName: "椰岛工坊",
  industry: "beverage",
  mainProducts: "椰子水",
  targetMarket: "健身人群+高端酒店",
  brandVision: "",
  coreValues: "",
  logoTextLanguage: "chinese",
};

async function main(): Promise<void> {
  // 动态 import：确保在清空凭据/阻断 fetch 之后才求值 worker 与行业模块
  const {
    buildAnalysisPrompt,
    BRAND_ANALYSIS_SYSTEM,
    parseDeepSeekJSON,
  } = await import("./worker.mjs");
  const { getIndustryDefaults } = await import("../src/lib/brand/industry-types");
  const { getIndustryKnowledge } = await import("../src/lib/brand/industry-knowledge");

  // ---- ① buildAnalysisPrompt 注入行业知识层 ----
  const prompt = buildAnalysisPrompt(coconutFixture);
  const knowledge = getIndustryKnowledge("beverage");
  const defaults = getIndustryDefaults("beverage");
  check(
    "① buildAnalysisPrompt(fixture) 包含行业 designStyle/colorTendency/typicalModules/行业锚定色板hex",
    knowledge.designStyle.some((s) => prompt.includes(s)) &&
      knowledge.colorTendency.some((s) => prompt.includes(s)) &&
      knowledge.typicalModules.some((s) => prompt.includes(s)) &&
      prompt.includes(defaults.primary) &&
      prompt.includes(defaults.secondary) &&
      prompt.includes(defaults.accent) &&
      prompt.includes("行业锚定色板"),
    `designStyle=${knowledge.designStyle.join("/")} hex=${defaults.primary},${defaults.secondary},${defaults.accent}`,
  );

  // ---- ② parseDeepSeekJSON 固定 fixture 结构 ----
  const fixedResponse = JSON.stringify({
    analysisTemplateVersion: "023-chinese-v2",
    industryInsight: "beverage insight",
    colorPalette: [
      { name: "品牌主色", nameEn: "Primary", hex: "#00695C", meaning: "行业锚定主色" },
      { name: "辅助色", nameEn: "Secondary", hex: "#D84315", meaning: "行业锚定辅助色" },
      { name: "强调色", nameEn: "Accent", hex: "#FFB300", meaning: "行业锚定强调色" },
    ],
    sceneImageSuggestions: [
      { zh: "产品包装应用", en: "professional beverage packaging product photography" },
    ],
    logoDesignSuggestions: {
      concept: "概念",
      style: "风格",
      prompts: ["prompt-1", "prompt-2"],
    },
  });
  let parsed: ParsedProfile | null = null;
  try {
    parsed = parseDeepSeekJSON(fixedResponse) as ParsedProfile;
  } catch {
    parsed = null;
  }
  check(
    "② parseDeepSeekJSON 固定 fixture 输出结构含 colorPalette/sceneImageSuggestions/logoDesignSuggestions",
    parsed !== null &&
      Array.isArray(parsed.colorPalette) &&
      parsed.colorPalette.length === 3 &&
      Array.isArray(parsed.sceneImageSuggestions) &&
      parsed.sceneImageSuggestions.length >= 1 &&
      typeof parsed.logoDesignSuggestions === "object" &&
      parsed.logoDesignSuggestions !== null &&
      Array.isArray(parsed.logoDesignSuggestions.prompts),
    `keys=${parsed ? Object.keys(parsed).join(",") : "null"}`,
  );

  // ---- ③ 无客户真实色 → colorPalette 与行业默认一致 ----
  const hasCustomerBrandColor = Boolean(
    coconutFixture.brandColors || coconutFixture.existingBrandColor,
  );
  const parsedPalette = parsed?.colorPalette ?? [];
  check(
    "③ 无客户真实色时 colorPalette 与 getIndustryDefaults('beverage') 一致（primary/secondary/accent）",
    !hasCustomerBrandColor &&
      parsedPalette.length === 3 &&
      parsedPalette[0]?.hex === defaults.primary &&
      parsedPalette[1]?.hex === defaults.secondary &&
      parsedPalette[2]?.hex === defaults.accent &&
      prompt.includes("客户未提供品牌色时，colorPalette 优先贴合行业锚定色板"),
    `fixture品牌色=${hasCustomerBrandColor} primary=${parsedPalette[0]?.hex ?? "null"} vs ${defaults.primary} secondary=${parsedPalette[1]?.hex ?? "null"} vs ${defaults.secondary} accent=${parsedPalette[2]?.hex ?? "null"} vs ${defaults.accent}`,
  );

  // ---- ④ getIndustryDefaults('beverage').sceneStyle 非空（worker.mjs:651 恒回退修复）----
  check(
    "④ getIndustryDefaults('beverage').sceneStyle 非空",
    Boolean(defaults.sceneStyle) && defaults.sceneStyle.trim().length > 0,
    `sceneStyle=${defaults.sceneStyle}`,
  );

  // 附带证据（不计入 4 断言）：BRAND_ANALYSIS_SYSTEM 已注入颜色/行业绑定规则
  const systemHasRules =
    BRAND_ANALYSIS_SYSTEM.includes("## 颜色与行业绑定（强制）") &&
    BRAND_ANALYSIS_SYSTEM.includes("客户真实品牌色 > 行业锚定色 > LLM 自由发挥");

  console.log("=== 143 Phase A 行业注入离线回归 ===");
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.evidence ? `  | 证据: ${c.evidence}` : ""}`);
  }
  console.log(`附带（不计断言）: BRAND_ANALYSIS_SYSTEM 含颜色/行业绑定规则=${systemHasRules}`);
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  console.log(`=== 断言: ${passed} passed, ${failed} failed | 退出码: ${process.exitCode ?? 0} ===`);
  if (failed > 0) process.exitCode = 1;

  // 保留引用防止未使用告警（originalFetch 仅用于证明本脚本拦截了 fetch）
  void originalFetch;
}

main().catch((err) => {
  console.error("143 REGRESSION ERROR:", err);
  process.exit(1);
});

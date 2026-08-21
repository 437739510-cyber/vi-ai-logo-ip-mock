import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_DEEPSEEK_MODEL,
  calculateDeepSeekCost,
  getDeepSeekPrices,
  isDeepSeekPeakTime,
  normalizeDeepSeekResponseModel,
  resolveDeepSeekModel,
} from "../src/lib/core/billing/deepseek-pricing";
import { planPages, type PagePlannerInput } from "../src/lib/vi-manual/page-planner";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;

function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

function beijingTime(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 7, 19, hour - 8, minute));
}

function plannerInput(): PagePlannerInput {
  return {
    clientInfo: {
      companyName: "120离线回归品牌",
      brandVision: "可靠而清晰",
      coreValues: "节制 一致",
      targetMarket: "企业客户",
      industry: "专业服务",
    },
    wantMascot: "no",
    brandColors: {
      primary: { hex: "#123456", name: "深蓝" },
      secondary: { hex: "#789ABC", name: "浅蓝" },
      accent: { hex: "#F2C94C", name: "金色" },
    },
    assetAnalysis: {
      logo: { hasLogo: true, elements: ["盾牌"], meaning: "守护价值" },
    },
  };
}

async function main(): Promise<void> {
  const peak = beijingTime(10, 0);
  const offPeak = beijingTime(13, 0);

  test("V4-Flash 高峰与空闲三项单价", () => {
    assert.deepEqual(getDeepSeekPrices("deepseek-v4-flash", peak), {
      cacheHitInput: 0.1,
      cacheMissInput: 3,
      output: 9,
    });
    assert.deepEqual(getDeepSeekPrices("deepseek-v4-flash", offPeak), {
      cacheHitInput: 0.05,
      cacheMissInput: 1.5,
      output: 4.5,
    });
  });

  test("V4-Pro 高峰与空闲三项单价", () => {
    assert.deepEqual(getDeepSeekPrices("deepseek-v4-pro", peak), {
      cacheHitInput: 0.3,
      cacheMissInput: 9,
      output: 27,
    });
    assert.deepEqual(getDeepSeekPrices("deepseek-v4-pro", offPeak), {
      cacheHitInput: 0.15,
      cacheMissInput: 4.5,
      output: 13.5,
    });
  });

  test("缓存命中 token 不重复计入普通输入", () => {
    const result = calculateDeepSeekCost("deepseek-v4-flash", {
      promptTokens: 1000,
      cachedPromptTokens: 400,
      completionTokens: 200,
    }, peak);
    assert.equal(result.cacheMissPromptTokens, 600);
    assert.equal(result.cachedPromptTokens, 400);
    assert.equal(result.totalCostCny, 0.00364);
  });

  test("缓存 token 大于 prompt 时未命中输入钳制为零", () => {
    const result = calculateDeepSeekCost("deepseek-v4-flash", {
      promptTokens: 1000,
      cachedPromptTokens: 1400,
      completionTokens: 0,
    }, peak);
    assert.equal(result.cacheMissPromptTokens, 0);
  });

  test("北京时间高峰采用半开区间边界", () => {
    assert.equal(isDeepSeekPeakTime(beijingTime(9, 0)), true);
    assert.equal(isDeepSeekPeakTime(beijingTime(11, 59)), true);
    assert.equal(isDeepSeekPeakTime(beijingTime(12, 0)), false);
    assert.equal(isDeepSeekPeakTime(beijingTime(14, 0)), true);
    assert.equal(isDeepSeekPeakTime(beijingTime(17, 59)), true);
    assert.equal(isDeepSeekPeakTime(beijingTime(18, 0)), false);
  });

  test("默认模型为 V4-Flash，未知模型显式失败", () => {
    assert.equal(DEFAULT_DEEPSEEK_MODEL, "deepseek-v4-flash");
    assert.equal(resolveDeepSeekModel(undefined), "deepseek-v4-flash");
    assert.equal(resolveDeepSeekModel("deepseek-v4-pro"), "deepseek-v4-pro");
    assert.throws(() => resolveDeepSeekModel("deepseek-chat"), /Unsupported DeepSeek model/);
  });

  test("API 响应模型版本别名归一化，未知值安全回退并可观察", () => {
    assert.deepEqual(normalizeDeepSeekResponseModel(
      "deepseek-v4-flash",
      "deepseek-v4-pro"
    ), {
      model: "deepseek-v4-flash",
      observedModel: "deepseek-v4-flash",
      source: "exact",
    });
    assert.equal(
      normalizeDeepSeekResponseModel("deepseek-v4-flash-0731", "deepseek-v4-pro").model,
      "deepseek-v4-flash"
    );
    assert.equal(
      normalizeDeepSeekResponseModel("deepseek-v4-pro-20260819", "deepseek-v4-flash").model,
      "deepseek-v4-pro"
    );
    const fallback = normalizeDeepSeekResponseModel("future-model-x", "deepseek-v4-flash");
    assert.equal(fallback.model, "deepseek-v4-flash");
    assert.equal(fallback.source, "request-fallback");
    assert.match(fallback.warning || "", /future-model-x/);
  });

  const productionFiles = [
    "scripts/worker.mjs",
    "src/lib/core/billing/deepseek-guard.ts",
    "src/lib/core/billing/deepseek-pricing.ts",
    "src/lib/vi-manual/page-planner.ts",
    "src/lib/vi-manual/plan-layout-engine.ts",
  ];
  const productionText = productionFiles
    .map((relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8"))
    .join("\n");

  test("本单生产路径不再硬编码 deepseek-chat", () => {
    assert.equal(productionText.includes("deepseek-chat"), false);
  });

  test("Worker 品牌分析通过守卫并保留 Prompt/JSON 契约", () => {
    const worker = readFileSync(path.join(repoRoot, "scripts/worker.mjs"), "utf8");
    const callStart = worker.indexOf("async function callDeepSeek");
    const callEnd = worker.indexOf("function parseDeepSeekJSON", callStart);
    assert.ok(callStart >= 0 && callEnd > callStart);
    const callDeepSeekSource = worker.slice(callStart, callEnd);
    assert.match(worker, /guardedDeepSeekCall\s*\(\s*\{/);
    assert.match(worker, /route:\s*['"]worker-brand-analysis['"]/);
    assert.match(worker, /\{ role: ['"]system['"], content: systemPrompt \}/);
    assert.match(worker, /\{ role: ['"]user['"], content: userPrompt \}/);
    assert.match(worker, /max_tokens:\s*maxTokens/);
    assert.match(worker, /callDeepSeek\(BRAND_ANALYSIS_SYSTEM, analysisPrompt, 0\.7, 4096, projectId\)/);
    assert.equal((worker.match(/await callDeepSeek\(/g) || []).length, 1);
    assert.match(worker, /analysisProfile\s*=\s*parseDeepSeekJSON\(dsContent\)/);
    assert.doesNotMatch(callDeepSeekSource, /await fetch\(/);
  });

  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  const originalLayoutFlag = process.env.DEEPSEEK_AI_LAYOUT_ENABLED;
  const originalServiceKey = process.env.SUPABASE_SERVICE_KEY;
  let deepSeekRequests = 0;
  let unexpectedRequests = 0;
  const usageLogUpdates: Array<Record<string, unknown>> = [];

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://api.deepseek.com/")) {
      deepSeekRequests += 1;
      const requestBody = JSON.parse(String(init?.body || "{}")) as { model?: string };
      assert.equal(requestBody.model, "deepseek-v4-flash");
      return new Response(JSON.stringify({
        model: "deepseek-v4-flash-0731",
        usage: {
          prompt_tokens: 100,
          prompt_cache_hit_tokens: 40,
          completion_tokens: 20,
        },
        choices: [{
          message: {
            content: JSON.stringify([{
              type: "text",
              id: "ai-layout-marker",
              content: "AI布局仍可用",
              position: "center",
              widthPct: 30,
              heightPct: 10,
            }]),
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.startsWith("https://fzoscrutqhdfzwnjgjvs.supabase.co/")) {
      const method = init?.method || "GET";
      if (method === "PATCH") {
        usageLogUpdates.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
      }
      const payload = method === "GET" ? [] : method === "POST" ? { id: 120 } : [];
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Range": "0-0/0",
        },
      });
    }
    unexpectedRequests += 1;
    throw new Error(`Unexpected network target in offline regression: ${url}`);
  };

  try {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.DEEPSEEK_AI_LAYOUT_ENABLED;
    deepSeekRequests = 0;
    const deterministicBlueprints = await planPages(plannerInput());

    await testAsync("默认关闭 AI 布局且仍生成合法 Blueprint", async () => {
      assert.equal(deepSeekRequests, 0);
      assert.ok(deterministicBlueprints.length > 0);
      for (const pageId of ["cover", "logo-interpretation", "summary"]) {
        const page = deterministicBlueprints.find((item) => item.pageId === pageId);
        assert.ok(page);
        assert.ok(page.elements.length > 0);
        assert.equal(page.elements.some((element) => element.id === "ai-layout-marker"), false);
      }
    });

    process.env.DEEPSEEK_API_KEY = "offline-regression-placeholder";
    process.env.DEEPSEEK_AI_LAYOUT_ENABLED = "1";
    deepSeekRequests = 0;
    usageLogUpdates.length = 0;
    const aiBlueprints = await planPages(plannerInput());

    await testAsync("显式开关为 1 时三页 AI 布局能力仍保留且仅命中本地 stub", async () => {
      assert.equal(deepSeekRequests, 3);
      for (const pageId of ["cover", "logo-interpretation", "summary"]) {
        const page = aiBlueprints.find((item) => item.pageId === pageId);
        assert.ok(page);
        assert.equal(page.elements.some((element) => element.id === "ai-layout-marker"), true);
      }
      assert.equal(usageLogUpdates.length, 3);
      for (const update of usageLogUpdates) {
        assert.equal(update.model, "deepseek-v4-flash");
        assert.equal(update.input_tokens, 100);
        assert.equal(update.output_tokens, 20);
        assert.equal(typeof update.cost_cny, "number");
        assert.ok(Number(update.cost_cny) > 0);
      }
      assert.equal(unexpectedRequests, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
    if (originalLayoutFlag === undefined) delete process.env.DEEPSEEK_AI_LAYOUT_ENABLED;
    else process.env.DEEPSEEK_AI_LAYOUT_ENABLED = originalLayoutFlag;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_KEY;
    else process.env.SUPABASE_SERVICE_KEY = originalServiceKey;
  }

  console.log(`\nPASS: ${passed} DeepSeek cost guard assertions; external network calls: 0`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

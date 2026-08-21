import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inferGeoContext } from "../src/lib/brand/geo-context";
import { enhanceBrandPositioning } from "../src/lib/brand/brand-positioning-enhancer";
import { detectCompanyScale } from "../src/lib/brand/company-scale";

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

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

async function main(): Promise<void> {
  const geoSource = source("src/lib/brand/geo-context.ts");
  const positioningSource = source("src/lib/brand/brand-positioning-enhancer.ts");
  const scaleSource = source("src/lib/brand/company-scale.ts");
  const combinedSource = [geoSource, positioningSource, scaleSource].join("\n");

  test("三个生产文件无旧模型名和裸 DeepSeek URL", () => {
    assert.equal(combinedSource.includes("deepseek-chat"), false);
    assert.equal(combinedSource.includes("https://api.deepseek.com/chat/completions"), false);
  });

  test("三处使用统一模型真源，geo/positioning 使用独立守卫 route", () => {
    for (const text of [geoSource, positioningSource, scaleSource]) {
      assert.match(text, /DEEPSEEK_MODEL/);
      assert.match(text, /guardedDeepSeekCall/);
    }
    assert.match(geoSource, /route:\s*"brand\/geo-context"/);
    assert.match(geoSource, /projectId,/);
    assert.match(positioningSource, /route:\s*"brand\/positioning-enhancer"/);
  });

  test("Prompt 参数、JSON 契约与原超时保持", () => {
    assert.match(geoSource, /8个维度的深度洞察/);
    assert.match(geoSource, /temperature:\s*0\.3/);
    // TICKET-122-R12：v4-flash 推理链曾占满 1200 token 致 finish=length 空响应
    // （inferred=false 稳定回归）；根因修复为 max_tokens=4096 + 超时 120000。
    assert.match(geoSource, /max_tokens:\s*4096/);
    assert.match(geoSource, /response_format:\s*\{ type: "json_object" \}/);
    assert.match(geoSource, /timeoutMs:\s*120000/);
    assert.match(positioningSource, /一句话，不超过30字/);
    assert.match(positioningSource, /temperature:\s*0\.5/);
    assert.match(positioningSource, /max_tokens:\s*300/);
    assert.match(positioningSource, /response_format:\s*\{ type: "json_object" \}/);
    assert.match(positioningSource, /timeoutMs:\s*8000/);
    assert.match(scaleSource, /temperature:\s*0\.1/);
    assert.match(scaleSource, /max_tokens:\s*200/);
    assert.match(scaleSource, /timeoutMs:\s*8000/);
  });

  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  const originalServiceKey = process.env.SUPABASE_SERVICE_KEY;
  let externalRequests = 0;

  try {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.SUPABASE_SERVICE_KEY;
    let cacheMode: "hit" | "miss" = "hit";
    let stubbedSupabaseRequests = 0;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://fzoscrutqhdfzwnjgjvs.supabase.co/") && url.includes("knowledge_cache")) {
        stubbedSupabaseRequests += 1;
        if (cacheMode === "hit") {
          return new Response(JSON.stringify({
            dimensions: { geography: { region: "缓存区域" } },
            summary_cn: "缓存洞察",
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ message: "not found" }), {
          status: 406,
          headers: { "Content-Type": "application/json" },
        });
      }
      externalRequests += 1;
      throw new Error(`Unexpected request without credentials: ${url}`);
    };

    await testAsync("无 key 时 geo 先读缓存：hit 保留 inferred，miss 才返回 EMPTY", async () => {
      const cachedGeo = await inferGeoContext({
        companyName: "缓存命中品牌",
        city: "缓存城市",
        industry: "专业服务",
      });
      assert.equal(cachedGeo.inferred, true);
      assert.equal(cachedGeo.region, "缓存区域");

      cacheMode = "miss";
      const emptyGeo = await inferGeoContext({
        companyName: "缓存未命中品牌",
        city: "未命中城市",
        industry: "专业服务",
      });
      assert.equal(emptyGeo.inferred, false);
      assert.ok(stubbedSupabaseRequests >= 2);
      assert.equal(externalRequests, 0);
    });

    await testAsync("清空凭据时 positioning/company-scale 保持 fallback 且无实际外网", async () => {
      const positioning = await enhanceBrandPositioning({
        companyName: "离线测试品牌",
        industry: "专业服务",
        brandType: "企业品牌",
        brandPersona: ["可靠"],
      });
      assert.deepEqual(positioning, {
        positioning: "",
        enhanced: false,
        rationale: "No API key",
      });

      const scale = await detectCompanyScale("离线测试品牌", "专业服务");
      assert.equal(scale.scale, "micro");
      assert.equal(externalRequests, 0);
    });

    process.env.DEEPSEEK_API_KEY = "offline-regression-placeholder";
    const deepSeekBodies: Array<Record<string, unknown>> = [];
    const usageRoutes: string[] = [];
    externalRequests = 0;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://api.deepseek.com/")) {
        const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        deepSeekBodies.push(body);
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const systemMessage = messages.find((message) => {
          if (typeof message !== "object" || message === null) return false;
          return (message as { role?: unknown }).role === "system";
        }) as { content?: unknown } | undefined;
        const isGeo = String(systemMessage?.content || "").includes("8个维度");
        const content = isGeo
          ? JSON.stringify({
              region: "测试区域",
              geoInsight: "测试洞察",
              colorHint: "测试色彩",
              materialHint: "测试物料",
              culturalSymbols: ["测试符号"],
              positioningAnchor: "测试锚点",
              dimensions: { geography: { region: "测试区域" } },
              inferred: true,
            })
          : JSON.stringify({ positioning: "测试定位", rationale: "测试理由" });
        return new Response(JSON.stringify({
          model: "deepseek-v4-flash-0731",
          usage: {
            prompt_tokens: 100,
            prompt_cache_hit_tokens: 20,
            completion_tokens: 30,
          },
          choices: [{ message: { content } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.startsWith("https://fzoscrutqhdfzwnjgjvs.supabase.co/")) {
        const method = init?.method || "GET";
        if (url.includes("api_usage_log") && method === "POST") {
          const body = JSON.parse(String(init?.body || "{}")) as { route?: string };
          if (body.route) usageRoutes.push(body.route);
          return new Response(JSON.stringify({ id: 121 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("knowledge_cache") && method === "GET") {
          return new Response(JSON.stringify({ message: "not found" }), {
            status: 406,
            headers: { "Content-Type": "application/json" },
          });
        }
        const payload = method === "GET" ? [] : [];
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Range": "0-0/0",
          },
        });
      }

      externalRequests += 1;
      throw new Error(`Unexpected network target in offline regression: ${url}`);
    };

    await testAsync("geo 与 positioning 经守卫发送 V4-Flash 且仅命中本地 stub", async () => {
      const geo = await inferGeoContext({
        companyName: "守卫测试品牌",
        city: "测试市",
        industry: "专业服务",
        projectId: "project-121",
      });
      assert.equal(geo.inferred, true);

      const positioning = await enhanceBrandPositioning({
        companyName: "守卫测试品牌",
        industry: "专业服务",
        brandType: "企业品牌",
        brandPersona: ["可靠"],
        geoContext: geo,
      });
      assert.equal(positioning.enhanced, true);
      assert.equal(positioning.positioning, "测试定位");

      assert.equal(deepSeekBodies.length, 2);
      for (const body of deepSeekBodies) {
        assert.equal(body.model, "deepseek-v4-flash");
      }
      assert.deepEqual(usageRoutes.sort(), [
        "brand/geo-context",
        "brand/positioning-enhancer",
      ]);
      assert.equal(externalRequests, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_KEY;
    else process.env.SUPABASE_SERVICE_KEY = originalServiceKey;
  }

  console.log(`\nPASS: ${passed} DeepSeek brand agent guard assertions; external network calls: 0`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

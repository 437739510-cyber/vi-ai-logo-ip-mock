/**
 * TICKET-122-R12 回归：
 *  - 默认：离线 stub（不联网、不写生产）验证 geo-context 解析语义（大输出正常、
 *    length/空响应 fail-closed）、R10 门地理矛盾分支拦截、网络隔离；
 *  - --real：虚构客户真实 geo 推断（清丽洗车·山西太原），断言 inferred=true、
 *    geoInsight 非空、finishReason≠length，费用经记录落盘 logs/122-r12/。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { inferGeoContext } from "../src/lib/brand/geo-context";
import { runPromptGateWithAutoFix, buildGateRules } from "../src/lib/prompt-gate";

const ROOT = path.resolve(process.cwd());
const R12 = path.join(ROOT, "logs", "122-r12");
const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
const ok = (name: string, cond: boolean, detail = "") => {
  checks.push({ name, pass: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
};

function makeStubFetch(geoScenario: "ok-big" | "length-empty") {
  const counters = { deepseek: 0, supabase: 0, blocked: 0 };
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("supabase.co")) {
      counters.supabase += 1;
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("api.deepseek.com")) {
      counters.deepseek += 1;
      const body = JSON.parse(String(init?.body || "{}"));
      const user = String(body.messages?.[1]?.content || "");
      const isGate = user.includes("【待检提示词】");
      const content = isGate
        ? JSON.stringify({ pass: false, ruleId: "geo-contradiction", reason: "海南椰汁出现雪景（地理矛盾）", fixSuggestion: "删除雪景改为热带海景" })
        : geoScenario === "ok-big"
          ? JSON.stringify({ region: "山西太原", geoInsight: "北方社区洗车依赖熟客信任与冬季盐渍清洁", colorHint: "深青绿", dimensions: { geography: { region: "山西太原" } }, inferred: true })
          : "";
      return new Response(JSON.stringify({
        model: "deepseek-v4-flash",
        choices: [{ finish_reason: geoScenario === "ok-big" ? "stop" : "length", message: { content } }],
        usage: { prompt_tokens: 500, completion_tokens: geoScenario === "ok-big" ? 900 : 4096, prompt_cache_hit_tokens: 0 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    counters.blocked += 1;
    throw new Error(`BLOCKED ${url}`);
  }) as typeof fetch;
  return { counters, restore: () => { globalThis.fetch = orig; } };
}

async function offlineTests() {
  process.env.DEEPSEEK_API_KEY = "stub-deepseek";

  const okBig = makeStubFetch("ok-big");
  const geo1 = await inferGeoContext({ companyName: "清丽洗车", mainProducts: "标准洗车", city: "太原市小店区", industry: "汽车清洁养护", projectId: "TEST-122-R12-OFFLINE-OK" });
  ok("geo 解析：大输出正常 → inferred=true 且含洞察", geo1.inferred === true && String(geo1.geoInsight || "").length > 0, `inferred=${geo1.inferred}`);
  ok("geo 网络隔离：仅 DeepSeek + supabase stub，无其它外部", okBig.counters.blocked === 0 && okBig.counters.deepseek >= 1, `blocked=${okBig.counters.blocked} ds=${okBig.counters.deepseek}`);
  okBig.restore();

  const lenEmpty = makeStubFetch("length-empty");
  const geo2 = await inferGeoContext({ companyName: "清丽洗车", mainProducts: "标准洗车", city: "太原市小店区", industry: "汽车清洁养护", projectId: "TEST-122-R12-OFFLINE-LEN" });
  ok("geo fail-closed：finish=length/空正文 → inferred=false 不猜不编", geo2.inferred === false, `inferred=${geo2.inferred}`);
  lenEmpty.restore();

  // R10 门地理矛盾分支：海南椰汁 + 雪景 → 拦截并记录（geoInferredFalse=false）
  const gateStub = makeStubFetch("ok-big");
  const gateOut = await runPromptGateWithAutoFix({
    prompt: "海南椰汁热带包装，背景出现雪景",
    industryFamily: "饮品", category: "椰汁", brandName: "清椰", palette: ["#1FA68D"],
    mascotIntent: "no", sceneKeys: ["packaging-1"], province: "海南省", city: "海口市",
    geoContext: { inferred: true, geoInsight: "海南热带气候，椰林海岸" },
    rules: buildGateRules({ industryFamily: "饮品", mascotIntent: "no", sceneKeys: ["packaging-1"] }),
    ticketCode: "TEST-122-R12",
  }, {
    transport: globalThis.fetch,
    logRoot: path.join(R12, "gate-test"),
    reporter: () => {},
  });
  ok("R10 门地理矛盾：海南椰汁+雪景 → 拦截并记录", gateOut.final === "needs_review" && gateOut.blockedRecords.length >= 1 && gateOut.blockedRecords[0].ruleId === "geo-contradiction", `final=${gateOut.final} ruleId=${gateOut.blockedRecords[0]?.ruleId}`);
  ok("门记录 geoInferredFalse=false（geo 已推断）", gateOut.blockedRecords[0]?.geoInferredFalse === false, `geoInferredFalse=${gateOut.blockedRecords[0]?.geoInferredFalse}`);
  gateStub.restore();

  delete process.env.DEEPSEEK_API_KEY;
}

async function realMode() {
  await fs.mkdir(R12, { recursive: true });
  const records: any[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("supabase.co")) {
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("api.deepseek.com")) {
      const started = Date.now();
      const response = await orig(input, init);
      const text = await response.clone().text();
      let body: any = null;
      try { body = JSON.parse(text); } catch { /* keep null */ }
      records.push({
        model: body?.model || null,
        httpStatus: response.status,
        finishReason: body?.choices?.[0]?.finish_reason || null,
        contentLength: String(body?.choices?.[0]?.message?.content || "").length,
        usage: body?.usage || null,
        latencyMs: Date.now() - started,
      });
      return response;
    }
    throw new Error(`BLOCKED ${url}`);
  }) as typeof fetch;

  const geo = await inferGeoContext({
    companyName: "清丽洗车",
    mainProducts: "标准洗车、内饰深度清洁、漆面打蜡养护、冬季融雪剂/盐渍清洁",
    city: "太原市小店区",
    industry: "汽车清洁养护",
    projectId: "TEST-122-R12-REAL",
  });
  globalThis.fetch = orig;

  ok("real: geo 推断 inferred=true", geo.inferred === true, `inferred=${geo.inferred}`);
  ok("real: 含地理洞察且 finishReason≠length", String(geo.geoInsight || "").length > 0 && records.every((r) => r.finishReason !== "length"), `insightLen=${String(geo.geoInsight || "").length} finishes=${records.map((r) => r.finishReason).join(",")}`);
  const file = path.join(R12, "deepseek-attempts.json");
  const existing = await fs.readFile(file, "utf8").then((t) => JSON.parse(t)).catch(() => ({ ticket: "TICKET-122-R12", attempts: [] }));
  existing.attempts.push(...records);
  existing.updatedAt = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(existing, null, 2));
  ok("real: 费用/token/模型/finish 已落盘", records.length >= 1 && existing.attempts.length >= 1, file);
}

async function main() {
  if (process.argv.includes("--real")) {
    await realMode();
  } else {
    await offlineTests();
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`RESULT ${passCount}/${checks.length} passed`);
  if (passCount !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

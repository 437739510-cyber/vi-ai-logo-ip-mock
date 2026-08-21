/** TICKET-122-R4 Phase 0: real planLayoutEngine contract, zero external I/O. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = "D:/disk/HermesDisk/bb-clean";
const OUT = path.join(ROOT, "logs/122-r4/layout-nonthinking-regression.json");
const DEEPSEEK_ORIGIN = "https://api.deepseek.com";
const DEEPSEEK_PATH = "/v1/chat/completions";
const SUPABASE_ORIGIN = "https://fzoscrutqhdfzwnjgjvs.supabase.co";
const originalFetch = globalThis.fetch;

const assertions: Array<{ name: string; pass: boolean; detail?: unknown }> = [];
const requestSummaries: any[] = [];
const branchResults: any[] = [];
const protocolEvents: any[] = [];
let deepseekMockCalls = 0;
let deepseekExternalCalls = 0;
let supabaseStubCalls = 0;
let otherExternalCalls = 0;
let blockedCalls = 0;
let internalResourceCalls = 0;

function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function check(name: string, pass: boolean, detail?: unknown): void {
  assertions.push({ name, pass, detail });
  if (!pass) throw new Error(`ASSERTION_FAILED:${name}`);
}

function exactDeepSeek(url: URL): boolean {
  return url.protocol === "https:" && url.hostname === "api.deepseek.com" && url.port === "" &&
    url.pathname === DEEPSEEK_PATH && url.search === "" && url.hash === "";
}

function chatResponse(content: unknown, finishReason = "stop"): Response {
  return new Response(JSON.stringify({
    model: "deepseek-v4-flash",
    choices: [{ finish_reason: finishReason, message: { role: "assistant", content, reasoning_content: null } }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 100, completion_tokens_details: { reasoning_tokens: 0 } },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

const responseQueue: Array<() => Response> = [
  () => chatResponse(JSON.stringify([
    { type: "logo", id: "logo-main", position: "center", widthPct: 30, heightPct: 30 },
    { type: "text", id: "company-name", content: "百疗萃养生馆", position: "center", fontSize: 42 },
  ])),
  () => chatResponse("[]"),
  () => chatResponse(""),
  () => chatResponse(null),
  () => chatResponse("{broken-json"),
  () => new Response(JSON.stringify({ error: { message: "phase0 mock rejection" } }), { status: 429, headers: { "Content-Type": "application/json" } }),
];

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (raw.startsWith("data:") || raw.startsWith("blob:")) {
    const scheme = raw.startsWith("data:") ? "data:" : "blob:";
    internalResourceCalls += 1;
    protocolEvents.push({ scheme, classification: "internal-resource", method, originalFetch: true });
    return originalFetch(input as any, init);
  }
  let url: URL;
  try { url = new URL(raw); } catch {
    blockedCalls += 1;
    protocolEvents.push({ scheme: "invalid", classification: "blocked", method, originalFetch: false });
    throw new Error("PHASE0_BLOCK:invalid-url");
  }
  if (url.origin === SUPABASE_ORIGIN && url.pathname === "/rest/v1/api_usage_log") {
    if (!["GET", "POST", "PATCH"].includes(method)) throw new Error(`PHASE0_SUPABASE_METHOD:${method}`);
    supabaseStubCalls += 1;
    protocolEvents.push({ scheme: "https:", classification: "supabase-local-stub", method, origin: url.origin, path: url.pathname, originalFetch: false });
    const body = method === "POST" ? "[{\"id\":1}]" : "[]";
    return new Response(body, { status: method === "POST" ? 201 : 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" } });
  }
  if (exactDeepSeek(url)) {
    deepseekMockCalls += 1;
    const rawBody = typeof init?.body === "string" ? init.body : "";
    const body = JSON.parse(rawBody);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userContent = String(messages.find((item: any) => item?.role === "user")?.content || "");
    requestSummaries.push({
      model: body.model,
      thinkingType: body.thinking?.type,
      maxTokens: body.max_tokens,
      temperature: body.temperature,
      messageCount: messages.length,
      messageRoles: messages.map((item: any) => item?.role),
      userMentionsPageId: userContent.includes('"cover"'),
      systemSha256: sha256(String(messages.find((item: any) => item?.role === "system")?.content || "")),
      userSha256: sha256(userContent),
      completePromptRecorded: false,
    });
    const next = responseQueue.shift();
    if (!next) throw new Error("PHASE0_RESPONSE_QUEUE_EMPTY");
    protocolEvents.push({ scheme: "https:", classification: "deepseek-in-process-mock", method, origin: url.origin, path: url.pathname, originalFetch: false });
    return next();
  }
  if (url.protocol === "http:" || url.protocol === "https:") otherExternalCalls += 1;
  blockedCalls += 1;
  protocolEvents.push({ scheme: url.protocol, classification: "blocked", method, origin: url.origin, path: url.pathname, originalFetch: false });
  throw new Error(`PHASE0_BLOCK:${url.protocol}`);
}) as typeof fetch;

async function main(): Promise<void> {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const keys = ["DEEPSEEK_API_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ARK_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "TOKENHUB_API_KEY"];
  const old = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) process.env[key] = "";
  // Non-secret sentinel allows the production guard to reach the in-process DeepSeek mock.
  process.env.DEEPSEEK_API_KEY = "ticket-122-r4-phase0-local-mock";
  process.env.DEEPSEEK_MODEL = "deepseek-v4-flash";
  try {
    const { planLayoutEngine } = await import("../src/lib/vi-manual/plan-layout-engine");
    const params = {
      pageId: "cover",
      companyName: "百疗萃养生馆",
      industry: "美业",
      brandVision: "让每一次到访都成为焕发自信的疗愈之旅。",
      coreValues: "专业呵护,传统智慧,温馨亲民",
      targetMarket: "25-45岁都市女性",
      brandColors: { primary: { hex: "#B76E79" }, secondary: { hex: "#D4AF7A" }, accent: { hex: "#E8C4A0" } },
      hasLogo: true,
      hasMascot: true,
      mascotName: "萃瑶",
      logoElements: ["水滴", "叶片"],
      logoMeaning: "滋养渗透、自然生机、健康养护",
    };
    const cases = ["valid-nonempty", "empty-array", "empty-content", "null-content", "broken-json", "http-non-200"];
    for (const name of cases) {
      const result = await planLayoutEngine(params);
      branchResults.push({ name, result });
    }

    const byName = Object.fromEntries(branchResults.map((item) => [item.name, item.result]));
    check("valid nonempty succeeds", byName["valid-nonempty"].success === true && byName["valid-nonempty"].count === 2 && byName["valid-nonempty"].elements.length === 2, byName["valid-nonempty"]);
    check("empty array is explicit failure", byName["empty-array"].success === false && byName["empty-array"].count === 0 && byName["empty-array"].error === "AI_LAYOUT_EMPTY", byName["empty-array"]);
    check("empty content is not success", byName["empty-content"].success === false && byName["empty-content"].count === 0, byName["empty-content"]);
    check("null content is not success", byName["null-content"].success === false && byName["null-content"].count === 0, byName["null-content"]);
    check("broken JSON is not success", byName["broken-json"].success === false && byName["broken-json"].error === "Failed to parse AI layout", byName["broken-json"]);
    check("HTTP non-200 is not success", byName["http-non-200"].success === false && String(byName["http-non-200"].error).includes("DeepSeek error: 429"), byName["http-non-200"]);
    check("all real request bodies captured", requestSummaries.length === cases.length, { captured: requestSummaries.length });
    check("model remains V4-Flash", requestSummaries.every((item) => item.model === "deepseek-v4-flash"));
    check("thinking is disabled by production request", requestSummaries.every((item) => item.thinkingType === "disabled"));
    check("max_tokens unchanged", requestSummaries.every((item) => item.maxTokens === 4096));
    check("temperature unchanged", requestSummaries.every((item) => item.temperature === 0.7));
    check("messages and pageId come from real function", requestSummaries.every((item) => item.messageCount === 2 && item.messageRoles.join(",") === "system,user" && item.userMentionsPageId));
    check("DeepSeek real external calls zero", deepseekExternalCalls === 0, { deepseekExternalCalls });
    check("other HTTP(S) real external calls zero", otherExternalCalls === 0, { otherExternalCalls });
    check("blocked unexpected calls zero", blockedCalls === 0, { blockedCalls });
    check("all six calls used in-process mock", deepseekMockCalls === 6 && responseQueue.length === 0, { deepseekMockCalls, remainingResponses: responseQueue.length });
  } finally {
    for (const [key, value] of old) value === undefined ? delete process.env[key] : process.env[key] = value;
  }

  const output = {
    ticket: "TICKET-122-R4",
    phase: 0,
    pass: assertions.every((item) => item.pass),
    generatedAt: new Date().toISOString(),
    counts: { deepseekMockCalls, deepseekExternalCalls, supabaseStubCalls, otherExternalCalls, blockedCalls, internalResourceCalls, productionWrites: 0, storageCalls: 0, orderCalls: 0 },
    assertions,
    requestSummaries,
    branchResults,
    protocolEvents,
    credentialValuesRecorded: false,
  };
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify({ pass: output.pass, output: OUT, counts: output.counts }, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ ticket: "TICKET-122-R4", phase: 0, pass: false, error: message, counts: { deepseekMockCalls, deepseekExternalCalls, supabaseStubCalls, otherExternalCalls, blockedCalls, internalResourceCalls }, assertions, requestSummaries, branchResults, protocolEvents, credentialValuesRecorded: false }, null, 2), "utf8");
  console.error(JSON.stringify({ pass: false, error: message, output: OUT }, null, 2));
  process.exitCode = 1;
}).finally(() => {
  globalThis.fetch = originalFetch;
});

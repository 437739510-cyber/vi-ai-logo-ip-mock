/** TICKET-122-R3 Phase 0: completely offline network-gate regression. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = "D:/disk/HermesDisk/bb-clean";
const OUT = path.join(ROOT, "logs/122-r3/network-gate-regression.json");
const DEEPSEEK = "https://api.deepseek.com/v1/chat/completions";
const SUPABASE_ORIGIN = "https://fzoscrutqhdfzwnjgjvs.supabase.co";
const originalFetch = globalThis.fetch;

type EventRow = {
  scheme: string;
  classification: string;
  method: string;
  internalResource: boolean;
  originalFetchCalled: boolean;
  blocked: boolean;
  detail?: Record<string, unknown>;
};

const events: EventRow[] = [];
const assertions: Array<{ name: string; pass: boolean; detail?: unknown }> = [];
let internalOriginalFetchCalls = 0;
let externalOriginalFetchCalls = 0;
let deepseekCalls = 0;
let supabaseStubCalls = 0;
let blockedNetworkRequests = 0;

function sha256(data: crypto.BinaryLike): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function addAssertion(name: string, pass: boolean, detail?: unknown): void {
  assertions.push({ name, pass, detail });
  if (!pass) throw new Error(`ASSERTION_FAILED:${name}`);
}

function safeUrlInfo(raw: string): { scheme: string; mediaType?: string } {
  if (raw.startsWith("data:")) {
    return { scheme: "data:", mediaType: raw.slice(5, raw.indexOf(";") > 0 ? raw.indexOf(";") : raw.indexOf(",")) };
  }
  try { return { scheme: new URL(raw).protocol }; } catch { return { scheme: "invalid" }; }
}

function exactDeepSeek(url: URL): boolean {
  return url.protocol === "https:" &&
    url.hostname === "api.deepseek.com" &&
    url.port === "" &&
    url.pathname === "/v1/chat/completions" &&
    url.search === "" &&
    url.hash === "";
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const info = safeUrlInfo(raw);

  if (info.scheme === "data:" || info.scheme === "blob:") {
    internalOriginalFetchCalls += 1;
    events.push({ scheme: info.scheme, classification: "internal-resource", method, internalResource: true, originalFetchCalled: true, blocked: false, detail: info.mediaType ? { mediaType: info.mediaType } : undefined });
    return originalFetch(input as any, init);
  }

  let parsed: URL;
  try { parsed = new URL(raw); } catch {
    blockedNetworkRequests += 1;
    events.push({ scheme: "invalid", classification: "blocked-unknown-protocol", method, internalResource: false, originalFetchCalled: false, blocked: true });
    throw new Error("NETWORK_GATE_BLOCK:invalid-url");
  }

  if (parsed.origin === SUPABASE_ORIGIN && parsed.pathname === "/rest/v1/api_usage_log") {
    if (!["GET", "POST", "PATCH"].includes(method)) throw new Error(`SUPABASE_STUB_METHOD_BLOCK:${method}`);
    supabaseStubCalls += 1;
    events.push({ scheme: "https:", classification: "supabase-local-stub", method, internalResource: false, originalFetchCalled: false, blocked: false, detail: { origin: parsed.origin, path: parsed.pathname } });
    const body = method === "POST" ? "[{\"id\":1}]" : "[]";
    return new Response(body, { status: method === "POST" ? 201 : 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" } });
  }

  if (exactDeepSeek(parsed)) {
    deepseekCalls += 1;
    throw new Error("PHASE0_DEEPSEEK_FORBIDDEN");
  }

  blockedNetworkRequests += 1;
  events.push({ scheme: parsed.protocol, classification: parsed.protocol === "http:" || parsed.protocol === "https:" ? "blocked-http" : "blocked-other-protocol", method, internalResource: false, originalFetchCalled: false, blocked: true, detail: { origin: parsed.origin, path: parsed.pathname } });
  throw new Error(`NETWORK_GATE_BLOCK:${parsed.protocol}`);
}) as typeof fetch;

async function expectBlocked(url: string): Promise<void> {
  let blocked = false;
  try { await fetch(url); } catch { blocked = true; }
  addAssertion(`blocked:${safeUrlInfo(url).scheme}`, blocked);
}

async function main(): Promise<void> {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const wasmUrl = "data:application/wasm;base64,AGFzbQEAAAA=";
  const wasmResponse = await fetch(wasmUrl);
  const wasmBytes = Buffer.from(await wasmResponse.arrayBuffer());
  const wasmModule = await WebAssembly.compile(wasmBytes);
  addAssertion("data wasm fetched as 8 bytes", wasmBytes.length === 8, { bytes: wasmBytes.length, sha256: sha256(wasmBytes) });
  addAssertion("data wasm compiled", wasmModule instanceof WebAssembly.Module);

  const blobSource = Buffer.from("ticket-122-r3-blob-smoke", "utf8");
  const blobUrl = URL.createObjectURL(new Blob([blobSource]));
  try {
    const blobBytes = Buffer.from(await (await fetch(blobUrl)).arrayBuffer());
    addAssertion("blob bytes identical", blobBytes.equals(blobSource), { bytes: blobBytes.length, sha256: sha256(blobBytes) });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  for (const method of ["GET", "POST", "PATCH"]) {
    const response = await fetch(`${SUPABASE_ORIGIN}/rest/v1/api_usage_log?phase=0`, { method });
    addAssertion(`supabase ${method} locally stubbed`, response.ok && response.status === (method === "POST" ? 201 : 200), { status: response.status });
  }

  await expectBlocked("https://phase0-block.invalid/probe");
  await expectBlocked("file:///D:/phase0-block.txt");

  const savedKeys = new Map<string, string | undefined>();
  for (const key of ["DEEPSEEK_API_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ARK_API_KEY", "OPENAI_API_KEY"]) {
    savedKeys.set(key, process.env[key]);
    process.env[key] = "";
  }
  process.env.DEEPSEEK_AI_LAYOUT_ENABLED = "0";
  try {
    const [{ planPages }, { renderPptxToBuffer }, pricing] = await Promise.all([
      import("../src/lib/vi-manual/page-planner"),
      import("../src/lib/pptx/render-pptx"),
      import("../src/lib/core/billing/deepseek-pricing"),
    ]);
    addAssertion("R3 modules imported", typeof planPages === "function" && typeof renderPptxToBuffer === "function" && typeof pricing.calculateDeepSeekCost === "function");
    const blueprints = await planPages({
      clientInfo: { companyName: "百疗萃养生馆", brandVision: "离线回归", coreValues: "专业", targetMarket: "本地", industry: "美业" },
      formalBrandName: "百疗萃养生馆",
      templateId: `__TICKET_122_R3_PHASE0_${Date.now()}__`,
      pageIds: ["cover"],
      brandColors: { primary: { hex: "#B76E79" }, secondary: { hex: "#D4AF7A" }, accent: { hex: "#E8C4A0" } },
      wantMascot: "no",
      assetAnalysis: { logo: { hasLogo: false }, mascot: { hasMascot: false } },
    } as any);
    const pptx = await renderPptxToBuffer(blueprints, { companyName: "百疗萃养生馆", industry: "美业", brandColors: { primary: "#B76E79", secondary: "#D4AF7A", accent: "#E8C4A0" }, compressImages: false });
    addAssertion("deterministic B real-module render", blueprints.length === 1 && pptx.length > 1_000, { pages: blueprints.length, bytes: pptx.length, sha256: sha256(pptx) });
  } finally {
    for (const [key, value] of savedKeys) value === undefined ? delete process.env[key] : process.env[key] = value;
  }

  addAssertion("DeepSeek calls are zero", deepseekCalls === 0, { deepseekCalls });
  addAssertion("external originalFetch calls are zero", externalOriginalFetchCalls === 0, { externalOriginalFetchCalls });
  addAssertion("Supabase stub calls exact", supabaseStubCalls === 3, { supabaseStubCalls });
  addAssertion("internal resources are not blocked", events.filter((e) => e.internalResource).every((e) => !e.blocked), { internalOriginalFetchCalls });
  addAssertion("blocked count exact", blockedNetworkRequests === 2, { blockedNetworkRequests });

  const output = {
    ticket: "TICKET-122-R3",
    phase: 0,
    pass: assertions.every((item) => item.pass),
    generatedAt: new Date().toISOString(),
    counts: { deepseekCalls, supabaseStubCalls, internalOriginalFetchCalls, externalOriginalFetchCalls, blockedNetworkRequests },
    assertions,
    events,
    credentialValuesRecorded: false,
  };
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify({ pass: output.pass, output: OUT, counts: output.counts }, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ ticket: "TICKET-122-R3", phase: 0, pass: false, error: message, counts: { deepseekCalls, supabaseStubCalls, internalOriginalFetchCalls, externalOriginalFetchCalls, blockedNetworkRequests }, assertions, events, credentialValuesRecorded: false }, null, 2), "utf8");
  console.error(JSON.stringify({ pass: false, error: message, output: OUT }, null, 2));
  process.exitCode = 1;
}).finally(() => {
  globalThis.fetch = originalFetch;
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routePath = "src/app/api/ai/generate-manual-pages-stream/route.ts";
const source = readFileSync(routePath, "utf8");
const handlerStart = source.indexOf("export async function POST");
const handler = source.slice(handlerStart);
const retiredReturn = handler.indexOf("return Response.json(");
let assertions = 0;

function check(value: unknown, message: string): asserts value {
  assert.ok(value, message);
  assertions += 1;
}

function present(pattern: RegExp, text: string, message: string) {
  assert.match(text, pattern, message);
  assertions += 1;
}

function absent(pattern: RegExp, text: string, message: string) {
  assert.doesNotMatch(text, pattern, message);
  assertions += 1;
}

async function main() {
  check(handlerStart >= 0, "POST handler exists");
  check(retiredReturn >= 0, "retired response exists in POST");
  present(/^export async function POST\(req: Request\) \{\s*return Response\.json\(/, handler, "410 return is first executable POST behavior");
  present(/code:\s*"LEGACY_MANUAL_PAGES_STREAM_DISABLED"/, handler, "fixed retirement code is returned");
  present(/\{ status: 410 \}/, handler, "HTTP 410 is returned");
  present(/旧网页 PNG 手册生成已停用/, handler, "message accurately retires old PNG manual");
  present(/本地 Worker 生成 PPTX/, handler, "message points to local Worker PPTX delivery");

  const beforeReturn = handler.slice(0, retiredReturn);
  absent(/req\.json|process\.env|ReadableStream|guardedDeepSeekCall|arkGenerate|DASHSCOPE|supabase|storage|sharp|writeFile|readFile|mkdir|fetch\s*\(/i, beforeReturn, "nothing executes before retirement return");

  for (const marker of [
    "req.json()",
    "process.env.ALIYUN_API_KEY",
    "new ReadableStream",
    "generateDesignDecision(",
    "generateRealPhotos(",
    "assemblePage(",
    "writeFile(dataPath",
  ]) {
    const index = handler.indexOf(marker);
    check(index > retiredReturn, `${marker} remains unreachable after 410`);
  }

  absent(/LEGACY_MANUAL_PAGES_STREAM_(?:ENABLED|EMERGENCY)|BB_.*MANUAL.*STREAM|emergency/i, handler.slice(0, handler.indexOf("req.json()")), "retirement has no recovery switch");
  absent(/PDF|线上生图/, handler.slice(retiredReturn, handler.indexOf("req.json()")), "customer message promises neither PDF nor online generation");

  present(/async function generateDesignDecision/, source, "old DeepSeek helper remains for historical context");
  present(/async function generateSinglePhoto/, source, "old photo helper remains for historical context");
  present(/async function assemblePage/, source, "old page assembly helper remains for historical context");
  check(source.split(/\r?\n/).length > 700, "legacy route was not broadly deleted");

  const oldFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("network access attempted"); }) as typeof fetch;
  try {
    const { POST } = await import("../src/app/api/ai/generate-manual-pages-stream/route");
    const request = new Proxy({} as Request, {
      get() { throw new Error("request body or property accessed"); },
    });
    const response = await POST(request);
    assert.equal(response.status, 410);
    assertions += 1;
    const payload = await response.json() as { error?: unknown; code?: unknown };
    assert.deepEqual(payload, {
      error: "旧网页 PNG 手册生成已停用，正式交付由本地 Worker 生成 PPTX。",
      code: "LEGACY_MANUAL_PAGES_STREAM_DISABLED",
    });
    assertions += 1;
  } finally {
    globalThis.fetch = oldFetch;
  }

  absent(/@ts-ignore|@ts-nocheck/, source, "no TypeScript suppression added");
  console.log(`TICKET-081-C regression: ${assertions} assertions passed`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "081-C regression failed");
  process.exitCode = 1;
});

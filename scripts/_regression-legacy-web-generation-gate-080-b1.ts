import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAdminSession } from "../src/lib/core/admin-session";
import {
  LEGACY_WEB_GENERATION_CLOSED_MESSAGE,
  checkLegacyWebGenerationGate,
} from "../src/lib/core/legacy-web-generation-gate";

const secret = "offline-b1-session-secret-at-least-32-characters";
const now = 2_000_000_000;

function requestWith(token?: string, legacyCookies = false) {
  return {
    cookies: {
      get(name: string) {
        if (name === "bb_admin_session" && token) return { value: token };
        if (legacyCookies && ["admin_auth", "admin_role", "admin_user_id"].includes(name)) return { value: "legacy" };
        return undefined;
      },
    },
  };
}

async function main() {
  const adminToken = await createAdminSession("admin", "admin", { secret, nowSeconds: now });
  const studentToken = await createAdminSession("student", "student-1", { secret, nowSeconds: now });
  assert.ok(adminToken);
  assert.ok(studentToken);

  const disabled = await checkLegacyWebGenerationGate(requestWith(adminToken), { sessionSecret: secret, nowSeconds: now });
  assert.equal(disabled.allowed, false);
  assert.equal(disabled.allowed ? "" : disabled.message, LEGACY_WEB_GENERATION_CLOSED_MESSAGE);

  for (const [legacyEnabled, emergencyLocalGeneration] of [
    ["1", undefined], [undefined, "1"], ["true", "1"], ["1", "true"],
    ["TRUE", "1"], ["1", "TRUE"], ["0", "1"], ["1", "0"], ["", "1"], ["1", ""],
  ] as const) {
    const result = await checkLegacyWebGenerationGate(requestWith(adminToken), {
      legacyEnabled, emergencyLocalGeneration, sessionSecret: secret, nowSeconds: now,
    });
    assert.equal(result.allowed, false, `${legacyEnabled}/${emergencyLocalGeneration}`);
  }

  const enabledOptions = { legacyEnabled: "1", emergencyLocalGeneration: "1", sessionSecret: secret, nowSeconds: now };
  assert.equal((await checkLegacyWebGenerationGate(requestWith(), enabledOptions)).allowed, false);
  assert.equal((await checkLegacyWebGenerationGate(requestWith(undefined, true), enabledOptions)).allowed, false);
  assert.equal((await checkLegacyWebGenerationGate(requestWith(studentToken), enabledOptions)).allowed, false);
  assert.equal((await checkLegacyWebGenerationGate(requestWith(`${adminToken}x`), enabledOptions)).allowed, false);
  const allowed = await checkLegacyWebGenerationGate(requestWith(adminToken), enabledOptions);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.allowed ? allowed.session.role : null, "admin");

  const rejected = await checkLegacyWebGenerationGate(requestWith(), enabledOptions);
  const rejectionText = JSON.stringify(rejected);
  for (const forbidden of [secret, "bb_admin_session", "BB_LEGACY_WEB_GENERATION_ENABLED", "BB_EMERGENCY_LOCAL_GENERATION", "provider", "Supabase"]) {
    assert.equal(rejectionText.includes(forbidden), false, forbidden);
  }

  const routePaths = [
    "src/app/api/ai/generate-logo/route.ts",
    "src/app/api/ai/generate-mascot/route.ts",
    "src/app/api/ai/generate-mascot-samples/route.ts",
    "src/app/api/ai/generate-full-mascot/route.ts",
    "src/app/api/ai/generate-manual-pptx/route.ts",
  ];
  for (const routePath of routePaths) {
    const source = readFileSync(routePath, "utf8");
    const handler = source.slice(source.indexOf("export async function POST"));
    const gateIndex = handler.indexOf("await checkLegacyWebGenerationGate(req)");
    assert.ok(gateIndex >= 0, routePath);
    assert.ok(gateIndex < handler.indexOf("req.json()"), `${routePath}: request body`);
    for (const sideEffect of ["supabaseAdmin", "getDefaultRegistry()", "guardedDeepSeekCall(", ".storage", "performGeneration("]) {
      const index = handler.indexOf(sideEffect);
      if (index >= 0) assert.ok(gateIndex < index, `${routePath}: ${sideEffect}`);
    }
    assert.match(handler.slice(0, handler.indexOf("try")), /if \(!gate\.allowed\) return NextResponse\.json/);
  }

  const gateSource = readFileSync("src/lib/core/legacy-web-generation-gate.ts", "utf8");
  assert.match(gateSource, /legacyEnabled !== "1" \|\| emergencyLocalGeneration !== "1"/);
  assert.match(gateSource, /verifyAdminSession/);
  assert.match(gateSource, /session\?\.role !== "admin"/);
  assert.doesNotMatch(gateSource, /admin_auth|admin_role|admin_user_id/);
  assert.doesNotMatch(gateSource, /request\.(headers|url)|searchParams|query|body/);
  assert.doesNotMatch([gateSource, ...routePaths.map((path) => readFileSync(path, "utf8"))].join("\n"), /@ts-ignore|@ts-nocheck/);

  console.log("TICKET-080-B1 regression: 58 assertions passed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "080-B1 regression failed");
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  adminSessionCookieOptions,
  createAdminSession,
  verifyAdminSession,
} from "../src/lib/core/admin-session";

const secret = "offline-test-secret-with-at-least-32-characters";
const now = 2_000_000_000;
const encoder = new TextEncoder();

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signPayload(payload: Record<string, unknown>): Promise<string> {
  const encoded = encode(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encoded));
  return `${encoded}.${encode(new Uint8Array(signature))}`;
}

async function main() {
const adminToken = await createAdminSession("admin", "admin", { secret, nowSeconds: now });
const studentToken = await createAdminSession("student", "student-1", { secret, nowSeconds: now, ttlSeconds: 3600 });
assert.ok(adminToken);
assert.ok(studentToken);
assert.deepEqual(await verifyAdminSession(adminToken, { secret, nowSeconds: now }), {
  version: 1, role: "admin", userId: "admin", issuedAt: now, expiresAt: now + ADMIN_SESSION_MAX_AGE_SECONDS,
});
assert.equal((await verifyAdminSession(studentToken, { secret, nowSeconds: now }))?.role, "student");

const [payloadPart, signaturePart] = adminToken.split(".");
assert.equal(await verifyAdminSession(`${payloadPart.slice(0, -1)}A.${signaturePart}`, { secret, nowSeconds: now }), null);
assert.equal(await verifyAdminSession(`${payloadPart}.${signaturePart.slice(0, -1)}A`, { secret, nowSeconds: now }), null);
assert.equal(await verifyAdminSession(adminToken, { secret: `${secret}-wrong`, nowSeconds: now }), null);
assert.equal(await verifyAdminSession(undefined, { secret, nowSeconds: now }), null);

for (const payload of [
  { version: 2, role: "admin", userId: "admin", issuedAt: now, expiresAt: now + 60 },
  { version: 1, role: "owner", userId: "admin", issuedAt: now, expiresAt: now + 60 },
  { version: 1, role: "admin", userId: "", issuedAt: now, expiresAt: now + 60 },
  { version: 1, role: "admin", userId: "admin", issuedAt: now - 120, expiresAt: now - 1 },
  { version: 1, role: "admin", userId: "admin", issuedAt: now + 61, expiresAt: now + 120 },
  { version: 1, role: "admin", userId: "admin", issuedAt: now, expiresAt: now + ADMIN_SESSION_MAX_AGE_SECONDS + 1 },
]) assert.equal(await verifyAdminSession(await signPayload(payload), { secret, nowSeconds: now }), null);

assert.equal(await createAdminSession("admin", "admin", { secret: "too-short", nowSeconds: now }), null);
assert.equal(await verifyAdminSession(adminToken, { secret: "too-short", nowSeconds: now }), null);
assert.equal(await createAdminSession("admin", "admin", { nowSeconds: now }), null);
assert.equal(await createAdminSession("admin", "", { secret, nowSeconds: now }), null);
assert.equal(await createAdminSession("admin", "admin", { secret, nowSeconds: now, ttlSeconds: ADMIN_SESSION_MAX_AGE_SECONDS + 1 }), null);

const cookieOptions = adminSessionCookieOptions();
assert.equal(ADMIN_SESSION_COOKIE, "bb_admin_session");
assert.equal(cookieOptions.httpOnly, true);
assert.equal(cookieOptions.sameSite, "lax");
assert.equal(cookieOptions.path, "/");
assert.ok(cookieOptions.maxAge <= 8 * 60 * 60);

const files = {
  session: readFileSync("src/lib/core/admin-session.ts", "utf8"),
  middleware: readFileSync("src/middleware.ts", "utf8"),
  layout: readFileSync("src/components/shared/AdminLayout.tsx", "utf8"),
  login: readFileSync("src/app/api/admin/login/route.ts", "utf8"),
  me: readFileSync("src/app/api/admin/me/route.ts", "utf8"),
  clients: readFileSync("src/app/api/admin/clients/route.ts", "utf8"),
  contents: readFileSync("src/app/api/admin/my-contents/route.ts", "utf8"),
  generate: readFileSync("src/app/api/admin/generate-for-client/route.ts", "utf8"),
  paid: readFileSync("src/app/api/admin/mark-paid/route.ts", "utf8"),
  studentGenerate: readFileSync("src/app/api/admin/student-generate/route.ts", "utf8"),
  studentUpload: readFileSync("src/app/api/admin/student-upload/route.ts", "utf8"),
  projectAuth: readFileSync("src/lib/core/project-write-auth.ts", "utf8"),
  selectLogo: readFileSync("src/app/api/ai/select-logo/route.ts", "utf8"),
  saveMascot: readFileSync("src/app/api/ai/save-mascot-preference/route.ts", "utf8"),
};

assert.doesNotMatch(files.session, /node:crypto|\bBuffer\b/);
assert.match(files.session, /crypto\.subtle\.sign/);
assert.match(files.session, /crypto\.subtle\.verify/);
assert.match(files.session, /process\.env\.ADMIN_SESSION_SECRET/);
assert.doesNotMatch(files.session, /ADMIN_PASSWORD/);
assert.match(files.session, /secure: process\.env\.NODE_ENV === "production"/);
assert.match(files.middleware, /await verifyAdminSession/);
assert.match(files.middleware, /session\.role === "student"/);
assert.doesNotMatch(files.middleware, /admin_auth|admin_role|admin_user_id/);
assert.match(files.layout, /fetch\("\/api\/admin\/login", \{ method: "DELETE" \}\)/);
assert.match(files.layout, /response\.ok \|\| response\.status === 401/);
assert.doesNotMatch(files.layout, /document\.cookie/);
assert.match(files.login, /cookies\.set\(ADMIN_SESSION_COOKIE, token/);
assert.match(files.login, /cookies\.set\(ADMIN_SESSION_COOKIE, ""/);

for (const [name, source] of Object.entries(files)) {
  if (name !== "login") assert.doesNotMatch(source, /["']admin_auth["']|["']admin_role["']|["']admin_user_id["']/, name);
}
for (const source of [files.me, files.clients, files.contents, files.generate, files.paid, files.studentGenerate, files.studentUpload, files.projectAuth]) {
  assert.match(source, /verifyAdminSession/);
}
assert.match(files.paid, /session\?\.role !== "admin"/);
for (const source of [files.contents, files.generate, files.studentGenerate, files.studentUpload]) {
  assert.match(source, /session\?\.role !== "student"/);
}
assert.match(files.selectLogo, /await hasCompatibleAdminCookies\(req\)/);
assert.match(files.saveMascot, /await hasCompatibleAdminCookies\(req\)/);
assert.doesNotMatch(Object.values(files).join("\n"), /@ts-ignore|@ts-nocheck/);

console.log("TICKET-080-A-R1 regression: 57 assertions passed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "080-A-R1 regression failed");
  process.exitCode = 1;
});

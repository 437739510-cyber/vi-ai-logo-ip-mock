import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authorizeProjectCustomer,
  getProjectLogoCandidates,
  isSafeProjectAssetUrl,
  normalizeProjectWriteCredentials,
  resolveDeliverableMascotSample,
  resolveProjectLogoCandidate,
  type ProjectWriteProject,
} from "../src/lib/core/project-write-auth";

const asset = (bucket: string, path: string) => `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`;
const clientInfo = {
  viewPassword: "safe-pass",
  generationStatus: "logo_generated",
  paidAt: "preserved",
  unrelated: { keep: true },
  brandProfile: { logoGenerationResults: [{ index: 0, imageUrl: asset("generated", "p1/current.png") }] },
  logoGenerationStatus: { results: [{ index: 1, imageUrl: asset("generated", "p1/fallback.png") }] },
  logoHistory: [{ round: 1, logos: [{ index: 0, imageUrl: asset("generated", "p1/history.png") }] }],
  mascotSamples: [
    { id: "a", imageUrl: asset("generated", "p1/a.png"), status: "passed", vision: { status: "passed" } },
    { id: "b", imageUrl: asset("generated", "p1/b.png"), status: "needs_review" },
    { id: "c", imageUrl: "http://127.0.0.1/c.png", status: "passed" },
  ],
};
const project: ProjectWriteProject = { id: "p1", submission_id: "s1", status: "paid", client_info: clientInfo };

assert.deepEqual(normalizeProjectWriteCredentials({ phone: " 13800000000 ", viewPassword: " safe-pass " }), {
  phone: "13800000000", viewPassword: "safe-pass",
});
assert.equal(authorizeProjectCustomer(project, "13800000000", { phone: "13800000000", viewPassword: "safe-pass" }), true);
assert.equal(authorizeProjectCustomer(project, "13900000000", { phone: "13800000000", viewPassword: "safe-pass" }), false);
assert.equal(authorizeProjectCustomer(project, "13800000000", { phone: "13800000000", viewPassword: "wrong" }), false);
assert.equal(authorizeProjectCustomer(project, "13800000000", { phone: "", viewPassword: "" }), false);

for (const unsafe of [
  "data:image/png;base64,abc", "file:///tmp/a.png", "http://localhost/a.png",
  "http://127.0.0.1/a.png", "https://10.0.0.1/a.png", "https://example.com/a.png",
]) assert.equal(isSafeProjectAssetUrl(unsafe), false, unsafe);
assert.equal(isSafeProjectAssetUrl(asset("generated", "p1/logo.png")), true);

assert.equal(getProjectLogoCandidates(clientInfo).length, 3);
assert.equal(resolveProjectLogoCandidate(clientInfo, 1)?.imageUrl, asset("generated", "p1/fallback.png"));
assert.equal(resolveProjectLogoCandidate(clientInfo, 0), null, "duplicate indexes require URL consistency");
assert.equal(resolveProjectLogoCandidate(clientInfo, 0, asset("generated", "p1/history.png"))?.imageUrl, asset("generated", "p1/history.png"));
assert.equal(resolveProjectLogoCandidate(clientInfo, 0, "https://example.com/foreign.png"), null);
assert.equal(resolveProjectLogoCandidate(clientInfo, 99), null);

assert.equal(resolveDeliverableMascotSample(clientInfo, "a")?.id, "a");
assert.equal(resolveDeliverableMascotSample(clientInfo, "b"), null);
assert.equal(resolveDeliverableMascotSample(clientInfo, "c"), null);
assert.equal(resolveDeliverableMascotSample(clientInfo, "d"), null);

const selectRoute = readFileSync("src/app/api/ai/select-logo/route.ts", "utf8");
const mascotRoute = readFileSync("src/app/api/ai/save-mascot-preference/route.ts", "utf8");
const viewPage = readFileSync("src/app/(client)/view/page.tsx", "utf8");
const mascotSection = readFileSync("src/components/client/MascotSection.tsx", "utf8");
const helper = readFileSync("src/lib/core/project-write-auth.ts", "utf8");

for (const source of [selectRoute, mascotRoute]) {
  assert.match(source, /hasCompatibleAdminCookies\(req\)/);
  assert.match(source, /authorizeProjectCustomer/);
  assert.match(source, /\.eq\("status", project\.status\)/);
  assert.match(source, /\.eq\("client_info->>generationStatus"/);
  assert.match(source, /if \(!updated\?\.length\).*status: 409/);
}
assert.ok(selectRoute.indexOf("hasCompatibleAdminCookies(req)") < selectRoute.indexOf("aiScoreLogos(candidates"));
assert.doesNotMatch(selectRoute, /fetch\(candidate|fetch\(selected|storage\s*\.from/);
assert.match(selectRoute, /autoSelect && !isAdmin/);
assert.match(selectRoute, /project\.status !== "logo_generated" \|\| clientInfo\.generationStatus !== "logo_generated"/);
assert.match(mascotRoute, /mascot_generated: "mascot_generated"/);
assert.match(mascotRoute, /mascot_samples_ready: "mascot_samples_ready"/);
assert.match(viewPage, /phone: phone\.trim\(\),[\s\S]*viewPassword: viewPassword\.trim\(\),[\s\S]*logoImageUrl/);
assert.match(viewPage, /phone=\{phone\.trim\(\)\}[\s\S]*viewPassword=\{viewPassword\.trim\(\)\}/);
assert.match(mascotSection, /JSON\.stringify\(\{ projectId, selectedSampleId: id, phone, viewPassword \}\)/);
assert.doesNotMatch([selectRoute, mascotRoute, helper].join("\n"), /\bany\b|@ts-ignore|@ts-nocheck/);
assert.match(selectRoute, /\.\.\.clientInfo/);
assert.match(mascotRoute, /\.\.\.clientInfo/);

console.log("TICKET-079 regression: 32 assertions passed");

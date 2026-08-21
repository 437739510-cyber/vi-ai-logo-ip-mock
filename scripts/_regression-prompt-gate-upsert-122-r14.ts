/**
 * TICKET-122-R14 回归（离线，除 --dna 外零网络）：
 *  1. upsert stub/no-I/O：字段映射（无客户原文/密钥）、失败不抛错；
 *  2. writeBlockedRecord upsert 接线（stub client 计数 + 本地文件仍写）；
 *  3. 迁移 SQL 字段断言；4. admin 导航入口；5. .env.local 开关；
 *  6. 后台只读接口双源逻辑（源码断言）+ 表读取映射（stub）。
 *  --dna：generate-manual-pptx DNA 真实冒烟（虚构清丽洗车，断言 atlas 5 键可被
 *  fillScenePrompts 消费，费用记录 logs/122-r14/）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import { sanitizeBlock } from "../src/lib/prompt-gate/admin-reader";
import { upsertPromptGateBlock, readPromptGateBlocksFromTable } from "../src/lib/prompt-gate/upsert";
import { writeBlockedRecord } from "../src/lib/prompt-gate";

const ROOT = path.resolve(process.cwd());
const R14 = path.join(ROOT, "logs", "122-r14");
const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
const ok = (name: string, cond: boolean, detail = "") => {
  checks.push({ name, pass: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
};

const sampleBlock = {
  ticket: "TEST-122-R14",
  blockedAt: "2026-08-22T00:00:00.000Z",
  ruleId: "cross-industry",
  industryFamily: "汽车清洁养护",
  projectCode: "TEST-122-R14",
  promptPreview: "洗车工位场景，背景出现美甲色卡展示架",
  beforePrompt: "洗车工位场景完整提示词（客户原文，不应进表）",
  afterPrompt: undefined,
  result: "needs_review",
  verification: { attempts: [], costCny: 0.001, tokens: { prompt: 100, completion: 50 }, model: "deepseek-v4-flash", finishReason: "stop" },
  status: "待核验",
  geoInferredFalse: false,
};

function makeStubClient() {
  const calls: Array<{ table: string; rows: Record<string, unknown>[] }> = [];
  const client = {
    from: (table: string) => ({
      insert: async (rows: Record<string, unknown>[]) => {
        calls.push({ table, rows });
        return { error: null as never, data: [{ id: 1 }] };
      },
      select: (_cols: string) => ({
        order: async () => ({ data: [], error: null as never }),
      }),
    }),
  };
  return { calls, client };
}

async function main() {
  if (process.argv.includes("--dna")) {
    await dnaSmoke();
  } else {
    await offlineTests();
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`RESULT ${passCount}/${checks.length} passed`);
  if (passCount !== checks.length) process.exitCode = 1;
}

async function offlineTests() {
  const view = sanitizeBlock(sampleBlock as unknown as Record<string, unknown>);
  const stub = makeStubClient();
  const r1 = await upsertPromptGateBlock(view, stub.client as never);
  ok("upsert: stub 成功且仅插入脱敏字段", r1.ok === true && stub.calls.length === 1, `ok=${r1.ok}`);
  const row = stub.calls[0]?.rows?.[0] || {};
  ok("upsert: 行不含客户原文全文与密钥", !JSON.stringify(row).includes("客户原文") && !JSON.stringify(row).toLowerCase().includes("api_key") && String(row.prompt_preview || "").length <= 200, "sanitized");
  ok("upsert: 字段映射完整", row.rule_id === "cross-industry" && row.project_code === "TEST-122-R14" && row.cost_cny === 0.001 && row.finish_reason === "stop", "mapped");

  const errClient = { from: () => ({ insert: async () => ({ error: { message: "boom" }, data: null }) }) };
  const r2 = await upsertPromptGateBlock(view, errClient as never);
  ok("upsert: 写失败返回 ok=false 不抛错", r2.ok === false && Boolean(r2.error), `ok=${r2.ok} err=${r2.error}`);

  const stub2 = makeStubClient();
  const file = await writeBlockedRecord(sampleBlock as never, path.join(R14, "gate-test"), { upsert: true, client: stub2.client });
  ok("接线: writeBlockedRecord 触发 upsert 且本地文件仍写", stub2.calls.length === 1 && (await fs.access(file).then(() => true).catch(() => false)), `upserts=${stub2.calls.length}`);

  const migration = readFileSync(path.join(ROOT, "supabase/migrations/20260822_prompt_gate_blocks.sql"), "utf8");
  ok("迁移: prompt_gate_blocks 字段齐全且无客户原文/密钥列", migration.includes("rule_id") && migration.includes("prompt_preview") && migration.includes("geo_inferred_false") && !migration.includes("prompt_full") && !migration.includes("api_key") && !migration.includes("before_prompt"), "migration ok");

  const rolesSrc = readFileSync(path.join(ROOT, "src/lib/core/admin-roles.ts"), "utf8");
  const layoutSrc = readFileSync(path.join(ROOT, "src/components/shared/AdminLayout.tsx"), "utf8");
  ok("导航: admin 菜单含 /admin/prompt-gate 与 ShieldAlert 图标", rolesSrc.includes('"/admin/prompt-gate"') && layoutSrc.includes("ShieldAlert"), "nav ok");

  const env = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  ok("开关: .env.local 含 PROMPT_GATE_ENABLED=1 与 VISION_ARBITRATION_ENABLED=1", env.includes("PROMPT_GATE_ENABLED=1") && env.includes("VISION_ARBITRATION_ENABLED=1"), "switches ok");

  const routeSrc = readFileSync(path.join(ROOT, "src/app/api/admin/prompt-gate-blocks/route.ts"), "utf8");
  ok("双源: 只读接口含 local/table/both 切换逻辑", routeSrc.includes("PROMPT_GATE_SOURCE") && routeSrc.includes("readPromptGateBlocksFromTable"), "dual-source wired");
  const tableRows = await readPromptGateBlocksFromTable({
    from: () => ({ select: () => ({ order: async () => ({ data: [{ blocked_at: "2026-08-22T00:00:00Z", rule_id: "x", project_code: "T", prompt_preview: "p" }], error: null }) }) }),
  } as never);
  ok("表读取: 映射为展示视图", tableRows.length === 1 && tableRows[0].ruleId === "x" && tableRows[0].promptPreview === "p", "read mapped");
}

async function dnaSmoke() {
  await fs.mkdir(R14, { recursive: true });
  const { extractBrandDNA, fillScenePrompts } = await import("../src/lib/vi-manual/deepseek-dna");
  const orig = globalThis.fetch;
  const records: any[] = [];
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("supabase.co")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("api.deepseek.com")) {
      const started = Date.now();
      const response = await orig(input, init);
      const text = await response.clone().text();
      let body: any = null;
      try { body = JSON.parse(text); } catch { /* keep null */ }
      records.push({ model: body?.model || null, httpStatus: response.status, finishReason: body?.choices?.[0]?.finish_reason || null, usage: body?.usage || null, latencyMs: Date.now() - started });
      return response;
    }
    throw new Error(`BLOCKED ${url}`);
  }) as typeof fetch;

  const dnaResult = await extractBrandDNA({
    brandName: "清丽洗车",
    industry: "汽车清洁养护",
    brandVision: "社区汽车清洁养护门店",
    coreValues: "可靠、干净、透明",
    targetMarket: "周边社区家庭车主",
    brandColors: { primary: { hex: "#0F6B6D" }, secondary: { hex: "#5CC8C4" }, accent: { hex: "#F5F2E8" } },
    logoDescription: "水滴负形结合简洁车身轮廓",
    sceneModules: ["门店", "包装", "营销"],
    visualKeywords: ["clean", "reliable"],
    mainProducts: "标准洗车、内饰深度清洁",
  });
  globalThis.fetch = orig;

  console.log("DNA_ERROR:", JSON.stringify((dnaResult as any)?.error || "none"));
  ok("dna: extractBrandDNA 成功且返回 scene_atlas", Boolean(dnaResult?.success) && Boolean(dnaResult?.scene_atlas), `success=${dnaResult?.success} error=${(dnaResult as any)?.error || "none"}`);
  const keys = Object.keys(dnaResult?.scene_atlas || {});
  const expected = ["stationery-1", "packaging-1", "packaging-2", "marketing-storefront", "marketing-1"];
  const missing = expected.filter((k) => !keys.includes(k));
  ok("dna: atlas 键=worker 5 场景契约", keys.length === 5 && missing.length === 0, `keys=${keys.join(",")}`);
  if (missing.length === 0) {
    const filled = fillScenePrompts(String(dnaResult?.logo_pure_prompt?.positive_en || ""), dnaResult.scene_atlas || {}, expected);
    ok("dna: fillScenePrompts 可消费 5 键且含 DNA", expected.every((k) => filled[k] && filled[k].includes(dnaResult?.logo_pure_prompt?.positive_en || "{{DNA}}")), `filled=${Object.keys(filled).join(",")}`);
  }
  const file = path.join(R14, "deepseek-attempts.json");
  const existing = await fs.readFile(file, "utf8").then((t) => JSON.parse(t)).catch(() => []);
  existing.push(...records);
  await fs.writeFile(file, JSON.stringify(existing, null, 2));
  ok("dna: token/费用/模型/finish 已记录", records.length >= 1 && records.every((r) => r.model && r.finishReason), file);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

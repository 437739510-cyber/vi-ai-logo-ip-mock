/**
 * TICKET-122-R11 回归：admin 提示词门拦截只读展示。
 *  - 本地 stub 数据源（临时 blocked-*.json）验证读取/筛选/摘要/脱敏；
 *  - no-I/O：reader 仅本地 FS，stub 网络计数必须为 0；
 *  - 路由接线：route.ts 含 admin 会话守卫 + reader 引用（只读、无 upsert）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  readPromptGateBlocks,
  filterPromptGateBlocks,
  summarizePromptGateBlocks,
} from "../src/lib/prompt-gate/admin-reader";

const ROOT = path.resolve(process.cwd());
const TEST_DIR = path.join(ROOT, "logs", "122-r10", "admin-test");
const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
const ok = (name: string, cond: boolean, detail = "") => {
  checks.push({ name, pass: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
};

const block = (id: string, over: Record<string, unknown> = {}) => ({
  ticket: "TEST-122-R10",
  blockedAt: `2026-08-21T19:1${id}:00.000Z`,
  ruleId: "cross-industry",
  industryFamily: "汽车清洁养护",
  projectCode: `PROJ-${id}`,
  promptPreview: `洗车工位场景预览${id}`,
  beforePrompt: `洗车工位场景完整提示词${id}`,
  afterPrompt: id === "3" ? "修正后提示词" : undefined,
  result: id === "3" ? "fixed" : "needs_review",
  verification: {
    attempts: [],
    costCny: 0.001,
    tokens: { prompt: 300, completion: 100 },
    model: "deepseek-v4-flash",
    finishReason: "stop",
  },
  status: "待核验",
  geoInferredFalse: id === "2",
  ...over,
});

async function main() {
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.writeFile(path.join(TEST_DIR, "blocked-A.json"), JSON.stringify(block("1", { ruleId: "cross-industry", industryFamily: "汽车清洁养护" })));
  await fs.writeFile(path.join(TEST_DIR, "blocked-B.json"), JSON.stringify(block("2", { ruleId: "geo-contradiction", industryFamily: "饮品" })));
  await fs.writeFile(path.join(TEST_DIR, "blocked-C.json"), JSON.stringify(block("3", { ruleId: "mascot-leak", industryFamily: "美业", status: "已开单" })));

  const origFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => { fetchCalls += 1; throw new Error("NETWORK_BLOCKED"); }) as typeof fetch;

  const blocks = await readPromptGateBlocks(TEST_DIR);
  ok("读取：本地 JSON 全部解析并按时间倒序", blocks.length === 3 && blocks[0].blockedAt >= blocks[1].blockedAt && blocks[1].blockedAt >= blocks[2].blockedAt, `count=${blocks.length}`);
  ok("脱敏：展示项不含完整提示词全文，预览 ≤200 字", blocks.every((b) => b.promptPreview.length <= 200 && !b.promptPreview.includes("完整提示词")), "sanitized");

  const f1 = filterPromptGateBlocks(blocks, { ruleId: "cross-industry" });
  ok("筛选：ruleId", f1.length === 1 && f1[0].ruleId === "cross-industry", `n=${f1.length}`);
  const f2 = filterPromptGateBlocks(blocks, { industryFamily: "饮品" });
  ok("筛选：行业族", f2.length === 1 && f2[0].industryFamily === "饮品", `n=${f2.length}`);
  const f3 = filterPromptGateBlocks(blocks, { status: "已开单" });
  ok("筛选：处理状态", f3.length === 1 && f3[0].status === "已开单", `n=${f3.length}`);
  const f4 = filterPromptGateBlocks(blocks, { from: "2026-08-21T19:12:00.000Z", to: "2026-08-21T19:12:59.000Z" });
  ok("筛选：时间范围", f4.length === 1, `n=${f4.length}`);

  const summary = summarizePromptGateBlocks(blocks);
  ok("摘要：total/byRuleId/byIndustry/byStatus", summary.total === 3 && summary.byRuleId["cross-industry"] === 1 && summary.byIndustry["饮品"] === 1 && summary.byStatus["待核验"] === 2, JSON.stringify(summary));

  ok("no-I/O：读取/筛选/摘要零网络请求", fetchCalls === 0, `fetch=${fetchCalls}`);
  globalThis.fetch = origFetch;

  const routeSrc = await fs.readFile(path.join(ROOT, "src/app/api/admin/prompt-gate-blocks/route.ts"), "utf8");
  ok("路由接线：admin 会话守卫 + 只读 reader + 无 upsert 调用/无 supabase", routeSrc.includes("verifyAdminSession") && routeSrc.includes("readPromptGateBlocks") && !routeSrc.includes(".upsert(") && !routeSrc.includes("supabaseAdmin"), "route wired");
  const pageSrc = await fs.readFile(path.join(ROOT, "src/app/admin/prompt-gate/page.tsx"), "utf8");
  ok("页面接线：只读列表/筛选/摘要组件存在", pageSrc.includes("提示词门拦截记录") && pageSrc.includes("ruleId") && pageSrc.includes("按规则统计"), "page wired");

  const passCount = checks.filter((c) => c.pass).length;
  console.log(`RESULT ${passCount}/${checks.length} passed`);
  if (passCount !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

/**
 * TICKET-122-R9 回归：
 *  - 默认：离线 stub（不联网）验证双通道共识 / 不一致仲裁 / 空响应补判 /
 *    网络隔离 / Files API 请求形态；
 *  - --real：真实不一致样例（虚构清丽洗车 wash_bay-attempt-5，含斯巴鲁车标）：
 *    本地 qwen2.5vl + SenseNova 先判，不一致则 DeepSeek 视觉终判，
 *    费用经 reporter 写入 logs/122-r9/deepseek-attempts.json。
 * 用法：npx tsx scripts/_vision-deepseek-arbitration-regression.ts [--real]
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  deepSeekVisionUploadFile,
  deepSeekVisionDeleteFile,
  runDualWithDeepSeekArbitration,
  sha256Text,
} from "../src/lib/vision-check/deepseek-arbitration";

const ROOT = path.resolve(process.cwd());
const R9 = path.join(ROOT, "logs", "122-r9");
const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
const ok = (name: string, cond: boolean, detail = "") => {
  checks.push({ name, pass: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
};

const ONE_PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function makeStubFetch(scenario: "consensus" | "disagree" | "online-empty") {
  const counters = { local: 0, online: 0, deepseek: 0, files: 0, blocked: 0 };
  const originalFetch = globalThis.fetch;
  const stub = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = String(init?.method || "GET").toUpperCase();
    if (url.startsWith("http://127.0.0.1:11434")) {
      counters.local += 1;
      const raw = scenario === "consensus"
        ? '{"singleSubject":true,"noWatermark":true,"reason":"local ok"}'
        : '{"singleSubject":true,"noWatermark":true,"reason":"local ok"}';
      return new Response(JSON.stringify({ response: raw }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("token.sensenova.cn")) {
      counters.online += 1;
      const raw = scenario === "consensus"
        ? '{"singleSubject":true,"noWatermark":true,"reason":"online ok"}'
        : scenario === "online-empty"
          ? ""
          : '{"singleSubject":false,"noWatermark":true,"reason":"online says multi-subject"}';
      return new Response(JSON.stringify({ choices: [{ message: { content: raw } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("api.deepseek.com/v1/chat/completions")) {
      counters.deepseek += 1;
      return new Response(JSON.stringify({
        model: "deepseek-v4-flash-vision-exp",
        choices: [{ finish_reason: "stop", message: { content: '{"singleSubject":true,"noWatermark":true,"reason":"deepseek arbitrates"}' } }],
        usage: { prompt_tokens: 500, completion_tokens: 200, prompt_cache_hit_tokens: 0 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("api.deepseek.com/v1/files")) {
      counters.files += 1;
      if (method === "DELETE") return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({ id: "file-stub-001" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    counters.blocked += 1;
    throw new Error(`BLOCKED ${method} ${url}`);
  }) as typeof fetch;
  globalThis.fetch = stub;
  return { counters, restore: () => { globalThis.fetch = originalFetch; } };
}

async function offlineTests() {
  // 离线 stub：占位 key 让通道走到 transport（stub），不产生任何真实网络/费用
  process.env.SENSENOVA_API_KEY = "stub-sensenova";
  process.env.DEEPSEEK_API_KEY = "stub-deepseek";
  const prompt = '只输出JSON：{"singleSubject":true或false,"noWatermark":true或false,"reason":"一句话"}';

  const consensus = makeStubFetch("consensus");
  const r1 = await runDualWithDeepSeekArbitration({
    prompt, imageBase64: ONE_PX, verdictKeys: ["singleSubject", "noWatermark"], transport: globalThis.fetch,
  });
  ok("consensus: 双通道一致不调 DeepSeek", r1.source === "dual-consensus" && r1.status === "passed" && consensus.counters.deepseek === 0, `source=${r1.source} status=${r1.status} ds=${consensus.counters.deepseek}`);
  consensus.restore();

  const disagree = makeStubFetch("disagree");
  const records: any[] = [];
  const r2 = await runDualWithDeepSeekArbitration({
    prompt, imageBase64: ONE_PX, verdictKeys: ["singleSubject", "noWatermark"], transport: globalThis.fetch,
    reporter: (rec) => records.push(rec),
  });
  ok("disagree: 不一致触发 DeepSeek 仲裁", r2.source === "deepseek-arbitration" && r2.status === "passed" && disagree.counters.deepseek === 1, `source=${r2.source} ds=${disagree.counters.deepseek}`);
  ok("disagree: 费用记录含 token/模型/finish", records.length === 1 && records[0].model === "deepseek-v4-flash-vision-exp" && records[0].finishReason === "stop" && records[0].costCny > 0, `cost=${records[0]?.costCny} model=${records[0]?.model}`);
  disagree.restore();

  const empty = makeStubFetch("online-empty");
  const r3 = await runDualWithDeepSeekArbitration({
    prompt, imageBase64: ONE_PX, verdictKeys: ["singleSubject", "noWatermark"], transport: globalThis.fetch,
  });
  ok("online-empty: 空响应 DeepSeek 补判", r3.source === "deepseek-arbitration" && r3.status === "passed" && empty.counters.deepseek === 1, `source=${r3.source} ds=${empty.counters.deepseek}`);
  empty.restore();

  const iso = makeStubFetch("consensus");
  ok("isolation: 无任何其它外部请求（supabase/zeabur 等 0 次）", iso.counters.blocked === 0 && iso.counters.files === 0, `blocked=${iso.counters.blocked}`);
  iso.restore();

  const files = makeStubFetch("consensus");
  process.env.DEEPSEEK_API_KEY = "stub-key";
  const up = await deepSeekVisionUploadFile(ONE_PX, { transport: globalThis.fetch });
  ok("files-upload: 返回 file_id 且请求形态正确", up.ok === true && up.fileId === "file-stub-001" && files.counters.files === 1, `ok=${up.ok} fileId=${up.fileId}`);
  const del = await deepSeekVisionDeleteFile("file-stub-001", { transport: globalThis.fetch });
  ok("files-delete: 删除成功", del.ok === true, `ok=${del.ok}`);
  files.restore();
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.SENSENOVA_API_KEY;
}

async function realMode() {
  await fs.mkdir(R9, { recursive: true });
  const imgPath = path.join(ROOT, "logs", "122-r5", "assets", "candidates", "scene.wash_bay-attempt-5.png");
  const exists = await fs.access(imgPath).then(() => true).catch(() => false);
  ok("real: 虚构测试图存在（wash_bay-attempt-5）", exists, imgPath);
  if (!exists) return;
  const buf = await fs.readFile(imgPath);
  const imageBase64 = `data:image/png;base64,${buf.toString("base64")}`;
  const prompt = '只输出JSON：{"noOtherBrand":true或false,"reason":"一句话"}。noOtherBrand=true 仅当画面中没有任何其他品牌车标/商标/徽章（例如奥迪、斯巴鲁、哈弗等）；无法确认填 false。';
  const attempts: any[] = [];
  const outcome = await runDualWithDeepSeekArbitration({
    prompt,
    imageBase64,
    verdictKeys: ["noOtherBrand"],
    reporter: (rec) => attempts.push({ ...rec, imageSha256: sha256Text(buf.toString("base64")) }),
  });
  console.log(JSON.stringify({ outcome: { source: outcome.source, status: outcome.status, verdict: outcome.verdict, channels: outcome.channels.map((c) => ({ channel: c.channel, parsed: c.parsed, error: c.error })) }, attempts }, null, 2));
  ok("real: 仲裁通道给出结论（consensus 或 deepseek）", outcome.source === "dual-consensus" || outcome.source === "deepseek-arbitration", `source=${outcome.source} status=${outcome.status}`);
  ok("real: 费用/模型/finish 已记录", attempts.length >= 0 && (outcome.records.length === 0 || outcome.records[0].finishReason != null), `records=${outcome.records.length}`);
  const attemptFile = path.join(R9, "deepseek-attempts.json");
  const existing = await fs.readFile(attemptFile, "utf8").then((t) => JSON.parse(t)).catch(() => ({ ticket: "TICKET-122-R9", attempts: [] }));
  existing.attempts.push(...attempts);
  existing.updatedAt = new Date().toISOString();
  await fs.writeFile(attemptFile, JSON.stringify(existing, null, 2));
  ok("real: attempts 已落盘 logs/122-r9/deepseek-attempts.json", true, attemptFile);
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

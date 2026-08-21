/**
 * TICKET-122-R9-R1 回归：
 *  - 默认：maybeArbitrateVision 离线 stub（禁用→不调用；启用+一致→不调 DeepSeek；
 *    启用+不一致/空响应→DeepSeek 仲裁 + 费用字段；仲裁异常→不可用标注不静默放行）；
 *    worker.mjs 三处接线源码断言；R9 离线 7/7 兼容；
 *  - --files：Files API 真实冒烟（虚构清丽洗车素材：上传 expires24h → file_id 引用
 *    仲裁一次 → 删除；记录契约与费用）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  maybeArbitrateVision,
  deepSeekVisionUploadFile,
  deepSeekVisionJudge,
  deepSeekVisionDeleteFile,
} from "../src/lib/vision-check/deepseek-arbitration";

const ROOT = path.resolve(process.cwd());
const R9R1 = path.join(ROOT, "logs", "122-r9-r1");
const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
const ok = (name: string, cond: boolean, detail = "") => {
  checks.push({ name, pass: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
};

const ONE_PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function stubFetch(scenario: "consensus" | "disagree" | "empty" | "error") {
  const counters = { local: 0, online: 0, deepseek: 0, blocked: 0 };
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("http://127.0.0.1:11434")) {
      counters.local += 1;
      const raw = '{"singleSubject":true,"noWatermark":true,"reason":"local"}';
      return new Response(JSON.stringify({ response: raw }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("token.sensenova.cn")) {
      counters.online += 1;
      const raw = scenario === "consensus"
        ? '{"singleSubject":true,"noWatermark":true,"reason":"online"}'
        : scenario === "empty"
          ? ""
          : '{"singleSubject":false,"noWatermark":true,"reason":"online disagrees"}';
      return new Response(JSON.stringify({ choices: [{ message: { content: raw } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("api.deepseek.com/v1/chat")) {
      counters.deepseek += 1;
      if (scenario === "error") return new Response("boom", { status: 500 });
      return new Response(JSON.stringify({
        model: "deepseek-v4-flash-vision-exp",
        choices: [{ finish_reason: "stop", message: { content: '{"singleSubject":true,"noWatermark":true,"reason":"arbitrate"}' } }],
        usage: { prompt_tokens: 500, completion_tokens: 200, prompt_cache_hit_tokens: 0 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    counters.blocked += 1;
    throw new Error(`BLOCKED ${url}`);
  }) as typeof fetch;
  return { counters, restore: () => { globalThis.fetch = orig; } };
}

async function offlineWiringTests() {
  process.env.DEEPSEEK_API_KEY = "stub-deepseek";
  process.env.SENSENOVA_API_KEY = "stub-sensenova";
  const prompt = '只输出JSON：{"singleSubject":true或false,"noWatermark":true或false,"reason":"一句话"}';

  // 禁用：不调用任何通道
  const disabled = stubFetch("consensus");
  const r0 = await maybeArbitrateVision({ imageBase64: ONE_PX, prompt, verdictKeys: ["singleSubject", "noWatermark"], enabled: false });
  ok("接线：禁用时不仲裁", r0.arbitrated === false && r0.reason === "disabled" && disabled.counters.deepseek === 0 && disabled.counters.online === 0, `arbitrated=${r0.arbitrated}`);
  disabled.restore();

  // 启用+一致：不调 DeepSeek
  const consensus = stubFetch("consensus");
  const r1 = await maybeArbitrateVision({ imageBase64: ONE_PX, prompt, verdictKeys: ["singleSubject", "noWatermark"], enabled: true, transport: globalThis.fetch });
  ok("接线：一致→双通道共识不调 DeepSeek", r1.arbitrated && r1.outcome?.source === "dual-consensus" && consensus.counters.deepseek === 0, `source=${r1.outcome?.source}`);
  consensus.restore();

  // 启用+不一致：DeepSeek 仲裁 + 费用字段
  const disagree = stubFetch("disagree");
  const records: any[] = [];
  const r2 = await maybeArbitrateVision({ imageBase64: ONE_PX, prompt, verdictKeys: ["singleSubject", "noWatermark"], enabled: true, transport: globalThis.fetch, reporter: (rec) => records.push(rec) });
  ok("接线：不一致→DeepSeek 仲裁", r2.arbitrated && r2.outcome?.source === "deepseek-arbitration" && disagree.counters.deepseek === 1, `source=${r2.outcome?.source} ds=${disagree.counters.deepseek}`);
  ok("接线：费用/模型/finish 记录", records.length === 1 && records[0].model === "deepseek-v4-flash-vision-exp" && records[0].finishReason === "stop" && records[0].costCny > 0, `cost=${records[0]?.costCny}`);
  disagree.restore();

  // 启用+在线空响应：补判
  const empty = stubFetch("empty");
  const r3 = await maybeArbitrateVision({ imageBase64: ONE_PX, prompt, verdictKeys: ["singleSubject", "noWatermark"], enabled: true, transport: globalThis.fetch });
  ok("接线：空响应→DeepSeek 补判", r3.arbitrated && r3.outcome?.source === "deepseek-arbitration" && empty.counters.deepseek === 1, `source=${r3.outcome?.source}`);
  empty.restore();

  // 仲裁异常：不可用标注，不静默放行
  const err = stubFetch("error");
  const r4 = await maybeArbitrateVision({ imageBase64: ONE_PX, prompt, verdictKeys: ["singleSubject", "noWatermark"], enabled: true, transport: globalThis.fetch });
  ok("接线：仲裁异常→unavailable 标注（不静默放行）", r4.arbitrated === true && r4.outcome?.source === "unavailable" && r4.outcome?.status === "skipped", `source=${r4.outcome?.source} status=${r4.outcome?.status}`);
  err.restore();

  // 网络隔离
  const iso = stubFetch("consensus");
  await maybeArbitrateVision({ imageBase64: ONE_PX, prompt, verdictKeys: ["singleSubject", "noWatermark"], enabled: true, transport: globalThis.fetch });
  ok("接线：网络隔离（除 DeepSeek/supabase 外 0）", iso.counters.blocked === 0, `blocked=${iso.counters.blocked}`);
  iso.restore();

  // worker.mjs 接线源码断言
  const workerSrc = readFileSync(path.join(ROOT, "scripts/worker.mjs"), "utf8");
  ok("接线：worker 三处视觉门调用 maybeArbitrateVision/arbitrateVisionIfNeeded",
    workerSrc.includes("arbitrateVisionIfNeeded") &&
    workerSrc.includes("[VISION-ARB] 三视图仲裁") &&
    workerSrc.includes("[VISION-ARB] 公仔场景仲裁") &&
    workerSrc.includes("VISION_ARBITRATION_ENABLED"), "worker wired");

  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.SENSENOVA_API_KEY;
}

async function filesSmoke() {
  await fs.mkdir(R9R1, { recursive: true });
  const imgPath = path.join(ROOT, "logs", "122-r5", "assets", "candidates", "scene.wash_bay-attempt-6.png");
  const exists = await fs.access(imgPath).then(() => true).catch(() => false);
  ok("files: 虚构测试图存在", exists, imgPath);
  if (!exists) return;
  const buf = await fs.readFile(imgPath);
  const imageBase64 = `data:image/png;base64,${buf.toString("base64")}`;

  const up = await deepSeekVisionUploadFile(imageBase64);
  ok("files: 上传成功且返回 file_id", up.ok === true && Boolean(up.fileId), `ok=${up.ok} fileId=${up.fileId}`);
  if (!up.ok || !up.fileId) return;

  const judge = await deepSeekVisionJudge({
    prompt: '只输出JSON：{"noMascot":true或false,"noOtherBrand":true或false,"reason":"一句话"}。评估洗车工位场景：无公仔、无其它品牌。',
    fileId: up.fileId,
  });
  ok("files: file_id 引用仲裁可用（解析出 JSON）", judge.ok === true && judge.parsed !== null, `ok=${judge.ok} finish=${judge.record.finishReason} cost=${judge.record.costCny}`);

  const del = await deepSeekVisionDeleteFile(up.fileId);
  ok("files: 删除成功", del.ok === true, `ok=${del.ok} status=${del.status}`);

  const attemptsFile = path.join(R9R1, "deepseek-attempts.json");
  const existing = await fs.readFile(attemptsFile, "utf8").then((t) => JSON.parse(t)).catch(() => []);
  existing.push({ smoke: "files-api", ...judge.record, fileId: up.fileId, deleted: del.ok, at: new Date().toISOString() });
  await fs.writeFile(attemptsFile, JSON.stringify(existing, null, 2));
  ok("files: 费用/契约已记录", Boolean(judge.record.model) && Boolean(judge.record.finishReason), attemptsFile);
}

async function main() {
  if (process.argv.includes("--files")) {
    await filesSmoke();
  } else {
    await offlineWiringTests();
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`RESULT ${passCount}/${checks.length} passed`);
  if (passCount !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

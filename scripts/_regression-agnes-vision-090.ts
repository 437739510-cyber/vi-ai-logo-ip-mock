/**
 * TICKET-090 聚焦回归：Agnes 免费视觉通道。
 *
 * 断言：
 * 1) 源码级：key 只从环境变量读取（无硬编码）、VISION_ENABLE_AGNES=1 才启用、
 *    max_tokens≥200、429 退避处理、≤1280px 缩图；
 * 2) 降级断言：未启用 → disabled；启用但无 key → missing_key；
 *    网络失败 → { ok:false } 不抛错（走既有降级）；
 * 3) 真实看图调用：本地样例图（logs/086/views/00744-front.png）→
 *    Agnes 返回非空、非乱码的 JSON 评估文本。
 */
import fs from "node:fs";
import { readFileSync } from "node:fs";
import {
  agnesVisionText,
  isAgnesVisionEnabled,
  looksGarbled,
  stripDataUriPrefix,
} from "../src/lib/vision-check/index";

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passCount += 1; console.log(`PASS ${name}`); }
  else { failCount += 1; console.log(`FAIL ${name} ${detail}`); }
}

const repoRoot = new URL("../", import.meta.url);
const visionSrc = readFileSync(new URL("src/lib/vision-check/index.ts", repoRoot), "utf8");

function loadEnv(): void {
  const text = readFileSync("D:/disk/HermesDisk/bb-clean/.env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  // 1) 源码级契约
  check("key 只从环境变量读取（AGNES_API_KEY）", visionSrc.includes("process.env.AGNES_API_KEY"), "missing env read");
  check("默认关闭灰度（VISION_ENABLE_AGNES=1）", visionSrc.includes('process.env.VISION_ENABLE_AGNES !== "1"') && visionSrc.includes('process.env.VISION_ENABLE_AGNES === "1"'), "missing gate");
  check("max_tokens 给足（≥200）", /max_tokens:\s*8\d\d/.test(visionSrc) || /max_tokens:\s*[2-9]\d\d/.test(visionSrc), "max_tokens too small");
  check("429 限流退避处理", visionSrc.includes("resp.status === 429") && visionSrc.includes("rate_limited"), "missing 429 handling");
  check("≤1280px 缩图", visionSrc.includes("AGNES_MAX_IMAGE_PX") && visionSrc.includes("1280"), "missing resize");
  check("无硬编码 key 值", !/sk-[A-Za-z0-9]{20,}/.test(visionSrc) && !visionSrc.includes("Bearer sk-"), "hardcoded key");
  check("失败不抛错（catch 返回 ok:false）", visionSrc.includes("return { ok: false, reason:"), "missing safe fallback");

  // 2) 降级断言
  delete process.env.VISION_ENABLE_AGNES;
  delete process.env.AGNES_API_KEY;
  check("未启用 → disabled", isAgnesVisionEnabled() === false && (await agnesVisionText("p", "x")).reason === "disabled", "disabled gate failed");
  process.env.VISION_ENABLE_AGNES = "1";
  delete process.env.AGNES_API_KEY;
  check("启用但无 key → missing_key", (await agnesVisionText("p", "x")).reason === "missing_key", "missing key failed");
  process.env.AGNES_API_KEY = "test-key-for-fallback";
  const netFail = await agnesVisionText("p", "x", { baseUrl: "http://127.0.0.1:1", timeoutMs: 5000 });
  check("网络失败 → ok:false 不抛错", netFail.ok === false && typeof netFail.reason === "string", JSON.stringify(netFail));

  // 3) 真实看图调用（本地样例图 + 中文核字口径提示词）
  loadEnv();
  process.env.VISION_ENABLE_AGNES = "1";
  const samplePath = "D:/disk/HermesDisk/bb-clean/logs/086/views/00744-front.png";
  check("本地样例图存在", fs.existsSync(samplePath), samplePath);
  const b64 = fs.readFileSync(samplePath).toString("base64");
  const prompt =
    '请评估这张3D卡通公仔图的完整性，只输出JSON：{"complete":true或false,"singleSubject":true或false,"whiteBackground":true或false,"noWatermark":true或false,"reason":"一句话"}。';
  const real = await agnesVisionText(prompt, b64, { timeoutMs: 120000 });
  check("Agnes 真实看图调用成功", real.ok === true, real.reason || "no text");
  if (real.ok && real.text) {
    const jsonish = real.text.includes("{") && (real.text.includes("complete") || real.text.includes("singleSubject") || real.text.includes("noWatermark"));
    check("返回内容为 JSON 评估（非空非乱码）", jsonish && !looksGarbled(real.text), real.text.slice(0, 120));
    console.log("INFO agnes sample output:", real.text.replace(/\s+/g, " ").slice(0, 160));
  }
  check("stripDataUriPrefix 兼容 data URL", stripDataUriPrefix("data:image/png;base64,QUJD") === "QUJD", "strip failed");

  delete process.env.VISION_ENABLE_AGNES;
  delete process.env.AGNES_API_KEY;
  // 让网络失败用例的底层句柄回收后再退出，避免 Windows libuv 关闭竞态。
  await new Promise((r) => setTimeout(r, 800));
  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e && e.message);
  process.exit(1);
});

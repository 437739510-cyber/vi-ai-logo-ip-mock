/**
 * 工单 027 运行时验证（需要本地 Ollama 可用；不可用时输出 SKIP 并退出 0）。
 *
 * 样本（D:\tool\_023-logo-test，023 实测产物）：
 * - 8 张最终 PASS（v1~v4 × 2）：必须全部 passed（不误杀）。
 * - 2 张失败样本 r1（“老碗碗香”）/ r3（“老老碗香”）：必须 suspect/needs_review（抓出）。
 * - 4 张早期未标注样本（1/2/3/r2）：报告识别结果，不计入误杀判定。
 * - 拼音样本（comfyui_zt_00366_，XIAOHUA MIANGUAN）：信息性记录
 *   （7B 对长拼音末字母有已知漏读风险，见 024 回执）。
 */
import fs from "fs";
import { runLogoVisionCheck, isOllamaAvailable } from "../src/lib/vision-check";

const SAMPLE_DIR = "D:\\tool\\_023-logo-test";
const PINYIN_SAMPLE = "D:\\ComfyUI-backup\\output\\comfyui_zt_00366_.png";

function readB64(p: string): string {
  return fs.readFileSync(p).toString("base64");
}

async function main() {
  console.log("== 027 视觉校验门运行时验证 ==");
  if (!(await isOllamaAvailable())) {
    console.log("SKIP: Ollama 不可用（未启动或未在运行），跳过运行时验证。");
    process.exit(0);
  }

  const passNames = [
    "logo-023-v1-r1.png", "logo-023-v1-r2.png",
    "logo-023-v2-r1.png", "logo-023-v2-r2.png",
    "logo-023-v3-r1.png", "logo-023-v3-r2.png",
    "logo-023-v4-r1.png", "logo-023-v4-r2.png",
  ];
  const failNames = ["logo-023-r1.png", "logo-023-r3.png"];
  const extraNames = ["logo-023-1.png", "logo-023-2.png", "logo-023-3.png", "logo-023-r2.png"];

  let passFail = 0;
  let failCaught = 0;

  for (const n of passNames) {
    const r = await runLogoVisionCheck({
      imageBase64: readB64(`${SAMPLE_DIR}\\${n}`),
      expectedText: "老碗香",
      mode: "chinese",
    });
    const ok = r.status === "passed";
    if (!ok) passFail++;
    console.log(`[PASS样本] ${n} -> ${r.status}${r.reason ? ` (${r.reason})` : ""} coarse=${r.coarseText?.slice(0, 40) ?? ""}`);
  }

  for (const n of failNames) {
    const r = await runLogoVisionCheck({
      imageBase64: readB64(`${SAMPLE_DIR}\\${n}`),
      expectedText: "老碗香",
      mode: "chinese",
    });
    const caught = r.status === "suspect" || r.status === "needs_review";
    if (caught) failCaught++;
    console.log(`[失败样本] ${n} -> ${r.status}${r.reason ? ` (${r.reason})` : ""} coarse=${r.coarseText?.slice(0, 40) ?? ""} fine=${r.fineText?.slice(0, 40) ?? ""}`);
  }

  for (const n of extraNames) {
    const r = await runLogoVisionCheck({
      imageBase64: readB64(`${SAMPLE_DIR}\\${n}`),
      expectedText: "老碗香",
      mode: "chinese",
    });
    console.log(`[早期未标注] ${n} -> ${r.status} coarse=${r.coarseText?.slice(0, 40) ?? ""}`);
  }

  // 拼音样本（信息性）
  if (fs.existsSync(PINYIN_SAMPLE)) {
    const r = await runLogoVisionCheck({
      imageBase64: readB64(PINYIN_SAMPLE),
      expectedText: "XIAOHUAMIANGUAN",
      mode: "pinyin",
    });
    console.log(`[拼音样本] comfyui_zt_00366_ -> ${r.status} coarse=${r.coarseText?.slice(0, 40) ?? ""} fine=${r.fineText?.slice(0, 40) ?? ""}`);
  }

  const summary = {
    passSamples: passNames.length,
    passMisKilled: passFail,
    failSamples: failNames.length,
    failCaught,
    failRate: failNames.length ? Math.round((failCaught / failNames.length) * 100) : 0,
  };
  console.log("== 汇总 ==");
  console.log(JSON.stringify(summary, null, 2));

  const ok =
    passFail === 0 &&
    failNames.length > 0 &&
    failCaught / failNames.length >= 0.8;
  console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});

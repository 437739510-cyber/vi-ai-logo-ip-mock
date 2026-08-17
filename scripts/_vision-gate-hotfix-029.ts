/**
 * 工单 029 运行时验证（独立脚本，不入 Git；需本机 Ollama）。
 *
 * 模式：
 *   EXPECT_DOWNGRADE=1  → 校验 Ollama 不可用时返回 skipped(ollama_unavailable)
 *   默认                 → 028 样本 4/4 passed（裸 base64 + data URI 各 2 张）；
 *                          失败样本 r1/r3 必须 suspect（被抓出）。
 *
 * 运行：npx tsx scripts/_vision-gate-hotfix-029.ts
 */
process.env.DEEPSEEK_API_KEY = "";
process.env.SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

import { readFileSync } from "fs";
import {
  runLogoVisionCheck,
  stripDataUriPrefix,
  isOllamaAvailable,
} from "../src/lib/vision-check";

const EXPECT_DOWNGRADE = process.env.EXPECT_DOWNGRADE === "1";
const EXPECTED = "老碗香";
const MODE = "chinese" as const;

function base64Of(p: string): string {
  return readFileSync(p).toString("base64");
}

async function main() {
  const results: Array<{ name: string; pass: boolean; detail: string }> = [];
  const record = (name: string, pass: boolean, detail: string) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} ${name}  |  ${detail}`);
  };

  // data URI 剥离单元
  record(
    "stripDataUriPrefix 单元",
    stripDataUriPrefix("data:image/png;base64,AAAA") === "AAAA" &&
      stripDataUriPrefix("AAAA") === "AAAA",
    `stripped=${stripDataUriPrefix("data:image/png;base64,AAAA")} raw=${stripDataUriPrefix("AAAA")}`,
  );

  if (EXPECT_DOWNGRADE) {
    const down = await isOllamaAvailable();
    if (down) {
      record("降级前置（Ollama 应不可用）", false, "Ollama 可达，降级模式无法验证，请先停止 Ollama");
    } else {
      const r = await runLogoVisionCheck({
        imageBase64: "AAAA",
        expectedText: EXPECTED,
        mode: MODE,
      });
      record(
        "降级：Ollama 不可用 → skipped(ollama_unavailable)",
        r.status === "skipped" && r.reason === "ollama_unavailable",
        `status=${r.status} reason=${r.reason || ""}`,
      );
    }
  } else {
    const up = await isOllamaAvailable();
    if (!up) {
      record("前置（Ollama 应可用）", false, "Ollama 不可达，内容校验无法执行；请先启动 Ollama");
      process.exitCode = 1;
      return;
    }

    const passImgs = [
      "D:\\ComfyUI-backup\\output\\comfyui_zt_00481_.png",
      "D:\\ComfyUI-backup\\output\\comfyui_zt_00482_.png",
    ];
    for (const p of passImgs) {
      const b64 = base64Of(p);
      const uri = "data:image/png;base64," + b64;
      for (const [label, input] of [
        ["裸 base64", b64],
        ["data URI", uri],
      ] as Array<[string, string]>) {
        const r = await runLogoVisionCheck({
          imageBase64: input,
          expectedText: EXPECTED,
          mode: MODE,
        });
        record(
          `028 样本 ${p.split("\\").pop()}（${label}）→ passed`,
          r.status === "passed",
          `status=${r.status} reason=${r.reason || ""} coarse=${(r.coarseText || "").slice(0, 40)}`,
        );
      }
    }

    const failImgs = [
      ["r1（老碗碗香）", "D:\\tool\\_023-logo-test\\logo-023-r1.png"],
      ["r3（老老碗香）", "D:\\tool\\_023-logo-test\\logo-023-r3.png"],
    ] as Array<[string, string]>;
    for (const [name, p] of failImgs) {
      const r = await runLogoVisionCheck({
        imageBase64: base64Of(p),
        expectedText: EXPECTED,
        mode: MODE,
      });
      record(
        `失败样本 ${name} → 被抓出（suspect）`,
        r.status === "suspect",
        `status=${r.status} reason=${r.reason || ""} coarse=${(r.coarseText || "").slice(0, 40)}`,
      );
    }
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`=== 029 运行时断言: ${results.length - failed} passed, ${failed} failed ===`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("029 runtime error:", e);
  process.exit(1);
});

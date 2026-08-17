/**
 * TICKET-091-R3 聚焦回归：packaging 特色场景（前台接待/美甲色卡）+ 美甲子类。
 *
 * 断言：
 * 1) worker 含特色场景提示词（「百疗萃」3 字大字 + 前台接待/美甲色卡元素）；
 * 2) packaging-1/2 走「百疗萃」逐字核字（runSceneVisionCheck）；
 * 3) page-planner 美业包装页说明含 美甲；
 * 4) 测试单 subIndustries 含 美容/美体/美甲（数据校验，用码点避免编码问题）。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passCount += 1; console.log(`PASS ${name}`); }
  else { failCount += 1; console.log(`FAIL ${name} ${detail}`); }
}

const repoRoot = new URL("../", import.meta.url);
const workerSrc = readFileSync(new URL("scripts/worker.mjs", repoRoot), "utf8");
const plannerSrc = readFileSync(new URL("src/lib/vi-manual/page-planner.ts", repoRoot), "utf8");
const renderSrc = readFileSync(new URL("src/lib/pptx/render-pptx.ts", repoRoot), "utf8");

function loadEnv(): void {
  const text = readFileSync("D:/disk/HermesDisk/bb-clean/.env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  // 1) 特色场景提示词
  check("worker 含 featureScenePromptFor", workerSrc.includes("function featureScenePromptFor"), "missing fn");
  check("前台接待场景提示词（百疗萃 3 字 + 前台/接待）", workerSrc.includes("Premium beauty & wellness reception scene") && workerSrc.includes("reception desk") && workerSrc.includes("large glowing brand name"), "reception prompt missing");
  check("美甲色卡场景提示词", workerSrc.includes("Nail salon service scene") && workerSrc.includes("nail polish color card") && workerSrc.includes("manicure tools"), "nail prompt missing");
  check("packaging-1/2 接入特色场景", workerSrc.includes("featureScenePromptFor('packaging-1'") && workerSrc.includes("featureScenePromptFor('packaging-2'") && workerSrc.includes("key === 'packaging-1' || key === 'packaging-2'"), "packaging wiring missing");

  // 2) 逐字核字
  check("packaging/营销「百疗萃」逐字核字（含代码贴字后核字）", workerSrc.includes("runSceneVisionCheck({ imageBase64: finalImage, expectedText: '\u767e\u7597\u8403'") && workerSrc.includes("overlayBrandTextOnScene"), "text check missing");

  // 3) 美业包装页说明含美甲
  check("page-planner 美业包装说明含 美甲", plannerSrc.includes("\u7f8e\u7532") && plannerSrc.includes("\u7f8e\u4e1a\uff08\u7f8e\u5bb9/\u7f8e\u4f53/\u7f8e\u7532\uff09\u670d\u52a1\u4e0e\u7269\u6599\u7684\u54c1\u724c\u5316\u5448\u73b0"), "planner desc missing");
  check("render-pptx 美业包装说明含 美甲", renderSrc.includes("\u7f8e\u4e1a\uff08\u7f8e\u5bb9/\u7f8e\u4f53/\u7f8e\u7532\uff09\u670d\u52a1\u4e0e\u7269\u6599\u7684\u54c1\u724c\u5316\u5448\u73b0"), "render desc missing");

  // 4) 数据校验：subIndustries 含 美容/美体/美甲
  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
  const sb = createClient(supabaseUrl, supabaseKey);
  const { data } = await sb.from("projects").select("client_info").eq("id", "VI-20260806-POLP").maybeSingle();
  const subs: string[] = data?.client_info?.subIndustries || [];
  const codes = subs.map((s) => [...s].map((c) => c.charCodeAt(0)));
  const has = (c1: number, c2: number) => codes.some((a) => a.length === 2 && a[0] === c1 && a[1] === c2);
  check("subIndustries 含 美容(32654,23481)", has(32654, 23481), codes.map((a) => a.join(",")).join("|"));
  check("subIndustries 含 美体(32654,20307)", has(32654, 20307), "");
  check("subIndustries 含 美甲(32654,30002)", has(32654, 30002), "");

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e && e.message);
  process.exit(1);
});

/**
 * TICKET-091 聚焦回归：R4 成品手册问题整改契约。
 *
 * 断言：
 * 1) 选定 LOGO（c1）已按 086 口径落库（数据断言，需 Supabase 凭据）；
 * 2) P26 三视图页优先 正/侧/背 单图布局（合拼版保留）；
 * 3) P30 禁用规范页文字双栏 + 公仔独立右列专区（不遮挡）；
 * 4) P04 logo 诠释页不再含「IP 角色介绍」区（移至角色定位页）；
 * 5) P27 表情库=6、无旧 8 残留表述；
 * 6) P28 场景融合：提示词融合语言 + 角落贴字 + 双模型融合断言接线。
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
const renderSrc = readFileSync(new URL("src/lib/pptx/render-pptx.ts", repoRoot), "utf8");
const plannerSrc = readFileSync(new URL("src/lib/vi-manual/page-planner.ts", repoRoot), "utf8");
const workerSrc = readFileSync(new URL("scripts/worker.mjs", repoRoot), "utf8");
const visionSrc = readFileSync(new URL("src/lib/vision-check/index.ts", repoRoot), "utf8");
const setLogoSrc = readFileSync(new URL("logs/091/set-selected-logo-c1.mjs", repoRoot), "utf8");

function loadEnv(): void {
  const text = readFileSync("D:/disk/HermesDisk/bb-clean/.env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  // 1) 选定 LOGO 落库（c1）
  check("落库脚本存在且用 c1", setLogoSrc.includes("logs/092/c1.png") && setLogoSrc.includes("selectedLogo"), "missing set-logo script");
  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
  const sb = createClient(supabaseUrl, supabaseKey);
  const { data } = await sb.from("projects").select("client_info").eq("id", "VI-20260806-POLP").maybeSingle();
  const sel = data?.client_info?.brandProfile?.selectedLogo;
  check("selectedLogo 已落库且为 c1", !!sel && String(sel.imageUrl || "").includes("logo-c1-selected"), sel ? String(sel.imageUrl) : "missing");

  // 2) P26 三视图单图布局
  check("三视图页优先拆分单图", renderSrc.includes("mascotSplitViews") && renderSrc.includes("renderMascotSplitGrid(slide, views, \"三视图\"") && renderSrc.includes("合拼版仍保留"), "P26 missing");
  check("拆分不足才回退合拼版", renderSrc.includes("views.length >= MASCOT_VIEW_MIN") && renderSrc.includes("mascotThreeViewData"), "P26 fallback missing");

  // 3) P30 禁用规范页独立图片区
  check("支持页文字双栏收窄", renderSrc.includes("contentWidthRatio") && renderSrc.includes("renderMascotTextPairs(slide, bp, bc, 1.55, 0.64)"), "P30 text column missing");
  check("公仔独立右列专区", renderSrc.includes("CONTENT_W * 0.64 + 0.25") && renderSrc.includes("CONTENT_W * 0.36 - 0.25"), "P30 image column missing");

  // 4) P04 角色介绍移至角色定位页
  check("logo 诠释页移除 IP 角色介绍元素", !plannerSrc.includes("li-ip-title") && !plannerSrc.includes("li-ip-desc"), "P04 planner residue");
  check("logo 诠释页移除 IP 角色介绍渲染区", !renderSrc.includes("slide.addText(\"IP 角色介绍\""), "P04 render residue");
  check("角色定位页含角色设定", plannerSrc.includes("pageId: \"mascot-positioning\"") && plannerSrc.includes("角色设定"), "P04 positioning page");

  // 5) P27 表情库 6 个、无 8 残留
  check("表情页文案=6 款（无至少8款）", !plannerSrc.includes("至少8款") && plannerSrc.includes("MASCOT_EMOTIONS_MIN"), "P27 planner");
  check("表情网格无 8 个残留", !renderSrc.includes("8 个中文表情") && !renderSrc.includes("4×2 表情网格"), "P27 render");

  // 6) P28 场景融合
  check("场景提示词含融合语言", workerSrc.includes("soft contact shadow under the feet") && workerSrc.includes("no hard cutout edges"), "P28 prompt missing");
  check("角落贴 LOGO/文字避开主体", workerSrc.includes("xRatio: 0.84, yRatio: 0.84, widthRatio: 0.14") && workerSrc.includes("xRatio: 0.06, yRatio: 0.9"), "P28 corner placement missing");
  check("vision-check 导出融合断言", visionSrc.includes("export async function runMascotSceneFusionCheck"), "P28 fusion fn missing");
  check("worker 接线融合断言", workerSrc.includes("runMascotSceneFusionCheck(finalImage)") && workerSrc.includes("融合断言"), "P28 fusion wiring missing");

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e && e.message);
  process.exit(1);
});

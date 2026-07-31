/**
 * Acceptance smoke for TASK-VI-PLATFORM-FIX-001.
 * Run: npx tsx scripts/_smoke-vi-manual.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

import { planPages, type PageBlueprint, type PagePlannerInput } from "../src/lib/vi-manual/page-planner";
import { renderPptxToBuffer, type RenderPptxOptions } from "../src/lib/pptx/render-pptx";

// Acceptance smoke must stay offline: never hit the paid DeepSeek API.
process.env.DEEPSEEK_API_KEY = "";

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const OUTPUT_PPTX = "D:\\tool\\_platform-fix-smoke.pptx";

const clientInfo = {
  companyName: "有间荼店",
  brandVision: "做一杯好喝的奶茶",
  coreValues: "新鲜 真诚",
  targetMarket: "年轻消费者",
};

const brandColors = {
  primary: { hex: "#C0392B", name: "品牌主色" },
  secondary: { hex: "#C59438", name: "辅助色" },
  accent: { hex: "#F5E6CA", name: "强调色" },
};

const baseInput: PagePlannerInput = { clientInfo, brandColors };

function collectText(bps: PageBlueprint[]): string {
  return bps
    .map((bp) => [bp.label, ...bp.elements.map((e) => e.content || "")].join(" "))
    .join(" ");
}

async function main(): Promise<void> {
  const results: string[] = [];
  const ok = (name: string, cond: boolean, detail = "") => {
    results.push(`${cond ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
    if (!cond) process.exitCode = 1;
  };

  const noIp = await planPages({ ...baseInput, includeMascotChapter: false, mascotAssetsReady: false });
  ok("no-IP mode has no mascot-* pages", noIp.every((b) => !b.pageId.startsWith("mascot-")));
  ok("no-IP mode page count is 25", noIp.length === 25, `got ${noIp.length}`);

  const withIp = await planPages({ ...baseInput, includeMascotChapter: true, mascotAssetsReady: true });
  const mascotPages = withIp.filter((b) => b.pageId.startsWith("mascot-"));
  ok("IP mode has 8 mascot-* pages", mascotPages.length === 8, `got ${mascotPages.length}`);
  ok("IP mode page count is 33", withIp.length === 33, `got ${withIp.length}`);

  const text = collectText([...noIp, ...withIp]);
  ok("blueprint text contains no 荼店", !text.includes("荼店"));

  mkdirSync(dirname(OUTPUT_PPTX), { recursive: true });
  const renderOptions: RenderPptxOptions = {
    companyName: "有间荼店",
    fullBrandName: "有间荼店",
    industry: "beverage",
    logoData: `data:image/png;base64,${ONE_PX_PNG_BASE64}`,
    aiLogoData: `data:image/png;base64,${ONE_PX_PNG_BASE64}`,
    brandColors: {
      primary: "#C0392B",
      secondary: "#C59438",
      accent: "#F5E6CA",
    },
    compressImages: false,
  };
  const buf = await renderPptxToBuffer(noIp, renderOptions);
  writeFileSync(OUTPUT_PPTX, buf);
  ok("smoke PPTX written", existsSync(OUTPUT_PPTX) && buf.length > 0, `${buf.length} bytes`);
  ok("renderer normalizes companyName", renderOptions.companyName === "有间奶茶店", renderOptions.companyName || "");
  ok("renderer normalizes fullBrandName", renderOptions.fullBrandName === "有间奶茶店", renderOptions.fullBrandName || "");

  const blankMascot: PageBlueprint = {
    pageId: "mascot-positioning",
    label: "IP角色定位",
    background: { type: "solid", primaryColor: "#FFFFFF" },
    elements: [],
    appliedRules: [],
    qualityThreshold: 70,
  };
  let threw = false;
  let errMsg = "";
  try {
    await renderPptxToBuffer([blankMascot], { companyName: "有间奶茶店" });
  } catch (err) {
    threw = true;
    errMsg = err instanceof Error ? err.message : String(err);
  }
  ok("mascot page without assets throws", threw && /no assets/.test(errMsg), errMsg || "did not throw");

  console.log("=== TASK-VI-PLATFORM-FIX-001 SMOKE ===");
  for (const r of results) console.log(r);
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`=== ${results.length - failed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err);
  process.exit(1);
});

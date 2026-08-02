/**
 * Acceptance smoke for TASK-VI-PLATFORM-FIX-003.
 * Run: npx tsx scripts/_smoke-vi-manual-003.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

import { planPages, type PageBlueprint } from "../src/lib/vi-manual/page-planner";
import { renderPptxToBuffer, type RenderPptxOptions } from "../src/lib/pptx/render-pptx";

// Acceptance smoke must stay offline: never hit the paid DeepSeek API.
process.env.DEEPSEEK_API_KEY = "";

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ONE_PX_PNG = `data:image/png;base64,${ONE_PX_PNG_BASE64}`;
const OUTPUT_PPTX = "D:\\tool\\_platform-fix-003-smoke.pptx";

const clientInfo = {
  companyName: "有间奶茶店",
  brandVision: "做一杯好喝的奶茶",
  coreValues: "新鲜 真诚",
  targetMarket: "年轻消费者",
  industry: "beverage",
};

const brandColors = {
  primary: { hex: "#C0392B", name: "品牌主色" },
  secondary: { hex: "#C59438", name: "辅助色" },
  accent: { hex: "#F5E6CA", name: "强调色" },
};

const baseInput = {
  clientInfo,
  brandColors,
  wantMascot: "yes",
  mascotAssets: {
    name: "小茶",
    front: ONE_PX_PNG,
    side: ONE_PX_PNG,
    back: ONE_PX_PNG,
    emotions: ["微笑", "欢迎", "专注", "惊喜", "安心", "开心", "引导", "俏皮"].map((name) => ({ name, url: ONE_PX_PNG })),
    scenes: ["门店迎宾", "包装应用", "会员互动", "社媒互动"].map((name) => ({ name, url: ONE_PX_PNG })),
  },
  assetAnalysis: {
    logo: { hasLogo: true },
    mascot: { hasMascot: true, name: "小茶", splitViews: [ONE_PX_PNG, ONE_PX_PNG, ONE_PX_PNG] },
  },
};

function pageText(bps: PageBlueprint[], pageId: string): string {
  const bp = bps.find((b) => b.pageId === pageId);
  if (!bp) return "";
  return [bp.label, ...bp.elements.map((e) => e.content || "")].join(" ");
}

function allText(bps: PageBlueprint[]): string {
  return bps.map((bp) => pageText(bps, bp.pageId)).join(" ");
}

async function main(): Promise<void> {
  const results: string[] = [];
  const ok = (name: string, cond: boolean, detail = "") => {
    results.push(`${cond ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
    if (!cond) process.exitCode = 1;
  };

  const bps = await planPages(baseInput);
  const text = allText(bps);
  const coordCards = (text.match(/排版坐标卡/g) || []).length;
  ok("blueprint contains at least 3 排版坐标卡", coordCards >= 3, `got ${coordCards}`);
  ok("stationery has 排版坐标卡", pageText(bps, "stationery").includes("排版坐标卡"));
  ok("packaging has 排版坐标卡", pageText(bps, "packaging").includes("排版坐标卡"));
  ok("marketing has 排版坐标卡", pageText(bps, "marketing").includes("排版坐标卡"));
  ok("digital-media has 排版坐标卡", pageText(bps, "digital-media").includes("排版坐标卡"));
  ok("wayfinding has 排版坐标卡", pageText(bps, "wayfinding").includes("排版坐标卡"));

  const fileOutputText = pageText(bps, "file-output");
  ok("file-output contains IP 公仔源文件", fileOutputText.includes("IP 公仔源文件"));
  ok("file-output contains 品牌名_Mascot_正面", fileOutputText.includes("有间奶茶店_Mascot_正面"));

  const auxText = pageText(bps, "auxiliary-graphics");
  ok("auxiliary graphics contains 最小使用尺寸", auxText.includes("最小使用尺寸"));
  ok("auxiliary graphics contains 10%-40%", auxText.includes("10%-40%"));

  const merchText = pageText(bps, "mascot-merchandise");
  ok("mascot merchandise contains 240x240px", merchText.includes("240x240px"));
  ok("mascot merchandise contains 头身比不得超过 1:1.8", merchText.includes("头身比不得超过 1:1.8"));
  ok("mascot merchandise contains 1024x1024px", merchText.includes("1024x1024px"));

  const renderOptions: RenderPptxOptions = {
    companyName: "有间奶茶店",
    fullBrandName: "有间奶茶店",
    industry: "beverage",
    logoData: ONE_PX_PNG,
    aiLogoData: ONE_PX_PNG,
    brandColors: {
      primary: "#C0392B",
      secondary: "#C59438",
      accent: "#F5E6CA",
    },
    logoColors: {
      navy: { name: "品牌深蓝", hex: "#1B2A4A", rgb: "27,42,74", cmyk: "64,43,0,71" },
      gold: { name: "品牌金棕", hex: "#C9A96E", rgb: "201,169,110", cmyk: "0,16,45,21" },
    },
    mascotData: ONE_PX_PNG,
    mascotThreeViewData: ONE_PX_PNG,
    mascotSplitViews: [ONE_PX_PNG, ONE_PX_PNG, ONE_PX_PNG],
    mascotEmotions: Object.fromEntries(["微笑", "欢迎", "专注", "惊喜", "安心", "开心", "引导", "俏皮"].map((name) => [name, ONE_PX_PNG])),
    mascotScenes: Object.fromEntries(["门店迎宾", "包装应用", "会员互动", "社媒互动"].map((name) => [name, ONE_PX_PNG])),
    compressImages: false,
  };

  mkdirSync(dirname(OUTPUT_PPTX), { recursive: true });
  const buf = await renderPptxToBuffer(bps, renderOptions);
  writeFileSync(OUTPUT_PPTX, buf);
  ok("smoke PPTX written", existsSync(OUTPUT_PPTX) && buf.length > 0, `${buf.length} bytes`);

  console.log("=== TASK-VI-PLATFORM-FIX-003 SMOKE ===");
  for (const r of results) console.log(r);
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`=== ${results.length - failed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err);
  process.exit(1);
});

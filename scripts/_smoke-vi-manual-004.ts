/**
 * Acceptance smoke for TASK-VI-PLATFORM-FIX-004.
 * Run: npx tsx scripts/_smoke-vi-manual-004.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

import { planPages, type PageBlueprint } from "../src/lib/vi-manual/page-planner";
import {
  renderPptxToBuffer,
  computePageNumberMap,
  getTocItems,
  assertTocPageNumbers,
  type RenderPptxOptions,
} from "../src/lib/pptx/render-pptx";

// Acceptance smoke must stay offline: never hit the paid DeepSeek API.
process.env.DEEPSEEK_API_KEY = "";

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ONE_PX_PNG = `data:image/png;base64,${ONE_PX_PNG_BASE64}`;
const OUTPUT_PPTX = "D:\\tool\\_platform-fix-004-smoke.pptx";

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
    logo: { hasLogo: true, meaning: "圆环代表完整服务，茶叶图形代表新鲜原料" },
    mascot: { hasMascot: true, name: "小茶", splitViews: [ONE_PX_PNG, ONE_PX_PNG, ONE_PX_PNG] },
  },
};

function pageText(bps: PageBlueprint[], pageId: string): string {
  const bp = bps.find((b) => b.pageId === pageId);
  if (!bp) return "";
  return [bp.label, ...bp.elements.map((e) => e.content || "")].join(" ");
}

function tocSections(blueprints: PageBlueprint[]): Set<string> {
  const map = computePageNumberMap(blueprints);
  return new Set(
    getTocItems("beverage")
      .filter((item) => map[item.pageId] !== undefined)
      .map((item) => item.section)
  );
}

async function main(): Promise<void> {
  const results: string[] = [];
  const ok = (name: string, cond: boolean, detail = "") => {
    results.push(`${cond ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
    if (!cond) process.exitCode = 1;
  };

  const noIp = await planPages({
    ...baseInput,
    wantMascot: "no",
    assetAnalysis: { logo: baseInput.assetAnalysis.logo },
  });
  const withIp = await planPages(baseInput);

  const allSections = new Set(getTocItems("beverage").map((item) => item.section));
  ok("TOC data has 4 sections", allSections.size === 4, [...allSections].join("/"));
  ok("TOC data has 基础规范", allSections.has("基础规范"));
  ok("TOC data has 应用系统", allSections.has("应用系统"));
  ok("TOC data has IP公仔", allSections.has("IP公仔"));
  ok("TOC data has 收尾", allSections.has("收尾"));

  ok("no-IP TOC has no IP公仔 section", !tocSections(noIp).has("IP公仔"));
  ok("IP TOC has IP公仔 section", tocSections(withIp).has("IP公仔"));

  // 目录所有页码与真实页序一致
  const map = computePageNumberMap(withIp);
  const tocIds = getTocItems("beverage")
    .filter((item) => map[item.pageId] !== undefined)
    .map((item) => item.pageId);
  const numbered = withIp.filter((b) => !["cover", "toc", "closing"].includes(b.pageId));
  const orderedMap: Record<string, number> = {};
  let n = 0;
  for (const bp of withIp) {
    if (bp.pageId === "cover") {
      orderedMap[bp.pageId] = 0;
      continue;
    }
    n += 1;
    orderedMap[bp.pageId] = n;
  }
  const expectedMap = orderedMap;
  const pageNumbersMatch = tocIds.every((id) => map[id] === expectedMap[id]);
  ok("TOC page numbers match computePageNumberMap", pageNumbersMatch && tocIds.length === numbered.length, `toc=${tocIds.length}, pages=${numbered.length}`);

  let validationOk = true;
  let validationMsg = "";
  try {
    assertTocPageNumbers(withIp, { industry: "beverage" });
  } catch (err) {
    validationOk = false;
    validationMsg = err instanceof Error ? err.message : String(err);
  }
  ok("assertTocPageNumbers passes before render", validationOk, validationMsg);

  const philosophyText = pageText(withIp, "brand-philosophy");
  ok("philosophy contains LOGO 的图形叙事", philosophyText.includes("LOGO 的图形叙事"));
  ok("philosophy contains IP 的亲和表达", philosophyText.includes("IP 的亲和表达"));

  const logoInterpText = pageText(withIp, "logo-interpretation");
  ok("logo interpretation contains IP 公仔承载品牌温度", logoInterpText.includes("IP 公仔承载品牌温度"));
  ok("logo interpretation contains 共用同一色彩与比例体系", logoInterpText.includes("共用同一色彩与比例体系"));

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
  const buf = await renderPptxToBuffer(withIp, renderOptions);
  writeFileSync(OUTPUT_PPTX, buf);
  ok("smoke PPTX written", existsSync(OUTPUT_PPTX) && buf.length > 0, `${buf.length} bytes`);

  console.log("=== TASK-VI-PLATFORM-FIX-004 SMOKE ===");
  for (const r of results) console.log(r);
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`=== ${results.length - failed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err);
  process.exit(1);
});

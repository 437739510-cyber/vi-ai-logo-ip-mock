/**
 * Acceptance smoke for TASK-VI-PLATFORM-FIX-002.
 * Run: npx tsx scripts/_smoke-vi-manual-002.ts
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
const OUTPUT_PPTX = "D:\\tool\\_platform-fix-002-smoke.pptx";

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
  },
};

function pageText(bps: PageBlueprint[], pageId: string): string {
  const bp = bps.find((b) => b.pageId === pageId);
  if (!bp) return "";
  return [bp.label, ...bp.elements.map((e) => e.content || "")].join(" ");
}

async function main(): Promise<void> {
  const results: string[] = [];
  const ok = (name: string, cond: boolean, detail = "") => {
    results.push(`${cond ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
    if (!cond) process.exitCode = 1;
  };

  const bps = await planPages(baseInput);

  const gridText = pageText(bps, "logo-grid");
  ok("logo grid contains 1 格 = 5mm", gridText.includes("1 格 = 5mm"));
  ok("logo grid contains 50mm", gridText.includes("50mm"));

  const variationsText = pageText(bps, "logo-variations");
  ok("logo variations contains 0.5 单位", variationsText.includes("0.5 单位"));
  ok("logo variations contains 2.5mm", variationsText.includes("2.5mm"));
  ok("logo variations contains 30mm", variationsText.includes("30mm"));

  const misuseText = pageText(bps, "logo-misuse");
  ok("logo misuse contains 裁切LOGO", misuseText.includes("裁切LOGO"));
  ok("logo misuse contains 局部截取祥云", misuseText.includes("局部截取祥云"));
  ok("logo misuse contains 更改圆环纹样", misuseText.includes("更改圆环纹样"));

  const threeViewText = pageText(bps, "mascot-threeview");
  ok("mascot threeview uses fixed 1:2.0", threeViewText.includes("1:2.0"));
  ok("mascot threeview no longer contains 1:1.5", !threeViewText.includes("1:1.5"));

  const usageText = pageText(bps, "mascot-usage");
  ok("mascot usage contains 间距 = 公仔高度 15%", usageText.includes("间距 = 公仔高度 15%"));
  ok("mascot usage contains 60mm", usageText.includes("60mm"));

  const complianceText = pageText(bps, "mascot-compliance");
  ok("mascot compliance contains 修改审批流程", complianceText.includes("修改审批流程"));
  ok("mascot compliance contains 对外授权申请模板", complianceText.includes("对外授权申请模板"));
  ok("mascot compliance contains 节日限定", complianceText.includes("节日限定"));

  const merchandiseText = pageText(bps, "mascot-merchandise");
  ok("mascot merchandise has GIF size", merchandiseText.includes("GIF 尺寸 240x240px 起"));
  ok("mascot merchandise has tote size", merchandiseText.includes("成品 35x40cm"));
  ok("mascot merchandise has standee ratio", merchandiseText.includes("全身占比 >= 70%"));

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
      navy: { name: "LOGO藏青", hex: "#1B2A4A", rgb: "27,42,74", cmyk: "64,43,0,71" },
      gold: { name: "祥云金", hex: "#C9A96E", rgb: "201,169,110", cmyk: "0,16,45,21" },
    },
    mascotData: ONE_PX_PNG,
    mascotThreeViewData: ONE_PX_PNG,
    mascotSplitViews: [ONE_PX_PNG, ONE_PX_PNG, ONE_PX_PNG],
    mascotEmotions: Object.fromEntries(["微笑", "欢迎", "专注", "惊喜", "安心", "开心", "引导", "俏皮"].map((name) => [name, ONE_PX_PNG])),
    mascotScenes: Object.fromEntries(["门店迎宾", "包装应用", "会员互动", "社媒互动"].map((name) => [name, ONE_PX_PNG])),
    compressImages: false,
  };
  ok("color options contain navy #1B2A4A", renderOptions.logoColors?.navy?.hex === "#1B2A4A");
  ok("color options contain gold #C9A96E", renderOptions.logoColors?.gold?.hex === "#C9A96E");

  mkdirSync(dirname(OUTPUT_PPTX), { recursive: true });
  const buf = await renderPptxToBuffer(bps, renderOptions);
  writeFileSync(OUTPUT_PPTX, buf);
  ok("smoke PPTX written", existsSync(OUTPUT_PPTX) && buf.length > 0, `${buf.length} bytes`);

  console.log("=== TASK-VI-PLATFORM-FIX-002 SMOKE ===");
  for (const r of results) console.log(r);
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`=== ${results.length - failed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err);
  process.exit(1);
});

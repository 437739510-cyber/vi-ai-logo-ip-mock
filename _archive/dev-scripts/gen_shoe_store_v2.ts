import { planPages } from "../src/lib/vi-manual/page-planner";
import { renderPptxToBuffer } from "../src/lib/pptx/render-pptx";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=== 老北京布鞋店 VI手册 V2 ===");

  const companyName = "老北京布鞋店";
  const industry = "零售:鞋履";

  const logoBase64 = "data:image/png;base64," + fs.readFileSync(path.join(process.cwd(), "public", "generated", "logo_selected.png")).toString("base64");

  const sceneDir = "E:\\ComfyUI\\output";
  const sceneImages: Record<string, string> = {};
  const files: Record<string, string> = {
    "stationery-1": "scene_shoe_v2_stationery_1_00001_.png",
    "packaging-1": "scene_shoe_v2_packaging_2_00001_.png",
    "packaging-2": "scene_shoe_v2_packaging_3_00001_.png",
    "marketing-1": "scene_shoe_v2_marketing_4_00001_.png",
    "marketing-2": "scene_shoe_v2_marketing_5_00001_.png",
  };
  for (const [k, fn] of Object.entries(files)) {
    const fp = path.join(sceneDir, fn);
    if (fs.existsSync(fp)) sceneImages[k] = "data:image/png;base64," + fs.readFileSync(fp).toString("base64");
  }
  console.log("Scene images:", Object.keys(sceneImages).length);

  console.log("Step 1: planPages...");
  const blueprints = await planPages({
    clientInfo: { companyName, brandVision: "传承老北京布鞋工艺，让每一位女性走得更舒适", coreValues: "舒适、传统、匠心、实惠", targetMarket: "25-65岁注重传统工艺和舒适度的女性顾客", logoPhilosophy: "民国复古风格，传统与简约结合", industry },
    brandColors: { primary: { hex: "#8B1A1A", name: "中国红" }, secondary: { hex: "#D4A017", name: "金色" }, accent: { hex: "#2C1810", name: "深棕" } },
    assetAnalysis: { logo: { hasLogo: true, meaning: "民国复古", elements: ["布鞋轮廓","民国字体","传统纹样"], styleTags: ["vintage","chinese","traditional"] }, mascot: { hasMascot: false } },
  });
  console.log("  ->", blueprints.length, "pages");

  console.log("Step 2: renderPptxToBuffer...");
  const buffer = await renderPptxToBuffer(blueprints, {
    projectName: "VI-20260628-933A", companyName, industry, logoData: logoBase64,
    brandColors: { primary: "#8B1A1A", secondary: "#D4A017", accent: "#2C1810" },
    brandVision: "传承老北京布鞋工艺，让每一位女性走得更舒适",
    coreValues: "舒适、传统、匠心、实惠",
    targetMarket: "25-65岁注重传统工艺和舒适度的女性顾客",
    logoPhilosophy: "民国复古风格",
    sceneImages, sceneLabels: {}, compressImages: true,
    auxGraphicsIntro: "老北京布鞋店的辅助图形源自传统中式回字纹和云纹，红金配色传递传统与匠心的品牌气质。",
    colorMeaning: "中国红象征喜庆与传承，金色代表品质，深棕传递手工艺的温暖。",
  });
  console.log("  ->", buffer.length, "bytes");

  const ts = Date.now();
  const outPath = path.join(process.cwd(), "public", "generated", "vi-manual-shoe-v2-" + ts + ".pptx");
  fs.writeFileSync(outPath, buffer);
  console.log("OK:", outPath);
  console.log("Size:", (buffer.length / 1024).toFixed(1), "KB");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

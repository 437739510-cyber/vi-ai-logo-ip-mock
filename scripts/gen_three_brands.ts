import { planPages } from "../src/lib/vi-manual/page-planner";
import { renderPptxToBuffer } from "../src/lib/pptx/render-pptx";
import * as fs from "fs";
import * as path from "path";

const BRANDS = [
  {
    name: "老北京布鞋店",
    industry: "零售:鞋履",
    vision: "传承老北京布鞋工艺，让每一位女性走得更舒适",
    values: "舒适、传统、匠心、实惠",
    market: "25-65岁注重传统工艺和舒适度的女性顾客",
    philosophy: "民国复古风格，传统与简约结合",
    logoFile: "logo_selected.png",
    primary: "#8B1A1A", secondary: "#D4A017", accent: "#2C1810",
    priName: "中国红", secName: "金色", accName: "深棕",
    logoElements: ["布鞋轮廓","民国字体","传统纹样"],
    logoStyle: ["vintage","chinese","traditional"],
    logoMeaning: "民国复古",
  },
  {
    name: "蜀九香火锅",
    industry: "餐饮:火锅",
    vision: "让每一口都是川味的极致享受",
    values: "真材实料、麻辣鲜香、巴蜀文化",
    market: "热爱麻辣、追求地道川味火锅的年轻人及家庭",
    philosophy: "巴蜀火锅文化，热烈烟火气",
    logoFile: "logo_selected.png",
    primary: "#CC0000", secondary: "#FF8C00", accent: "#FFD700",
    priName: "辣椒红", secName: "暖橙", accName: "金色",
    logoElements: ["火锅轮廓","火焰纹","辣椒剪影"],
    logoStyle: ["hot","chinese","appetizing"],
    logoMeaning: "蜀地九香，传承巴蜀火锅文化",
  },
  {
    name: "花语时光美容院",
    industry: "美容:SPA",
    vision: "让每一刻都绽放自然之美",
    values: "自然之美、专业呵护、优雅绽放",
    market: "注重肌肤护理、追求品质生活的都市女性",
    philosophy: "如花绽放的美丽，时光沉淀的优雅",
    logoFile: "logo_selected.png",
    primary: "#E8A0BF", secondary: "#2D5A27", accent: "#D4AF37",
    priName: "樱花粉", secName: "松柏绿", accName: "玫瑰金",
    logoElements: ["花瓣","女性侧脸","弧线"],
    logoStyle: ["elegant","feminine","minimal"],
    logoMeaning: "如花绽放的美丽，时光沉淀的优雅",
  },
];

async function main() {
  for (const brand of BRANDS) {
    console.log(`\n===== ${brand.name} =====`);

    // Try to load logo
    let logoBase64 = "";
    const logoPath = path.join(process.cwd(), "public", "generated", brand.logoFile);
    if (fs.existsSync(logoPath)) {
      logoBase64 = "data:image/png;base64," + fs.readFileSync(logoPath).toString("base64");
    }

    console.log("Step 1: planPages...");
    const blueprints = await planPages({
      clientInfo: {
        companyName: brand.name,
        brandVision: brand.vision,
        coreValues: brand.values,
        targetMarket: brand.market,
        logoPhilosophy: brand.philosophy,
        industry: brand.industry,
      },
      brandColors: {
        primary: { hex: brand.primary, name: brand.priName },
        secondary: { hex: brand.secondary, name: brand.secName },
        accent: { hex: brand.accent, name: brand.accName },
      },
      assetAnalysis: {
        logo: {
          hasLogo: true,
          meaning: brand.logoMeaning,
          elements: brand.logoElements,
          styleTags: brand.logoStyle,
        },
        mascot: { hasMascot: false },
      },
    });
    console.log("  ->", blueprints.length, "pages");

    console.log("Step 2: renderPptxToBuffer...");
    const buffer = await renderPptxToBuffer(blueprints, {
      projectName: "VI-" + Date.now(),
      companyName: brand.name,
      industry: brand.industry,
      logoData: logoBase64 || undefined,
      brandColors: {
        primary: brand.primary,
        secondary: brand.secondary,
        accent: brand.accent,
      },
      brandVision: brand.vision,
      coreValues: brand.values,
      targetMarket: brand.market,
      logoPhilosophy: brand.philosophy,
      sceneImages: {},
      sceneLabels: {},
      compressImages: true,
      auxGraphicsIntro: brand.name + "的辅助图形源自品牌核心视觉元素。",
      colorMeaning: brand.priName + "象征品牌核心调性，" + brand.secName + "营造层次感，" + brand.accName + "用于关键信息突出。",
    });

    const ts = Date.now();
    const safeName = brand.name.replace(/[\/\\:*?"<>|]/g, "_");
    const outPath = path.join(process.cwd(), "public", "generated", "vi-manual-" + safeName + "-" + ts + ".pptx");
    fs.writeFileSync(outPath, buffer);
    console.log("OK:", outPath);
    console.log("Size:", (buffer.length / 1024).toFixed(1), "KB");
  }
  console.log("\n=== ALL DONE ===");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

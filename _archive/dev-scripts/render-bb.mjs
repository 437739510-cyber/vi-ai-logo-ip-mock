import { renderPptxToBuffer } from "../src/lib/pptx/render-pptx";
import { planPages } from "../src/lib/vi-manual/page-planner";
import { promises as fs } from "fs";
import path from "path";

const OUT = "D:/disk/CODEX/vi手册logo";

// Load logo
const logoBuf = await fs.readFile(path.join(OUT, "yang_logo_01.png"));
const logoData = `data:image/png;base64,${logoBuf.toString("base64")}`;
console.log("  [OK] Loaded logo: yang_logo_01.png");

// Load scene images
const sceneKeys = ["stationery", "packaging-1", "packaging-2", "marketing-1", "marketing-2"];
const sceneImages = {};
const sceneLabels = {
  stationery: "品牌物料应用",
  "packaging-1": "包装系统应用",
  "packaging-2": "产品包装应用",
  "marketing-1": "宣传海报应用",
  "marketing-2": "会员卡应用",
};

for (const key of sceneKeys) {
  const fp = path.join(OUT, `yang_scene_${key}.png`);
  try {
    const buf = await fs.readFile(fp);
    sceneImages[key] = `image/png;base64,${buf.toString("base64")}`;
    console.log(`  [OK] Loaded scene: ${key}`);
  } catch (e) {
    console.log(`  [MISS] Scene: ${key}`);
  }
}

// Generate page blueprints
const blueprints = await planPages({
  clientInfo: {
    companyName: "花颜美容院",
    brandVision: "以花养颜，传承东方草本护肤智慧，让每一位女性焕发自然之美",
    coreValues: "天然、匠心、信赖、优雅",
    targetMarket: "28-55岁都市女性，追求天然护肤与身心平衡",
    logoPhilosophy: "花颜标识以花瓣与女性侧脸轮廓为核心元素，采用圆形徽章构图，传达完满和谐的品牌精神。",
    industry: "beauty",
  },
  brandColors: {
    primary: { hex: "#E8576C", name: "花颜粉" },
    secondary: { hex: "#F8BBD0", name: "浅樱粉" },
    accent: { hex: "#C9A96E", name: "暗金" },
  },
});

console.log(`  Blueprints: ${blueprints.length} pages`);

const options = {
  projectName: "花颜美容院",
  companyName: "花颜美容院",
  industry: "beauty",
  logoData,
  aiLogoData: logoData,
  brandColors: { primary: "#E8576C", secondary: "#F8BBD0", accent: "#C9A96E" },
  brandVision: "以花养颜，传承东方草本护肤智慧，让每一位女性焕发自然之美",
  coreValues: "天然、匠心、信赖、优雅",
  targetMarket: "28-55岁都市女性，追求天然护肤与身心平衡",
  logoPhilosophy: "花颜标识以花瓣与女性侧脸轮廓为核心元素，采用圆形徽章构图，传达完满和谐的品牌精神。花瓣层叠舒展，寓意肌肤如花般自然绽放。",
  sceneImages,
  sceneLabels,
  sceneSectionTitles: {
    stationery: "美容应用系统",
    "packaging-1": "美容包装系统",
    "packaging-2": "美容包装系统",
    "marketing-1": "美容营销系统",
    "marketing-2": "美容营销系统",
  },
  auxGraphicsIntro: "品牌辅助图形提取自花瓣形态，通过重复、旋转、渐变等方式形成品牌独特的视觉纹样，应用于包装、店面、社媒等多种场景。",
  colorMeaning: "花颜粉代表女性柔美与生命力，浅樱粉传递温柔与亲和，暗金点缀高端质感。",
  colorPaletteMeanings: {
    primary: "花颜粉 — 品牌核心识别色，象征女性柔美与生命力",
    secondary: "浅樱粉 — 柔和过渡色，传递温柔与亲和感",
    accent: "暗金 — 高端点缀色，彰显品质与信赖",
  },
  compressImages: false,
};

console.log("Rendering with bb-clean renderPptxToBuffer...");
const buf = await renderPptxToBuffer(blueprints, options);
const outPath = path.join(OUT, "花颜美容院-VI手册-bb.pptx");
await fs.writeFile(outPath, buf);
console.log(`DONE: ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);

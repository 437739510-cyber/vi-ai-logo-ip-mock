// P0 validation: Generate test PPTXs
import { renderPptxToBuffer } from "../src/lib/pptx/render-pptx";
import { planPages } from "../src/lib/vi-manual/page-planner";
import { promises as fs } from "fs";
import path from "path";

const OUT = "D:/disk/HERMES&CODEX/test-output";
await fs.mkdir(OUT, { recursive: true });

// 花语时光
console.log("=== 花语时光美容院 ===");
const fbp = await planPages({
  clientInfo: { companyName: "花语时光美容院", brandVision: "忙碌与精致不再对立", coreValues: "精致、温暖、专业、高效", targetMarket: "深圳25-45岁商务职场女性", industry: "beauty" },
  brandColors: { primary: { hex: "#C0392B" }, secondary: { hex: "#8E44AD" }, accent: { hex: "#D4A76A" } },
});
console.log(`  ${fbp.length} blueprints`);
const fbuf = await renderPptxToBuffer(fbp, { projectName: "花语时光美容院", companyName: "花语时光美容院", industry: "beauty", brandColors: { primary: "#C0392B", secondary: "#8E44AD", accent: "#D4A76A" }, brandVision: "忙碌与精致不再对立", coreValues: "精致、温暖、专业、高效", targetMarket: "深圳25-45岁商务职场女性" });
const fp = path.join(OUT, "花语时光美容院_VI手册_P0验证.pptx");
await fs.writeFile(fp, fbuf);
console.log(`  Written: ${fp} (${(fbuf.length/1024).toFixed(0)} KB)`);

// 陕陕刀削面馆
console.log("=== 陕陕刀削面馆 ===");
const sbp = await planPages({
  clientInfo: { companyName: "陕陕刀削面馆", brandVision: "传承陕派刀削面百年技艺", coreValues: "匠心、正宗、亲切、品质", targetMarket: "18-45岁面食爱好者", industry: "restaurant" },
  brandColors: { primary: { hex: "#C0392B" }, secondary: { hex: "#F39C12" }, accent: { hex: "#2C3E50" } },
});
console.log(`  ${sbp.length} blueprints`);
const sbuf = await renderPptxToBuffer(sbp, { projectName: "陕陕刀削面馆", companyName: "陕陕刀削面馆", industry: "restaurant", brandColors: { primary: "#C0392B", secondary: "#F39C12", accent: "#2C3E50" }, brandVision: "传承陕派刀削面百年技艺", coreValues: "匠心、正宗、亲切、品质", targetMarket: "18-45岁面食爱好者" });
const sp = path.join(OUT, "陕陕刀削面馆_VI手册_P0验证.pptx");
await fs.writeFile(sp, sbuf);
console.log(`  Written: ${sp} (${(sbuf.length/1024).toFixed(0)} KB)`);

console.log("\n=== P0 Done ===");
/**
 * Validation script: test industry-aware prompt with 3 industries x 4 AI pages
 * Run: npx tsx scripts/validate-industry-layout.ts
 */

import { planLayoutEngine } from "../src/lib/vi-manual/plan-layout-engine";

const INDUSTRIES = [
  {
    name: "shoe-store",
    label: "老北京布鞋店",
    industry: "鞋店/鞋履零售",
    companyName: "老北京布鞋店",
    brandVision: "让每一步都踏实舒适",
    coreValues: "匠心传承、舒适为本、京味文化",
    targetMarket: "注重传统与舒适的中老年消费者及文化爱好者",
    brandTone: "传统、匠心、舒适、京味文化",
    brandColors: {
      primary: { hex: "#C23B22", name: "中国红" },
      secondary: { hex: "#3C2415", name: "深棕" },
      accent: { hex: "#D4A574", name: "暖金" },
    },
    hasLogo: true,
    logoElements: ["布鞋轮廓", "祥云纹"],
    logoMeaning: "传承老北京手工布鞋工艺，寓意脚踏实地",
    logoStyleTags: ["传统", "中式", "简约"],
  },
  {
    name: "hotpot",
    label: "蜀九香火锅",
    industry: "餐饮/火锅",
    companyName: "蜀九香火锅",
    brandVision: "让每一口都是川味的极致享受",
    coreValues: "真材实料、麻辣鲜香、巴蜀文化",
    targetMarket: "热爱麻辣的年轻人及家庭",
    brandTone: "热烈、地道、烟火气",
    brandColors: {
      primary: { hex: "#CC0000", name: "辣椒红" },
      secondary: { hex: "#FF8C00", name: "暖橙" },
      accent: { hex: "#FFD700", name: "金色" },
    },
    hasLogo: true,
    logoElements: ["火锅轮廓", "火焰纹", "辣椒剪影"],
    logoMeaning: "蜀地九香，传承巴蜀火锅文化的麻辣鲜香",
    logoStyleTags: ["热烈", "中式", "食欲感"],
  },
  {
    name: "beauty-salon",
    label: "花语时光美容院",
    industry: "美容/SPA",
    companyName: "花语时光美容院",
    brandVision: "让每一刻都绽放自然之美",
    coreValues: "自然之美、专业呵护、优雅绽放",
    targetMarket: "注重肌肤护理的都市女性",
    brandTone: "优雅、高级、温柔、轻奢",
    brandColors: {
      primary: { hex: "#E8A0BF", name: "樱花粉" },
      secondary: { hex: "#2D5A27", name: "松柏绿" },
      accent: { hex: "#D4AF37", name: "玫瑰金" },
    },
    hasLogo: true,
    logoElements: ["花瓣", "女性侧脸", "弧线"],
    logoMeaning: "如花绽放的美丽，时光沉淀的优雅",
    logoStyleTags: ["优雅", "柔美", "简约"],
  },
];

const AI_PAGES = ["cover", "brand-philosophy", "logo-interpretation", "summary"];

async function main() {
  const fs = await import("fs");
  const path = await import("path");

  const outputDir = "output/layout-validation";
  fs.mkdirSync(outputDir, { recursive: true });

  for (const brand of INDUSTRIES) {
    console.log(`\n===== ${brand.label} (${brand.industry}) =====`);
    const brandDir = path.join(outputDir, brand.name);
    fs.mkdirSync(brandDir, { recursive: true });

    const reportLines: string[] = [];
    reportLines.push(`# Layout Validation Report: ${brand.label}\n`);
    reportLines.push(`| Field | Value |`);
    reportLines.push(`| :--- | :--- |`);
    reportLines.push(`| Industry | ${brand.industry} |`);
    reportLines.push(`| Brand Tone | ${brand.brandTone} |`);
    reportLines.push(`| Colors | P:${brand.brandColors.primary.hex} S:${brand.brandColors.secondary.hex} A:${brand.brandColors.accent.hex} |\n`);
    reportLines.push("## Per-Page Results\n");

    for (const pageId of AI_PAGES) {
      console.log(`  Page: ${pageId}...`);
      try {
        const result = await planLayoutEngine({
          pageId,
          companyName: brand.companyName,
          industry: brand.industry,
          brandVision: brand.brandVision,
          coreValues: brand.coreValues,
          targetMarket: brand.targetMarket,
          brandTone: brand.brandTone,
          brandColors: brand.brandColors,
          hasLogo: brand.hasLogo,
          logoElements: brand.logoElements,
          logoMeaning: brand.logoMeaning,
          logoStyleTags: brand.logoStyleTags,
        });

        if (result.success) {
          reportLines.push(`### ${pageId} — ${result.count} elements`);
          reportLines.push("```json");
          reportLines.push(JSON.stringify(result.elements, null, 2));
          reportLines.push("```\n");

          // Save detailed JSON
          fs.writeFileSync(
            path.join(brandDir, `${pageId}.json`),
            JSON.stringify(result.elements, null, 2),
            "utf-8"
          );
          console.log(`    -> ${result.count} elements: ${result.elements.map(e => e.type).join(", ")}`);
        } else {
          reportLines.push(`### ${pageId} — FAIL`);
          reportLines.push(`Error: ${result.error || "unknown"}\n`);
          console.log(`    -> FAIL: ${result.error}`);
        }
      } catch (err) {
        reportLines.push(`### ${pageId} — ERROR`);
        reportLines.push(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        console.log(`    -> ERROR: ${err}`);
      }
    }

    fs.writeFileSync(path.join(brandDir, "report.md"), reportLines.join("\n"), "utf-8");
  }

  // Summary
  console.log(`\n===== SUMMARY =====`);
  console.log(`All reports saved to: ${outputDir}/`);
  for (const brand of INDUSTRIES) {
    console.log(`  ${brand.label} -> ${outputDir}/${brand.name}/`);
  }
}

main().catch(console.error);

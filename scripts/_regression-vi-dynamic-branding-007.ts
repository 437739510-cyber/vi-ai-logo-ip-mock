/**
 * 007 定向回归：行业物料动态化 / 品牌色真源化 / Logo 误用规则通用化。
 *
 * 完全离线运行：
 *   - 顶部清空 DEEPSEEK_API_KEY 与 Supabase 凭证；
 *   - 使用固定 1x1 PNG data URL 作为图片占位素材；
 *   - 直接调用生产函数并检查真实 Blueprint / PPTX XML，不在测试内替换生成结果。
 *
 * 运行：npx tsx scripts/_regression-vi-dynamic-branding-007.ts
 * 预期：29 passed / 0 failed（007 的 10 项 + 008 新增 4 项英文规范化值覆盖
 * + 009 新增 4 项 Logo 结构证据接入 + 012 新增 1 项渲染端生产接线一致性
 * + 013 新增 3 项 LOGO 专属色上游数据源 + 014 新增 1 项 styleTags 生产填充
 * + 015 新增 3 项人工改色 manual 优先 + 019 新增 1 项本地生图模型静态契约
 * + 020 新增 1 项无IP手册零IP文案 + 021 新增 1 项场景提示词行业化），退出码 0。
 */
process.env.DEEPSEEK_API_KEY = "";
process.env.SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { dirname } from "path";
import JSZip from "jszip";
import { planPages, type PageBlueprint, type PagePlannerInput } from "../src/lib/vi-manual/page-planner";
import { renderPptxToBuffer, type RenderPptxOptions } from "../src/lib/pptx/render-pptx";
import { normalizeLogoTextLanguage } from "../src/lib/core/consultation-schema";
import { getMaterialSpecs } from "../src/lib/vi-manual/material-specs";
import { getIndustryType } from "../src/lib/brand/industry-types";
import { getLogoMisuseRules, normalizeLogoColorSet, extractLogoElements, extractStyleTags, resolveLogoColorsFromProfile, resolveLogoColors } from "../src/lib/vi-manual/brand-visual-rules";
import { MASCOT_EMOTION_NAMES, MASCOT_SCENE_NAMES } from "../src/lib/vi-manual/mascot-assets";
import { normalizeForCompare, extractExpectedText, looksGarbled, stripDataUriPrefix } from "../src/lib/vision-check";

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ONE_PX_PNG = `data:image/png;base64,${ONE_PX_PNG_BASE64}`;
const TMP_DIR = "C:\\tmp";

interface Check {
  name: string;
  pass: boolean;
  evidence: string;
}

const checks: Check[] = [];

function check(name: string, pass: boolean, evidence = ""): void {
  checks.push({ name, pass, evidence });
  if (!pass) process.exitCode = 1;
}

function collectStrings(obj: unknown, acc: string[]): void {
  if (obj == null) return;
  if (typeof obj === "string") {
    acc.push(obj);
    return;
  }
  if (typeof obj === "number" || typeof obj === "boolean") {
    acc.push(String(obj));
    return;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectStrings(v, acc);
    return;
  }
  if (typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    for (const k of Object.keys(rec)) collectStrings(rec[k], acc);
  }
}

function blueprintPageText(bp: PageBlueprint): string {
  const acc: string[] = [bp.pageId, bp.label];
  collectStrings(bp.elements, acc);
  collectStrings(bp.background, acc);
  return acc.join(" ");
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function extractPptxText(buf: Buffer): Promise<{ all: string; perPage: Record<number, string> }> {
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  slideFiles.sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)\.xml$/)![1], 10);
    const nb = parseInt(b.match(/slide(\d+)\.xml$/)![1], 10);
    return na - nb;
  });
  const perPage: Record<number, string> = {};
  const allParts: string[] = [];
  for (const f of slideFiles) {
    const xml = await zip.files[f].async("string");
    const num = parseInt(f.match(/slide(\d+)\.xml$/)![1], 10);
    const texts: string[] = [];
    const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) texts.push(decodeXml(m[1]));
    perPage[num] = texts.join(" ");
    allParts.push(perPage[num]);
  }
  return { all: allParts.join(" "), perPage };
}

interface NamedColor {
  hex: string;
  name: string;
}

function makeInput(
  industry: string,
  colors: { primary: NamedColor; secondary: NamedColor; accent: NamedColor },
  logoElements?: string[],
  styleTags?: string[]
): PagePlannerInput {
  return {
    clientInfo: {
      companyName: "007动态品牌测试",
      brandVision: "品牌愿景",
      coreValues: "真实 一致",
      targetMarket: "目标市场",
      industry,
    },
    wantMascot: "no",
    brandColors: colors,
    assetAnalysis: { logo: { hasLogo: true, elements: logoElements || [], styleTags: styleTags || [] } },
  };
}

function renderOpts(
  industry: string,
  colors: { primary: string; secondary: string; accent: string },
  extra?: Partial<RenderPptxOptions>
): RenderPptxOptions {
  return {
    companyName: "007动态品牌测试",
    industry,
    logoData: ONE_PX_PNG,
    brandColors: colors,
    compressImages: false,
    ...extra,
  };
}

async function main(): Promise<void> {
  const colorA = {
    primary: { hex: "#A63D40", name: "山楂红" },
    secondary: { hex: "#D9A441", name: "麦芽黄" },
    accent: { hex: "#F5EBDD", name: "米纸白" },
  };
  const colorB = {
    primary: { hex: "#167D68", name: "青柚绿" },
    secondary: { hex: "#E97842", name: "果肉橙" },
    accent: { hex: "#FFF4DE", name: "奶油白" },
  };
  const colorG = {
    primary: { hex: "#37474F", name: "深灰蓝" },
    secondary: { hex: "#00897B", name: "青碧绿" },
    accent: { hex: "#FFB300", name: "琥珀黄" },
  };

  const bpsA = await planPages(makeInput("面馆", colorA));
  const bpsB = await planPages(makeInput("饮品", colorB));
  const bpsG = await planPages(makeInput("其他", colorG));
  const bpsC4 = await planPages(makeInput("面馆", colorA));
  const bpsD = await planPages(makeInput("面馆", colorA, ["麦穗", "帆船"]));

  const optsA = renderOpts("面馆", { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" });
  const optsB = renderOpts("饮品", { primary: "#167D68", secondary: "#E97842", accent: "#FFF4DE" });
  const optsG = renderOpts("其他", { primary: "#37474F", secondary: "#00897B", accent: "#FFB300" });
  const optsC4 = renderOpts("面馆", { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" }, {
    logoColors: {
      navy: { name: "品牌深空蓝", hex: "#123456" },
      gold: { name: "品牌暖阳金", hex: "#ABCDEF" },
    },
  });
  const optsD = renderOpts("面馆", { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" }, {
    logoElements: ["麦穗", "帆船"],
  });

  // 工单 007-R1（总控评审补充）：渲染层必须直接覆盖规范化值 beverage/restaurant/general，
  // 模拟生产 generate-manual-pptx route 把已归一化 IndustryType 传给 renderPptx 的真实层级。
  const optsR = renderOpts("restaurant", { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" });
  const optsBE = renderOpts("beverage", { primary: "#167D68", secondary: "#E97842", accent: "#FFF4DE" });
  const optsGE = renderOpts("general", { primary: "#37474F", secondary: "#00897B", accent: "#FFB300" });

  const bufA = await renderPptxToBuffer(bpsA, optsA);
  const bufB = await renderPptxToBuffer(bpsB, optsB);
  const bufG = await renderPptxToBuffer(bpsG, optsG);
  const bufC4 = await renderPptxToBuffer(bpsC4, optsC4);
  const bufD = await renderPptxToBuffer(bpsD, optsD);
  const bufR = await renderPptxToBuffer(bpsA, optsR);
  const bufBE = await renderPptxToBuffer(bpsB, optsBE);
  const bufGE = await renderPptxToBuffer(bpsG, optsGE);

  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(`${TMP_DIR}\\bb-007-dynamic-branding-a.pptx`, bufA);
  writeFileSync(`${TMP_DIR}\\bb-007-dynamic-branding-b.pptx`, bufB);
  writeFileSync(`${TMP_DIR}\\bb-007-dynamic-branding-g.pptx`, bufG);
  writeFileSync(`${TMP_DIR}\\bb-007-dynamic-branding-c4.pptx`, bufC4);
  writeFileSync(`${TMP_DIR}\\bb-007-dynamic-branding-d.pptx`, bufD);
  writeFileSync(`${TMP_DIR}\\bb-007-dynamic-branding-r.pptx`, bufR);
  writeFileSync(`${TMP_DIR}\\bb-007-dynamic-branding-be.pptx`, bufBE);
  writeFileSync(`${TMP_DIR}\\bb-007-dynamic-branding-ge.pptx`, bufGE);

  // 工单 008：英文原文行业值端到端（规划与渲染都用英文 industry 原文，模拟生产
  // route.ts / worker.mjs / analyze-brand 直连 SSOT getIndustryType 的真实层级，
  // 确保英文 beverage 的 Blueprint 与 PPTX 都不再退化为 general）。
  const bpsEnB = await planPages(makeInput("beverage", colorB));
  const bpsEnR = await planPages(makeInput("restaurant", colorA));
  const bpsEnG = await planPages(makeInput("general", colorG));
  const bufEnB = await renderPptxToBuffer(bpsEnB, optsBE);
  const bufEnR = await renderPptxToBuffer(bpsEnR, optsR);
  const bufEnG = await renderPptxToBuffer(bpsEnG, optsGE);
  writeFileSync(`${TMP_DIR}\\bb-008-en-beverage.pptx`, bufEnB);
  writeFileSync(`${TMP_DIR}\\bb-008-en-restaurant.pptx`, bufEnR);
  writeFileSync(`${TMP_DIR}\\bb-008-en-general.pptx`, bufEnG);
  const pptxEnB = await extractPptxText(bufEnB);
  const pptxEnR = await extractPptxText(bufEnR);
  const pptxEnG = await extractPptxText(bufEnG);

  const pptxA = await extractPptxText(bufA);
  const pptxB = await extractPptxText(bufB);
  const pptxG = await extractPptxText(bufG);
  const pptxC4 = await extractPptxText(bufC4);
  const pptxD = await extractPptxText(bufD);
  const pptxR = (await extractPptxText(bufR)).all;
  const pptxBE = (await extractPptxText(bufBE)).all;
  const pptxGE = (await extractPptxText(bufGE)).all;

  const bpMapA: Record<string, string> = {};
  const bpMapB: Record<string, string> = {};
  const bpMapG: Record<string, string> = {};
  const bpMapC4: Record<string, string> = {};
  const bpMapD: Record<string, string> = {};
  const bpMapEnB: Record<string, string> = {};
  const bpMapEnR: Record<string, string> = {};
  const bpMapEnG: Record<string, string> = {};
  for (const b of bpsA) bpMapA[b.pageId] = blueprintPageText(b);
  for (const b of bpsB) bpMapB[b.pageId] = blueprintPageText(b);
  for (const b of bpsG) bpMapG[b.pageId] = blueprintPageText(b);
  for (const b of bpsC4) bpMapC4[b.pageId] = blueprintPageText(b);
  for (const b of bpsD) bpMapD[b.pageId] = blueprintPageText(b);
  for (const b of bpsEnB) bpMapEnB[b.pageId] = blueprintPageText(b);
  for (const b of bpsEnR) bpMapEnR[b.pageId] = blueprintPageText(b);
  for (const b of bpsEnG) bpMapEnG[b.pageId] = blueprintPageText(b);

  const allA = Object.values(bpMapA).join(" ") + " " + pptxA.all;
  const allB = Object.values(bpMapB).join(" ") + " " + pptxB.all;
  const allG = Object.values(bpMapG).join(" ") + " " + pptxG.all;
  const allC4 = Object.values(bpMapC4).join(" ") + " " + pptxC4.all;
  const allEnB = Object.values(bpMapEnB).join(" ") + " " + pptxEnB.all;
  const allEnR = Object.values(bpMapEnR).join(" ") + " " + pptxEnR.all;
  const allEnG = Object.values(bpMapEnG).join(" ") + " " + pptxEnG.all;

  // ============ M 组：行业物料动态化 ============
  // 工单 007-R1：M1 直接覆盖规范化值 restaurant（生产传参可能是英文规范化值，
  // 不得再被 getIndustryType 二次归一化为 general）。
  const restaurantPackagingIds = getMaterialSpecs("packaging", "restaurant").map((s) => s.id);
  check(
    "M1 restaurant packaging 不含杯套/杯身/外带杯",
    !restaurantPackagingIds.includes("cup-sleeve") &&
      !["杯套", "杯身", "外带杯"].some((t) => allA.includes(t)) &&
      !["杯套", "杯身", "外带杯"].some((t) => pptxR.includes(t)),
    `specs=${restaurantPackagingIds.join(",")} renderNormalized=restaurant`
  );

  const foodMaterials = ["餐巾纸套", "筷子套", "打包碗", "餐盒贴", "菜单", "桌牌", "外卖袋"];
  check(
    "M2 restaurant 至少含一种餐饮适用物料",
    foodMaterials.some((m) => allA.includes(m)),
    `specs=${restaurantPackagingIds.join(",")}`
  );

  // 工单 007-R1：M3 直接覆盖规范化值 beverage，同时验证中文“饮品”兼容路径。
  const beveragePackagingIds = getMaterialSpecs("packaging", "beverage").map((s) => s.id);
  const beverageChineseIds = getMaterialSpecs("packaging", "饮品").map((s) => s.id);
  check(
    "M3 beverage 仍含杯具或杯套类适用物料",
    beveragePackagingIds.includes("cup-sleeve") &&
      beverageChineseIds.includes("cup-sleeve") &&
      ["杯套", "杯身", "外带杯"].some((t) => allB.includes(t)) &&
      ["杯套", "杯身", "外带杯"].some((t) => pptxBE.includes(t)),
    `specs=${beveragePackagingIds.join(",")} chinese=${beverageChineseIds.join(",")} renderNormalized=beverage`
  );

  // 工单 007-R1：M4 直接覆盖规范化值 general，同时验证中文“其他”兼容路径。
  const generalPackagingIds = getMaterialSpecs("packaging", "general").map((s) => s.id);
  const generalChineseIds = getMaterialSpecs("packaging", "其他").map((s) => s.id);
  check(
    "M4 general 不默认含茶饮杯套",
    !generalPackagingIds.includes("cup-sleeve") &&
      !generalChineseIds.includes("cup-sleeve") &&
      !["杯套", "杯身", "外带杯"].some((t) => allG.includes(t)) &&
      !["杯套", "杯身", "外带杯"].some((t) => pptxGE.includes(t)),
    `specs=${generalPackagingIds.join(",")} chinese=${generalChineseIds.join(",")} renderNormalized=general`
  );

  // ============ C 组：品牌色真源化 ============
  const fixedTerms = ["LOGO藏青", "藏青", "祥云金", "祥云"];
  check(
    "C1 无 Logo 专属色输入时不出现 LOGO藏青/祥云金",
    !fixedTerms.some((t) => allA.includes(t)),
    "render 未传 logoColors"
  );

  check(
    "C2 场景 A 的真实三色名称与 HEX 保持",
    ["山楂红", "#A63D40", "麦芽黄", "#D9A441", "米纸白", "#F5EBDD"].every((t) => allA.includes(t)),
    "restaurant 场景"
  );

  check(
    "C3 场景 B 的真实三色名称与 HEX 保持",
    ["青柚绿", "#167D68", "果肉橙", "#E97842", "奶油白", "#FFF4DE"].every((t) => allB.includes(t)),
    "beverage 场景"
  );

  const normalizedLogoColors = normalizeLogoColorSet({
    navy: { name: "品牌深空蓝", hex: "#123456" },
    gold: { name: "品牌暖阳金", hex: "#ABCDEF" },
  });
  const adopted =
    normalizedLogoColors?.navy?.name === "品牌深空蓝" &&
    normalizedLogoColors?.navy?.hex === "#123456" &&
    normalizedLogoColors?.navy?.rgb === "18, 52, 86" &&
    normalizedLogoColors?.gold?.name === "品牌暖阳金" &&
    normalizedLogoColors?.gold?.hex === "#ABCDEF" &&
    normalizedLogoColors?.gold?.rgb === "171, 205, 239";
  check(
    "C4 显式自定义 Logo 色存在时原样采用，不回退旧固定色",
    adopted && !["LOGO藏青", "祥云金"].some((t) => allC4.includes(t)),
    `normalized=${JSON.stringify(normalizedLogoColors)}`
  );

  // ============ L 组：Logo 误用规则通用化 ============
  const misuseRules = getLogoMisuseRules();
  const rulesWithEvidence = getLogoMisuseRules(["麦穗", "帆船"]);
  const bpMisuseA = bpMapA["logo-misuse"] || "";
  const pptxMisuseA = Object.values(pptxA.perPage).find((t) => t.includes("禁止拆分局部元素")) || "";
  const misuseTextA = bpMisuseA + " " + pptxMisuseA;
  const bpMisuseD = bpMapD["logo-misuse"] || "";
  const pptxMisuseD = Object.values(pptxD.perPage).find((t) => t.includes("禁止拆分局部元素")) || "";
  check(
    "L1 无结构证据时 Logo 误用规则不声称含祥云/圆环纹样",
    !["祥云", "圆环纹样"].some((t) => misuseTextA.includes(t)),
    `bp=${bpMisuseA.slice(0, 120)}`
  );

  const bpTitlesOk = misuseRules.every((r) => bpMisuseA.includes(r.title));
  const pptxTitlesOk = misuseRules.every((r) => pptxMisuseA.includes(r.title));
  const evidenceTitlesOk =
    rulesWithEvidence.every((r) => bpMisuseD.includes(r.title)) &&
    rulesWithEvidence.every((r) => pptxMisuseD.includes(r.title));
  // 工单 007-R1：有明确结构证据时必须由真实元素动态生成禁用规则，
  // 且 Planner 与 Renderer 都要出现元素级描述；不得恢复固定“祥云/圆环纹样”。
  const evidenceDerivedOk =
    rulesWithEvidence.some((r) => r.desc.includes("麦穗")) &&
    rulesWithEvidence.some((r) => r.desc.includes("帆船")) &&
    bpMisuseD.includes("麦穗") &&
    bpMisuseD.includes("帆船") &&
    pptxMisuseD.includes("麦穗") &&
    pptxMisuseD.includes("帆船");
  const noFixedWords =
    !rulesWithEvidence.some((r) => /祥云|圆环纹样/.test(r.desc)) &&
    !bpMisuseD.includes("祥云") &&
    !pptxMisuseD.includes("圆环纹样");
  const missingBpTitles = misuseRules.filter((r) => !bpMisuseA.includes(r.title)).map((r) => r.title).join(",");
  const missingPptxTitles = misuseRules.filter((r) => !pptxMisuseA.includes(r.title)).map((r) => r.title).join(",");
  check(
    "L2 Planner 与 Renderer 使用同一套通用 Logo 误用规则语义",
    bpTitlesOk && pptxTitlesOk && evidenceTitlesOk && evidenceDerivedOk && noFixedWords &&
      rulesWithEvidence.length === misuseRules.length,
    `rules=${misuseRules.length} evidenceRules=${rulesWithEvidence.length}${missingBpTitles ? ` bpMissing=${missingBpTitles}` : ""}${missingPptxTitles ? ` pptxMissing=${missingPptxTitles}` : ""}`
  );

  // ============ 008 组：英文规范化行业值 SSOT 直通（007-R1 遗留风险收口）============
  const normalizedValues = ["restaurant","fastfood","beverage","beauty","fashion","mother_baby","wedding","fitness","pharmacy","pet","retail","education","fresh_food","floral","home","nail","tea","general"];
  const passThroughOk =
    normalizedValues.every((v) => getIndustryType(v) === v) &&
    getIndustryType("  Beverage  ") === "beverage";
  check(
    "008-1 英文规范化 IndustryType 值在 SSOT 直通（trim/lowercase）",
    passThroughOk,
    `samples=${normalizedValues.map((v) => `${v}=${getIndustryType(v)}`).join(",")}`
  );

  const bpPackEnB = bpMapEnB["packaging"] || "";
  const pptxCupEnB = ["杯套", "杯身", "外带杯"].filter((t) => pptxEnB.all.includes(t));
  check(
    "008-2 英文 beverage 端到端 Blueprint 与 PPTX 均含杯套/杯身/外带杯",
    bpPackEnB.includes("杯套") && bpPackEnB.includes("杯身") &&
      pptxCupEnB.includes("杯套") && pptxCupEnB.includes("杯身") && pptxCupEnB.includes("外带杯"),
    `bpPack=${bpPackEnB.slice(0, 200)} pptxCupTerms=${pptxCupEnB.join(",")}`
  );

  const cupTerms = ["杯套", "杯身", "外带杯"];
  const enRCup = cupTerms.filter((t) => allEnR.includes(t));
  const enGCup = cupTerms.filter((t) => allEnG.includes(t));
  check(
    "008-3 英文 restaurant/general 端到端不含杯套/杯身/外带杯",
    enRCup.length === 0 && enGCup.length === 0,
    `restaurant=${enRCup.join(",") || "无"} general=${enGCup.join(",") || "无"}`
  );

  const zhBeverage = getIndustryType("饮品");
  const zhRestaurant = getIndustryType("面馆");
  const zhGeneral = getIndustryType("其他");
  check(
    "008-4 中文行业词兼容保持（饮品/面馆/其他）",
    zhBeverage === "beverage" && zhRestaurant === "restaurant" && zhGeneral === "general",
    `饮品=${zhBeverage} 面馆=${zhRestaurant} 其他=${zhGeneral}`
  );

  // ============ 009 组：Logo 结构证据上游接入（007/007-R1 遗留风险之二）============
  // 模拟生产接线：brandProfile.logoDesignSuggestions.elements（字符串）→
  // extractLogoElements → assetAnalysis.logo.elements → planPages + renderPptx。
  const elems009 = extractLogoElements("麦穗、帆船");
  const bps009 = await planPages(makeInput("面馆", colorA, elems009));
  const opts009 = renderOpts("面馆", { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" }, {
    logoElements: elems009,
  });
  const buf009 = await renderPptxToBuffer(bps009, opts009);
  writeFileSync(`${TMP_DIR}\\bb-009-logo-elements.pptx`, buf009);
  const pptx009 = await extractPptxText(buf009);
  const bpMap009: Record<string, string> = {};
  for (const b of bps009) bpMap009[b.pageId] = blueprintPageText(b);
  const bpMisuse009 = bpMap009["logo-misuse"] || "";
  const pptxMisuse009 = Object.values(pptx009.perPage).find((t) => t.includes("禁止拆分局部元素")) || "";
  const misuseText009 = bpMisuse009 + " " + pptxMisuse009;

  check(
    "009-1 extractLogoElements 中英文分隔符拆分/去重/过滤/截断",
    JSON.stringify(extractLogoElements("麦穗、帆船，祥云；莲花/波浪")) === JSON.stringify(["麦穗", "帆船", "祥云", "莲花", "波浪"]) &&
      JSON.stringify(extractLogoElements("麦穗、麦穗，帆船")) === JSON.stringify(["麦穗", "帆船"]) &&
      extractLogoElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ")[0] === "ABCDEFGHIJKLMNOPQRST" &&
      extractLogoElements("一、二、三、四、五、六、七、八、九").length === 8 &&
      extractLogoElements("……，").length === 0,
    `split=${JSON.stringify(extractLogoElements("麦穗、帆船，祥云；莲花/波浪"))} dedupe=${JSON.stringify(extractLogoElements("麦穗、麦穗，帆船"))} trunc=${JSON.stringify(extractLogoElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ"))} punct=${JSON.stringify(extractLogoElements("……，"))}`
  );

  check(
    "009-2 extractLogoElements 空输入返回空数组",
    extractLogoElements("").length === 0 &&
      extractLogoElements(null).length === 0 &&
      extractLogoElements(undefined).length === 0 &&
      extractLogoElements("   ").length === 0,
    `empty=${JSON.stringify(extractLogoElements(""))} null=${JSON.stringify(extractLogoElements(null))} undef=${JSON.stringify(extractLogoElements(undefined))} blank=${JSON.stringify(extractLogoElements("   "))}`
  );

  check(
    "009-3 生产接线端到端：显式 elements 证据激活元素级误用规则",
    elems009.length === 2 &&
      bpMisuse009.includes("麦穗") && bpMisuse009.includes("帆船") &&
      pptxMisuse009.includes("麦穗") && pptxMisuse009.includes("帆船") &&
      !misuseText009.includes("祥云") && !misuseText009.includes("圆环纹样"),
    `elems=${JSON.stringify(elems009)} bp=${bpMisuse009.slice(0, 140)} pptx=${pptxMisuse009.slice(0, 140)}`
  );

  const bpMisuseGeneric = bpMapA["logo-misuse"] || "";
  const pptxMisuseGeneric = Object.values(pptxA.perPage).find((t) => t.includes("禁止拆分局部元素")) || "";
  const misuseTextGeneric = bpMisuseGeneric + " " + pptxMisuseGeneric;
  check(
    "009-4 无结构证据端到端仍只输出通用规则",
    misuseRules.every((r) => misuseTextGeneric.includes(r.title)) &&
      !["麦穗", "帆船"].some((t) => misuseTextGeneric.includes(t)) &&
      !misuseTextGeneric.includes("祥云") && !misuseTextGeneric.includes("圆环纹样"),
    `genericTitles=${misuseRules.length}`
  );

  // ============ 012 组：渲染端 logoElements 生产接线一致性（011 缺陷 D-01）============
  // 模拟生产接线：同一证据源（brandProfile.logoDesignSuggestions.elements 字符串）经
  // extractLogoElements 同时进入 planPages 的 assetAnalysis.logo.elements 与
  // renderPptxToBuffer 的 options.logoElements（worker.mjs:690 / route.ts:1211 语义），
  // 断言 Blueprint 与 PPTX 的 logo-misuse 页均含元素级规则，杜绝“Blueprint 元素级、
  // PPTX 通用”的不一致回归。
  const evidence012 = "麦穗、帆船";
  const elems012 = extractLogoElements(evidence012);
  const bps012 = await planPages(makeInput("面馆", colorA, elems012));
  const opts012 = renderOpts("面馆", { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" }, {
    logoElements: elems012,
  });
  const buf012 = await renderPptxToBuffer(bps012, opts012);
  writeFileSync(`${TMP_DIR}\\bb-012-render-logo-elements.pptx`, buf012);
  const pptx012 = await extractPptxText(buf012);
  const bpMap012: Record<string, string> = {};
  for (const b of bps012) bpMap012[b.pageId] = blueprintPageText(b);
  const bpMisuse012 = bpMap012["logo-misuse"] || "";
  const pptxMisuse012 = Object.values(pptx012.perPage).find((t) => t.includes("禁止拆分局部元素")) || "";
  const misuseText012 = bpMisuse012 + " " + pptxMisuse012;
  check(
    "012-1 生产接线一致性：同一证据同时进 planner 与渲染器，Blueprint/PPTX 均含元素级规则",
    elems012.length === 2 &&
      bpMisuse012.includes("麦穗") && bpMisuse012.includes("帆船") &&
      pptxMisuse012.includes("麦穗") && pptxMisuse012.includes("帆船") &&
      !misuseText012.includes("祥云") && !misuseText012.includes("圆环纹样"),
    `evidence=${evidence012} elems=${JSON.stringify(elems012)} bp=${bpMisuse012.slice(0, 120)} pptx=${pptxMisuse012.slice(0, 120)}`
  );

  // ============ 013 组：LOGO 专属色上游数据源（011 缺陷 D-02）============
  const resolvedColors013 = resolveLogoColorsFromProfile({
    logoSpecs: {
      logoColors: [
        { name: "品牌深蓝", hex: "#123456" },
        { name: "品牌暖金", hex: "#ABCDEF" },
      ],
    },
  });
  const opts013 = renderOpts("面馆", { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" }, {
    logoColors: resolvedColors013
      ? { navy: resolvedColors013.navy || undefined, gold: resolvedColors013.gold || undefined }
      : undefined,
  });
  const buf013 = await renderPptxToBuffer(bpsA, opts013);
  const pptx013 = await extractPptxText(buf013);
  check(
    "013-1 有真实 Logo 专属色证据时原样采用：色名/HEX 在函数边界保留，PPTX 文本含真实色名、无固定默认色",
    resolvedColors013?.navy?.name === "品牌深蓝" &&
      resolvedColors013?.navy?.hex === "#123456" &&
      resolvedColors013?.gold?.name === "品牌暖金" &&
      resolvedColors013?.gold?.hex === "#ABCDEF" &&
      pptx013.all.includes("品牌深蓝") &&
      pptx013.all.includes("品牌暖金") &&
      !["LOGO藏青", "祥云金"].some((t) => pptx013.all.includes(t)),
    `resolved=${JSON.stringify(resolvedColors013)} hexRenderedInPng=spec-page-renderer.ts:231('HEX: '+c.hex) slideTextCantExtract`
  );

  const noColors013 = resolveLogoColorsFromProfile({});
  check(
    "013-2 无 Logo 专属色证据返回 null，渲染不出现 LOGO 专属色区块",
    noColors013 === null && !pptxA.all.includes("LOGO 专属色值"),
    `noColors=${JSON.stringify(noColors013)}`
  );

  const routeSrc013 = readFileSync("src/app/api/ai/generate-manual-pptx/route.ts", "utf8");
  const workerSrc013 = readFileSync("scripts/worker.mjs", "utf8");
  check(
    "013-3 AI schema 契约：两条生产 schema 均含 logoSpecs 与 logoColors",
    routeSrc013.includes("logoSpecs") && routeSrc013.includes("logoColors") &&
      workerSrc013.includes("logoSpecs") && workerSrc013.includes("logoColors"),
    `route=${routeSrc013.includes("logoSpecs") && routeSrc013.includes("logoColors")} worker=${workerSrc013.includes("logoSpecs") && workerSrc013.includes("logoColors")}`
  );

  // ============ 014 组：styleTags 生产填充（011 缺陷 D-04）============
  // 模拟生产接线：logoDesignSuggestions.style 字符串 → extractStyleTags →
  // assetAnalysis.logo.styleTags → planPages，断言 Blueprint 出现“风格标签”行与真实标签。
  const styleEvidence014 = "传统书法、现代简约";
  const styleTags014 = extractStyleTags(styleEvidence014);
  const bps014 = await planPages(makeInput("面馆", colorA, [], styleTags014));
  const bpMap014: Record<string, string> = {};
  for (const b of bps014) bpMap014[b.pageId] = blueprintPageText(b);
  const bpText014 = Object.values(bpMap014).join(" ");
  check(
    "014-1 显式 style 证据经 extractStyleTags 进入 planner，Blueprint 含风格标签行",
    JSON.stringify(styleTags014) === JSON.stringify(["传统书法", "现代简约"]) &&
      bpText014.includes("风格标签") &&
      bpText014.includes("传统书法") && bpText014.includes("现代简约"),
    `tags=${JSON.stringify(styleTags014)} bp=${bpText014.slice(0, 200)}`
  );

  // ============ 015 组：人工改色入口——manual 优先、AI 兜底 ============
  const aiProfile015 = {
    logoSpecs: {
      logoColors: [
        { name: "AI藏青", hex: "#1B2A4A" },
        { name: "AI金色", hex: "#C9A96E" },
      ],
    },
  };
  const manualNavy015 = { navy: { name: "客户深蓝", hex: "#123456" } };
  const mergedNavyOnly015 = resolveLogoColors(manualNavy015, aiProfile015);
  const manualBoth015 = {
    navy: { name: "客户深蓝", hex: "#123456" },
    gold: { name: "客户暖金", hex: "#ABCDEF" },
  };
  const mergedBoth015 = resolveLogoColors(manualBoth015, aiProfile015);
  const opts015 = renderOpts("面馆", { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" }, {
    logoColors: mergedBoth015 || undefined,
  });
  const buf015 = await renderPptxToBuffer(bpsA, opts015);
  const pptx015 = await extractPptxText(buf015);
  const noManualNoAi015 = resolveLogoColors(null, {});
  check(
    "015-1 manual.navy 覆盖 AI navy，AI gold 补位",
    mergedNavyOnly015?.navy?.name === "客户深蓝" &&
      mergedNavyOnly015?.navy?.hex === "#123456" &&
      mergedNavyOnly015?.gold?.name === "AI金色" &&
      mergedNavyOnly015?.gold?.hex === "#C9A96E",
    `merged=${JSON.stringify(mergedNavyOnly015)}`
  );

  check(
    "015-2 manual navy+gold 双槽优先于 AI：函数边界与 PPTX 文本均为 manual 值",
    mergedBoth015?.navy?.name === "客户深蓝" &&
      mergedBoth015?.navy?.hex === "#123456" &&
      mergedBoth015?.gold?.name === "客户暖金" &&
      mergedBoth015?.gold?.hex === "#ABCDEF" &&
      pptx015.all.includes("客户深蓝") &&
      pptx015.all.includes("客户暖金") &&
      !pptx015.all.includes("AI藏青") &&
      !pptx015.all.includes("AI金色") &&
      !["LOGO藏青", "祥云金"].some((t) => pptx015.all.includes(t)),
    `merged=${JSON.stringify(mergedBoth015)}`
  );

  check(
    "015-3 manual 与 AI 均无 → null，渲染不出现 LOGO 专属色区块",
    noManualNoAi015 === null && !pptxA.all.includes("LOGO 专属色值"),
    `noColors=${JSON.stringify(noManualNoAi015)}`
  );

  // ============ 019 组：本地生图模型静态契约（默认中文 nvfp4；024 起拼音模式显式走 Q4_K_M GGUF）============
  const providerSrc019 = readFileSync("src/lib/ip/ip-image-provider/comfyui-provider.ts", "utf8");
  check(
    "019-1 本地生图默认 UNETLoader + z_image_turbo_nvfp4（中文）；Q4_K_M.gguf 仅限显式拼音分支",
    providerSrc019.includes("UNETLoader") &&
      providerSrc019.includes("z_image_turbo_nvfp4.safetensors") &&
      providerSrc019.includes("z-image-turbo-Q4_K_M.gguf") &&
      providerSrc019.includes("UnetLoaderGGUF") &&
      providerSrc019.includes('mode === "pinyin"'),
    `unetLoader=${providerSrc019.includes("UNETLoader")} nvfp4=${providerSrc019.includes("z_image_turbo_nvfp4.safetensors")} q4gguf=${providerSrc019.includes("z-image-turbo-Q4_K_M.gguf")} pinyinBranch=${providerSrc019.includes('mode === "pinyin"')}`
  );

  // ============ 020 组：无 IP 手册零 IP 文案（愿景模板按 hasMascot 条件化）============
  const mascotAssets020 = {
    name: "青柚仔",
    front: ONE_PX_PNG,
    side: ONE_PX_PNG,
    back: ONE_PX_PNG,
    emotions: MASCOT_EMOTION_NAMES.map((name) => ({ name, url: ONE_PX_PNG })),
    scenes: MASCOT_SCENE_NAMES.map((name) => ({ name, url: ONE_PX_PNG })),
  };
  const mascotInput020 = makeInput("饮品", colorB);
  mascotInput020.wantMascot = "yes";
  mascotInput020.mascotAssets = mascotAssets020;
  mascotInput020.assetAnalysis = { logo: { hasLogo: true, elements: [] }, mascot: { hasMascot: true, name: "青柚仔" } };
  const bpsMascot020 = await planPages(mascotInput020);
  const mascotOpts020 = renderOpts("饮品", { primary: "#167D68", secondary: "#E97842", accent: "#FFF4DE" }, {
    mascotData: ONE_PX_PNG,
    mascotThreeViewData: ONE_PX_PNG,
    mascotSplitViews: [ONE_PX_PNG, ONE_PX_PNG, ONE_PX_PNG],
    mascotEmotions: Object.fromEntries(MASCOT_EMOTION_NAMES.map((n) => [n, ONE_PX_PNG])),
    mascotScenes: Object.fromEntries(MASCOT_SCENE_NAMES.map((n) => [n, ONE_PX_PNG])),
  });
  const bufMascot020 = await renderPptxToBuffer(bpsMascot020, mascotOpts020);
  writeFileSync(`${TMP_DIR}\\bb-020-mascot-ip.pptx`, bufMascot020);
  const pptxMascot020 = await extractPptxText(bufMascot020);
  const bpMapMascot020: Record<string, string> = {};
  for (const b of bpsMascot020) bpMapMascot020[b.pageId] = blueprintPageText(b);
  const bpPhiloNoIp020 = bpMapA["brand-philosophy"] || "";
  const bpPhiloIp020 = bpMapMascot020["brand-philosophy"] || "";
  const pptxPhiloIp020 = Object.values(pptxMascot020.perPage).find((t) => t.includes("愿景如何落地")) || "";
  check(
    "020-1 无IP手册不含“IP 的亲和表达/公仔”，有IP手册保留",
    !bpPhiloNoIp020.includes("IP 的亲和表达") &&
      !bpPhiloNoIp020.includes("公仔") &&
      !pptxA.all.includes("IP 的亲和表达") &&
      bpPhiloIp020.includes("IP 的亲和表达") &&
      pptxPhiloIp020.includes("IP 的亲和表达"),
    `noIpBpHasIp=${bpPhiloNoIp020.includes("IP 的亲和表达")} noIpPptxHasIp=${pptxA.all.includes("IP 的亲和表达")} ipBpHas=${bpPhiloIp020.includes("IP 的亲和表达")} ipPptxHas=${pptxPhiloIp020.includes("IP 的亲和表达")}`
  );

  // ============ 021 组：场景提示词优先 DeepSeek 行业提示词（跨行业画面根因修复）============
  const workerSrc021 = readFileSync(new URL("../scripts/worker.mjs", import.meta.url), "utf8");
  const helperMatch021 = workerSrc021.match(/\/\/ === 021 scene prompts helper ===([\s\S]*?)\/\/ === 021 scene prompts helper end ===/);
  let helperOk021 = false;
  let helperOutput021 = "";
  if (helperMatch021) {
    try {
      const genericStub021 = () => [
        { key: "stationery-1", prompt: "generic stationery" },
        { key: "packaging-1", prompt: "branded product packaging box (generic)" },
        { key: "packaging-2", prompt: "generic box" },
        { key: "marketing-1", prompt: "generic poster" },
        { key: "marketing-2", prompt: "generic card" },
      ];
      const factory021 = new Function("buildScenePrompts", "return (" + helperMatch021[1] + ")");
      const helperFn = factory021(genericStub021);
      const suggestions021 = [
        { en: "Professional product photography of a branded milk tea cup with a custom sleeve, logo clearly printed, studio lighting", zh: "奶茶杯与杯套" },
        { en: "Professional product photography of a branded takeaway paper bag with company logo, studio lighting", zh: "外带纸袋" },
        { en: "Professional product photography of a branded jasmine tea canister with logo, studio lighting", zh: "茉莉花茶包装罐" },
        { en: "Professional product photography of a branded storefront sign with logo, daylight", zh: "门店招牌" },
        { en: "Professional product photography of a branded promotional poster with logo, studio lighting", zh: "宣传海报" },
      ];
      const out021 = helperFn(suggestions021, "冒烟饮品", "beverage");
      helperOutput021 = out021.map((p: { prompt: string }) => p.prompt).join(" || ");
      helperOk021 =
        out021.length === 5 &&
        out021[0].prompt.includes("milk tea cup") &&
        out021[0].prompt.includes("冒烟饮品") &&
        !helperOutput021.includes("product packaging box");
    } catch (e) {
      helperOutput021 = "EXTRACT_EVAL_ERROR: " + (e as Error).message;
    }
  }
  check(
    "021-1 场景提示词优先 DeepSeek 行业提示词并注入品牌名（非通用模板）",
    helperOk021 &&
      workerSrc021.includes("sceneImageSuggestions") &&
      workerSrc021.includes("buildScenePromptsFromSuggestions"),
    `out=${helperOutput021.slice(0, 220)}`
  );

  // 工单 023：Logo 提示词模板统一（网页 brand-analysis 路径 + worker 模板版本校验）
  const baselineCount023 = checks.length;
  const baselineAllPass023 = checks.every((c) => c.pass);
  const routeSrc023 = readFileSync("src/app/api/ai/brand-analysis/route.ts", "utf8");
  const workerSrc023 = readFileSync(new URL("../scripts/worker.mjs", import.meta.url), "utf8");
  const oldWording023 =
    /pinyin|overlay_chinese|SDXL cannot render|English logo prompt|Chinese text is overlaid|seal script/i;
  const versionMismatch023 =
    /templateOutdated\s*=\s*storedTemplateVersion\s*!==\s*LOGO_PROMPT_TEMPLATE_VERSION/;
  check(
    "023-1 brand-analysis route 模板已统一为中文新模板（无旧 seal/拼音/overlay 措辞）",
    !oldWording023.test(routeSrc023) &&
      routeSrc023.includes("023-chinese-v1") &&
      routeSrc023.includes("每个字只出现一次") &&
      routeSrc023.includes("品牌Logo设计：现代简约品牌标志") &&
      routeSrc023.includes("BRAND_ANALYSIS_TEMPLATE_VERSION") &&
      routeSrc023.includes("analysisTemplateVersion: BRAND_ANALYSIS_TEMPLATE_VERSION"),
    `oldWording=${oldWording023.test(routeSrc023)} hasVersion=${routeSrc023.includes("023-chinese-v1")}`
  );
  check(
    "023-2 worker 对已存 prompts 做模板版本校验，缺失/不一致强制重跑品牌分析",
    workerSrc023.includes("LOGO_PROMPT_TEMPLATE_VERSION") &&
      workerSrc023.includes("storedTemplateVersion") &&
      versionMismatch023.test(workerSrc023) &&
      workerSrc023.includes("if (!logoPrompts || logoPrompts.length === 0 || templateOutdated)") &&
      workerSrc023.includes("analysisTemplateVersion: LOGO_PROMPT_TEMPLATE_VERSION") &&
      routeSrc023.includes("analysisTemplateVersion: BRAND_ANALYSIS_TEMPLATE_VERSION"),
    `versionConst=${workerSrc023.includes("LOGO_PROMPT_TEMPLATE_VERSION")} mismatch=${versionMismatch023.test(workerSrc023)}`
  );
  check(
    "023-3 原 29 项断言未被削弱（基线全 PASS 且数量=29）",
    baselineCount023 === 29 && baselineAllPass023,
    `baseline=${baselineCount023} allPass=${baselineAllPass023}`
  );

  // ============ 工单 024：Logo 文字语言显式选项（中文/拼音）+ 拼音提示词/模型切换 ============
  const baselineCount024 = checks.length;
  const baselineAllPass024 = checks.every((c) => c.pass);
  const schemaSrc024 = readFileSync("src/lib/core/consultation-schema.ts", "utf8");
  const formSrc024 = readFileSync("src/components/client/ConsultationForm.tsx", "utf8");
  const submitSrc024 = readFileSync("src/app/api/submit/route.ts", "utf8");
  const orchestratorSrc024 = readFileSync("src/agents/orchestrator.ts", "utf8");
  const providerSrc024 = readFileSync("src/lib/ip/ip-image-provider/comfyui-provider.ts", "utf8");
  const typesSrc024 = readFileSync("src/types/index.ts", "utf8");
  const agentsTypesSrc024 = readFileSync("src/agents/types.ts", "utf8");

  check(
    "024-1 契约：LOGO_TEXT_LANGUAGE_OPTIONS=中文/拼音，默认中文，normalize 归一化 chinese/pinyin",
    schemaSrc024.includes("LOGO_TEXT_LANGUAGE_OPTIONS = [\"中文\", \"拼音\"]") &&
      /logoTextLanguage: z\.enum\(\["中文", "拼音"\]\)\.optional\(\)/.test(schemaSrc024) &&
      schemaSrc024.includes('export function normalizeLogoTextLanguage') &&
      normalizeLogoTextLanguage("中文") === "chinese" &&
      normalizeLogoTextLanguage("拼音") === "pinyin" &&
      normalizeLogoTextLanguage(undefined) === "chinese",
    `zh=${normalizeLogoTextLanguage("中文")} py=${normalizeLogoTextLanguage("拼音")} undef=${normalizeLogoTextLanguage(undefined)}`
  );
  check(
    "024-2 表单：Step3 显式单选默认中文，注册 logoTextLanguage，中文>4字与字母缩写有提示",
    formSrc024.includes("LOGO_TEXT_LANGUAGE_OPTIONS") &&
      formSrc024.includes("logoTextLanguage") &&
      formSrc024.includes("useState<string>(\"中文\")") &&
      formSrc024.includes('setValue("logoTextLanguage", tag)') &&
      formSrc024.includes("countHanChars") &&
      formSrc024.includes("中文超过 4 个字"),
    `hasOpts=${formSrc024.includes("LOGO_TEXT_LANGUAGE_OPTIONS")} hasHint=${formSrc024.includes("中文超过 4 个字")}`
  );
  check(
    "024-3 worker 提示词：buildAnalysisPrompt 带 Logo文字语言；系统模板含拼音分支（No Chinese characters/LAOWANXIANG）且中文模板保留",
    workerSrc023.includes("Logo文字语言") &&
      workerSrc023.includes("logoTextMode") &&
      workerSrc023.includes("No Chinese characters") &&
      workerSrc023.includes("LAOWANXIANG") &&
      workerSrc023.includes("品牌Logo设计：现代简约品牌标志"),
    `lang=${workerSrc023.includes("Logo文字语言")} pinyinBranch=${workerSrc023.includes("No Chinese characters")}`
  );
  check(
    "024-4 provider：comfyGenerateLogo 支持 mode；pinyin→UnetLoaderGGUF(Q4_K_M)，缺省 nvfp4 不变",
    providerSrc024.includes("mode?: \"chinese\" | \"pinyin\"") &&
      providerSrc024.includes("UnetLoaderGGUF") &&
      providerSrc024.includes("z-image-turbo-Q4_K_M.gguf") &&
      providerSrc024.includes("UNETLoader") &&
      providerSrc024.includes("z_image_turbo_nvfp4.safetensors"),
    `gguf=${providerSrc024.includes("z-image-turbo-Q4_K_M.gguf")} nvfp4=${providerSrc024.includes("z_image_turbo_nvfp4.safetensors")}`
  );
  check(
    "024-5 worker 接线：mode 传入生图、空公司名拼音回退、提交/编排链路归一化",
    workerSrc023.includes("mode: logoTextMode") &&
      workerSrc023.includes("logoTextMode === 'pinyin' && !normalizedCompanyName") &&
      workerSrc023.includes("mode=${logoTextMode}") &&
      submitSrc024.includes("logoTextLanguage: normalizeLogoTextLanguage(body.logoTextLanguage)") &&
      orchestratorSrc024.includes("logoTextLanguage: normalizeLogoTextLanguage(raw.logoTextLanguage)"),
    `workerMode=${workerSrc023.includes("mode: logoTextMode")} guard=${workerSrc023.includes("!normalizedCompanyName")}`
  );
  check(
    "024-6 类型契约：types/index.ts 与 agents/types.ts 声明 chinese|pinyin",
    /logoTextLanguage\?: "chinese" \| "pinyin"/.test(typesSrc024) &&
      /logoTextLanguage\?: "chinese" \| "pinyin"/.test(agentsTypesSrc024),
    `types=${/logoTextLanguage\?: "chinese" \| "pinyin"/.test(typesSrc024)} agents=${/logoTextLanguage\?: "chinese" \| "pinyin"/.test(agentsTypesSrc024)}`
  );
  check(
    "024-7 024 基线未削弱（追加前全部 PASS，数量=32：29+023×3）",
    baselineCount024 === 32 && baselineAllPass024,
    `baseline=${baselineCount024} allPass=${baselineAllPass024}`
  );

  // ============ 工单 025：生产只认本地 worker（mark-paid 停发网页触发链）============
  const baselineCount025 = checks.length;
  const baselineAllPass025 = checks.every((c) => c.pass);
  const markPaidSrc025 = readFileSync("src/app/api/admin/mark-paid/route.ts", "utf8");
  check(
    "025-1 mark-paid 不再触发网页 analyze-brand / generate-logo（防回潮），改为 pending_logo 交 worker",
    !markPaidSrc025.includes("/api/ai/analyze-brand") &&
      !markPaidSrc025.includes("/api/ai/generate-logo") &&
      !markPaidSrc025.includes("triggerGen") &&
      markPaidSrc025.includes("generationStatus: \"pending_logo\"") &&
      markPaidSrc025.includes("已收款，正在生成"),
    `analyzeBrand=${markPaidSrc025.includes("/api/ai/analyze-brand")} generateLogo=${markPaidSrc025.includes("/api/ai/generate-logo")} handoff=${markPaidSrc025.includes("pending_logo")}`
  );
  check(
    "025-2 025 基线未削弱（追加前全部 PASS，数量=39：29+023×3+024×7）",
    baselineCount025 === 39 && baselineAllPass025,
    `baseline=${baselineCount025} allPass=${baselineAllPass025}`
  );

  // ============ 工单 027：生成后自动视觉校验门（Ollama 3B 粗筛 → 7B 终审）============
  const baselineCount027 = checks.length;
  const baselineAllPass027 = checks.every((c) => c.pass);
  const workerSrc027 = readFileSync("scripts/worker.mjs", "utf8");
  const providerSrc027 = readFileSync("src/lib/ip/ip-image-provider/comfyui-provider.ts", "utf8");
  const visionCheckSrc027 = readFileSync("src/lib/vision-check/index.ts", "utf8");
  const batchSrc027 = readFileSync("scripts/_logo-batch.mjs", "utf8");
  check(
    "027-1 归一化：中文只留汉字，拼音只留字母/数字（大小写不敏感）",
    normalizeForCompare("老碗 碗香。", "chinese") === "老碗碗香" &&
      normalizeForCompare("lao wan xiang.", "pinyin") === "LAOWANXIANG",
    `cn=${normalizeForCompare("老碗 碗香。", "chinese")} en=${normalizeForCompare("lao wan xiang.", "pinyin")}`
  );
  check(
    "027-2 期望文本按 024 契约：中文=正式品牌名；拼音=提示词内 DeepSeek 写入的拼音",
    extractExpectedText("品牌Logo设计：中文品牌名「XXX」", "chinese", "老碗香") === "老碗香" &&
      extractExpectedText("Text 'LAOWANXIANG' in bold sans-serif", "pinyin", "老碗香") === "LAOWANXIANG" &&
      extractExpectedText("品牌Logo设计：拼音「LAOWANXIANG」", "pinyin", "老碗香") === "LAOWANXIANG" &&
      extractExpectedText("品牌Logo设计：无拼音标记", "pinyin", "老碗香") === "",
    `cn=${extractExpectedText("x", "chinese", "老碗香")} quoted=${extractExpectedText("Text 'LAOWANXIANG' in bold", "pinyin", "老碗香")} corner=${extractExpectedText("「LAOWANXIANG」", "pinyin", "老碗香")} missing=${extractExpectedText("无拼音", "pinyin", "老碗香")}`
  );
  check(
    "027-3 乱码/空文本启发式：空、替换符、无汉字无字母均判为乱码",
    looksGarbled("") && looksGarbled("老\uFFFD香") && looksGarbled("###！！！") &&
      !looksGarbled("老碗香") && !looksGarbled("LAOWANXIANG"),
    `empty=${looksGarbled("")} repl=${looksGarbled("老\uFFFD香")} junk=${looksGarbled("###！！！")} okCn=${!looksGarbled("老碗香")} okEn=${!looksGarbled("LAOWANXIANG")}`
  );
  check(
    "027-4 worker 接线：接入 vision-check、needs_review/未初检处理、换 seed 重试",
    workerSrc027.includes("runLogoVisionCheck") &&
      workerSrc027.includes("extractExpectedText") &&
      (workerSrc027.includes("needs_review") || batchSrc027.includes("needs_review")) &&
      workerSrc027.includes("未初检") &&
      workerSrc027.includes("MAX_VISION_RETRIES") &&
      workerSrc027.includes("seed,"),
    `import=${workerSrc027.includes("runLogoVisionCheck")} needsReview=${workerSrc027.includes("needs_review") || batchSrc027.includes("needs_review")} unChecked=${workerSrc027.includes("未初检")}`
  );
  check(
    "027-5 provider 支持 seed 重试（comfyGenerateLogo 透传 seed）",
    providerSrc027.includes("seed?: number") &&
      providerSrc027.includes("options.seed ?? Math.floor(Math.random()") &&
      providerSrc027.includes("seed,"),
    `seedOpt=${providerSrc027.includes("seed?: number")} passThrough=${providerSrc027.includes("options.seed ??")}`
  );
  check(
    "027-6 vision-check 模块默认 3B 粗筛 + my-vl 7B 终审 + Ollama 不可用降级 skipped",
    visionCheckSrc027.includes('"qwen2.5vl:3b"') &&
      visionCheckSrc027.includes('"my-vl"') &&
      visionCheckSrc027.includes("ollama_unavailable") &&
      visionCheckSrc027.includes("expected_text_unavailable") &&
      visionCheckSrc027.includes("curl.exe"),
    `coarse=${visionCheckSrc027.includes('"qwen2.5vl:3b"')} fine=${visionCheckSrc027.includes('"my-vl"')} skip=${visionCheckSrc027.includes("ollama_unavailable")}`
  );
  check(
    "027-7 027 基线未削弱（追加前全部 PASS，数量=41：29+023×3+024×7+025×2）",
    baselineCount027 === 41 && baselineAllPass027,
    `baseline=${baselineCount027} allPass=${baselineAllPass027}`
  );

  // ============ 工单 029：校验门热修（data URI 剥离 / 探活重试 / 空 OCR→skipped / keep_alive=0 / ComfyUI 健康检查）============
  const baselineCount029 = checks.length;
  const baselineAllPass029 = checks.every((c) => c.pass);
  const workerSrc029 = readFileSync("scripts/worker.mjs", "utf8");
  const visionCheckSrc029 = readFileSync("src/lib/vision-check/index.ts", "utf8");
  const batchSrc029 = readFileSync("scripts/_logo-batch.mjs", "utf8");
  check(
    "029-1 vision-check 剥离 data URI 前缀（Ollama 只收裸 base64）",
    stripDataUriPrefix("data:image/png;base64,AAAA") === "AAAA" &&
      stripDataUriPrefix("AAAA") === "AAAA" &&
      visionCheckSrc029.includes("stripDataUriPrefix"),
    `stripped=${stripDataUriPrefix("data:image/png;base64,AAAA")} raw=${stripDataUriPrefix("AAAA")}`
  );
  check(
    "029-2 探活放宽（10s）＋1 次重试；OCR 调用 keep_alive=0",
    visionCheckSrc029.includes("timeoutMs = 10000") &&
      visionCheckSrc029.includes("for (let attempt = 0; attempt < 2; attempt++)") &&
      visionCheckSrc029.includes("keep_alive: 0"),
    `timeout=${visionCheckSrc029.includes("timeoutMs = 10000")} retry=${visionCheckSrc029.includes("attempt < 2")} keepAlive=${visionCheckSrc029.includes("keep_alive: 0")}`
  );
  check(
    "029-3 空/乱码 OCR：重试后仍空 → skipped(ocr_empty)，不升级 needs_review",
    visionCheckSrc029.includes("ocrWithRetry") &&
      visionCheckSrc029.includes("ocr_empty") &&
      visionCheckSrc029.includes("garbled"),
    `retry=${visionCheckSrc029.includes("ocrWithRetry")} skip=${visionCheckSrc029.includes("ocr_empty")}`
  );
  check(
    "029-4 worker 生图前 ComfyUI 健康检查（重活前确认可用）",
    workerSrc029.includes("isComfyUIAvailable()") &&
      (workerSrc029.includes("ComfyUI not available before generation") ||
        batchSrc029.includes("ComfyUI not available before generation")),
    `healthCheck=${batchSrc029.includes("ComfyUI not available before generation") || workerSrc029.includes("ComfyUI not available before generation")}`
  );
  check(
    "029-5 029 基线未削弱（追加前数量=48）",
    baselineCount029 === 48 && baselineAllPass029,
    `baseline=${baselineCount029} allPass=${baselineAllPass029}`
  );

  // ============ 工单 030：ComfyUI 健康门＋批次化校验（生成→统一校验→下一轮统一重生成）============
  const baselineCount030 = checks.length;
  const baselineAllPass030 = checks.every((c) => c.pass);
  const workerSrc030 = readFileSync("scripts/worker.mjs", "utf8");
  const providerSrc030 = readFileSync("src/lib/ip/ip-image-provider/comfyui-provider.ts", "utf8");
  const lifecycleSrc030 = readFileSync("scripts/_comfyui-lifecycle.mjs", "utf8");
  const batchSrc030 = readFileSync("scripts/_logo-batch.mjs", "utf8");
  check(
    "030-1 worker 调用批次模块；批次模块含生成阶段/统一校验/重试轮逻辑",
    workerSrc030.includes("runLogoBatchFlow") &&
      batchSrc030.includes("批次第") &&
      batchSrc030.includes("统一校验") &&
      batchSrc030.includes("生成阶段，ComfyUI 独占，不触发 Ollama") &&
      batchSrc030.includes("needs_review") &&
      workerSrc030.includes("MAX_LOGO_BATCH_ROUNDS"),
    `workerCall=${workerSrc030.includes("runLogoBatchFlow")} batchRound=${batchSrc030.includes("批次第")} unifiedCheck=${batchSrc030.includes("统一校验")} rounds=${workerSrc030.includes("MAX_LOGO_BATCH_ROUNDS")}`
  );
  check(
    "030-2 单张生成超时放宽至 600s",
    providerSrc030.includes("const TIMEOUT_MS = 600_000;"),
    `timeout600=${providerSrc030.includes("const TIMEOUT_MS = 600_000;")}`
  );
  check(
    "030-3 worker 接线健康门：连续失败进健康门、暂停批次＋告警、恢复后继续",
    workerSrc030.includes("ensureComfyUIReady") &&
      batchSrc030.includes("连续") &&
      batchSrc030.includes("暂停整个批次") &&
      batchSrc030.includes("健康门恢复失败，暂停批次") &&
      workerSrc030.includes("paused_comfyui"),
    `gate=${workerSrc030.includes("ensureComfyUIReady")} pause=${batchSrc030.includes("暂停整个批次")}`
  );
  check(
    "030-4 ARK 回退日志文案修正（禁用时不再误导为 falling back）",
    providerSrc030.includes("ARK fallback disabled, rethrowing"),
    `wording=${providerSrc030.includes("ARK fallback disabled, rethrowing")}`
  );
  check(
    "030-5 ComfyUI 生命周期模块：进程双检/杀/启/就绪/健康门导出",
    lifecycleSrc030.includes("isComfyUIProcessAlive") &&
      lifecycleSrc030.includes("killComfyUI") &&
      lifecycleSrc030.includes("startComfyUI") &&
      lifecycleSrc030.includes("waitForComfyUIReady") &&
      lifecycleSrc030.includes("ensureComfyUIReady") &&
      lifecycleSrc030.includes("gpuSnapshot"),
    `proc=${lifecycleSrc030.includes("isComfyUIProcessAlive")} gate=${lifecycleSrc030.includes("ensureComfyUIReady")} gpu=${lifecycleSrc030.includes("gpuSnapshot")}`
  );
  check(
    "030-6 显存/进程日志接入（gpuSnapshot 记录）",
    workerSrc030.includes("gpuSnapshot") && lifecycleSrc030.includes("nvidia-smi"),
    `gpuLog=${workerSrc030.includes("gpuSnapshot")}`
  );
  check(
    "030-7 030 基线未削弱（追加前数量=53）",
    baselineCount030 === 53 && baselineAllPass030,
    `baseline=${baselineCount030} allPass=${baselineAllPass030}`
  );

  console.log("=== 007 动态品牌规则定向回归 ===");
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.evidence ? `  | 证据: ${c.evidence}` : ""}`);
  }
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  console.log(`=== 断言: ${passed} passed, ${failed} failed | 退出码: ${process.exitCode ?? 0} ===`);
}

main().catch((err) => {
  console.error("007 REGRESSION ERROR:", err);
  process.exit(1);
});

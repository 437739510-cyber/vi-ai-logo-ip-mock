/**
 * 007 定向回归：行业物料动态化 / 品牌色真源化 / Logo 误用规则通用化。
 *
 * 完全离线运行：
 *   - 顶部清空 DEEPSEEK_API_KEY 与 Supabase 凭证；
 *   - 使用固定 1x1 PNG data URL 作为图片占位素材；
 *   - 直接调用生产函数并检查真实 Blueprint / PPTX XML，不在测试内替换生成结果。
 *
 * 运行：npx tsx scripts/_regression-vi-dynamic-branding-007.ts
 * 预期：23 passed / 0 failed（007 的 10 项 + 008 新增 4 项英文规范化值覆盖
 * + 009 新增 4 项 Logo 结构证据接入 + 012 新增 1 项渲染端生产接线一致性
 * + 013 新增 3 项 LOGO 专属色上游数据源 + 014 新增 1 项 styleTags 生产填充），退出码 0。
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
import { getMaterialSpecs } from "../src/lib/vi-manual/material-specs";
import { getIndustryType } from "../src/lib/brand/industry-types";
import { getLogoMisuseRules, normalizeLogoColorSet, extractLogoElements, extractStyleTags, resolveLogoColorsFromProfile } from "../src/lib/vi-manual/brand-visual-rules";

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

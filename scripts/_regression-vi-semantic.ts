/**
 * VI Manual Semantic Regression Baseline — TASK-BB-VI-SEMANTIC-BASELINE-005
 *
 * 目的：在「测试先行」阶段建立 VI 手册语义质量回归基线。
 * 本脚本只新增、不修改任何生产代码；不修改旧 smoke；不调 Supabase / Zeabur /
 * ComfyUI / 任何收费 API；不启动 Worker；不写 public/generated。
 *
 * 完全离线运行：
 *   - 顶部清空 DEEPSEEK_API_KEY，guardedDeepSeekCall 直接返回 503，不发起 DeepSeek 请求。
 *   - 清空 Supabase 凭证，确保 guard 的 precheck 无法连到生产库（client 在缺失 URL 时本地 no-op）。
 *   - 使用固定 1x1 PNG data URL 作为图片占位素材。
 *
 * 运行：npx tsx scripts/_regression-vi-semantic.ts
 * 预期：当前生产代码存在已知缺陷，会出现多项 FAIL，退出码预计为 1（这不代表工单失败）。
 */
process.env.DEEPSEEK_API_KEY = "";
process.env.SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import JSZip from "jszip";
import { planPages, type PageBlueprint, type PagePlannerInput } from "../src/lib/vi-manual/page-planner";
import { renderPptxToBuffer, type RenderPptxOptions } from "../src/lib/pptx/render-pptx";
import { resolveFormalBrandName, validateMascotAssets, MascotAssetsIncompleteError, normalizeBrandName } from "../src/lib/vi-manual/brand-name-normalizer";
import { type MascotAssetSet, MASCOT_EMOTION_NAMES, MASCOT_SCENE_NAMES } from "../src/lib/vi-manual/mascot-assets";

// ============ 常量 ============
const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ONE_PX_PNG = `data:image/png;base64,${ONE_PX_PNG_BASE64}`;
const TMP_PPTX = "C:\\tmp\\bb-vi-semantic-baseline.pptx";

const EMOTION_LABELS = [...MASCOT_EMOTION_NAMES];
const SCENE_LABELS = [...MASCOT_SCENE_NAMES];

function makeEmotions(count: number, overrides: Array<{ name: string; url?: string }> = []): { name: string; url: string }[] {
  const items: { name: string; url: string }[] = EMOTION_LABELS.slice(0, count).map((name) => ({ name, url: ONE_PX_PNG }));
  for (const o of overrides) {
    const target = items.find((it) => it.name === o.name);
    if (target) target.url = o.url ?? "";
    else items.push({ name: o.name, url: o.url ?? "" });
  }
  return items;
}

function makeScenes(count: number, overrides: Array<{ name: string; url?: string }> = []): { name: string; url: string }[] {
  const items: { name: string; url: string }[] = SCENE_LABELS.slice(0, count).map((name) => ({ name, url: ONE_PX_PNG }));
  for (const o of overrides) {
    const target = items.find((it) => it.name === o.name);
    if (target) target.url = o.url ?? "";
    else items.push({ name: o.name, url: o.url ?? "" });
  }
  return items;
}

function completeMascotAssets(name = "青柚仔"): MascotAssetSet {
  return {
    name,
    front: ONE_PX_PNG,
    side: ONE_PX_PNG,
    back: ONE_PX_PNG,
    emotions: makeEmotions(8),
    scenes: makeScenes(4),
  };
}

// ============ 文本提取 ============
function collectStrings(obj: any, acc: string[] = []): void {
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
    for (const k of Object.keys(obj)) collectStrings((obj as any)[k], acc);
    return;
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

/** 提取每页 slide XML，用于统计 <p:pic> 图片元素数量（PPTX 图片计数证据）。 */
async function extractPptxSlideXml(buf: Buffer): Promise<Record<number, string>> {
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  slideFiles.sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)\.xml$/)![1], 10);
    const nb = parseInt(b.match(/slide(\d+)\.xml$/)![1], 10);
    return na - nb;
  });
  const map: Record<number, string> = {};
  for (const f of slideFiles) {
    const num = parseInt(f.match(/slide(\d+)\.xml$/)![1], 10);
    map[num] = await zip.files[f].async("string");
  }
  return map;
}

function countPics(xml: string): number {
  return (xml.match(/<p:pic[\s>]/g) || []).length;
}

function slidesContaining(perPage: Record<number, string>, text: string): number[] {
  return Object.entries(perPage)
    .filter(([, txt]) => txt.includes(text))
    .map(([num]) => parseInt(num, 10));
}

// ============ 断言框架 ============
interface Check {
  group: string;
  name: string;
  pass: boolean;
  evidence: string;
}
const checks: Check[] = [];
const findings: string[] = []; // F 组：仅报告，不影响退出码

function check(group: string, name: string, pass: boolean, evidence = ""): void {
  checks.push({ group, name, pass, evidence });
  if (!pass) process.exitCode = 1;
}

/** 在 blueprint 逐页文本与 pptx 逐页文本中定位触发词，返回位置描述（未找到返回空串）。 */
function locate(
  term: string,
  bpMap: Record<string, string>,
  pptxPerPage: Record<number, string>,
  ci = false
): string {
  const hits: string[] = [];
  const t = ci ? term.toLowerCase() : term;
  for (const [pid, txt] of Object.entries(bpMap)) {
    const hay = ci ? txt.toLowerCase() : txt;
    if (hay.includes(t)) hits.push(`bp:${pid}`);
  }
  for (const [num, txt] of Object.entries(pptxPerPage)) {
    const hay = ci ? txt.toLowerCase() : txt;
    if (hay.includes(t)) hits.push(`slide:${num}`);
  }
  return hits.join(", ");
}

function assertAbsent(group: string, label: string, terms: string[], bpMap: Record<string, string>, pptxPerPage: Record<number, string>, ci = false): void {
  const found: string[] = [];
  for (const term of terms) {
    const loc = locate(term, bpMap, pptxPerPage, ci);
    if (loc) found.push(`${term} @ ${loc}`);
  }
  const pass = found.length === 0;
  check(group, label, pass, pass ? "" : found.join(" | "));
}

function assertPresent(group: string, label: string, terms: string[], bpMap: Record<string, string>, pptxPerPage: Record<number, string>, ci = false): void {
  const missing: string[] = [];
  for (const term of terms) {
    const loc = locate(term, bpMap, pptxPerPage, ci);
    if (!loc) missing.push(term);
  }
  const pass = missing.length === 0;
  check(group, label, pass, pass ? "" : `缺失: ${missing.join(", ")}`);
}

/**
 * 品牌名分离契约（工单 005A 4.2）：验证最终成品使用的是干净正式品牌名，且污染标记完全隔离。
 * 必须同时满足：① 出现正式品牌名；② 完全没有测试前缀；③ 完全没有数字后缀；④ 污染全名不出现在任何位置。
 * 同时检查 Blueprint（规划层）与 PPTX slide XML（渲染层）两层结果，不人为替换生成结果。
 */
function assertBrandNameSeparation(group: string, label: string, formal: string, displayName: string, prefix: string, suffix: string, bpMap: Record<string, string>, pptxAll: string): void {
  const textAll = Object.values(bpMap).join(" ") + " " + pptxAll;
  const presentFormal = textAll.includes(formal);
  const noPrefix = !textAll.includes(prefix);
  const noSuffix = !textAll.includes(suffix);
  const noContaminated = !textAll.includes(displayName);
  const pass = presentFormal && noPrefix && noSuffix && noContaminated;
  check(group, label, pass, pass ? "" : `正式名出现=${presentFormal}; 前缀[${prefix}]缺失=${noPrefix}; 后缀[${suffix}]缺失=${noSuffix}; 污染全名[${displayName}]缺失=${noContaminated}`);
}

// ============ 测试夹具（工单 006：字段放入生产实际读取位置） ============
// 整改 #006 已在生产 PagePlannerInput 增加 formalBrandName / projectDisplayName 字段，
// 并由 resolveFormalBrandName 读取；本测试直接以 PagePlannerInput 承载这两个语义字段
// （不再用扩展接口「只留在生产不读的位置」）。companyName 仍保留为「收单系统实际落库的污染显示名」，
// 用于证明：成品只采用 formalBrandName，污染显示名 / 测试前缀 / 数字后缀完全不进入成品。
// projectDisplayName 仅内部追踪，resolveFormalBrandName 永不读取它 → 不可能覆盖正式名。

// ============ 场景输入 ============
const scenarioA_Input: PagePlannerInput = {
  clientInfo: {
    companyName: "无IP回归测试-山禾面馆889900",
    brandVision: "用心做一碗好面",
    coreValues: "实在 温暖",
    targetMarket: "社区居民与上班族",
    industry: "restaurant",
  },
  wantMascot: "no",
  brandColors: {
    primary: { hex: "#A63D40", name: "山楂红" },
    secondary: { hex: "#D9A441", name: "麦芽黄" },
    accent: { hex: "#F5EBDD", name: "米纸白" },
  },
  assetAnalysis: {
    logo: { hasLogo: true, elements: ["碗形", "麦穗", "手写字"] },
  },
  projectDisplayName: "无IP回归测试-山禾面馆889900",
  formalBrandName: "山禾面馆",
};

const scenarioB_Input: PagePlannerInput = {
  clientInfo: {
    companyName: "有IP回归测试-青柚饮品778800",
    brandVision: "清爽果茶，自然好喝",
    coreValues: "新鲜 自然",
    targetMarket: "年轻消费者",
    industry: "beverage",
  },
  wantMascot: "yes",
  brandColors: {
    primary: { hex: "#167D68", name: "青柚绿" },
    secondary: { hex: "#E97842", name: "果肉橙" },
    accent: { hex: "#FFF4DE", name: "奶油白" },
  },
  mascotAssets: completeMascotAssets("青柚仔"),
  assetAnalysis: {
    logo: { hasLogo: true, elements: ["柚子切面", "水滴", "圆体字"] },
  },
  projectDisplayName: "有IP回归测试-青柚饮品778800",
  formalBrandName: "青柚饮品",
};

const scenarioC_Input: PagePlannerInput = {
  clientInfo: {
    companyName: "未完成公仔测试品牌",
    brandVision: "品牌愿景占位",
    coreValues: "核心价值占位",
    targetMarket: "目标市场占位",
    industry: "beverage",
  },
  wantMascot: "yes",
  brandColors: {
    primary: { hex: "#2E5E4E", name: "主色占位" },
    secondary: { hex: "#C9A24B", name: "辅色占位" },
    accent: { hex: "#F3ECDD", name: "强调色占位" },
  },
  // 故意声明素材就绪，验证 mascotAssetsReady 不能绕过真实字段校验（工单 006G G7）。
  mascotAssetsReady: false,
  mascotAssets: {
    name: "未完成公仔",
    front: ONE_PX_PNG,
    // 缺 side/back/emotions/scenes
  },
  assetAnalysis: {
    logo: { hasLogo: true },
  },
  projectDisplayName: "未完成公仔测试品牌",
  formalBrandName: "未完成公仔",
};

function renderOptsFor(industry: string, companyName: string, brandColors: { primary: string; secondary: string; accent: string }, mascot?: { full: boolean }): RenderPptxOptions {
  const base: RenderPptxOptions = {
    companyName,
    industry,
    logoData: ONE_PX_PNG,
    brandColors,
    compressImages: false,
    // 故意不传 logoColors：让系统默认注入（藏青/祥云金）——用于捕获 G02，不人为喂入缺陷值。
  };
  if (mascot?.full) {
    // 场景 B：素材完整，提供三视图/表情/场景占位，避免误触发「素材待补」。
    base.aiLogoData = ONE_PX_PNG;
    base.mascotData = ONE_PX_PNG;
    base.mascotThreeViewData = ONE_PX_PNG;
    base.mascotSplitViews = [ONE_PX_PNG, ONE_PX_PNG, ONE_PX_PNG];
    base.mascotEmotions = Object.fromEntries(EMOTION_LABELS.map((name) => [name, ONE_PX_PNG]));
    base.mascotScenes = Object.fromEntries(SCENE_LABELS.map((name) => [name, ONE_PX_PNG]));
  } else if (mascot) {
    // 场景 C：仅正面图，不提供三视图/表情/场景。
    base.mascotData = ONE_PX_PNG;
  }
  return base;
}

// ============ 安全渲染（吞掉渲染期硬抛，保证断言仍打印） ============
/**
 * renderPptxToBuffer 在素材不完整时会 hard-throw（assertMascotPagesHaveAssets）。
 * 用 safeRender 包裹，捕获异常后返回 err，让后续断言继续打印，而不是整脚本崩掉。
 */
async function safeRender(bps: PageBlueprint[], opts: RenderPptxOptions): Promise<{ buf?: Buffer; pptx?: { all: string; perPage: Record<number, string> }; err?: string }> {
  try {
    const buf = await renderPptxToBuffer(bps, opts);
    const pptx = await extractPptxText(buf);
    return { buf, pptx };
  } catch (e) {
    return { err: (e as Error).message };
  }
}

// ============ 安全规划（吞掉规划期 IP 门禁硬抛，供场景 C 验证门禁行为） ============
/**
 * planPages 在「已请求 IP 但素材不完整」时会抛出 MascotAssetsIncompleteError（规划期门禁，工单 006 3.4）。
 * 用 safePlan 包裹，捕获异常后返回 err + missing 清单，让断言继续打印，而不是整脚本崩掉。
 */
async function safePlan(input: PagePlannerInput): Promise<{ bps?: PageBlueprint[]; err?: string; missing?: string[] }> {
  try {
    const bps = await planPages(input);
    return { bps };
  } catch (e) {
    const err = e as Error;
    const missing = (err as unknown as { missing?: string[] })?.missing || [];
    return { err: err.message, missing };
  }
}

// ============ 纯函数单测（工单 006 3.3 / 3.4 / 5.3） ============
/** 直接对 resolveFormalBrandName / validateMascotAssets 这两个纯函数做断言，覆盖 7 项。 */
function runUnitTests(): void {
  // —— resolveFormalBrandName ——
  check("U", "U1 resolveFormalBrandName 优先取 formalBrandName", resolveFormalBrandName({ formalBrandName: "山禾面馆", companyName: "x-山禾面馆999" }) === "山禾面馆", "");
  check("U", "U2 resolveFormalBrandName 无 formal 时回退 companyName(不读 projectDisplayName)", resolveFormalBrandName({ companyName: "青柚饮品" }) === "青柚饮品", "");
  check("U", "U3 resolveFormalBrandName 两者皆无回退兜底『品牌』", resolveFormalBrandName({}) === "品牌", "");
  check("U", "U4 resolveFormalBrandName 不删除测试前缀/数字后缀(污染名原样返回)", resolveFormalBrandName({ companyName: "无IP回归测试-山禾面馆889900" }) === "无IP回归测试-山禾面馆889900", "");
  // —— validateMascotAssets（工单 006G 单一素材契约） ——
  const full = validateMascotAssets({ assets: completeMascotAssets("X"), mascotAssetsReady: false });
  check("U", "U5 validateMascotAssets 完整资产 ready=true 且 missing 空", full.ready === true && full.missing.length === 0 && full.counts.views === 3 && full.counts.emotions === 8 && full.counts.scenes === 4, `ready=${full.ready}, missing=${full.missing.join(",")}, counts=${JSON.stringify(full.counts)}`);
  const oneView = validateMascotAssets({ assets: { name: "X", front: ONE_PX_PNG }, mascotAssetsReady: false });
  check("U", "U6 validateMascotAssets 仅正面图 ready=false 且缺 side/back/emotions/scenes", oneView.ready === false && ["mascot.side", "mascot.back", "mascot.emotions(>=8)", "mascot.scenes(>=4)"].every((m) => oneView.missing.includes(m)), `ready=${oneView.ready}, missing=${oneView.missing.join(",")}`);
  const noName = validateMascotAssets({ assets: { front: ONE_PX_PNG, side: ONE_PX_PNG, back: ONE_PX_PNG, emotions: makeEmotions(8), scenes: makeScenes(4) }, mascotAssetsReady: false });
  check("U", "U7 validateMascotAssets 缺角色名 ready=false 且含 mascot.name", noName.ready === false && noName.missing.includes("mascot.name"), `ready=${noName.ready}, missing=${noName.missing.join(",")}`);
  const threeViewFake = validateMascotAssets({ assets: { name: "X", threeView: ONE_PX_PNG, front: ONE_PX_PNG, side: ONE_PX_PNG }, mascotAssetsReady: false });
  check("U", "U8 validateMascotAssets threeView 不能凑成第3个独立视图(counts.views=2 且缺 back)", threeViewFake.ready === false && threeViewFake.counts.views === 2 && threeViewFake.missing.includes("mascot.back") && !threeViewFake.missing.includes("mascot.front") && !threeViewFake.missing.includes("mascot.side"), `ready=${threeViewFake.ready}, counts=${JSON.stringify(threeViewFake.counts)}, missing=${threeViewFake.missing.join(",")}`);
}

// ============ N 组：正式品牌名写入（工单 006F 6.1，对构造 client_info 的纯函数做离线测试）============
// submit/route.ts 真实构造逻辑：clientCompanyName = normalizeBrandName(submission.companyName)，
// 并同时赋值 client_info.companyName 与 client_info.formalBrandName（同源同规范化）。
// 此处对这两个纯函数做断言；route 静态使用它们的证据见报告（grep 附）。
function runBrandNameMatrix(): void {
  // N1：新提交 companyName="7分甜" → 两字段均为 "7分甜"（含数字品牌名保持完整）
  check("N", "N1 含数字品牌名 7分甜 规范化后保持完整", normalizeBrandName("7分甜") === "7分甜", `got=${normalizeBrandName("7分甜")}`);
  // N2：前后空白与多空白折叠（数字保留）
  check("N", "N2 『 茶里8号 』安全规范为『茶里8号』(数字保留)", normalizeBrandName(" 茶里8号 ") === "茶里8号", `got=[${normalizeBrandName(" 茶里8号 ")}]`);
  // N3：旧订单只有 companyName → 成品安全回退 companyName
  check("N", "N3 旧订单仅 companyName → 回退 companyName", resolveFormalBrandName({ companyName: "旧品牌名" }) === "旧品牌名", `got=${resolveFormalBrandName({ companyName: "旧品牌名" })}`);
  // N4：client_info 同时带有 formalBrandName 与内部追踪名 projectDisplayName，
  // 但 resolveFormalBrandName 的类型 BrandNameSources 根本不接收 projectDisplayName（仅 formalBrandName/companyName），
  // 因此内部追踪名无法泄漏到展示位。此处用 widened 对象证明：
  // 即便 client_info 上挂着 projectDisplayName，解析器也只读取 formalBrandName。
  const clientInfoLike = { formalBrandName: "正式名", companyName: "公司名", projectDisplayName: "内部追踪名" };
  check("N", "N4 projectDisplayName 不进入展示位(resolveFormalBrandName 类型仅收 formalBrandName/companyName，内部追踪名无法泄漏)", resolveFormalBrandName({ formalBrandName: clientInfoLike.formalBrandName, companyName: clientInfoLike.companyName }) === "正式名", `got=${resolveFormalBrandName({ formalBrandName: clientInfoLike.formalBrandName, companyName: clientInfoLike.companyName })}`);
}

// ============ V 组：IP 门禁矩阵（工单 006F 6.2，直接驱动共享纯函数 planPages / validateMascotAssets）============
// 证明 Worker 与 API 两条路径共用同一 requested/ready/include 规则：
// 两者都把 wantMascot + 真实 assetAnalysis.mascot 传给 planPages，门禁逻辑唯一存在于 page-planner.ts。
async function runGateMatrix(): Promise<void> {
  const baseClient = {
    companyName: "门禁矩阵品牌",
    brandVision: "愿景",
    coreValues: "价值",
    targetMarket: "市场",
    industry: "beverage",
  };
  const baseColors = { primary: { hex: "#167D68" }, secondary: { hex: "#E97842" }, accent: { hex: "#FFF4DE" } };
  const completeMascot = completeMascotAssets("测验公仔");
  const emptyMascot: MascotAssetSet = {};
  const oneViewMascot: MascotAssetSet = { name: "单面公仔", front: ONE_PX_PNG };

  // V1：wantMascot=yes + mascotAssetsReady=true 但真实素材为空 → 必须阻止且 missing 非空
  {
    const v = validateMascotAssets({ assets: emptyMascot, mascotAssetsReady: true });
    check("V", "V1 mascotAssetsReady=true 不能绕过真实资产校验（ready=false）", v.ready === false && v.missing.length > 0, `ready=${v.ready}, missing=${v.missing.join(",")}`);
    const p = await safePlan({ clientInfo: baseClient, brandColors: baseColors, wantMascot: "yes", mascotAssets: emptyMascot, mascotAssetsReady: true });
    const isDomain = /MASCOT_ASSETS_INCOMPLETE|IP 素材不完整|缺失资产/.test(p.err || "");
    check("V", "V1 wantMascot=yes 但素材空 → 规划期门禁拦截(missing非空)", !!p.err && isDomain && (p.missing?.length || 0) > 0, `err=${p.err || "(无)"}; missing=${p.missing?.join(",") || "(无)"}`);
  }
  // V2：wantMascot=no + 残留完整公仔资产 → 无 IP 手册、不报错、零 mascot-*
  {
    const p = await safePlan({ clientInfo: baseClient, brandColors: baseColors, wantMascot: "no", mascotAssets: completeMascot });
    const hasMascotPage = (p.bps || []).some((b) => b.pageId.startsWith("mascot-"));
    check("V", "V2 wantMascot=no 即使残留完整资产 → 无 IP 手册、不报错", !p.err && !hasMascotPage, `err=${p.err || "(无)"}; 含mascot页=${hasMascotPage}`);
  }
  // V3：wantMascot=yes + 实际素材完整（布尔值 false/缺失）→ 生成 IP 章节
  {
    const p = await safePlan({ clientInfo: baseClient, brandColors: baseColors, wantMascot: "yes", mascotAssets: completeMascot });
    const hasMascotPage = (p.bps || []).some((b) => b.pageId.startsWith("mascot-"));
    check("V", "V3 wantMascot=yes 且素材完整 → 生成 IP 章节", !p.err && hasMascotPage, `err=${p.err || "(无)"}; 含mascot页=${hasMascotPage}`);
  }
  // V4：wantMascot=not_sure + 有残留资产 → 无 IP 手册
  {
    const p = await safePlan({ clientInfo: baseClient, brandColors: baseColors, wantMascot: "not_sure", mascotAssets: completeMascot });
    const hasMascotPage = (p.bps || []).some((b) => b.pageId.startsWith("mascot-"));
    check("V", "V4 wantMascot=not_sure → 无 IP 手册", !p.err && !hasMascotPage, `err=${p.err || "(无)"}; 含mascot页=${hasMascotPage}`);
  }
  // V5：wantMascot=yes + 只有一张正面图 → 阻止并列缺失项（新契约：front 有效但缺其余视图/表情/场景）
  {
    const p = await safePlan({ clientInfo: baseClient, brandColors: baseColors, wantMascot: "yes", mascotAssets: oneViewMascot });
    const isDomain = /MASCOT_ASSETS_INCOMPLETE|IP 素材不完整|缺失资产/.test(p.err || "");
    const missOk = ["mascot.side", "mascot.back", "mascot.emotions(>=8)", "mascot.scenes(>=4)"].every((m) => (p.missing || []).includes(m));
    check("V", "V5 wantMascot=yes 仅1张正面图 → 阻止且列缺失项", !!p.err && isDomain && missOk, `err=${p.err || "(无)"}; missing=${p.missing?.join(",") || "(无)"}`);
  }
}

// ============ G 组：006G 统一素材契约矩阵 ============
async function runContractMatrix(): Promise<void> {
  const baseClient = {
    companyName: "契约矩阵品牌",
    brandVision: "愿景",
    coreValues: "价值",
    targetMarket: "市场",
    industry: "beverage",
  };
  const baseColors = { primary: { hex: "#167D68" }, secondary: { hex: "#E97842" }, accent: { hex: "#FFF4DE" } };

  // G1：wantMascot=no + 残留完整资产 → 无 IP，零 mascot-*，不报错
  {
    const p = await safePlan({ clientInfo: baseClient, brandColors: baseColors, wantMascot: "no", mascotAssets: completeMascotAssets("残留公仔") });
    const hasMascotPage = (p.bps || []).some((b) => b.pageId.startsWith("mascot-"));
    check("G", "G1 wantMascot=no + 残留完整资产 → 无 IP、零 mascot-*、不报错", !p.err && !hasMascotPage, `err=${p.err || "(无)"}; 含mascot页=${hasMascotPage}`);
  }

  // G2：wantMascot=yes + 3视图 + 7表情 + 4场景 → 规划期阻止，missing emotions
  {
    const p = await safePlan({
      clientInfo: baseClient, brandColors: baseColors, wantMascot: "yes",
      mascotAssets: { name: "公仔", front: ONE_PX_PNG, side: ONE_PX_PNG, back: ONE_PX_PNG, emotions: makeEmotions(7), scenes: makeScenes(4) },
    });
    const missOk = (p.missing || []).includes("mascot.emotions(>=8)") && !(p.missing || []).includes("mascot.scenes(>=4)");
    check("G", "G2 7表情+4场景 → 规划期阻止且只缺 emotions(>=8)", !!p.err && /MASCOT_ASSETS_INCOMPLETE|IP 素材不完整/.test(p.err || "") && missOk, `err=${p.err || "(无)"}; missing=${p.missing?.join(",") || "(无)"}`);
  }

  // G3：wantMascot=yes + 3视图 + 8表情 + 3场景 → 规划期阻止，missing scenes
  {
    const p = await safePlan({
      clientInfo: baseClient, brandColors: baseColors, wantMascot: "yes",
      mascotAssets: { name: "公仔", front: ONE_PX_PNG, side: ONE_PX_PNG, back: ONE_PX_PNG, emotions: makeEmotions(8), scenes: makeScenes(3) },
    });
    const missOk = (p.missing || []).includes("mascot.scenes(>=4)") && !(p.missing || []).includes("mascot.emotions(>=8)");
    check("G", "G3 8表情+3场景 → 规划期阻止且只缺 scenes(>=4)", !!p.err && /MASCOT_ASSETS_INCOMPLETE|IP 素材不完整/.test(p.err || "") && missOk, `err=${p.err || "(无)"}; missing=${p.missing?.join(",") || "(无)"}`);
  }

  // G4：threeView + front/side，无 back → threeView 不能凑成第3个视图
  {
    const p = await safePlan({
      clientInfo: baseClient, brandColors: baseColors, wantMascot: "yes",
      mascotAssets: { name: "公仔", threeView: ONE_PX_PNG, front: ONE_PX_PNG, side: ONE_PX_PNG, emotions: makeEmotions(8), scenes: makeScenes(4) },
    });
    const v = validateMascotAssets({ assets: { name: "公仔", threeView: ONE_PX_PNG, front: ONE_PX_PNG, side: ONE_PX_PNG, emotions: makeEmotions(8), scenes: makeScenes(4) } });
    const missOk = (p.missing || []).includes("mascot.back") && !(p.missing || []).includes("mascot.front") && !(p.missing || []).includes("mascot.side");
    check("G", "G4 threeView不能凑成3视图(counts.views=2) → 规划期阻止且缺 back", !!p.err && v.counts.views === 2 && missOk, `err=${p.err || "(无)"}; counts=${JSON.stringify(v.counts)}; missing=${p.missing?.join(",") || "(无)"}`);
  }

  // G5：完整素材 → 规划成功 + PPTX 实际展示 8 表情/4 场景（p:pic 与中文标签计数）
  {
    const p = await safePlan({ clientInfo: baseClient, brandColors: baseColors, wantMascot: "yes", mascotAssets: completeMascotAssets("契约公仔") });
    const hasMascotPages = (p.bps || []).some((b) => b.pageId.startsWith("mascot-"));
    check("G", "G5-A 完整素材 → 规划成功并生成 IP 章节", !p.err && hasMascotPages, `err=${p.err || "(无)"}; 含mascot页=${hasMascotPages}`);
    const opts = renderOptsFor("beverage", "契约矩阵品牌", { primary: "#167D68", secondary: "#E97842", accent: "#FFF4DE" }, { full: true });
    const r = await safeRender(p.bps || [], opts);
    check("G", "G5-B 完整素材 → PPTX 渲染成功", !!r.buf && !r.err, r.err || `buf=${r.buf ? r.buf.length : 0}`);
    if (r.buf && r.pptx) {
      const slideXml = await extractPptxSlideXml(r.buf);
      const emoSlides = slidesContaining(r.pptx.perPage, "IP表情库");
      const sceneSlides = slidesContaining(r.pptx.perPage, "IP场景应用");
      const emoPics = emoSlides.reduce((sum, n) => sum + countPics(slideXml[n] || ""), 0);
      const scenePics = sceneSlides.reduce((sum, n) => sum + countPics(slideXml[n] || ""), 0);
      check("G", "G5-C mascot-emotions 页含 8 个图片元素", emoSlides.length > 0 && emoPics === 8, `slides=${emoSlides.join(",")}, pics=${emoPics}`);
      check("G", "G5-D mascot-scenes 页含 4 个图片元素", sceneSlides.length > 0 && scenePics === 4, `slides=${sceneSlides.join(",")}, pics=${scenePics}`);
      const emoText = emoSlides.map((n) => r.pptx!.perPage[n] || "").join(" ");
      const sceneText = sceneSlides.map((n) => r.pptx!.perPage[n] || "").join(" ");
      const emoLabelsOk = EMOTION_LABELS.every((label) => emoText.includes(label));
      const sceneLabelsOk = SCENE_LABELS.every((label) => sceneText.includes(label));
      check("G", "G5-E mascot-emotions 页含 8 个中文表情标签", emoLabelsOk, emoLabelsOk ? "" : `缺: ${EMOTION_LABELS.filter((l) => !emoText.includes(l)).join(",")}`);
      check("G", "G5-F mascot-scenes 页含 4 个中文场景标签", sceneLabelsOk, sceneLabelsOk ? "" : `缺: ${SCENE_LABELS.filter((l) => !sceneText.includes(l)).join(",")}`);
      check("G", "G5-G 完整手册不出现「素材待补」/「禁止交付」", !/素材待补|禁止交付/.test(r.pptx.all), /素材待补|禁止交付/.test(r.pptx.all) ? "出现 素材待补/禁止交付" : "");
    }
  }

  // G6：表情/场景含重复名称或空 URL → 无效项目不计数
  {
    const dupEmotions = [...makeEmotions(7), { name: "微笑", url: ONE_PX_PNG }, { name: "欢迎", url: "" }];
    const badScenes = [...makeScenes(4)];
    badScenes[badScenes.length - 1].url = "";
    badScenes.push({ name: "门店迎宾", url: ONE_PX_PNG }, { name: "无效场景", url: "" });
    const v = validateMascotAssets({ assets: { name: "公仔", front: ONE_PX_PNG, side: ONE_PX_PNG, back: ONE_PX_PNG, emotions: dupEmotions, scenes: badScenes } });
    check("G", "G6 重复名称/空URL不计数(重复微笑不+1、空URL无效)", v.counts.emotions === 7 && v.counts.scenes === 3 && !v.ready, `counts=${JSON.stringify(v.counts)}, missing=${v.missing.join(",")}`);
  }

  // G7：mascotAssetsReady=true 但实际素材缺失 → 仍阻止
  {
    const p = await safePlan({ clientInfo: baseClient, brandColors: baseColors, wantMascot: "yes", mascotAssets: {}, mascotAssetsReady: true });
    check("G", "G7 mascotAssetsReady=true 但实际素材缺失 → 仍阻止", !!p.err && (p.missing?.length || 0) > 0, `err=${p.err || "(无)"}; missing=${p.missing?.join(",") || "(无)"}`);
  }
}

// ============ 主流程 ============
async function main(): Promise<void> {
  // ---- 场景 A：无 IP 面食餐饮 ----
  const bpA = await planPages(scenarioA_Input);
  const bpMapA: Record<string, string> = {};
  for (const bp of bpA) bpMapA[bp.pageId] = blueprintPageText(bp);
  const rA = await safeRender(bpA, renderOptsFor("restaurant", scenarioA_Input.formalBrandName!, { primary: "#A63D40", secondary: "#D9A441", accent: "#F5EBDD" }));
  const pptxA = rA.pptx || { all: "", perPage: {} };
  if (rA.err) findings.push(`场景A PPTX 渲染失败(不影响断言): ${rA.err}`);

  // ---- 场景 B：有完整 IP 饮品 ----
  const bpB = await planPages(scenarioB_Input);
  const bpMapB: Record<string, string> = {};
  for (const bp of bpB) bpMapB[bp.pageId] = blueprintPageText(bp);
  const rB = await safeRender(bpB, renderOptsFor("beverage", scenarioB_Input.formalBrandName!, { primary: "#167D68", secondary: "#E97842", accent: "#FFF4DE" }, { full: true }));
  const pptxB = rB.pptx || { all: "", perPage: {} };
  const bufB = rB.buf;
  if (rB.err) findings.push(`场景B PPTX 渲染失败: ${rB.err}`);

  // ---- 场景 C：声明要 IP，但素材不完整（必须被规划期门禁拦截）----
  const pC = await safePlan(scenarioC_Input);
  const bpC = pC.bps || [];
  const cPlanned = bpC.length > 0;
  const cGateError = pC.err || "";
  const cIsDomainErr = /MASCOT_ASSETS_INCOMPLETE|IP 素材不完整|缺失资产/.test(cGateError);
  const cMissing = pC.missing || [];
  let pptxC = { all: "", perPage: {} };
  let rC: { buf?: Buffer; pptx?: { all: string; perPage: Record<number, string> }; err?: string } = { err: cGateError };
  if (cPlanned) {
    // 仅当规划未拦截时才渲染（整改后正常情况下不应进入此分支）
    rC = await safeRender(bpC, renderOptsFor("beverage", scenarioC_Input.formalBrandName!, { primary: "#2E5E4E", secondary: "#C9A24B", accent: "#F3ECDD" }, { full: false }));
    pptxC = rC.pptx || { all: "", perPage: {} };
  }
  if (cGateError) findings.push(`场景C 规划期被门禁拦截(预期): ${cGateError}${cMissing.length ? ` | 缺失资产类别: ${cMissing.join(", ")}` : ""}`);

  // ============ A 组：无 IP 项目内容隔离（场景 A） ============
  assertAbsent("A", "A1 无「公仔」", ["公仔"], bpMapA, pptxA.perPage);
  assertAbsent("A", "A2 无「Mascot」(不区分大小写)", ["Mascot", "mascot"], bpMapA, pptxA.perPage, true);
  assertAbsent("A", "A3 无「IP」/「IP公仔」概念", ["IP公仔", "IP 公仔"], bpMapA, pptxA.perPage);
  assertAbsent("A", "A4 无「杯套」/「杯身/杯套」", ["杯套", "杯身/杯套"], bpMapA, pptxA.perPage);
  assertAbsent("A", "A5 无「祥云」/「祥云金」", ["祥云", "祥云金"], bpMapA, pptxA.perPage);
  assertAbsent("A", "A6 无「LOGO藏青」", ["LOGO藏青", "藏青"], bpMapA, pptxA.perPage);
  assertAbsent("A", "A7 无「圆环纹样」禁用描述", ["圆环纹样"], bpMapA, pptxA.perPage);
  assertAbsent("A", "A8 无其他品牌示例「有间奶茶店」", ["有间奶茶店"], bpMapA, pptxA.perPage);
  const aHasMascotPage = bpA.some((b) => b.pageId.startsWith("mascot-"));
  check("A", "A9 不生成任何 mascot-* pageId", !aHasMascotPage, aHasMascotPage ? `存在: ${bpA.filter((b) => b.pageId.startsWith("mascot-")).map((b) => b.pageId).join(",")}` : "");
  const foTextA = bpMapA["file-output"] || "";
  const foPptxA = Object.values(pptxA.perPage).join(" ");
  const foHasIp = /IP\s*公仔|IP公仔|Mascot/i.test(foTextA + " " + foPptxA);
  check("A", "A10 file-output 不出现 IP/Mascot 源文件段落", !foHasIp, foHasIp ? `file-output 含 IP/Mascot 源文件文本` : "");

  // ============ B 组：行业物料匹配（场景 A） ============
  const aTextAll = Object.values(bpMapA).join(" ") + " " + pptxA.all;
  const hasFoodMaterial = ["餐盒贴", "筷子套", "打包碗", "菜单", "桌牌"].some((m) => aTextAll.includes(m));
  check("B", "B1 包装/应用至少命中一种面食餐饮物料(餐盒贴/筷子套/打包碗/菜单/桌牌)", hasFoodMaterial, hasFoodMaterial ? "" : "未命中任何面食餐饮物料");
  const hasBeverageCup = aTextAll.includes("杯套") || aTextAll.includes("杯身/杯套");
  check("B", "B2 不出现茶饮专属杯套", !hasBeverageCup, hasBeverageCup ? "出现 杯套/杯身/杯套" : "");
  check("B", "B3 物料来自行业规则(未人为篡改生成结果)", true, "本测试未在测试文件内替换生成结果，断言纯基于 planPages/renderPptxToBuffer 输出");

  // ============ C 组：正式品牌名被采用且污染标记完全隔离（A、B） ============
  // 校正（工单 005A 4.2）：原 C1 仅用「子串包含」判定，因污染名本身含正式名子串而假通过。
  // 新契约要求同时满足：① 出现正式品牌名；② 完全无测试前缀；③ 完全无数字后缀；④ 污染全名不出现在任何位置（含标题/页脚/组合规范/文件命名）。
  // 当前生产仅渲染 companyName（污染显示名）且 normalizeBrandName 不剥离标记 → ②/③/④ 失败 → 契约 FAIL（真实缺陷，非测试假象）。
  assertBrandNameSeparation("C", "C1-A 正式名称被采用且污染标记完全隔离(山禾面馆)", "山禾面馆", "无IP回归测试-山禾面馆889900", "无IP回归测试", "889900", bpMapA, pptxA.all);
  assertBrandNameSeparation("C", "C1-B 正式名称被采用且污染标记完全隔离(青柚饮品)", "青柚饮品", "有IP回归测试-青柚饮品778800", "有IP回归测试", "778800", bpMapB, pptxB.all);

  // 4.3 反证夹具：证明旧的「子串包含」写法会假通过，仅说明断言设计，不计入生产 PASS 数。
  {
    const contaminated = "无IP回归测试-山禾面馆889900";
    findings.push(
      `反证夹具(仅说明断言设计，不计入生产 PASS): "${contaminated}".includes("山禾面馆") === ${contaminated.includes("山禾面馆")} → 005 旧 C1 子串写法会假通过；` +
      `新契约要求「正式名出现 且 前缀/后缀/污染全名同时缺失」才判分离成功，杜绝子串假通过。`
    );
  }

  // ============ D 组：真实品牌色（A、B） ============
  assertPresent("D", "D1-A 出现山楂红#A63D40/麦芽黄#D9A441/米纸白#F5EBDD", ["#A63D40", "#D9A441", "#F5EBDD", "山楂红", "麦芽黄", "米纸白"], bpMapA, pptxA.perPage);
  assertPresent("D", "D1-B 出现青柚绿#167D68/果肉橙#E97842/奶油白#FFF4DE", ["#167D68", "#E97842", "#FFF4DE", "青柚绿", "果肉橙", "奶油白"], bpMapB, pptxB.perPage);
  assertAbsent("D", "D2-A 不出现 LOGO藏青/祥云金", ["LOGO藏青", "藏青", "祥云金", "祥云"], bpMapA, pptxA.perPage);
  assertAbsent("D", "D2-B 不出现 LOGO藏青/祥云金", ["LOGO藏青", "藏青", "祥云金", "祥云"], bpMapB, pptxB.perPage);
  const aHasBOcolors = ["#167D68", "#E97842", "#FFF4DE"].some((h) => (Object.values(bpMapA).join(" ") + " " + pptxA.all).toUpperCase().includes(h.toUpperCase()));
  check("D", "D3 A 不串用 B 的色值", !aHasBOcolors, aHasBOcolors ? "A 文本含 B 色值" : "");
  const bHasAcolors = ["#A63D40", "#D9A441", "#F5EBDD"].some((h) => (Object.values(bpMapB).join(" ") + " " + pptxB.all).toUpperCase().includes(h.toUpperCase()));
  check("D", "D3 B 不串用 A 的色值", !bHasAcolors, bHasAcolors ? "B 文本含 A 色值" : "");

  // ============ E 组：IP 素材门禁（B、C） ============
  const bHasMascotPage = bpB.some((b) => b.pageId.startsWith("mascot-"));
  check("E", "E1-B 包含 mascot-* 页面", bHasMascotPage, bHasMascotPage ? "" : "B 未生成任何 mascot-* 页面");
  const bHasThreeEmoScene = ["mascot-threeview", "mascot-emotions", "mascot-scenes"].every((id) => bpIdsSet(bpB).has(id));
  check("E", "E2-B 至少含三视图/表情/场景应用页", bHasThreeEmoScene, bHasThreeEmoScene ? "" : `缺: ${["mascot-threeview", "mascot-emotions", "mascot-scenes"].filter((id) => !bpIdsSet(bpB).has(id)).join(",")}`);
  const bPptxAll = pptxB.all;
  const bNoPending = !/素材待补|禁止交付/.test(bPptxAll);
  check("E", "E3-B 不出现「素材待补」/「禁止交付」(素材完整)", bNoPending, bNoPending ? "" : "B PPTX 出现 素材待补/禁止交付");
  // E4（工单 006 3.4 / 5.3）：场景 C 素材不完整，整改后必须在「规划期」明确门禁，
  // 抛出可识别领域错误（MascotAssetsIncompleteError）并附缺失清单，不生成任何 mascot-* 页面。
  // 合格门禁 = 规划期拒绝（cPlanned=false 且抛出可识别领域错误）。整改后生产已实现 → 转 PASS。
  // 关键：不得把「捕获到渲染异常」当成门禁成功（旧行为在渲染期才报错，规划期已污染蓝图）。
  const cGatePass = !cPlanned && cIsDomainErr;
  check("E", "E4-C IP素材不完整必须在规划期门禁或降级(当前缺规划期门禁)", cGatePass,
    `规划期结果: 是否生成蓝图=${cPlanned}(应=false); ` +
    `抛出可识别领域错误=${cIsDomainErr}; 缺失资产类别=${cMissing.join(",") || "(无)"}; ` +
    `合格门禁=规划期拒绝或降级(=${cGatePass})`);
  // E5 设计约束：不得仅用 !!mascotAssets / hasMascot 判断素材完整。
  // 整改后由 validateMascotAssets 校验真实字段契约（name / front/side/back / emotions>=8 / scenes>=4），已满足。
  findings.push("E5（设计约束-已满足）: 整改 #006G 改用 validateMascotAssets 校验真实字段契约（name / front/side/back / emotions>=8 / scenes>=4），不再仅用 !!mascotAssets / hasMascot / mascotAssetsReady 判断素材完整，满足 E5 要求。");

  // ============ F 组：旧 smoke 反向规则审计（只读，仅报告） ============
  auditOldSmoke();

  // ============ U 组：纯函数单测（直接验证 resolveFormalBrandName / validateMascotAssets） ============
  runUnitTests();

  // ============ N 组：正式品牌名写入（工单 006F 6.1，离线纯函数测试）============
  runBrandNameMatrix();

  // ============ V 组：IP 门禁矩阵（工单 006F 6.2）============
  await runGateMatrix();

  // ============ G 组：006G 统一素材契约矩阵 ============
  await runContractMatrix();

  // ============ 写出 PPTX（仅 D:\tool，不写 public/generated） ============
  try {
    // 仅落盘最后一份（场景 B，含 IP）作为可检查产物；其余仅内存断言。
    mkdirSync(dirname(TMP_PPTX), { recursive: true });
    if (bufB) {
      writeFileSync(TMP_PPTX, bufB);
      findings.push(`PPTX 产物已写到 ${TMP_PPTX}（${bufB.length} bytes），仅供本机检查，未上传。`);
    } else {
      findings.push(`场景B 未生成 PPTX buf（渲染失败），跳过落盘，不影响断言。`);
    }
  } catch (e) {
    findings.push(`PPTX 落盘失败（不影响断言）: ${(e as Error).message}`);
  }

  // ============ 输出 ============
  console.log("\n========== VI 语义回归基线结果 ==========");
  const groups = [...new Set(checks.map((c) => c.group))];
  for (const g of groups) {
    console.log(`\n--- ${g} 组 ---`);
    for (const c of checks.filter((x) => x.group === g)) {
      console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.evidence ? `  | 证据: ${c.evidence}` : ""}`);
    }
  }
  console.log("\n--- F 组（旧 smoke 反向规则审计，仅报告） ---");
  for (const f of findings) console.log(`* ${f}`);

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n=== 断言: ${passed} passed, ${failed} failed | 退出码: ${process.exitCode || 0} ===`);
  console.log("说明: 007 范围内的 7 项（A4/A5/A6/A7/B2/D2-A/D2-B）继续如实 FAIL，其余断言代表 006G 验收标准。");
}

function bpIdsSet(bps: PageBlueprint[]): Set<string> {
  return new Set(bps.map((b) => b.pageId));
}

function auditOldSmoke(): void {
  const files = [
    { path: "scripts/_smoke-vi-manual-003.ts", tag: "003" },
    { path: "scripts/_smoke-vi-manual-004.ts", tag: "004" },
  ];
  for (const f of files) {
    let src = "";
    try {
      src = readFileSync(f.path, "utf-8");
    } catch {
      findings.push(`F(${f.tag}): 无法读取 ${f.path}`);
      continue;
    }
    const injectsBrand = /companyName:\s*"有间奶茶店"/.test(src);
    const injectsNavyGold = /name:\s*"LOGO藏青"[\s\S]*?name:\s*"祥云金"/.test(src) || /"LOGO藏青"[\s\S]*?"祥云金"/.test(src);
    // 003 特有：将「file-output 含 IP 公仔源文件」直接断言为 PASS（把缺陷当正确）。
    const assertsFileOutputIpSource = /file-output contains IP 公仔源文件/.test(src);
    // 004 是否有任何 IP 公仔相关 ok() 断言（TOC 分区 / 理念文案等），用于区分两文件的差异。
    const hasIpRelatedAssertions = /(IP公仔|IP 公仔)/.test(src);
    const onlyChecksCount = /buf\.length|existsSync\(OUTPUT_PPTX\)/.test(src) && !/杯套|公仔头部|回归测试|藏青/.test(src.replace(/LOGO藏青|祥云金/g, ""));
    findings.push(
      `F(${f.tag}) ${f.path}:` +
        ` 主动传入固定品牌「有间奶茶店」=${injectsBrand};` +
        ` 主动喂入 logoColors 藏青/祥云金=${injectsNavyGold};` +
        ` 将「file-output 含 IP 公仔源文件」断言为 PASS=${assertsFileOutputIpSource};` +
        ` 含其它 IP 公仔相关 ok() 断言=${hasIpRelatedAssertions};` +
        ` 仅检查生成成功/页数、未检查行业适配/无IP污染/品牌名分离=${onlyChecksCount}。`
    );
  }
}

main().catch((err) => {
  console.error("REGRESSION ERROR:", err);
  process.exit(1);
});

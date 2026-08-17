/** 工单 072：真 Logo 平面合成执行器与未就绪场景交付门禁。纯离线像素回归。 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  compositeLogoOnScene,
  evaluateLogoSceneDeliveryGate,
  getLogoSceneLayout,
  partitionLogoSceneRequests,
} from "../src/lib/vi-manual/logo-scene-compositor";

process.env.DEEPSEEK_API_KEY = "";
process.env.ARK_API_KEY = "";
process.env.SUPABASE_SERVICE_KEY = "";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const workerSrc = readFileSync(path.join(root, "scripts/worker.mjs"), "utf8");
const selfSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
const fixtureDir = mkdtempSync(path.join(tmpdir(), "bb-072-"));

const checks: { name: string; pass: boolean; evidence: string }[] = [];
function check(name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}  | 证据: ${evidence}`);
}

function dataUriToBuffer(value: string): Buffer {
  return Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
}

async function transparentLogo(width: number, height: number, color: [number, number, number]): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4);
  for (let y = Math.floor(height * 0.2); y < Math.ceil(height * 0.8); y += 1) {
    for (let x = Math.floor(width * 0.2); x < Math.ceil(width * 0.8); x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = 255;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function main() {
  try {
    const background = await sharp({
      create: { width: 640, height: 480, channels: 4, background: { r: 30, g: 40, b: 50, alpha: 1 } },
    }).png().toBuffer();
    const logo = await transparentLogo(200, 100, [210, 45, 60]);
    writeFileSync(path.join(fixtureDir, "background.png"), background);
    writeFileSync(path.join(fixtureDir, "transparent-logo.png"), logo);

    const transparentResult = await compositeLogoOnScene({
      background,
      logo,
      sceneKey: "stationery-1",
    });
    let alphaAndColorPass = false;
    let alphaEvidence = "composite failed";
    if (transparentResult.ok) {
      const { data, info } = await sharp(dataUriToBuffer(transparentResult.imageUrl))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const centerX = transparentResult.placement.left + Math.floor(transparentResult.placement.width / 2);
      const centerY = transparentResult.placement.top + Math.floor(transparentResult.placement.height / 2);
      const centerOffset = (centerY * info.width + centerX) * info.channels;
      const edgeX = transparentResult.placement.left + 1;
      const edgeY = transparentResult.placement.top + 1;
      const edgeOffset = (edgeY * info.width + edgeX) * info.channels;
      const center = [data[centerOffset], data[centerOffset + 1], data[centerOffset + 2], data[centerOffset + 3]];
      const edge = [data[edgeOffset], data[edgeOffset + 1], data[edgeOffset + 2], data[edgeOffset + 3]];
      alphaAndColorPass =
        center[0] >= 205 && center[1] <= 50 && center[2] <= 65 && center[3] === 255 &&
        edge[0] === 30 && edge[1] === 40 && edge[2] === 50 && edge[3] === 255;
      alphaEvidence = `center=${center.join(",")} transparentEdgeShowsBackground=${edge.join(",")}`;
    }
    check(
      "072-1 透明 Logo 合成后透明区、颜色与宽高比保持",
      transparentResult.ok &&
        Math.abs(transparentResult.placement.width / transparentResult.placement.height - 2) < 0.03 &&
        alphaAndColorPass,
      alphaEvidence,
    );

    const shapeCases = [
      { name: "landscape", width: 240, height: 80, key: "stationery-1" },
      { name: "portrait", width: 80, height: 240, key: "packaging-1" },
      { name: "square", width: 120, height: 120, key: "packaging-2" },
    ] as const;
    const shapeResults = [];
    for (const item of shapeCases) {
      const itemLogo = await transparentLogo(item.width, item.height, [40, 150, 90]);
      const result = await compositeLogoOnScene({ background, logo: itemLogo, sceneKey: item.key });
      shapeResults.push({ item, result });
    }
    check(
      "072-2 横版/竖版/方形 Logo 均不拉伸、不越界",
      shapeResults.every(({ item, result }) => result.ok &&
        Math.abs(result.placement.width / result.placement.height - item.width / item.height) < 0.04 &&
        result.placement.left >= 0 && result.placement.top >= 0 &&
        result.placement.left + result.placement.width <= result.placement.canvasWidth &&
        result.placement.top + result.placement.height <= result.placement.canvasHeight),
      shapeResults.map(({ item, result }) => `${item.name}:${result.ok ? `${result.placement.width}x${result.placement.height}` : result.errorCode}`).join(" | "),
    );
    check(
      "072-3 三个平面场景 key 均命中通用相对布局",
      ["stationery-1", "packaging-1", "packaging-2"].every((key) => {
        const layout = getLogoSceneLayout(key);
        return !!layout && [layout.leftRatio, layout.topRatio, layout.maxWidthRatio, layout.maxHeightRatio]
          .every((value) => value > 0 && value < 1);
      }),
      "stationery/packaging-primary/packaging-secondary",
    );

    const unknown = await compositeLogoOnScene({ background, logo, sceneKey: "unknown-slot" });
    const customLayout = await compositeLogoOnScene({
      background,
      logo,
      sceneKey: "stationery-1",
      layout: { name: "custom", leftRatio: 0.01, topRatio: 0.01, maxWidthRatio: 0.9, maxHeightRatio: 0.9 },
    });
    check(
      "072-4 未知 key 与非标准坐标明确失败，不使用客户布局",
      !unknown.ok && unknown.errorCode === "UNSUPPORTED_SCENE_KEY" &&
        !customLayout.ok && customLayout.errorCode === "INVALID_LAYOUT" &&
        getLogoSceneLayout("unknown-slot") === null,
      `${!unknown.ok ? unknown.errorCode : "unexpected success"}/${!customLayout.ok ? customLayout.errorCode : "unexpected success"}`,
    );

    const whiteLogo = await sharp({
      create: { width: 180, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).composite([{ input: Buffer.from('<svg width="80" height="40"><rect width="80" height="40" fill="#2468A0"/></svg>'), left: 50, top: 30 }]).png().toBuffer();
    writeFileSync(path.join(fixtureDir, "opaque-white-logo.png"), whiteLogo);
    const whiteResult = await compositeLogoOnScene({ background, logo: whiteLogo, sceneKey: "packaging-1" });
    check(
      "072-5 不透明白底 Logo 不会被静默贴成白方框",
      !whiteResult.ok && whiteResult.errorCode === "LOGO_OPAQUE_WHITE_BACKGROUND",
      !whiteResult.ok ? whiteResult.errorCode : "unexpected success",
    );

    const guardTerms = ["reserved clean branding area", "no text", "no letters", "no fake logo"];
    check(
      "072-6 composite 背景 prompt 明确预留品牌区且无字/无伪 Logo",
      guardTerms.every((term) => workerSrc.includes(term)) &&
        workerSrc.includes("const compositeBackground") &&
        workerSrc.includes("background plate only"),
      guardTerms.join(","),
    );

    const broken = await compositeLogoOnScene({ background: "not-base64", logo, sceneKey: "packaging-2" });
    check(
      "072-7 合成失败不返回原底图并冒充成功",
      !broken.ok && broken.executorStatus === "failed" && !("imageUrl" in broken),
      !broken.ok ? broken.errorCode : "unexpected success",
    );

    const mixed = [
      { key: "stationery-1", routeStatus: "ready", logoPlacement: { strategy: "composite" as const } },
      { key: "packaging-1", routeStatus: "ready", logoPlacement: { strategy: "composite" as const } },
      { key: "marketing-storefront", routeStatus: "candidate_074", logoPlacement: { strategy: "reference_anchor" as const } },
      { key: "marketing-1", routeStatus: "candidate_074", logoPlacement: { strategy: "reference_anchor" as const } },
      { key: "future-slot", routeStatus: "pending_executor" },
    ];
    const partitioned = partitionLogoSceneRequests(mixed);
    check(
      "072-8 composite request 为 ready，可进入执行",
      partitioned.ready.filter((item) => item.routeStatus === "ready").length === 2,
      `ready=${partitioned.ready.map((item) => item.key).join(",")}`,
    );
    check(
      "072-9 reference_anchor 候选进入专用执行器，不冒充普通 composite",
      partitioned.ready.filter((item) => item.routeStatus === "candidate_074").length === 2 &&
        workerSrc.includes("request.logoPlacement?.strategy === 'reference_anchor'") &&
        workerSrc.includes("comfyGenerateReferenceAnchor"),
      `candidate=${partitioned.ready.filter((item) => item.routeStatus === "candidate_074").map((item) => item.key).join(",")}`,
    );
    check(
      "072-10 混合请求只执行 ready 子集，不因 pending 跳过全部",
      workerSrc.includes("prompts: compositeSceneRequests.map") &&
        workerSrc.includes("referenceSceneRequests.length > 0") &&
        partitioned.ready.length === 4 && partitioned.pending.length === 1,
      "ready/pending 独立分流",
    );

    const requiredKeys = ["stationery-1", "packaging-1", "packaging-2", "marketing-storefront", "marketing-1"];
    const compositeImages = {
      "stationery-1": "image-a",
      "packaging-1": "image-b",
      "packaging-2": "image-c",
    };
    const compositeVision = {
      "stationery-1": "passed",
      "packaging-1": "passed",
      "packaging-2": "skipped",
    };
    const blockedGate = evaluateLogoSceneDeliveryGate({
      requiredKeys,
      sceneImages: compositeImages,
      sceneVision: compositeVision,
      requests: mixed,
    });
    const gateIndex = workerSrc.indexOf("const logoSceneGate = evaluateLogoSceneDeliveryGate");
    const plannerIndex = workerSrc.indexOf("// Step 3: Plan pages via DeepSeek");
    check(
      "072-11 缺少必需场景时在 DeepSeek/PPTX/上传前门禁阻止",
      !blockedGate.ready && blockedGate.status === "needs_review" &&
        gateIndex > 0 && plannerIndex > gateIndex &&
        workerSrc.includes("generationStatus: 'needs_review'") && workerSrc.includes("return;"),
      `blockers=${blockedGate.blockers.map((item) => `${item.key}:${item.reason}`).join(",")}`,
    );

    const photoImages = { ...compositeImages, "marketing-storefront": "photo-storefront" };
    const photoVision = { ...compositeVision, "marketing-storefront": "passed" };
    const photoGate = evaluateLogoSceneDeliveryGate({
      requiredKeys,
      sceneImages: photoImages,
      sceneVision: photoVision,
      requests: mixed.filter((item) => item.key !== "marketing-storefront"),
    });
    check(
      "072-12 合格照片门头被识别为替代产物，其余 pending 仍如实阻塞",
      !photoGate.ready &&
        !photoGate.blockers.some((item) => item.key === "marketing-storefront") &&
        photoGate.blockers.some((item) => item.key === "marketing-1" && item.reason === "candidate_074"),
      `blockers=${photoGate.blockers.map((item) => item.key).join(",")}`,
    );
    const compositeSkippedGate = evaluateLogoSceneDeliveryGate({
      requiredKeys: ["packaging-2"],
      sceneImages: { "packaging-2": "image-c" },
      sceneVision: { "packaging-2": "skipped" },
      requests: [{ key: "packaging-2", routeStatus: "ready", logoPlacement: { strategy: "composite" } }],
    });
    const compositeReviewGate = evaluateLogoSceneDeliveryGate({
      requiredKeys: ["packaging-2"],
      sceneImages: { "packaging-2": "image-c" },
      sceneVision: { "packaging-2": "needs_review" },
      requests: [{ key: "packaging-2", routeStatus: "ready", logoPlacement: { strategy: "composite" } }],
    });
    check(
      "072-12b composite 既有 skipped 降级通过、needs_review 阻断语义不退化",
      compositeSkippedGate.ready && !compositeReviewGate.ready && compositeReviewGate.blockers[0]?.reason === "needs_review",
      JSON.stringify({ skipped: compositeSkippedGate, needsReview: compositeReviewGate }),
    );

    check(
      "072-13 无选定 Logo 仍保持 071 可诊断行为",
      workerSrc.includes("function resolveSelectedLogoAsset") &&
        workerSrc.includes("missing_selected_logo") &&
        workerSrc.includes("不会回退 logoGenerationResults[0]") &&
        workerSrc.includes("selectedLogoAsset.status !== 'selected'"),
      "selectedLogo only；missing_selected_logo",
    );

    const forbidden = [
      String.fromCodePoint(30334, 30103, 33803),
      "P" + "OLP",
      "VI-" + "20260806",
      "samples-" + "059",
      "pilot-" + "069",
      "logo-" + "rosegold",
    ];
    const compositorSrc = readFileSync(path.join(root, "src/lib/vi-manual/logo-scene-compositor.ts"), "utf8");
    check(
      "072-14 无客户名、项目 ID、固定路径、客户 URL 和客户色值硬编码",
      forbidden.every((value) => !workerSrc.includes(value) && !selfSrc.includes(value) && !compositorSrc.includes(value)) &&
        !compositorSrc.includes("http://") && !compositorSrc.includes("https://"),
      "客户特例与固定 URL 扫描",
    );

    check(
      "072-15 生产链为底图生成→真 Logo 合成→视觉校验，失败抛错",
      workerSrc.indexOf("const background = await comfyuiGenerateScene") < workerSrc.indexOf("const composite = await compositeLogoOnScene") &&
        workerSrc.indexOf("const composite = await compositeLogoOnScene") < workerSrc.indexOf("check: async ({ imageBase64 }) => runSceneVisionCheck") &&
        workerSrc.includes("throw new Error(`${composite.errorCode}: ${composite.message}`)"),
      "background → composite → runSceneVisionCheck",
    );
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }

  const failed = checks.filter((item) => !item.pass);
  console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
  if (failed.length) failed.forEach((item) => console.log("FAILED:", item.name));
  process.exit(failed.length ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  rmSync(fixtureDir, { recursive: true, force: true });
  process.exit(1);
});

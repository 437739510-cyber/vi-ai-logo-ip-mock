/**
 * TICKET-086-R2 聚焦回归：三视图重做契约。
 *
 * 断言：
 * 1) worker 视图提示词含「画面中只有一个角色」类约束（exactly one character /
 *    no mirrored or duplicated），且不含中文「三视图/多视图」字样；
 * 2) compositor 导出 combineThreeViewSheet，3 张单角色图可合拼为横版三面板
 *    （正/侧/背，白底，尺寸符合 3152×1194 类宽高比）；
 * 3) worker 手册阶段接线 mascotAssets.threeView → mascotThreeViewData；
 * 4) render-pptx 三视图页优先嵌入合拼横版（mascotThreeViewData），否则回退
 *    front/side/back 三独立视图；
 * 5) 无写死品牌名/公仔名。
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { combineThreeViewSheet } from "../src/lib/vi-manual/logo-scene-compositor";

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passCount += 1; console.log(`PASS ${name}`); }
  else { failCount += 1; console.log(`FAIL ${name} ${detail}`); }
}

const repoRoot = new URL("../", import.meta.url);
const workerSrc = readFileSync(new URL("scripts/worker.mjs", repoRoot), "utf8");
const compositorSrc = readFileSync(new URL("src/lib/vi-manual/logo-scene-compositor.ts", repoRoot), "utf8");
const renderSrc = readFileSync(new URL("src/lib/pptx/render-pptx.ts", repoRoot), "utf8");

async function makeSingleImage(color: string): Promise<string> {
  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#FFFFFF"/><circle cx="256" cy="256" r="180" fill="${color}"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function main(): Promise<void> {
  // 1) 单角色提示词约束
  // 工单 086-R3：视图提示词移入平台三视图子流程（generateThreeViewsPlatform）。
  const promptsStart = workerSrc.indexOf("const prompts = {");
  const promptsEnd = workerSrc.indexOf("};", promptsStart) + 3;
  const viewPrompt = promptsStart >= 0 ? workerSrc.slice(promptsStart, promptsEnd) : "";
  check("worker 视图提示词存在", viewPrompt.includes("Facing the camera directly") && viewPrompt.includes("Body turned 90 degrees") && viewPrompt.includes("Seen from behind"), "missing");
  check(
    "视图提示词强调画面只有一个角色",
    viewPrompt.split("Exactly one character in the frame").length - 1 >= 3,
    viewPrompt.slice(0, 160),
  );
  check("视图提示词不含中文「三视图/多视图」", !viewPrompt.includes("三视图") && !viewPrompt.includes("多视图"), viewPrompt.slice(0, 120));

  // 2) combineThreeViewSheet
  check("compositor 导出 combineThreeViewSheet", compositorSrc.includes("export async function combineThreeViewSheet"), "missing");
  const front = await makeSingleImage("#B76E79");
  const side = await makeSingleImage("#D4AF7A");
  const back = await makeSingleImage("#E8C4A0");
  const combined = await combineThreeViewSheet({ front, side, back, sheetWidth: 3152, sheetHeight: 1194 });
  check("合拼成功", combined.ok === true, combined.ok ? "" : combined.message);
  if (combined.ok) {
    const meta = await sharp(Buffer.from(combined.imageUrl.split(",")[1], "base64")).metadata();
    check("合拼尺寸 3152×1194", meta.width === 3152 && meta.height === 1194, `${meta.width}x${meta.height}`);
    check("合拼为横版（宽 > 高 ×2）", (meta.width || 0) > (meta.height || 0) * 2, `${meta.width}x${meta.height}`);
  }

  // 3) worker 接线合拼版
  check("worker 接线 mascotAssets.threeView → mascotThreeViewData", workerSrc.includes("三视图合拼版已载入") && workerSrc.includes("mascotAssets.threeView"), "missing");
  check("worker 无合拼版时回退正面图", workerSrc.includes("if (!mascotThreeViewData) mascotThreeViewData = mascotData;"), "missing");

  // 4) render-pptx 三视图页优先合拼横版
  check("render-pptx 三视图页优先 mascotThreeViewData", renderSrc.includes('if (bp.pageId === "mascot-threeview")') && renderSrc.includes("isUsableImageRef(sheet)"), "missing");
  check("render-pptx 回退三独立视图", renderSrc.includes("renderMascotSplitGrid(slide, views, \"三视图\"") || renderSrc.includes('renderMascotSplitGrid(slide, views, "三视图"'), "missing");

  // 5) 无写死
  const forbidden = ["百疗萃养生馆", "萃瑶"];
  check("worker/compositor/render 无写死", forbidden.every((v) => !workerSrc.includes(v) && !compositorSrc.includes(v) && !renderSrc.includes(v)), "found hardcode");

  // 6) 客户照片质量跳过开关（数据驱动，可复用）
  check("worker 支持 skipCustomerPhotoScene（跳过客户照片场景链路）", workerSrc.includes("skipCustomerPhotoScene === true") && workerSrc.includes("跳过客户照片场景链路"), "missing");

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL " + (err instanceof Error ? err.message : String(err)));
  process.exit(2);
});

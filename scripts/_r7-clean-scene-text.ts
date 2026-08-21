// TICKET-122-R7：wash_bay 场景乱码文字清理（复刻 worker.mjs cleanAiSceneText 链路）。
// 用法：npx tsx scripts/_r7-clean-scene-text.ts --input <png> --output <png> [--model qwen2.5vl:latest]
// 依赖：Ollama（locateTextRegion）+ ComfyUI 8188（inpaint）。
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { locateTextRegion, generateInpaintMaskPng } from "../src/lib/vision-check";
import { comfyuiInpaintPhoto } from "../src/lib/ip/ip-image-provider/comfyui-provider";

const INPUT_DIR = process.env.COMFYUI_INPUT_DIR || "D:/ComfyUI-backup/input";
const sha256 = (v: Buffer | string) => crypto.createHash("sha256").update(v).digest("hex");

function arg(name: string): string | undefined {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit?.slice(`--${name}=`.length);
}

async function main() {
  const input = arg("input");
  const output = arg("output");
  const model = arg("model") || "qwen2.5vl:latest";
  const locateOnly = process.argv.includes("--locate-only");
  const regionJson = arg("region-json");
  if (!input || !output) throw new Error("--input and --output required");
  const before = await fs.readFile(input);
  const prefix = `r7_cleantext_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const srcFile = `${prefix}_src.png`;
  const maskedFile = `${prefix}_masked.png`;
  const srcPath = path.join(INPUT_DIR, srcFile);
  const maskedPath = path.join(INPUT_DIR, maskedFile);
  const record: any = { input, output, model, beforeSha256: sha256(before), cleaned: false };
  try {
    const srcBytes = await sharp(before).resize({ width: 1280, withoutEnlargement: true }).png().toBuffer();
    await fs.writeFile(srcPath, srcBytes);
    let region: any = null;
    if (regionJson) {
      region = JSON.parse(await fs.readFile(regionJson, "utf8")).region;
      record.regionSource = regionJson;
    } else {
      region = await locateTextRegion(srcPath, { model });
    }
    if (!region) {
      record.region = null;
      record.reason = "no_text_region_located";
      await fs.copyFile(input, output);
      if (locateOnly) {
        const locatePath = arg("record") || path.join(path.dirname(output), `locate-${path.basename(output, ".png")}.json`);
        await fs.writeFile(locatePath, JSON.stringify({ region: null, reason: "no_text_region_located" }, null, 2));
        console.log(JSON.stringify({ ok: true, locateOnly, region: null }, null, 2));
        return;
      }
    } else {
      record.region = region;
      if (locateOnly) {
        const locatePath = arg("record") || path.join(path.dirname(output), `locate-${path.basename(output, ".png")}.json`);
        await fs.writeFile(locatePath, JSON.stringify({ region }, null, 2));
        console.log(JSON.stringify({ ok: true, locateOnly, region }, null, 2));
        return;
      }
      record.cleaned = true;
      await generateInpaintMaskPng(srcPath, region, maskedPath, { featherPx: 24 });
      const seed = Math.floor(Math.random() * 2_147_483_647);
      record.seed = seed;
      record.inpaintPrompt = "clean blank unprinted surface with subtle texture matching the surrounding area, remove all text letters words numbers and characters completely, no typography, professional product photography";
      const gen = await comfyuiInpaintPhoto({
        imageFile: maskedFile,
        prompt: record.inpaintPrompt,
        seed,
        variant: "nvfp4",
        filenamePrefix: "r7_zt_inpaint",
      });
      record.inpaintModel = gen.model;
      record.inpaintDurationMs = gen.durationMs;
      const mm = String(gen.imageUrl).match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
      if (!mm) throw new Error("inpaint result not a data uri");
      await fs.writeFile(output, Buffer.from(mm[2], "base64"));
    }
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    await fs.unlink(srcPath).catch(() => {});
    await fs.unlink(maskedPath).catch(() => {});
  }
  const after = await fs.readFile(output);
  record.afterSha256 = sha256(after);
  const meta = await sharp(after).metadata();
  record.outputBytes = after.length;
  record.width = meta.width;
  record.height = meta.height;
  const recordPath = arg("record") || path.join(path.dirname(output), `clean-record-${path.basename(output, ".png")}.json`);
  await fs.writeFile(recordPath, JSON.stringify(record, null, 2));
  console.log(JSON.stringify({ ok: true, recordPath, ...record }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});

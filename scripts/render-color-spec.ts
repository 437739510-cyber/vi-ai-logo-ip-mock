/**
 * Render color spec page to PNG for visual inspection
 * Run: npx tsx scripts/render-color-spec.ts
 */
import { renderColorSpecPng } from "../src/lib/pptx/spec-page-renderer";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const dataUri = await renderColorSpecPng({
    bc: {
      pri: "8B1A1A",
      sec: "D4A017",
      acc: "2C1810",
    },
    colorMeaning: "中国红象征喜庆与传承，金色代表品质，深棕传递手工艺的温暖。",
  });

  const b64 = dataUri.replace(/^data:image\/png;base64,/, "");
  const buf = Buffer.from(b64, "base64");

  const outPath = path.join(process.cwd(), "output", "color-spec-preview.png");
  fs.writeFileSync(outPath, buf);
  console.log("Saved:", outPath, `(${(buf.length / 1024).toFixed(1)} KB)`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

/**
 * Chinese text overlay utility.
 *
 * SDXL/Star-3 Alpha cannot generate correct Chinese characters,
 * so we overlay the brand name using PIL + KaiTi font after image generation.
 *
 * Calls scripts/overlay_chinese.py via child_process.
 */

import { spawn } from "child_process";
import path from "path";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "overlay_chinese.py");

/**
 * Overlay Chinese company name on a base64 data URL image.
 * Returns the modified base64 data URL, or the original on error.
 */
export async function overlayChineseText(
  base64DataUrl: string,
  companyName: string
): Promise<string> {
  if (!companyName || !base64DataUrl) return base64DataUrl;

  // Only process if the image is a base64 data URL (not an HTTP URL)
  if (!base64DataUrl.startsWith("data:")) return base64DataUrl;

  return new Promise((resolve) => {
    const python = spawn("python", [SCRIPT_PATH, companyName], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = Buffer.alloc(0);
    let stderr = "";

    python.stdout.on("data", (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);
    });

    python.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    python.on("close", (code: number | null) => {
      if (code === 0 && stdout.length > 0) {
        resolve(stdout.toString());
      } else {
        console.warn(
          `[overlay-chinese] Failed (code=${code}): ${stderr.slice(0, 200)}`
        );
        resolve(base64DataUrl); // Return original on error
      }
    });

    python.on("error", (err: Error) => {
      console.warn(`[overlay-chinese] Spawn error: ${err.message}`);
      resolve(base64DataUrl);
    });

    // Write base64 data to stdin
    python.stdin.write(base64DataUrl);
    python.stdin.end();
  });
}
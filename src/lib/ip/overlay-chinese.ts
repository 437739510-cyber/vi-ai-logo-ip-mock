/**
 * Chinese text overlay utility.
 *
 * SDXL/Star-3 Alpha cannot generate correct Chinese characters,
 * so we overlay the brand name using PIL + KaiTi font after image generation.
 *
 * Calls scripts/overlay_chinese.py via child_process.
 * V121: Added 15s timeout to prevent hang on pipe write deadlock.
 */

import { spawn } from "child_process";
import path from "path";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "overlay_chinese.py");
const OVERLAY_TIMEOUT_MS = 15000;

/**
 * Overlay Chinese company name on a base64 data URL image.
 * Returns the modified base64 data URL, or the original on error/timeout.
 */
export async function overlayChineseText(
  base64DataUrl: string,
  companyName: string,
  fontFamily?: string
): Promise<string> {
  if (!companyName || !base64DataUrl) return base64DataUrl;

  // Only process if the image is a base64 data URL (not an HTTP URL)
  if (!base64DataUrl.startsWith("data:")) return base64DataUrl;

  return new Promise((resolve) => {
    let resolved = false;
    const done = (result: string) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    const python = spawn("python", [SCRIPT_PATH, companyName], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = Buffer.alloc(0);
    let stderr = "";

    // V121: Timeout to prevent hang
    const timeout = setTimeout(() => {
      console.warn("[overlay-chinese] Timeout after " + OVERLAY_TIMEOUT_MS + "ms, killing python");
      try { python.kill("SIGTERM"); } catch {}
      done(base64DataUrl);
    }, OVERLAY_TIMEOUT_MS);

    python.stdout.on("data", (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);
    });

    python.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    python.on("close", (code: number | null) => {
      clearTimeout(timeout);
      if (code === 0 && stdout.length > 0) {
        done(stdout.toString());
      } else {
        console.warn(
          `[overlay-chinese] Failed (code=${code}): ${stderr.slice(0, 200)}`
        );
        done(base64DataUrl); // Return original on error
      }
    });

    python.on("error", (err: Error) => {
      clearTimeout(timeout);
      console.warn(`[overlay-chinese] Spawn error: ${err.message}`);
      done(base64DataUrl);
    });

    // Write base64 data to stdin (V121: drain-aware write)
    const writeData = () => {
      const ok = python.stdin.write(base64DataUrl);
      if (!ok) {
        python.stdin.once("drain", () => {
          python.stdin.end();
        });
      } else {
        python.stdin.end();
      }
    };
    writeData();
  });
}

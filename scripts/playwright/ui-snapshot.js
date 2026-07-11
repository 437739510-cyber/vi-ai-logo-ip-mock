/**
 * BrandBrain UI Snapshot �� Playwright automated screenshot tool
 * Usage:  npm run test:ui-snapshot
 * Output: D:\disk\HERMES&CODEX\ui-snapshots\{page}_{timestamp}.png
 *
 * Takes screenshots of 3 core pages, auto-starts & stops dev server.
 * Part of the Hermes-Codex visual QA pipeline.
 */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// === CONFIG ===
const BASE_URL = "http://localhost:3000";
const SNAPSHOT_DIR = "D:\\disk\\HERMES&CODEX\\ui-snapshots";
const PAGES = [
  { name: "homepage",          path: "/" },
  { name: "member-login",      path: "/member/login" },
  { name: "admin-dashboard",   path: "/admin/dashboard" },
];
const DEV_READY_TIMEOUT_MS = 60_000;
const PAGE_TIMEOUT_MS = 30_000;
const VIEWPORT = { width: 1440, height: 900 };

// === HELPERS ===
function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function log(msg, ok = true) {
  const tag = ok ? "[OK]" : "[FAIL]";
  console.log(`${tag} ${msg}`);
}

// === WAIT FOR DEV SERVER ===
async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) {
        log(`Dev server ready at ${url}`);
        return true;
      }
    } catch (_) {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  log(`Dev server did not start within ${timeoutMs / 1000}s`, false);
  return false;
}

// === MAIN ===
async function main() {
  console.log("");
  console.log("==============================================");
  console.log("  BrandBrain UI Snapshot Tool");
  console.log(`  Output: ${SNAPSHOT_DIR}`);
  console.log("==============================================");
  console.log("");

  // 1?? Ensure output directory
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  // 2?? Start dev server
  const ts = timestamp();
  console.log(`[START] Launching dev server (npm run dev)...`);
  const devProcess = spawn("npm", ["run", "dev"], {
    cwd: __dirname + "/../..",
    shell: true,
    stdio: "pipe",
  });

  // Forward dev server output (helpful for debugging)
  devProcess.stdout.on("data", (d) => {
    const line = d.toString().trim();
    if (line.includes("Local:") || line.includes("Ready") || line.includes("error")) {
      console.log(`  [dev] ${line}`);
    }
  });
  devProcess.stderr.on("data", (d) => {
    const line = d.toString().trim();
    if (line && !line.startsWith(" ?")) {
      console.log(`  [dev] ${line}`);
    }
  });

  // 3?? Wait for server
  const ready = await waitForServer(BASE_URL, DEV_READY_TIMEOUT_MS);
  if (!ready) {
    devProcess.kill();
    process.exit(1);
  }

  // 4?? Take screenshots
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT });

    for (const pageConfig of PAGES) {
      console.log(`[SHOT] ${pageConfig.name}  ��  ${pageConfig.path}`);
      const page = await context.newPage();

      try {
        await page.goto(`${BASE_URL}${pageConfig.path}`, {
          waitUntil: "networkidle",
          timeout: PAGE_TIMEOUT_MS,
        });

        // Wait for page to fully render �� fix for white screenshot issue
        await page.waitForLoadState("networkidle");
        // Wait for actual rendered text content (not just empty body shell).
        // body exists immediately; innerText proves React/Next.js hydration completed.
        try {
          await page.waitForFunction(
            () => document.body.innerText.trim().length > 50,
            { timeout: 15000 }
          );
        } catch {
          await page.waitForTimeout(3000);
        }
        // Extra settle time for animations (framer-motion)
        await page.waitForTimeout(2000);

        const filename = `${pageConfig.name}_${ts}.png`;
        const filepath = path.join(SNAPSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: true });

        const sizeKB = (fs.statSync(filepath).size / 1024).toFixed(1);
        log(`${pageConfig.name}  ��  ${filename}  (${sizeKB} KB)`);
      } catch (err) {
        log(`${pageConfig.name}  ��  ${err.message.slice(0, 80)}`, false);
      } finally {
        await page.close();
      }
    }

    await context.close();
  } finally {
    if (browser) await browser.close();
  }

  // 5?? Cleanup
  devProcess.kill();
  console.log("");
  console.log("[DONE] Screenshots saved. Hermes can review at:");
  console.log(`       ${SNAPSHOT_DIR}`);
  console.log("");
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});



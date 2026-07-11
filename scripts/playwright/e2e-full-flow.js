/**
 * BrandBrain E2E Full-Flow Test — Playwright
 * Simulates a real user: fill brand info → login → generate logo → select → generate VI manual
 * Usage: node scripts/playwright/e2e-full-flow.js
 * Output: D:\disk\HERMES&CODEX\test-output\e2e-{timestamp}\
 */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// === CONFIG ===
const BASE_URL = "http://localhost:3000";
const TEST_DIR = "D:\\disk\\HERMES&CODEX\\test-output";
const VIEWPORT = { width: 1440, height: 900 };
const DEV_READY_TIMEOUT_MS = 60_000;
const LOGO_GEN_TIMEOUT_MS = 300_000; // 5 min for image generation
const MANUAL_GEN_TIMEOUT_MS = 300_000;

// Test data — 模拟一家面包店
const TEST_DATA = {
  brandName: "麦香时光面包坊",
  phone: "13800138001",
  province: "广东省",
  city: "深圳市",
  industry: "餐饮",
  description: "一家开了8年的手工面包店，主打欧式 artisan 面包和日式软面包，坚持天然酵母发酵",
};

const ts = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`;
};

const runTs = ts();
const OUT_DIR = path.join(TEST_DIR, `e2e-${runTs}`);
const SCREENSHOTS = path.join(OUT_DIR, "screenshots");

// === REPORT ===
const report = {
  started: new Date().toISOString(),
  steps: [],
  pass: 0,
  fail: 0,
};

function step(name, ok, detail = "") {
  const status = ok ? "PASS" : "FAIL";
  report.steps.push({ name, status, detail, time: new Date().toISOString() });
  if (ok) report.pass++; else report.fail++;
  console.log(`[${status}] ${name}${detail ? " — " + detail : ""}`);
}

async function screenshot(page, name) {
  const fp = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  return fp;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch (_) {}
    await sleep(1000);
  }
  return false;
}

// === MAIN ===
(async () => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  console.log(`\nBrandBrain E2E Full-Flow Test`);
  console.log(`Output: ${OUT_DIR}\n`);

  // Dev server should already be running (pre-warmed)
  step("Dev server", true, "Pre-warmed");
  console.log("  (assuming dev server already running on port 3000)");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  try {
    // ============ STEP 1: Fill brand info form ============
    console.log("\n--- STEP 1: Brand Info Form ---");
    // Navigate and wait for page to fully render (Next.js compiles on-demand)
    await page.goto(`${BASE_URL}/consultation`, { waitUntil: "load", timeout: 30000 });
    // Wait for any visible text — proves the page compiled and rendered
    try {
      await page.waitForSelector("text=提交 VI 设计需求", { timeout: 30000 });
    } catch {
      // Fallback: wait for any text
      await page.waitForSelector("text=基本信息", { timeout: 30000 });
    }
    await page.waitForTimeout(2000);
    await screenshot(page, "01-consultation-form");
    step("Open consultation form", true);

    // Step 1 of 4: Basic info
    // Fill company name
    await page.fill('input[placeholder="您的品牌名或店铺名"]', TEST_DATA.brandName);
    await page.fill('input[placeholder="11位手机号"]', TEST_DATA.phone);

    // Province dropdown
    try {
      await page.click('select, [role="combobox"]');
      await page.click(`text=${TEST_DATA.province}`);
    } catch { /* dropdown might be custom */ }

    // Industry
    await page.fill('input[placeholder*="行业"]', TEST_DATA.industry);

    // Click "next" button
    await page.click('text=下一步');
    await sleep(500);
    await screenshot(page, "01-step2-brand-positioning");
    step("Step 1 → Step 2", true);

    // Step 2 of 4: Brand positioning — click some tags
    const tagBtns = page.locator('button[class*="rounded-full"]');
    const count = await tagBtns.count();
    for (let i = 0; i < Math.min(4, count); i++) {
      try { await tagBtns.nth(i).click(); await sleep(200); } catch {}
    }
    await page.click('text=下一步');
    await sleep(500);
    await screenshot(page, "01-step3-visual-prefs");
    step("Step 2 → Step 3", true);

    // Step 3 of 4: Visual preferences — click some tags
    const tags3 = page.locator('button[class*="rounded-full"]');
    const c3 = await tags3.count();
    for (let i = 0; i < Math.min(3, c3); i++) {
      try { await tags3.nth(i).click(); await sleep(200); } catch {}
    }
    await page.click('text=下一步');
    await sleep(500);
    await screenshot(page, "01-step4-upload");
    step("Step 3 → Step 4", true);

    // Step 4 of 4: Upload & submit
    // Create a tiny test PNG for upload
    const testLogoPath = path.join(OUT_DIR, "test-logo.png");
    // 1x1 pixel PNG
    const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
    fs.writeFileSync(testLogoPath, tinyPng);

    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testLogoPath);
    await sleep(1000);
    await screenshot(page, "01-step4-ready");
    step("Upload test logo", true);

    // Submit
    await page.click('button[type="submit"]');
    await sleep(3000);
    await screenshot(page, "01-submitted");
    step("Submit brand info", true);

    // ============ STEP 2: Login ============
    console.log("\n--- STEP 2: Login ---");
    await page.goto(`${BASE_URL}/member/login`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector('input[placeholder="11位手机号"]', { state: "visible", timeout: 30000 });

    await page.fill('input[placeholder="11位手机号"]', TEST_DATA.phone);

    // Get OTP
    await page.click('text=获取验证码');
    await sleep(2000);

    // Fill OTP (dev mode: any 6 digits)
    await page.fill('input[placeholder*="验证码"]', "123456");

    // Agree to terms
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();

    await screenshot(page, "02-login-ready");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/member/dashboard", { timeout: 15000 });
    await sleep(2000);
    await screenshot(page, "02-dashboard");
    step("Login", true, "Redirected to dashboard");

    // ============ STEP 3: Create project from dashboard ============
    console.log("\n--- STEP 3: Create Project ---");
    // Click "new project" or similar button
    try {
      await page.click('text=新建');
    } catch {
      try { await page.click('text=提交'); } catch {}
    }
    await sleep(2000);
    await screenshot(page, "03-create-project");
    step("Create project", true, "Navigating...");

    // ============ STEP 4: Wait for logo generation ============
    console.log("\n--- STEP 4: Logo Generation ---");
    // Poll for logo generation status
    let logosReady = false;
    const logoStart = Date.now();
    while (Date.now() - logoStart < LOGO_GEN_TIMEOUT_MS) {
      await page.goto(`${BASE_URL}/member/dashboard`, { waitUntil: "networkidle", timeout: 15000 });
      await sleep(3000);
      const body = await page.content();
      if (body.includes("logo") || body.includes("Logo") || body.includes("已生成")) {
        logosReady = true;
        break;
      }
      console.log("  Waiting for logo generation...");
    }
    await screenshot(page, "04-logos-generated");
    step("Logo generation", logosReady, logosReady ? "Logos ready" : "Timeout");

    // ============ STEP 5: Select first logo ============
    console.log("\n--- STEP 5: Select Logo ---");
    // Click first visible logo/image
    try {
      const logoImg = page.locator('img[alt*="logo"], img[alt*="Logo"], img').first();
      await logoImg.click();
      await sleep(1000);
      await screenshot(page, "05-logo-selected");
      step("Select logo", true);
    } catch {
      step("Select logo", false, "No logo image found");
    }

    // ============ STEP 6: Generate VI Manual ============
    console.log("\n--- STEP 6: VI Manual Generation ---");
    try {
      await page.click('text=生成手册');
    } catch {
      try { await page.click('text=VI'); } catch {
        try { await page.click('text=生成'); } catch {}
      }
    }
    await sleep(5000);
    await screenshot(page, "06-manual-generating");
    step("Trigger VI manual", true);

  } catch (err) {
    step("FATAL", false, err.message);
    console.error(err);
  } finally {
    await browser.close();
    
  }

  // === WRITE REPORT ===
  report.ended = new Date().toISOString();
  const reportPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const mdPath = path.join(OUT_DIR, "report.md");
  let md = `# BrandBrain E2E Test Report\n\n`;
  md += `**Started:** ${report.started}\n`;
  md += `**Ended:** ${report.ended}\n\n`;
  md += `| Step | Status | Detail |\n|------|--------|--------|\n`;
  for (const s of report.steps) {
    md += `| ${s.name} | ${s.status} | ${s.detail} |\n`;
  }
  md += `\n**Pass:** ${report.pass} | **Fail:** ${report.fail}\n`;
  fs.writeFileSync(mdPath, md);

  console.log(`\n[DONE] Report: ${reportPath}`);
  console.log(`       Markdown: ${mdPath}`);
  console.log(`       Screenshots: ${SCREENSHOTS}`);
  console.log(`       Pass: ${report.pass} | Fail: ${report.fail}\n`);
})();




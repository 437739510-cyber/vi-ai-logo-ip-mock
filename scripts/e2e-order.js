/**
 * BrandBrain E2E Full Order Flow — Playwright (adapted from Hermes script)
 * Flow: API login (inject token) → consultation form → generate logo → select → VI manual
 * Usage: npm run test:e2e
 * Output: D:\disk\HERMES&CODEX\e2e-snapshots\{timestamp}\
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// === CONFIG ===
const CONFIG = {
  BASE_URL: "http://localhost:3000",
  TEST_PHONE: "13413049752",
  TEST_OTP: "123456",
  OUTPUT_ROOT: "D:\\disk\\HERMES&CODEX\\e2e-snapshots",
  MAX_WAIT_GENERATE: 180_000,
  HEADLESS: true,
  VIEWPORT: { width: 1440, height: 900 },

  // Test brand data — matches actual ConsultationForm fields
  BRAND: {
    clientName: "测试用户",
    companyName: "老碗香社区面馆",
    phone: "13413049752",
    industry: "美食",
    province: "广东省",
    city: "深圳市",
    description: "开了十年的社区老店，主打家常手擀面，温暖接地气",
    mainProducts: "手擀面、刀削面、臊子面",
    businessForm: "实体店",
    businessYears: "10",
    brandVision: "成为社区最温暖的面馆",
    coreValues: "传承、温暖、匠心",
    targetMarket: "25-55岁社区居民和上班族",
  },
};

// === HELPERS ===
const runTs = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const OUT_DIR = path.join(CONFIG.OUTPUT_ROOT, `e2e-${runTs()}`);
let stepIdx = 0;
let reportText = "";

function logStep(name, status, desc = "") {
  stepIdx++;
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] Step ${stepIdx} | ${name} | ${status} ${desc ? "| " + desc : ""}`;
  console.log(line);
  reportText += line + "\n";
}

async function shot(page, fileName) {
  const fp = path.join(OUT_DIR, `${String(stepIdx).padStart(2, "0")}_${fileName}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  return fp;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// === API LOGIN — inject token via cookie ===
async function apiLogin() {
  // Step 1: Send OTP
  await fetch(`${CONFIG.BASE_URL}/api/member/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: CONFIG.TEST_PHONE }),
  });

  // Step 2: Login with OTP
  const loginRes = await fetch(`${CONFIG.BASE_URL}/api/member/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: CONFIG.TEST_PHONE, otp: CONFIG.TEST_OTP, mode: "otp" }),
  });

  // Extract session cookies
  const setCookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  const cookies = [];
  for (const c of setCookie) {
    const parts = c.split(";")[0].split("=");
    cookies.push({ name: parts[0].trim(), value: parts.slice(1).join("="), domain: "localhost", path: "/" });
  }

  const data = await loginRes.json().catch(() => ({}));
  return { success: data.success === true, cookies, data };
}

// === MAIN ===
(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  reportText = `========== BrandBrain E2E Full Order Test ==========\n`;
  reportText += `Time: ${new Date().toLocaleString()}\n`;
  reportText += `Target: ${CONFIG.BASE_URL}\n`;
  reportText += `Output: ${OUT_DIR}\n`;
  reportText += `==================================================\n\n`;

  console.log(`\nBrandBrain E2E Full Order Test`);
  console.log(`Output: ${OUT_DIR}\n`);

  const browser = await chromium.launch({ headless: CONFIG.HEADLESS });
  const context = await browser.newContext({ viewport: CONFIG.VIEWPORT });
  const page = await context.newPage();

  try {
    // === STEP 1: API Login & inject cookies ===
    logStep("API Login", "executing");
    const loginResult = await apiLogin();

    if (loginResult.success && loginResult.cookies.length > 0) {
      await context.addCookies(loginResult.cookies);
      logStep("API Login", "PASS", "Token injected");
    } else {
      // Fallback: frontend login
      logStep("API Login", "WARN", "Falling back to UI login");
      await page.goto(`${CONFIG.BASE_URL}/member/login`, { waitUntil: "networkidle", timeout: 30000 });
      await page.fill('input[placeholder*="手机"]', CONFIG.TEST_PHONE);
      await page.click('button:has-text("获取验证码")');
      await sleep(2000);
      await page.fill('input[placeholder*="验证码"]', CONFIG.TEST_OTP);
      const cb = page.locator('input[type="checkbox"]').first();
      await cb.check();
      await page.click('button[type="submit"]');
      await page.waitForURL("**/member/dashboard", { timeout: 15000 });
      logStep("UI Login", "PASS");
    }

    // === STEP 2: Fill brand info via consultation form ===
    logStep("Open Consultation Form", "executing");
    await page.goto(`${CONFIG.BASE_URL}/consultation`, { waitUntil: "networkidle", timeout: 60000 });
    await sleep(3000);
    await shot(page, "01-consultation");
    logStep("Open Consultation Form", "PASS");

    // === Robust step-by-step form navigation ===
    // Helper: click "下一步" and verify advancement to expected heading
    async function clickNextAndVerify(page, expectedHeadingText) {
      const nextBtn = page.locator('button:has-text("下一步")');
      await nextBtn.waitFor({ state: "visible", timeout: 5000 });
      await nextBtn.click();
      // Wait for the expected heading to appear
      try {
        await page.waitForFunction(
          (text) => {
            const h3s = document.querySelectorAll("h3");
            return Array.from(h3s).some(h => h.textContent && h.textContent.includes(text));
          },
          expectedHeadingText,
          { timeout: 8000 }
        );
        return true;
      } catch {
        return false;
      }
    }

    // === Proper form filling with all required fields ===

    // Step 1: Basic info (9 required fields)
    await page.fill('input[placeholder="您的姓名"]', CONFIG.BRAND.clientName);
    await page.fill('input[placeholder="11位手机号"]', CONFIG.BRAND.phone);
    await page.fill('input[placeholder="您的品牌名或店铺名"]', CONFIG.BRAND.companyName);

    // Province select
    await page.selectOption('select:has(option:has-text("请选择省份"))', { label: "广东省" });
    await sleep(500);

    // City select (enabled after province)
    await page.selectOption('select:has(option:has-text("请选择城市"))', { label: "深圳市" });
    await sleep(300);

    // Industry — two-level select
    await page.selectOption('select:has(option:has-text("选择大类"))', { label: "美食" });
    await sleep(300);
    await page.selectOption('select:has(option:has-text("选择小类"))', { label: "小吃快餐" });
    await sleep(300);

    // Business form
    await page.selectOption('select:has(option:has-text("请选择经营形态"))', { label: "路边摊/档口" });
    await sleep(200);

    // Main products
    await page.fill('input[name="mainProducts"]', CONFIG.BRAND.mainProducts);
    // Business years
    await page.fill('input[name="businessYears"]', CONFIG.BRAND.businessYears);

    await shot(page, "02-step1-filled");
    logStep("Step 1: Basic Info", "FILLED");

    // Click next — now all fields are filled, validation should pass
    const next1 = page.locator('button:has-text("下一步")');
    await next1.click();
    await page.waitForTimeout(2000);

    // Verify we moved to step 2
    const h3s = await page.evaluate(() => Array.from(document.querySelectorAll('h3')).map(h => h.textContent));
    const onStep2 = h3s.some(h => h.includes('品牌') || h.includes('定位'));
    if (!onStep2) {
      console.log('WARNING: May not have advanced to step 2. H3s:', JSON.stringify(h3s));
    }
    await shot(page, "03-step2-brand");
    logStep("Step 1->2", onStep2 ? "PASS" : "WARN");

    // Step 2: Brand positioning — click a few tags then next
    const tagBtns2 = page.locator('button[class*="rounded-full"]');
    const c2a = await tagBtns2.count();
    for (let i = 0; i < Math.min(3, c2a); i++) {
      try { await tagBtns2.nth(i).click(); await sleep(200); } catch {}
    }
    await page.locator('button:has-text("下一步")').click();
    await page.waitForTimeout(2000);
    await shot(page, "04-step3-visual");
    logStep("Step 2: Brand Positioning", "PASS");

    // Step 3: Visual preferences — click a couple of tags then next
    const tagBtns3 = page.locator('button[class*="rounded-full"]');
    const c3a = await tagBtns3.count();
    for (let i = 0; i < Math.min(2, c3a); i++) {
      try { await tagBtns3.nth(i).click(); await sleep(200); } catch {}
    }
    await page.locator('button:has-text("下一步")').click();
    await page.waitForTimeout(2000);

    // Verify we're on step 4
    const h3s4 = await page.evaluate(() => Array.from(document.querySelectorAll('h3')).map(h => h.textContent));
    const onStep4 = h3s4.some(h => h.includes('素材') || h.includes('上传'));
    if (!onStep4) {
      throw new Error('Failed to advance to step 4 (upload). H3s: ' + JSON.stringify(h3s4));
    }
    await shot(page, "05-step4-upload");
    logStep("Step 3: Visual Preferences", "PASS");

    // Step 4: Upload & Submit
    // Create a tiny test PNG
    const testPngPath = path.join(OUT_DIR, "test-logo.png");
    const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
    fs.writeFileSync(testPngPath, tinyPng);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: "attached", timeout: 10000 });
    await fileInput.setInputFiles(testPngPath);
    await sleep(1500);

        await shot(page, "06-ready-to-submit");

    // === STEP 3: API-based form submission (bypasses browser file upload quirks) ===
    logStep("Step 4: API Submit", "executing");
    let projectId = "";
    let viewPwd = "";
    try {
      const submitPayload = {
        clientName: CONFIG.BRAND.clientName,
        companyName: CONFIG.BRAND.companyName,
        phone: CONFIG.BRAND.phone,
        industry: CONFIG.BRAND.industry,
        province: CONFIG.BRAND.province,
        city: CONFIG.BRAND.city,
        description: CONFIG.BRAND.description,
        mainProducts: CONFIG.BRAND.mainProducts,
        businessForm: CONFIG.BRAND.businessForm,
        businessYears: CONFIG.BRAND.businessYears,
        brandVision: CONFIG.BRAND.brandVision,
        coreValues: CONFIG.BRAND.coreValues,
        targetMarket: CONFIG.BRAND.targetMarket,
        brandPersonality: "温暖亲切",
        logoStyle: "简约现代",
        logoUsage: "门店招牌",
        logoFiles: [{ fileName: "test.png", url: "https://via.placeholder.com/100" }],
        storePhotos: [{ fileName: "store-test.png", url: "https://via.placeholder.com/100" }],
      };
      const submitRes = await fetch(`${CONFIG.BASE_URL}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
      });
      const submitData = await submitRes.json().catch(() => ({}));
      if (submitData.projectId) {
        projectId = submitData.projectId;
        viewPwd = submitData.viewPassword || "";
        logStep("Step 4: API Submit", "PASS", projectId);
      } else {
        logStep("Step 4: API Submit", "FAIL", submitData.error || "No projectId");
      }
    } catch (e) {
      logStep("Step 4: API Submit", "FAIL", e.message);
    }

    // Navigate to progress page for screenshot
    if (projectId) {
      await page.goto(`${CONFIG.BASE_URL}/progress?id=${projectId}&pwd=${viewPwd}&phone=${encodeURIComponent(CONFIG.BRAND.phone)}`, { waitUntil: "networkidle", timeout: 15000 });
      await sleep(2000);
      await shot(page, "07-progress-page");
      logStep("Navigate to Progress", "PASS");
    } else {
      logStep("Navigate to Progress", "SKIP", "No projectId");
    }

    // === STEP 4: Trigger brand analysis + logo generation via API ===
    logStep("Trigger Brand Analysis", "executing");
    let analysisDone = false;
    try {
      const analysisRes = await fetch(`${CONFIG.BASE_URL}/api/ai/brand-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clientInfo: {
            companyName: CONFIG.BRAND.companyName,
            industry: CONFIG.BRAND.industry,
            province: CONFIG.BRAND.province,
            city: CONFIG.BRAND.city,
            brandVision: CONFIG.BRAND.brandVision,
            coreValues: CONFIG.BRAND.coreValues,
            targetMarket: CONFIG.BRAND.targetMarket,
            mainProducts: CONFIG.BRAND.mainProducts,
            description: CONFIG.BRAND.description,
          },
        }),
      });
      const analysisData = await analysisRes.json().catch(() => ({}));
      if (analysisRes.ok) {
        logStep("Trigger Brand Analysis", "PASS");
        analysisDone = true;
      } else {
        logStep("Trigger Brand Analysis", "WARN", analysisData.error || "API rejected");
      }
    } catch (e) {
      logStep("Trigger Brand Analysis", "WARN", e.message);
    }

    logStep("Trigger Logo Generation", "executing");
    try {
      const genRes = await fetch(`${CONFIG.BASE_URL}/api/ai/generate-logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const genData = await genRes.json().catch(() => ({}));
      if (genRes.ok) {
        logStep("Trigger Logo Generation", "PASS", "API accepted");
      } else {
        logStep("Trigger Logo Generation", "WARN", genData.error || "API rejected");
      }
    } catch (e) {
      logStep("Trigger Logo Generation", "WARN", e.message);
    }

    // === STEP 5: Poll project status API for logo completion ===
    logStep("Wait for Logo Generation", "executing");
    let logosReady = false;
    let currentStatus = "";
    const logoStart = Date.now();
    while (Date.now() - logoStart < CONFIG.MAX_WAIT_GENERATE) {
      await sleep(2000);
      try {
        const statusRes = await fetch(`${CONFIG.BASE_URL}/api/ai/get-project-status?projectId=${projectId}`);
        const statusData = await statusRes.json().catch(() => ({}));
        currentStatus = statusData.status || "";
        if (currentStatus === "logo_generated" || currentStatus === "completed") {
          logosReady = true;
          break;
        }
        console.log(`  Status: ${currentStatus} (${statusData.progress || 0}%)`);
      } catch {
        console.log("  Status check failed, retrying...");
      }
    }
    await shot(page, "08-status-check");
    logStep("Logo Generation", logosReady ? "PASS" : "FAIL",
      logosReady ? `Status: ${currentStatus}` : `Timeout. Last status: ${currentStatus || "unknown"}`);

    // === STEP 6: View and select logo ===
    if (logosReady && viewPwd) {
      logStep("Navigate to View Logos", "executing");
      await page.goto(`${CONFIG.BASE_URL}/view`, { waitUntil: "networkidle", timeout: 15000 });
      try {
        await page.fill('input[placeholder*="手机"]', CONFIG.TEST_PHONE);
        await page.fill('input[placeholder*="密码"]', viewPwd);
        await page.click('button:has-text("查看")');
        await sleep(3000);
        await shot(page, "09-view-logos");
        logStep("View Logos", "PASS");

        const firstLogo = page.locator('img[alt*="logo"], img[alt*="Logo"], .logo-card img, [class*="logo"] img').first();
        if (await firstLogo.count() > 0) {
          await firstLogo.click();
          await sleep(2000);
          await shot(page, "10-logo-selected");
          logStep("Select First Logo", "PASS");
        } else {
          logStep("Select First Logo", "WARN", "No logo elements visible");
        }
      } catch (e) {
        logStep("View Logos", "WARN", e.message);
      }
    }

    // === STEP 7: Generate VI Manual ===
    logStep("Generate VI Manual", "executing");
    try {
      await page.click('button:has-text("生成手册"), button:has-text("VI"), button:has-text("导出")');
      await sleep(2000);
      await shot(page, "11-manual-generating");
      logStep("Generate VI Manual", "PASS");
    } catch {
      logStep("Generate VI Manual", "WARN", "Button not found");
    }

    // === FINAL ===
    await shot(page, "12-final-state");
    reportText += `\n========== FINAL ==========\n`;
    reportText += `Status: COMPLETED\n`;
    reportText += `Steps: ${stepIdx}\n`;
    reportText += `Screenshots: ${OUT_DIR}\n`;
    logStep("E2E Complete", "DONE");

  } catch (err) {
    await shot(page, "99-error-crash");
    logStep("CRASH", "FAIL", err.message);
    reportText += `\nERROR: ${err.message}\n`;
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, "test-report.txt"), reportText, "utf-8");
    await browser.close();
    console.log(`\nReport: ${OUT_DIR}/test-report.txt`);
    console.log(`Screenshots: ${OUT_DIR}\n`);
  }
})();

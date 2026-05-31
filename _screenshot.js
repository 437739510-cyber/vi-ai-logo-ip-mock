const puppeteer = require("puppeteer");
const path = require("path");

const BASE = "http://localhost:3003";
const OUT = "C:/Users/Administrator/Documents/Codex/vi-ai-logo-ip-mock/_bridge/screenshots";
const ADMIN_PW = "2alxjjdu";

const pages = [
  { url: "/admin/projects", name: "admin-projects" },
  { url: "/admin/billing", name: "admin-billing" },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  // Login
  const loginPage = await browser.newPage();
  await loginPage.setViewport({ width: 1440, height: 900 });
  await loginPage.goto(BASE + "/admin/login", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Submit password via fetch to get the auth cookie
  const cookieRes = await loginPage.evaluate(async (pw) => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json();
    return data;
  }, ADMIN_PW);

  console.log("Login API response:", JSON.stringify(cookieRes));

  // Navigate to dashboard to set the cookie
  await loginPage.goto(BASE + "/admin/dashboard", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });
  await new Promise((r) => setTimeout(r, 2000));

  const afterLoginText = await loginPage.evaluate(() =>
    document.body.innerText.substring(0, 200)
  );
  console.log("After login text:", afterLoginText);

  const cookies = await loginPage.cookies();
  console.log("Cookies:", cookies.length);

  // Screenshot pages with auth cookie
  for (const { url, name } of pages) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setCookie(...cookies);

    try {
      await page.goto(BASE + url, { waitUntil: "networkidle2", timeout: 20000 });
      await new Promise((r) => setTimeout(r, 3000));
      const text = await page.evaluate(() => document.body.innerText.substring(0, 300));
      console.log(name + ":", text.substring(0, 100));
      await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true });
      console.log("OK:", name);
    } catch (e) {
      console.log("FAIL:", name, e.message);
    }
    await page.close();
  }

  // ip-sandbox
  const ipPage = await browser.newPage();
  await ipPage.setViewport({ width: 1440, height: 900 });
  await ipPage.setCookie(...cookies);
  try {
    await ipPage.goto(BASE + "/admin/ip-sandbox", { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 3000));
    await ipPage.screenshot({ path: path.join(OUT, "admin-ip-sandbox.png"), fullPage: true });
    console.log("OK: admin-ip-sandbox");
  } catch (e) {
    console.log("FAIL: admin-ip-sandbox", e.message);
  }
  await ipPage.close();

  await loginPage.close();
  await browser.close();
  console.log("Done");
})();

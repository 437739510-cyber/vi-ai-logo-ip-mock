const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3003';
const PASSWORD = '2alxjjdu';
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '_bridge', 'screenshots');

async function screenshot(url, filename) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Login
  await page.goto(`${BASE_URL}/admin/projects`, { waitUntil: 'networkidle2' });
  await page.evaluate(async (pw) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    return res.json();
  }, PASSWORD);

  // Navigate to target page
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  const filePath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  await browser.close();
  console.log(`✓ Saved: ${filename} (${url})`);
  return filePath;
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  await screenshot('/admin/projects', 'admin-projects.png');
  await screenshot('/admin/billing', 'admin-billing.png');
  await screenshot('/admin/ip-sandbox', 'admin-ip-sandbox.png');

  console.log('\nAll screenshots captured.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

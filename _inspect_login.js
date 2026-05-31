const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto("http://localhost:3003/admin/login", {
    waitUntil: "networkidle2",
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Get full page HTML
  const html = await page.content();

  // Find the password input and button
  const formHtml = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input")).map((i) => ({
      type: i.type,
      name: i.name,
      id: i.id,
      placeholder: i.placeholder,
    }));
    const buttons = Array.from(document.querySelectorAll("button")).map((b) => ({
      text: b.innerText,
      type: b.type,
      id: b.id,
    }));
    const forms = Array.from(document.querySelectorAll("form")).map((f) => ({
      action: f.action,
      method: f.method,
      id: f.id,
    }));
    return { inputs, buttons, forms };
  });

  console.log(JSON.stringify(formHtml, null, 2));

  await browser.close();
})();

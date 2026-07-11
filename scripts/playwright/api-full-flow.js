/**
 * BrandBrain API Full-Chain Integration Test
 * Flow: login �� submit brand info �� brand analysis �� generate logos �� select logo �� save manual
 * Usage: node scripts/playwright/api-full-flow.js [baseUrl]
 * Default: http://localhost:3000
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";
const TEST_DIR = "D:\\disk\\HERMES&CODEX\\test-output";

// === Test Data ===
const TEST = {
  phone: "13800138001",
  otp: "123456",
  brand: {
    clientName: "�����û�",
    companyName: "����ʱ�������",
    phone: "13800138001",
    industry: "����",
    province: "�㶫ʡ",
    city: "������",
    description: "һ�ҿ���8����ֹ�����꣬����ŷʽ artisan �������ʽ������������Ȼ��ĸ����",
    brandVision: "��Ϊ��������ů���ֹ����Ʒ��",
    coreValues: "��Ȼ�����ġ���ů",
    targetMarket: "25-45��׷��Ʒ������Ķ��а���ͼ�ͥ",
    mainProducts: "ŷʽ artisan �������ʽ���������ʽ���",
    businessForm: "ʵ���",
  },
};

// === Helpers ===
const ts = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

let cookieStore = "";

function saveCookies(res) {
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get("set-cookie");
  if (setCookie) {
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const c of cookies) {
      const parts = c.split(";")[0];
      if (cookieStore) cookieStore += "; ";
      cookieStore += parts;
    }
  }
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (cookieStore) opts.headers["Cookie"] = cookieStore;
  if (body && method !== "GET") opts.body = JSON.stringify(body);
    if (body && method === "GET") path += "?" + new URLSearchParams(body).toString();

  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const ms = Date.now() - start;
  saveCookies(res);

  let data;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }

  return { status: res.status, data, ms };
}

function check(step, res, key = null) {
  const ok = res.status >= 200 && res.status < 400;
  const detail = key ? (res.data?.[key] ? `got ${key}` : `missing ${key}`) : `HTTP ${res.status} (${res.ms}ms)`;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${step} �� ${detail}`);
  if (!ok) console.log("       Response:", JSON.stringify(res.data).slice(0, 200));
  return ok;
}

// === MAIN ===
async function main() {
  const runTs = ts();
  console.log(`\nBrandBrain API Full-Chain Test �� ${runTs}`);
  console.log(`Target: ${BASE_URL}\n`);

  const results = [];
  let projectId, submissionId, logoCount;

  try {
    // === Step 1: Send OTP ===
    console.log("--- Step 1: Send OTP ---");
    let res = await api("POST", "/api/member/send-otp", { phone: TEST.phone });
    results.push(["Send OTP", res.status === 200, res.ms]);

    // === Step 2: Login ===
    console.log("--- Step 2: Login ---");
    res = await api("POST", "/api/member/login", {
      phone: TEST.phone,
      otp: TEST.otp,
      mode: "otp",
    });
    const loggedIn = check("Login", res, "success");
    results.push(["Login", loggedIn, res.ms]);
    if (!loggedIn) throw new Error("Login failed");

    // === Step 3: Submit brand info ===
    console.log("--- Step 3: Submit Brand Info ---");
    res = await api("POST", "/api/submit", TEST.brand);
    const submitted = check("Submit brand", res, "projectId");
    results.push(["Submit", submitted, res.ms]);

    if (res.data?.projectId) {
      projectId = res.data.projectId;
      submissionId = res.data.submissionId || res.data.id;
      console.log(`       projectId: ${projectId}`);
    } else {
      // Try to extract from response
      projectId = res.data?.id || res.data?.data?.projectId;
      if (projectId) console.log(`       projectId: ${projectId}`);
    }

    // === Step 4: Brand Analysis ===
    if (projectId) {
      console.log("--- Step 4: Brand Analysis ---");
      res = await api("POST", "/api/ai/brand-analysis", {
        projectId,
        submissionId,
        clientInfo: {
          companyName: TEST.brand.companyName,
          industry: TEST.brand.industry,
          province: TEST.brand.province,
          city: TEST.brand.city,
          brandVision: TEST.brand.brandVision,
          coreValues: TEST.brand.coreValues,
          targetMarket: TEST.brand.targetMarket,
        },
      });
      const analyzed = check("Brand analysis", res, "success");
      results.push(["Brand Analysis", analyzed, res.ms]);
    }

    // === Step 5: Generate Logos ===
    if (projectId) {
      console.log("--- Step 5: Generate Logos (async, polling) ---");
      res = await api("POST", "/api/ai/generate-logo", { projectId });
      const genStarted = res.status === 202 || res.status === 200;
      console.log(`[${genStarted ? "PASS" : "FAIL"}] Start logo gen �� HTTP ${res.status} (${res.ms}ms)`);
      results.push(["Logo Gen Start", genStarted, res.ms]);

      // Poll for completion
      if (genStarted) {
        let attempts = 0;
        const maxAttempts = 30; // ~5 minutes
        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 10000));
          attempts++;
          res = await api("GET", "/api/ai/get-project-status", { projectId });
          const status = res.data?.status || res.data?.state || "";
          logoCount = res.data?.details?.logoGeneration?.total || res.data?.logoCount || res.data?.logos?.length || 0;
          console.log(`       [${attempts}] status=${status}, logos=${logoCount}`);
          if (status === "logo_generated" || logoCount >= 2) break;
        }
        const logosReady = logoCount >= 2;
        console.log(`[${logosReady ? "PASS" : "FAIL"}] Logos ready �� ${logoCount} logos`);
        results.push(["Logos Generated", logosReady]);
      }
    }

    // === Step 6: Select Logo ===
    if (projectId && logoCount > 0) {
      console.log("--- Step 6: Select Logo ---");
      res = await api("POST", "/api/ai/select-logo", {
        projectId,
        autoSelect: true,
      });
      const selected = check("Select logo", res, "success");
      results.push(["Select Logo", selected, res.ms]);
    }

    // === Step 7: Save Manual ===
    if (projectId) {
      console.log("--- Step 7: Save Manual ---");
      res = await api("POST", "/api/ai/save-manual", {
        manual: {
          id: `manual-${projectId}`,
          projectId,
          status: "draft",
          pages: [],
          generatedAt: new Date().toISOString(),
        },
      });
      const saved = check("Save manual", res);
      results.push(["Save Manual", saved, res.ms]);
    }

  } catch (err) {
    console.error(`[FATAL] ${err.message}`);
    results.push(["FATAL", false, err.message]);
  }

  // === Report ===
  console.log("\n==============================================");
  console.log("  API Full-Chain Test Report");
  console.log("==============================================");
  let pass = 0, fail = 0;
  for (const [step, ok, detail] of results) {
    const status = ok ? "PASS" : "FAIL";
    if (ok) pass++; else fail++;
    console.log(`  ${status}  ${step}${detail ? ` (${detail}ms)` : ""}`);
  }
  console.log(`\n  Pass: ${pass} | Fail: ${fail}`);
  console.log("");

  // Save JSON report
  const fs = require("fs");
  const path = require("path");
  const outDir = path.join(TEST_DIR, `api-test-${runTs}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ results, pass, fail, target: BASE_URL }, null, 2));
  console.log(`Report saved: ${outDir}/report.json\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main();

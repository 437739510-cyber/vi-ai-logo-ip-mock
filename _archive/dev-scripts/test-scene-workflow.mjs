// test-scene-workflow.mjs — Verify scene workflow fixes (002)
// Checks: JSON validity, BOM, node connections, template variable replacement
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const results = [];
let pass = 0, fail = 0;

function check(id, label, condition, detail = "") {
  results.push({ id, label, pass: !!condition, detail: condition ? "OK" : detail });
  if (condition) pass++; else fail++;
}

function hasBOM(buf) {
  return buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
}

// --- 1. Validate scene JSON files ---
const sceneNames = ["marketing", "packaging", "stationery"];
const workflowsDir = join(root, "comfyui-workflows");

for (const name of sceneNames) {
  const f = join(workflowsDir, `vi-scene-${name}.json`);
  const buf = readFileSync(f);
  const raw = buf.toString("utf-8");

  check(`S1-${name}`, `Scene JSON (${name}) — no BOM`, !hasBOM(buf));

  let parsed;
  try { parsed = JSON.parse(raw); check(`S2-${name}`, `Scene JSON (${name}) — valid JSON`, true); }
  catch (e) { parsed = null; check(`S2-${name}`, `Scene JSON (${name}) — valid JSON`, false, e.message); }

  if (parsed && parsed.nodes) {
    const ksNode = Object.values(parsed.nodes).find(n => n.class_type === "KSampler");
    if (ksNode) {
      const model = ksNode.inputs?.model;
      check(`S3-${name}`, `KSampler model=[3,0]`, model && model[0] === "3" && model[1] === 0,
        `Got: [${model?.[0]},${model?.[1]}]`);
    } else {
      check(`S3-${name}`, `KSampler node exists`, false, "Not found");
    }

    const ckpt = parsed.nodes["3"];
    check(`S4-${name}`, `CheckpointLoaderSimple is node 3`, ckpt?.class_type === "CheckpointLoaderSimple",
      `Got: ${ckpt?.class_type || "NOT FOUND"}`);
  }
}

// --- 2. Template variable replacement simulation ---
for (const name of sceneNames) {
  const f = join(workflowsDir, `vi-scene-${name}.json`);
  const raw = readFileSync(f, "utf-8");

  const seedCount = (raw.match(/\{\{SEED\}\}/g) || []).length;
  const posCount = (raw.match(/\{\{POSITIVE_PROMPT\}\}/g) || []).length;
  const negCount = (raw.match(/\{\{NEGATIVE_PROMPT\}\}/g) || []).length;

  // Simulate what worker.mjs does
  const replaced = raw
    .replace(/\{\{SEED\}\}/g, "1234567890")
    .replace(/\{\{SCENE_ID\}\}/g, "test_scene")
    .replace(/\{\{INDUSTRY_ID\}\}/g, "food")
    .replace(/\{\{POSITIVE_PROMPT\}\}/g, "A beautiful storefront")
    .replace(/\{\{NEGATIVE_PROMPT\}\}/g, "blurry, low quality");

  const residual = replaced.match(/\{\{[A-Z_]+\}\}/g) || [];
  check(`T1-${name}`, `All templates replaced — no residual`, residual.length === 0,
    `Residual: ${residual.join(", ")}`);

  try {
    const obj = JSON.parse(replaced, (key, value) => {
      return (key === "seed" || key === "steps" || key === "cfg") && typeof value === "string" && !isNaN(Number(value))
        ? Number(value) : value;
    });
    check(`T2-${name}`, `Parsed after replacement with reviver`, true);
  } catch (e) {
    check(`T2-${name}`, `Parsed after replacement with reviver`, false, e.message);
  }

  const hasTemplates = seedCount > 0 || posCount > 0 || negCount > 0;
  check(`T3-${name}`, `Has template variables (SEED:${seedCount} POS:${posCount} NEG:${negCount})`, hasTemplates,
    `No template variables found`);
}

// --- 3. Worker.mjs scene processing code ---
const workerPath = join(root, "scripts", "worker.mjs");
const workerContent = readFileSync(workerPath, "utf-8");

// Check for template variable handling in worker source (note: escaped as JS regex literals)
const rawPatterns = ["SEED", "SCENE_ID", "INDUSTRY_ID", "POSITIVE_PROMPT", "NEGATIVE_PROMPT"];
const allFound = rawPatterns.every(p => workerContent.includes(p));
check("W1", "Worker source contains all 5 template variable names", allFound,
  `Missing: ${rawPatterns.filter(p => !workerContent.includes(p)).join(", ")}`);

const usesResolved = workerContent.includes("resolvedWorkflow");
check("W2", "Worker uses resolvedWorkflow (not sceneWorkflow) for ComfyUI call", usesResolved);

const hasMap = workerContent.includes("MODULE_WORKFLOW_MAP");
check("W3", "Worker has MODULE_WORKFLOW_MAP for scene JSON routing", hasMap);

// --- Generate report ---
const msgDir = "D:\\disk\\HERMES&CODEX\\MESSAGE";
const reportPath = join(msgDir, "test-scene-report.md");
const total = pass + fail;
let md = `# Scene Workflow Test Report
Generated: ${new Date().toISOString()}
Total: ${pass}/${total} passed

## Results

| # | Check | Result |
|---|-------|--------|
`;
results.forEach(r => {
  md += `| ${r.id} | ${r.label} | ${r.pass ? "OK" : "FAIL: " + r.detail} |\n`;
});
md += `
## Conclusion
${fail === 0 ? "All checks passed." : `**${fail} check(s) FAILED** — see above.`}
`;
writeFileSync(reportPath, md, "utf-8");
console.log(md);
process.exit(fail > 0 ? 1 : 0);
// test-logo-prompt.mjs — Verify logo prompt optimization (001)
// Checks: negative prompt no vector/flat, pinyin rule, ComfyUI params
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

// --- 1. Check deepseek-dna.ts system prompt for forbidden words ---
const dnaPath = join(root, "src", "lib", "vi-manual", "deepseek-dna.ts");
const dnaContent = readFileSync(dnaPath, "utf-8");

// 1a: System prompt negative_en example must NOT contain vector/flat
const sysPromptNegLine = dnaContent.match(/negative_en:.*standard quality-control.*$/m)?.[0] || "";
const hasVector = /vector/.test(sysPromptNegLine);
const hasFlat = /flat design/.test(sysPromptNegLine);
check("D1", "System prompt negative_en example — no 'vector'", !hasVector,
  `FOUND: "${sysPromptNegLine.trim()}"`);
check("D2", "System prompt negative_en example — no 'flat design'", !hasFlat,
  `FOUND: "${sysPromptNegLine.trim()}"`);

// 1b: Universal negative prompt rule
const univNegLine = dnaContent.match(/5\. Universal negative prompt.*?\n.*?(blurry.*)/)?.[1] || "";
check("D3", "Universal Logo neg prompt rule — no 'vector'", !/vector/i.test(univNegLine), `Got: "${univNegLine.trim()}"`);
check("D4", "Universal Logo neg prompt rule — no 'flat design'", !/flat design/i.test(univNegLine));

// 1c: Scene universal neg prompt
const sceneNegLine = dnaContent.match(/3\. Universal negative prompt.*?scene.*?\n.*?(blurry.*)/)?.[1] || "";
check("D5", "Universal Scene neg prompt rule — no 'vector'", !/vector/i.test(sceneNegLine));

// 1d: Fallback defaults (3 places)
const fallbackMatches = [...dnaContent.matchAll(/"deformed, blurry, low quality, distorted, 3d render/g)];
check("D6", "Fallback default neg prompts — at least 3 occurrences", fallbackMatches.length >= 3,
  `Found ${fallbackMatches.length}`);

// 1e: Pinyin rule present
const hasPinyin = /Replace the brand name with its PINYIN/i.test(dnaContent);
check("D7", "Pinyin rule present in system prompt", hasPinyin);

// --- 2. Check worker.mjs ---
const workerPath = join(root, "scripts", "worker.mjs");
const workerContent = readFileSync(workerPath, "utf-8");

// 2a: Logo negative prompt
const logoNegMatch = workerContent.match(/const negativePrompt = '(.*?)';/);
const logoNegInWorker = logoNegMatch ? logoNegMatch[1] : "";
check("W1", "Worker Logo neg prompt — no 'vector'", !/vector/i.test(logoNegInWorker), `Got: "${logoNegInWorker}"`);
check("W2", "Worker Logo neg prompt — no 'flat design'", !/flat design/i.test(logoNegInWorker));
check("W3", "Worker Logo neg prompt — no 'cartoon/illustration'", !/cartoon|illustration/.test(logoNegInWorker));

// 2b: Scene negative prompt fallback
const sceneNegMatch = workerContent.match(/sp\.negative \|\| '([^']+)'/);
const sceneNegFallback = sceneNegMatch ? sceneNegMatch[1] : "NOT FOUND";
check("W4", "Worker Scene neg fallback — no 'vector'", !/vector/i.test(sceneNegFallback));
check("W5", "Worker Scene neg fallback — no 'flat design'", !/flat design/i.test(sceneNegFallback));

// 2c: Template variable replacement
const hasSeedReplace = /replace.*SEED/.test(workerContent);
check("W6", "Worker has {{SEED}} template replacement logic", hasSeedReplace);

// 2d: reviver
const hasReviver = /parse.*reviver/.test(workerContent) || /typeof value ===.*string/.test(workerContent);
check("W7", "Worker JSON.parse has reviver for seed/steps/cfg", hasReviver);

// --- 3. Check comfyui-provider.ts params ---
const providerPath = join(root, "src", "lib", "ip", "ip-image-provider", "comfyui-provider.ts");
const providerContent = readFileSync(providerPath, "utf-8");

const logoParams = providerContent.match(/comfyGenerateLogo[\s\S]*?genParams:\s*(\{[^}]+\})/)?.[1] || "";
check("P1", "Logo genParams reads from config", /cfg\.logo\.steps/.test(logoParams));
check("P2", "Logo genParams cfg from config", /cfg\.logo\.cfg/.test(logoParams));
check("P3", "Logo genParams sampler from config", /cfg\.logo\.sampler/.test(logoParams));
check("P4", "Logo genParams scheduler from config", /cfg\.logo\.scheduler/.test(logoParams));

const sceneParams = providerContent.match(/comfyGenerateScene[\s\S]*?genParams:\s*(\{[^}]+\})/)?.[1] || "";
check("P5", "Scene genParams reads from config", /cfg2\.scene\.steps/.test(sceneParams));
check("P6", "Scene genParams cfg from config", /cfg2\.scene\.cfg/.test(sceneParams));
check("P7", "Scene genParams sampler from config", /cfg2\.scene\.sampler/.test(sceneParams));
check("C1", "image-gen-config.json imported in provider", providerContent.includes("image-gen-config.json"));
check("C2", "getImageGenConfig function defined", providerContent.includes("function getImageGenConfig"));
check("C3", "Worker imports config JSON", workerContent.includes("image-gen-config.json"));
check("C4", "Worker getConfig function defined", workerContent.includes("function getConfig"));

// --- Generate report ---
const msgDir = "D:\\disk\\HERMES&CODEX\\MESSAGE";
const reportPath = join(msgDir, "test-logo-report.md");
const total = pass + fail;
let md = `# Logo Prompt Test Report
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

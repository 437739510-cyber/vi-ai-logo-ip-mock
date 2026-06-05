/**
 * fix-pptx-v4.js — PPTX V4 Frontend Fix
 * 
 * V4 Strategy: 前端只传 projectId，其余全部由后端 route.ts 从 Supabase 查
 * 不再传 brandColors/companyName/logoUrl/mascotUrl —— 这些字段前端经常传错
 * 
 * 修改 handleGeneratePptx 函数，POST body 只包含 projectId
 * 
 * Usage: node fix-pptx-v4.js
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'app', 'admin', 'projects', '[id]', 'page.tsx');

if (!fs.existsSync(FILE)) {
  console.error('ERROR: Cannot find ' + FILE);
  process.exit(1);
}

let content = fs.readFileSync(FILE, 'utf-8');
let changes = 0;

// Strategy: Find the handleGeneratePptx function and replace its fetch body
// We need to find the POST /api/ai/generate-manual-pptx call and simplify it

// Pattern 1: Find the entire handleGeneratePptx function and replace
const funcMatch = content.match(/const handleGeneratePptx\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?setPptxLoading\(false\);\s*\}/);

if (funcMatch) {
  const oldFunc = funcMatch[0];
  // Build new function - only pass projectId
  const newFunc = `const handleGeneratePptx = async () => {
    setPptxLoading(true);
    setPptxError("");
    try {
      const res = await fetch("/api/ai/generate-manual-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "PPTX generation failed");
      }
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error(data.error || "No URL returned");
      }
    } catch (err: any) {
      setPptxError(err.message || "PPTX generation failed");
    } finally {
      setPptxLoading(false);
    }
  }`;
  content = content.replace(oldFunc, newFunc);
  changes++;
  console.log('Fix 1: Replaced handleGeneratePptx with projectId-only version');
} else {
  console.log('Fix 1: Could not find handleGeneratePptx function, trying alternate patterns...');
  
  // Try alternate: find the fetch call to generate-manual-pptx and simplify body
  const bodyMatch = content.match(/body:\s*JSON\.stringify\(\{[^}]*projectId[^}]*\}\)/);
  if (bodyMatch) {
    const oldBody = bodyMatch[0];
    const newBody = 'body: JSON.stringify({ projectId: project.id })';
    content = content.replace(oldBody, newBody);
    changes++;
    console.log('Fix 1b: Simplified fetch body to projectId only');
  }
}

// Fix 2: AI layout planner port 3001 -> 3000
const aiFile = path.join(__dirname, 'src', 'lib', 'ai-layout-planner.ts');
if (fs.existsSync(aiFile)) {
  let aiContent = fs.readFileSync(aiFile, 'utf-8');
  if (aiContent.includes('localhost:3001')) {
    aiContent = aiContent.replace(/localhost:3001/g, 'localhost:3000');
    fs.writeFileSync(aiFile, aiContent, 'utf-8');
    console.log('Fix 2: AI layout planner port 3001 -> 3000');
    changes++;
  } else {
    console.log('Fix 2: Port already correct');
  }
} else {
  console.log('Fix 2: ai-layout-planner.ts not found (skip)');
}

// Fix 3: Ensure the PPTX button exists
if (!content.includes('generate-manual-pptx') && !content.includes('handleGeneratePptx')) {
  // Add button before the closing section
  const insertPoint = content.lastIndexOf('</section>');
  if (insertPoint > 0) {
    const pptxSection = `
      {/* PptxGenJS 生成 PPTX 手册 */}
      <section className="bg-white rounded-xl border border-blue-200 p-6 space-y-4 bg-gradient-to-br from-blue-50 to-transparent">
        <div className="flex items-center gap-2.5">
          <FileDown className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-neutral-900">PptxGenJS 生成 PPTX 手册</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">纯前端渲染，0成本，生成专业VI手册PPTX文件</p>
          </div>
        </div>
        <button
          onClick={handleGeneratePptx}
          disabled={pptxLoading}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
        >
          {pptxLoading ? '生成中...' : '生成 PPTX 手册'}
        </button>
        {pptxError && <p className="text-xs text-red-600">{pptxError}</p>}
      </section>
`;
    content = content.slice(0, insertPoint) + pptxSection + content.slice(insertPoint);
    changes++;
    console.log('Fix 3: Added PPTX button section');
  }
} else {
  console.log('Fix 3: PPTX button already exists');
}

// Fix 4: Ensure state variables exist
if (!content.includes('pptxLoading')) {
  // Add state after other useState declarations
  const stateInsert = content.indexOf('const [submission');
  if (stateInsert > 0) {
    const insertAfter = content.indexOf(';', stateInsert) + 1;
    const stateCode = `\n  const [pptxLoading, setPptxLoading] = useState(false);\n  const [pptxError, setPptxError] = useState("");`;
    content = content.slice(0, insertAfter) + stateCode + content.slice(insertAfter);
    changes++;
    console.log('Fix 4: Added pptxLoading/pptxError state');
  }
} else {
  console.log('Fix 4: State already exists');
}

if (changes > 0) {
  fs.writeFileSync(FILE, content, 'utf-8');
  console.log(`\nOK: ${changes} fixes applied`);
} else {
  console.log('\nNo changes needed');
}

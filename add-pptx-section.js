/**
 * add-pptx-section.js — Add PptxGenJS section to project detail page
 * 
 * Usage: node add-pptx-section.js
 * 
 * Inserts a new "PptxGenJS 生成 PPTX 手册" section right after the
 * existing "AI 生成手册页面（通义万相）" section in page.tsx
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'app', 'admin', 'projects', '[id]', 'page.tsx');

if (!fs.existsSync(FILE)) {
  console.error('ERROR: Cannot find ' + FILE);
  console.error('Make sure you are in the project root directory');
  process.exit(1);
}

let content = fs.readFileSync(FILE, 'utf-8');

// Check if already patched
if (content.includes('generate-manual-pptx') || content.includes('PptxGenJS')) {
  console.log('Already patched! Skipping.');
  process.exit(0);
}

// 1. Add FileDown2/Download icon import if not present (already has Download)
// 2. Add state variable for PPTX generation
const stateInsert = `  const [deletingManual, setDeletingManual] = useState<string | null>(null);`;
const pptxState = `  const [deletingManual, setDeletingManual] = useState<string | null>(null);
  const [generatingPptx, setGeneratingPptx] = useState(false);
  const [pptxResult, setPptxResult] = useState<{url: string; pageCount: number; fileName: string} | null>(null);
  const [pptxError, setPptxError] = useState<string | null>(null);`;

content = content.replace(stateInsert, pptxState);

// 3. Add handler function before the return statement
// Find a good insertion point - after the last handler function
const handlerAnchor = 'const handleExportPdf = async (manualId: string) => {';
const pptxHandler = `/** Generate PPTX via PptxGenJS engine (no API cost!) */
  const handleGeneratePptx = async () => {
    if (!project) return;
    setGeneratingPptx(true);
    setPptxError(null);
    setPptxResult(null);
    try {
      const res = await fetch('/api/ai/generate-manual-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          clientInfo: {
            companyName: project.clientName || project.name || '',
            brandVision: submission?.brandVision || '',
            coreValues: submission?.coreValues || '',
            targetMarket: submission?.targetMarket || '',
            industry: submission?.industry || '',
            logoPhilosophy: submission?.logoPhilosophy || '',
            mascotPhilosophy: submission?.mascotPhilosophy || '',
          },
          brandColors: project.brandColors || {
            primary: { hex: '#1A73E8' },
            secondary: { hex: '#34A853' },
            accent: { hex: '#FBBC04' },
          },
          logoUrl: project.logoUrl,
          mascotUrl: project.mascotUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPptxResult({ url: data.url, pageCount: data.pageCount, fileName: data.fileName });
      } else {
        setPptxError(data.error || '\u751f\u6210\u5931\u8d25');
      }
    } catch (e: any) {
      setPptxError(e.message || '\u7f51\u7edc\u9519\u8bef');
    } finally {
      setGeneratingPptx(false);
    }
  };

  `;

content = content.replace(handlerAnchor, pptxHandler + handlerAnchor);

// 4. Insert PptxGenJS section after the 通义万相 section
// Find the closing of the 通义万相 section and insert after it
const txySectionEnd = `{/* AI generate section: Tongyi Wanxiang pages */}`;
const pptxSection = `{/* PptxGenJS Engine: PPTX generation (no API cost) */}
      <section className="bg-white rounded-xl border border-blue-200 p-6 space-y-4 bg-gradient-to-br from-blue-50 to-transparent">
        <div className="flex items-center gap-2.5">
          <FileDown className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-neutral-900">PptxGenJS \u751f\u6210 PPTX \u624b\u518c\uff08\u514d\u8d39\uff09</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">\u7a0b\u5e8f\u5316\u6e32\u67d3\uff0c\u4e0d\u8c03\u7528\u901a\u4e49\u4e07\u76f8\uff0c0 \u6210\u672c\u751f\u6210\u53ef\u7f16\u8f91 PPTX \u6587\u4ef6\u3002Logo/IP \u5927\u80c6\u6ee1\u7248\u5c55\u793a</p>
          </div>
        </div>
        <button
          onClick={handleGeneratePptx}
          disabled={generatingPptx}
          className="inline-flex w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingPptx ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> \u751f\u6210\u4e2d...</>
          ) : (
            <><FileDown className="w-4 h-4" /> \u751f\u6210 PPTX \u624b\u518c</>
          )}
        </button>
        {pptxError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-xs text-red-600">{pptxError}</p>
          </div>
        )}
        {pptxResult && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-blue-700">\u751f\u6210\u6210\u529f\uff01{pptxResult.pageCount} \u9875</p>
              </div>
            </div>
            <a
              href={pptxResult.url}
              download
              className="px-3 py-1.5 text-[11px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> \u4e0b\u8f7d PPTX
            </a>
          </div>
        )}
      </section>

      `;

content = content.replace(txySectionEnd, pptxSection + txySectionEnd);

// 5. Write back
fs.writeFileSync(FILE, content, 'utf-8');
console.log('OK: PptxGenJS section added to project detail page');
console.log('');
console.log('Changes made:');
console.log('1. Added state: generatingPptx, pptxResult, pptxError');
console.log('2. Added handler: handleGeneratePptx()');
console.log('3. Added PptxGenJS section UI after Tongyi Wanxiang section');

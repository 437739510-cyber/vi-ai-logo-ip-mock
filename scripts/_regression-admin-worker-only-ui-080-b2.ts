import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagePath = "src/app/admin/projects/[id]/page.tsx";
const source = readFileSync(pagePath, "utf8");
let assertions = 0;

function present(pattern: RegExp, label: string) {
  assert.match(source, pattern, label);
  assertions += 1;
}

function absent(pattern: RegExp, label: string) {
  assert.doesNotMatch(source, pattern, label);
  assertions += 1;
}

for (const route of ["generate-logo", "generate-mascot", "generate-manual-pptx"]) {
  absent(new RegExp(`/api/ai/${route}`), `legacy browser route removed: ${route}`);
}

for (const handler of ["handleGenerateLogo", "handleGenerateMascot", "handleGeneratePptx"]) {
  absent(new RegExp(`\\b${handler}\\b`), `legacy handler removed: ${handler}`);
}

absent(/auto-resum|自动续传|正在续传|resumeInterval|stallCheck/i, "PPTX auto resume removed");
absent(/品牌分析完成[\s\S]{0,500}handleGenerateLogo|analysisStatus[\s\S]{0,500}handleGenerateLogo/, "brand analysis does not trigger Logo generation");
absent(/重新生成\s*\(约|重新生成将花费|预估费用|costPerImage/, "online generation cost copy removed");
absent(/setGenerationFormat|generationFormat|格式选择/, "PDF/PPTX generation selector removed");
absent(/export-pdf-v6|handleExportPdf|PDF 导出/, "browser PDF generation removed");
absent(/生成VI手册\s*\(/, "manual generation button removed");

present(/线上接单、本地 Worker 生产/, "worker-only production explanation shown");
present(/任务由本地 Worker 按订单状态自动处理/, "worker automatic processing shown");
present(/付款确认后进入本地 Worker 队列/, "payment-to-worker queue explanation shown");
present(/客户选择 IP 后由现有状态机接力/, "IP state-machine handoff shown");
present(/VI 手册 PPTX 交付/, "PPTX-only delivery shown");
present(/页面只展示状态与 PPTX 交付结果/, "read-only delivery behavior shown");

present(/\/api\/admin\/mark-paid/, "payment confirmation preserved");
present(/\/api\/ai\/select-logo/, "Logo selection preserved");
present(/\/api\/ai\/set-manual-review-status/, "IP manual review preserved");
present(/下载 PPTX/, "PPTX download preserved");
present(/生成历史/, "generation history preserved");
present(/generation-history\?projectId=/, "history query preserved");
present(/logoResult\.logos\.map/, "generated Logo result display preserved");
present(/mascotAssets as any\)\.threeView/, "IP asset review display preserved");
present(/pptxResult\.downloadUrl \|\| pptxResult\.storageUrl \|\| pptxResult\.url/, "PPTX result URL fallback preserved");

absent(/generationStatus\s*:/, "page does not write generationStatus in a request object");
absent(/setGenerationStatus|update\([^)]*generationStatus/, "page has no direct generationStatus mutation");
absent(/\/api\/(?:admin\/)?(?:queue|enqueue)|queueJob|enqueueJob/, "no queue bypass added");
absent(/window\.location[^\n]*(?:generate-logo|generate-mascot|generate-manual-pptx)/, "no navigation bypass");
absent(/@ts-ignore|@ts-nocheck/, "no TypeScript suppression added");

console.log(`TICKET-080-B2 regression: ${assertions} assertions passed`);

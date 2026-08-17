import { readFileSync } from "node:fs";
import {
  buildCanonicalPptxResult,
  buildCompletedManualHistoryItem,
  createManualFilename,
  createManualObjectPath,
  createManualStorageUrl,
  normalizeViManualHistory,
  parseManualFilename,
  VI_MANUAL_STORAGE_BUCKET,
} from "../src/lib/vi-manual/manual-delivery";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const projectId = "VI-20260810-A1B2";
const timestamp = 1786300000000;
const fileName = createManualFilename(projectId, timestamp);
const objectPath = createManualObjectPath(projectId, fileName);
const storageUrl = createManualStorageUrl("https://example.supabase.co", projectId, fileName);
const result = buildCanonicalPptxResult({
  projectId,
  timestamp,
  pageCount: 25,
  supabaseUrl: "https://example.supabase.co/",
});
const completedAt = "2026-08-10T01:02:03.000Z";
const historyItem = buildCompletedManualHistoryItem(result, completedAt);

check(
  "078-1 canonical bucket/path/URL 一致",
  VI_MANUAL_STORAGE_BUCKET === "brand-brain-generated" &&
    objectPath === `${projectId}/${fileName}` &&
    storageUrl === `https://example.supabase.co/storage/v1/object/public/brand-brain-generated/${objectPath}` &&
    result.objectPath === objectPath && result.storageUrl === storageUrl,
);

check(
  "078-2 含连字符 projectId 的 canonical filename 可无歧义解析",
  parseManualFilename(fileName)?.projectId === projectId &&
    parseManualFilename(fileName)?.timestamp === String(timestamp),
);

const rejectedNames = [
  `../${fileName}`,
  `..\\${fileName}`,
  `folder/${fileName}`,
  `folder\\${fileName}`,
  `vi-manual-${projectId}-${timestamp}.pdf`,
  `vi-manual-${projectId}.pptx`,
  `fake-vi-manual-${projectId}-${timestamp}.pptx`,
  `vi-manual-${projectId}-${timestamp}.pptx.bak`,
  `vi-manual-${projectId}_${timestamp}.pptx`,
];
check(
  "078-3 路径逃逸、错误扩展名与伪造名称全部拒绝",
  rejectedNames.every((candidate) => parseManualFilename(candidate) === null),
  rejectedNames.filter((candidate) => parseManualFilename(candidate) !== null).join(", "),
);

check(
  "078-4 Worker 新历史项持久化稳定字段与同源扁平下载字段",
  historyItem.id === `pptx:${fileName}` && historyItem.completedAt === completedAt &&
    historyItem.timestamp === completedAt && historyItem.status === "completed" &&
    historyItem.downloadUrl === result.downloadUrl && historyItem.storageUrl === result.storageUrl &&
    historyItem.fileName === result.fileName && historyItem.pptxResult === result,
);

const nested = normalizeViManualHistory({
  viGenerationHistory: [{
    status: "completed",
    timestamp: completedAt,
    pageCount: 22,
    pptxResult: { fileName, downloadUrl: result.downloadUrl, storageUrl, pageCount: 22 },
  }],
});
check(
  "078-5 nested Worker 旧 history 正确归一化",
  nested.length === 1 && nested[0].id === `pptx:${fileName}` &&
    nested[0].completedAt === completedAt && nested[0].downloadUrl === result.downloadUrl &&
    nested[0].pageCount === 22,
);

const flat = normalizeViManualHistory({
  viGenerationHistory: [{
    id: "persisted-flat-id",
    status: "completed",
    completedAt,
    format: "pptx",
    pageCount: 18,
    fileName,
    storageUrl,
  }],
});
check(
  "078-6 flat web 旧 history 正确归一化",
  flat.length === 1 && flat[0].id === "persisted-flat-id" && flat[0].downloadUrl === storageUrl &&
    flat[0].completedAt === completedAt && flat[0].pageCount === 18,
);

const fallback = normalizeViManualHistory({
  viGenerationHistory: [{ status: "failed" }],
  pptxResult: { fileName, pageCount: 25, downloadUrl: result.downloadUrl },
});
check(
  "078-7 history 无有效完成项时使用 pptxResult fallback",
  fallback.length === 1 && fallback[0].id === `pptx:${fileName}` &&
    fallback[0].completedAt === null && fallback[0].downloadUrl === result.downloadUrl,
);

const noDuplicate = normalizeViManualHistory({
  viGenerationHistory: [historyItem],
  pptxResult: { fileName, pageCount: 99, downloadUrl: "/must-not-append" },
});
check(
  "078-8 有有效 history 时不重复追加 fallback",
  noDuplicate.length === 1 && noDuplicate[0].pageCount === 25 &&
    noDuplicate[0].downloadUrl === result.downloadUrl,
);

check(
  "078-9 无效数据返回空数组且不伪造当前时间",
  normalizeViManualHistory(null).length === 0 &&
    normalizeViManualHistory({ viGenerationHistory: [{ status: "completed" }] }).length === 0 &&
    normalizeViManualHistory({ pptxResult: { fileName: "bad.pptx", downloadUrl: "/bad" } }).length === 0,
);

const workerSrc = readFileSync(new URL("./worker.mjs", import.meta.url), "utf8");
const memberSrc = readFileSync(new URL("../src/app/api/member/vi-manuals/route.ts", import.meta.url), "utf8");
const downloadSrc = readFileSync(
  new URL("../src/app/api/ai/download-pptx/[filename]/route.ts", import.meta.url),
  "utf8",
);

check(
  "078-10 会员 API 保留 token/session/member/phone 归属链",
  memberSrc.includes('get("member_token")') && memberSrc.includes('.from("member_sessions")') &&
    memberSrc.includes('.from("members")') && memberSrc.includes('.eq("phone", member.phone)') &&
    memberSrc.includes('.in("submission_id", submissionIds)'),
);

check(
  "078-11 下载路由使用精确 canonical 对象且移除 manuals 桶根与 query 猜测",
  downloadSrc.includes("parseManualFilename(filename)") &&
    downloadSrc.includes("createManualStorageUrl(SUPABASE_URL, parsed.projectId, filename)") &&
    !downloadSrc.includes("/public/manuals/") && !downloadSrc.includes("searchParams") &&
    !downloadSrc.includes('ext === "pdf"'),
);

check(
  "078-12 Worker、会员和下载路由共同消费共享契约",
  workerSrc.includes("buildCanonicalPptxResult") && workerSrc.includes("VI_MANUAL_STORAGE_BUCKET") &&
    memberSrc.includes("normalizeViManualHistory") && downloadSrc.includes("createManualStorageUrl") &&
    !(workerSrc.slice(workerSrc.indexOf("// Step 5: Upload to Supabase Storage"), workerSrc.indexOf("// ========== Mascot Sample Generation")).includes("'brand-brain-generated'")),
);

console.log(`RESULT ${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;

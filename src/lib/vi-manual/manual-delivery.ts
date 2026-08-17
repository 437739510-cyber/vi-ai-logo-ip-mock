/** TICKET-078: pure VI manual delivery contract (no database, network, or process I/O). */

export const VI_MANUAL_STORAGE_BUCKET = "brand-brain-generated";
export const VI_MANUAL_FORMAT = "pptx" as const;
export const VI_MANUAL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const PROJECT_ID_PATTERN = "[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*";
const MANUAL_FILENAME_RE = new RegExp(
  `^vi-manual-(${PROJECT_ID_PATTERN})-(\\d{10,17})\\.pptx$`,
);

type UnknownRecord = Record<string, unknown>;

export interface ParsedManualFilename {
  projectId: string;
  timestamp: string;
  fileName: string;
}

export interface CanonicalPptxResult {
  url: string;
  downloadUrl: string;
  storageUrl: string;
  fileName: string;
  pageCount: number;
  bucket: typeof VI_MANUAL_STORAGE_BUCKET;
  objectPath: string;
}

export interface CompletedManualHistoryItem extends CanonicalPptxResult {
  id: string;
  format: typeof VI_MANUAL_FORMAT;
  completedAt: string;
  timestamp: string;
  status: "completed";
  pptxResult: CanonicalPptxResult;
}

export interface NormalizedViManual {
  id: string;
  format: typeof VI_MANUAL_FORMAT;
  pageCount: number;
  completedAt: string | null;
  downloadUrl: string;
  fileName: string;
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stableDate(value: unknown): string | null {
  const text = nonEmptyString(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function pageCount(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function isValidManualProjectId(projectId: unknown): projectId is string {
  return typeof projectId === "string" && new RegExp(`^${PROJECT_ID_PATTERN}$`).test(projectId);
}

export function createManualFilename(projectId: string, timestamp: number | string): string {
  const timestampText = String(timestamp);
  if (!isValidManualProjectId(projectId) || !/^\d{10,17}$/.test(timestampText)) {
    throw new Error("invalid canonical VI manual filename components");
  }
  return `vi-manual-${projectId}-${timestampText}.pptx`;
}

export function parseManualFilename(filename: unknown): ParsedManualFilename | null {
  if (typeof filename !== "string" || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return null;
  }
  const match = MANUAL_FILENAME_RE.exec(filename);
  if (!match) return null;
  return { projectId: match[1], timestamp: match[2], fileName: filename };
}

export function createManualObjectPath(projectId: string, fileName: string): string {
  const parsed = parseManualFilename(fileName);
  if (!parsed || parsed.projectId !== projectId) {
    throw new Error("filename does not belong to project");
  }
  return `${projectId}/${fileName}`;
}

export function createManualStorageUrl(
  supabaseUrl: string,
  projectId: string,
  fileName: string,
): string {
  const base = nonEmptyString(supabaseUrl)?.replace(/\/+$/, "");
  if (!base) throw new Error("missing Supabase URL");
  const objectPath = createManualObjectPath(projectId, fileName);
  return `${base}/storage/v1/object/public/${VI_MANUAL_STORAGE_BUCKET}/${objectPath}`;
}

export function buildCanonicalPptxResult(input: {
  projectId: string;
  timestamp: number | string;
  pageCount: number;
  supabaseUrl: string;
}): CanonicalPptxResult {
  const fileName = createManualFilename(input.projectId, input.timestamp);
  const objectPath = createManualObjectPath(input.projectId, fileName);
  const downloadUrl = `/api/ai/download-pptx/${fileName}`;
  return {
    url: downloadUrl,
    downloadUrl,
    storageUrl: createManualStorageUrl(input.supabaseUrl, input.projectId, fileName),
    fileName,
    pageCount: pageCount(input.pageCount),
    bucket: VI_MANUAL_STORAGE_BUCKET,
    objectPath,
  };
}

export function buildCompletedManualHistoryItem(
  result: CanonicalPptxResult,
  completedAt: string,
): CompletedManualHistoryItem {
  const persistedCompletedAt = stableDate(completedAt);
  if (!persistedCompletedAt) throw new Error("invalid completion time");
  return {
    ...result,
    id: `pptx:${result.fileName}`,
    format: VI_MANUAL_FORMAT,
    completedAt: persistedCompletedAt,
    timestamp: persistedCompletedAt,
    status: "completed",
    pptxResult: result,
  };
}

function normalizeCompletedItem(value: unknown): NormalizedViManual | null {
  const item = asRecord(value);
  if (item.status !== "completed") return null;
  const nested = asRecord(item.pptxResult);
  const fileName = nonEmptyString(item.fileName) || nonEmptyString(nested.fileName);
  if (!fileName || !parseManualFilename(fileName)) return null;
  const downloadUrl =
    nonEmptyString(item.downloadUrl) || nonEmptyString(item.storageUrl) || nonEmptyString(item.url) ||
    nonEmptyString(nested.downloadUrl) || nonEmptyString(nested.storageUrl) || nonEmptyString(nested.url);
  if (!downloadUrl) return null;
  return {
    id: nonEmptyString(item.id) || `pptx:${fileName}`,
    format: VI_MANUAL_FORMAT,
    pageCount: pageCount(item.pageCount ?? nested.pageCount),
    completedAt:
      stableDate(item.completedAt) || stableDate(item.timestamp) || stableDate(nested.completedAt),
    downloadUrl,
    fileName,
  };
}

function normalizePptxFallback(value: unknown): NormalizedViManual | null {
  const result = asRecord(value);
  const fileName = nonEmptyString(result.fileName);
  if (!fileName || !parseManualFilename(fileName)) return null;
  const downloadUrl =
    nonEmptyString(result.downloadUrl) || nonEmptyString(result.storageUrl) || nonEmptyString(result.url);
  if (!downloadUrl) return null;
  return {
    id: nonEmptyString(result.id) || `pptx:${fileName}`,
    format: VI_MANUAL_FORMAT,
    pageCount: pageCount(result.pageCount),
    completedAt: stableDate(result.completedAt) || stableDate(result.timestamp),
    downloadUrl,
    fileName,
  };
}

export function normalizeViManualHistory(clientInfo: unknown): NormalizedViManual[] {
  const info = asRecord(clientInfo);
  const history = Array.isArray(info.viGenerationHistory) ? info.viGenerationHistory : [];
  const normalized = history
    .map(normalizeCompletedItem)
    .filter((item): item is NormalizedViManual => item !== null);
  if (normalized.length > 0) return normalized;
  const fallback = normalizePptxFallback(info.pptxResult);
  return fallback ? [fallback] : [];
}

/**
 * Generation Logger — 生成日志系统
 *
 * 记录每次 VI 手册生成的完整过程：
 * - 使用的 PageBlueprint
 * - 每页质量评分
 * - 成功/失败状态
 * - 耗时
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "public", "generated", "logs");
const INDEX_PATH = path.join(LOG_DIR, "generation-index.json");

// ========== 类型 ==========

export interface GenerationLogEntry {
  projectId: string;
  refId?: string;
  templateId?: string;
  generatedAt: string;
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  durationMs: number;
  pages: PageLog[];
}

export interface PageLog {
  pageId: string;
  label: string;
  success: boolean;
  qualityScore: number | null;
  qualityPassed: boolean | null;
  durationMs: number;
  error?: string;
  imageUrl?: string;
}

export interface GenerationLogIndex {
  version: number;
  entries: GenerationLogSummary[];
}

export interface GenerationLogSummary {
  projectId: string;
  generatedAt: string;
  totalPages: number;
  successfulPages: number;
  failedPages: number;
}

// ========== 主功能 ==========

/**
 * 保存一次生成的完整日志
 */
export async function saveGenerationLog(entry: GenerationLogEntry): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });

  // Write individual log file
  const logFileName = `gen-${entry.projectId}-${Date.now()}.json`;
  const logPath = path.join(LOG_DIR, logFileName);
  await writeFile(logPath, JSON.stringify(entry, null, 2), "utf-8");

  // Update index
  const index = await loadIndex();
  index.entries.push({
    projectId: entry.projectId,
    generatedAt: entry.generatedAt,
    totalPages: entry.totalPages,
    successfulPages: entry.successfulPages,
    failedPages: entry.failedPages,
  });
  // Keep only last 100 entries
  if (index.entries.length > 100) {
    index.entries = index.entries.slice(-100);
  }
  await saveIndex(index);
}

/**
 * 获取所有生成记录摘要
 */
export async function listGenerationLogs(limit: number = 50): Promise<GenerationLogSummary[]> {
  const index = await loadIndex();
  return index.entries.slice(-limit).reverse();
}

/**
 * 获取项目最新的生成日志
 */
export async function getLatestProjectLog(projectId: string): Promise<GenerationLogEntry | null> {
  const dir = LOG_DIR;
  try {
    const files = await import("fs").then(fs => fs.readdirSync(dir));
    const projectLogs = files
      .filter(f => f.startsWith(`gen-${projectId}-`))
      .sort()
      .reverse();

    if (projectLogs.length === 0) return null;

    const content = await readFile(path.join(dir, projectLogs[0]), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ========== 内部 ==========

async function loadIndex(): Promise<GenerationLogIndex> {
  try {
    const content = await readFile(INDEX_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { version: 1, entries: [] };
  }
}

async function saveIndex(index: GenerationLogIndex): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

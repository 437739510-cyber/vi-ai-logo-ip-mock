/**
 * Billing System V1 — Usage Log
 *
 * Records all cost-related operations.
 * Uses Memory storage (JSON files).
 */

import type { UsageLog, UsageAction } from "./types";

const LOGS_DIR = "public/memory/billing";
const LOGS_FILE = "usage-logs.json";

function getLogsPath(): string {
  return `${process.cwd()}/${LOGS_DIR}/${LOGS_FILE}`;
}

// ========== File I/O ==========

async function readLogs(): Promise<UsageLog[]> {
  try {
    const fs = await import("fs/promises");
    const data = await fs.readFile(getLogsPath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeLogs(logs: UsageLog[]): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");
  await fs.mkdir(path.dirname(getLogsPath()), { recursive: true });
  await fs.writeFile(getLogsPath(), JSON.stringify(logs, null, 2), "utf-8");
}

// ========== ID Generator ==========

let counter = 0;
function generateId(): string {
  counter++;
  const ts = Date.now().toString(36);
  return `log-${ts}-${counter}`;
}

// ========== API ==========

/**
 * 记录一次消耗
 */
export async function logUsage(params: {
  projectId: string;
  accountId: string;
  action: UsageAction;
  cost: number;
  balanceBefore: number;
  balanceAfter: number;
  durationMs: number;
  status: "success" | "failed" | "pending";
  resultId?: string;
}): Promise<UsageLog> {
  const log: UsageLog = {
    id: generateId(),
    projectId: params.projectId,
    accountId: params.accountId,
    action: params.action,
    cost: params.cost,
    balanceBefore: params.balanceBefore,
    balanceAfter: params.balanceAfter,
    durationMs: params.durationMs,
    status: params.status,
    resultId: params.resultId,
    createdAt: new Date().toISOString(),
  };

  const logs = await readLogs();
  logs.push(log);
  await writeLogs(logs);

  return log;
}

/**
 * 获取项目的所有消耗记录
 */
export async function getUsageLogs(projectId: string): Promise<UsageLog[]> {
  const logs = await readLogs();
  return logs.filter((l) => l.projectId === projectId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 获取账户的所有消耗记录
 */
export async function getUsageLogsByAccount(accountId: string): Promise<UsageLog[]> {
  const logs = await readLogs();
  return logs.filter((l) => l.accountId === accountId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 获取项目的总消耗
 */
export async function getTotalCost(projectId: string): Promise<number> {
  const logs = await getUsageLogs(projectId);
  return logs.reduce((sum, l) => sum + l.cost, 0);
}

/**
 * 获取所有消耗记录（管理用）
 */
export async function getAllLogs(): Promise<UsageLog[]> {
  return readLogs();
}

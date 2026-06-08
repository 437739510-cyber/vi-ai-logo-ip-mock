/**
 * Billing System V1 — Balance
 *
 * Manages account balances using Memory storage.
 */

import type { AccountBalance } from "./types";

const BILLING_DIR = "public/memory/billing";
const ACCOUNTS_FILE = "accounts.json";

function getAccountsPath(): string {
  const base = process.cwd();
  return `${base}/${BILLING_DIR}/${ACCOUNTS_FILE}`;
}

// ========== File I/O ==========

async function readAccounts(): Promise<AccountBalance[]> {
  try {
    const fs = await import("fs/promises");
    const data = await fs.readFile(getAccountsPath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeAccounts(accounts: AccountBalance[]): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const dir = path.dirname(getAccountsPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getAccountsPath(), JSON.stringify(accounts, null, 2), "utf-8");
}

// ========== API ==========

/**
 * 获取账户余额
 */
export async function getBalance(accountId: string): Promise<AccountBalance | null> {
  const accounts = await readAccounts();
  return accounts.find((a) => a.accountId === accountId) || null;
}

/**
 * 获取或创建账户
 */
export async function getOrCreateAccount(
  accountId: string,
  companyName: string,
  initialCredits: number = 10000
): Promise<AccountBalance> {
  const existing = await getBalance(accountId);
  if (existing) return existing;

  const account: AccountBalance = {
    accountId,
    companyName,
    totalCredits: initialCredits,
    usedCredits: 0,
    remainingCredits: initialCredits,
    lastUpdated: new Date().toISOString(),
    warningThreshold: 1000,
  };

  const accounts = await readAccounts();
  accounts.push(account);
  await writeAccounts(accounts);
  return account;
}

/**
 * 扣减余额
 */
export async function deductBalance(
  accountId: string,
  cost: number
): Promise<{ success: boolean; newBalance: AccountBalance | null; error?: string }> {
  const accounts = await readAccounts();
  const idx = accounts.findIndex((a) => a.accountId === accountId);

  if (idx === -1) {
    return { success: false, newBalance: null, error: "账户不存在" };
  }

  const account = accounts[idx];

  if (account.remainingCredits < cost) {
    return { success: false, newBalance: null, error: "余额不足" };
  }

  account.usedCredits += cost;
  account.remainingCredits -= cost;
  account.lastUpdated = new Date().toISOString();

  accounts[idx] = account;
  await writeAccounts(accounts);

  return { success: true, newBalance: account };
}

/**
 * 检查余额是否足够
 */
export async function checkSufficient(
  accountId: string,
  estimatedCost: number
): Promise<{ sufficient: boolean; balance: number; shortfall: number }> {
  const account = await getBalance(accountId);
  if (!account) return { sufficient: false, balance: 0, shortfall: estimatedCost };

  const shortfall = Math.max(0, estimatedCost - account.remainingCredits);
  return {
    sufficient: shortfall === 0,
    balance: account.remainingCredits,
    shortfall,
  };
}

/**
 * 获取所有账户
 */
export async function getAllAccounts(): Promise<AccountBalance[]> {
  return readAccounts();
}

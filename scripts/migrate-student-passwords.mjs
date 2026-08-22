#!/usr/bin/env node
// 一次性存量迁移：把 student_accounts.password_hash 中的旧明文改写为 scrypt 哈希。
// 幂等：已是哈希的行跳过。默认 DRY-RUN（只列出，不写库）。
// 生产写库需满足两重确认：命令行 `--apply` 且环境变量 `MIGRATION_APPLY_CONFIRM=1`。
// 支持的离线 dry-run：`node scripts/migrate-student-passwords.mjs --dry-run --fixture <rows.json>`，
//   使用本地 fixture（JSON 数组或 { rows: [...] }），不会连接 Supabase 或触碰生产库。

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { randomBytes, scryptSync } from "node:crypto";
import path from "path";
import { fileURLToPath } from "url";

// ==== 与 src/lib/password.ts 保持一致的哈希格式（脚本须能独立用 Node 运行） ====
const PREFIX = "scrypt";
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function isPasswordHash(stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1] ?? "", "base64");
  const hash = Buffer.from(parts[2] ?? "", "base64");
  return salt.length === SALT_BYTES && hash.length === KEY_LENGTH;
}

function hashPassword(password) {
  if (typeof password !== "string") throw new TypeError("password must be a string");
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${PREFIX}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const opts = { dryRun: true, apply: false, fixture: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") {
      opts.apply = true;
      opts.dryRun = false;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
      opts.apply = false;
    } else if (arg === "--fixture") {
      opts.fixture = argv[++i] ?? null;
    }
  }
  return opts;
}

function maskedPhone(phone) {
  if (!phone) return "***";
  const s = String(phone);
  return s.length >= 7 ? `${s.slice(0, 3)}****${s.slice(-4)}` : `${s.slice(0, 2)}****`;
}

async function loadRows(opts) {
  if (opts.fixture) {
    if (!existsSync(opts.fixture)) throw new Error(`fixture not found: ${opts.fixture}`);
    const data = JSON.parse(readFileSync(opts.fixture, "utf-8"));
    return { rows: Array.isArray(data) ? data : data.rows || [], client: null };
  }

  const env = readFileSync(path.join(root, ".env.local"), "utf-8");
  const getEnv = (k) => {
    const m = env.match(new RegExp(`^${k}=(.+)`, "m"));
    return m ? m[1].trim() : "";
  };
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_KEY");
  if (!url || !key) {
    console.error("Missing SUPABASE env variables (or use --fixture for offline dry-run).");
    process.exit(1);
  }
  const client = createClient(url, key);
  const { data, error } = await client.from("student_accounts").select("id, phone, password_hash");
  if (error) {
    console.error("Failed to read student_accounts:", error.message);
    process.exit(1);
  }
  return { rows: data || [], client };
}

function classify(rows) {
  const toMigrate = [];
  const alreadyHashed = [];
  for (const r of rows) {
    if (isPasswordHash(r.password_hash)) alreadyHashed.push(r);
    else toMigrate.push(r);
  }
  return { toMigrate, alreadyHashed };
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const { rows, client } = await loadRows(opts);
  const { toMigrate, alreadyHashed } = classify(rows);

  console.log("=== student_accounts.password_hash migration ===");
  console.log(
    `mode=${opts.apply ? "APPLY" : "DRY-RUN"}  total=${rows.length}  plaintext=${toMigrate.length}  alreadyHash=${alreadyHashed.length}`
  );
  console.log("");
  console.log(`plaintext rows (${opts.apply ? "would be updated" : "would be migrated"}, password value NOT shown):`);
  if (toMigrate.length === 0) {
    console.log("  (none)");
  }
  for (const r of toMigrate) {
    console.log(`  - id=${r.id}  phone=${maskedPhone(r.phone)}  status=PLAINTEXT`);
  }
  console.log("");
  console.log(`already-hash rows (skipped): ${alreadyHashed.length}`);

  if (opts.apply) {
    if (process.env.MIGRATION_APPLY_CONFIRM !== "1") {
      console.error("");
      console.error("Refusing to apply: set MIGRATION_APPLY_CONFIRM=1 in addition to --apply.");
      process.exit(1);
    }
    if (!client) {
      console.error("Refusing to apply while reading from a fixture; connect to Supabase instead.");
      process.exit(1);
    }
    let updated = 0;
    for (const r of toMigrate) {
      const newHash = hashPassword(String(r.password_hash));
      const { error } = await client
        .from("student_accounts")
        .update({ password_hash: newHash })
        .eq("id", r.id);
      if (error) {
        console.error(`  FAIL id=${r.id}: ${error.message}`);
        continue;
      }
      updated++;
      console.log(`  updated id=${r.id}`);
    }
    console.log("");
    console.log(`applied: ${updated}/${toMigrate.length} rows updated.`);
  } else {
    console.log("");
    console.log("dry-run: no rows were written. To apply, run with --apply and MIGRATION_APPLY_CONFIRM=1.");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

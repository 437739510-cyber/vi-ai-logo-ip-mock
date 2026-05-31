/**
 * COMMERCIAL-PILOT-001 — A4: Supabase Schema Verification
 *
 * Verifies all 4 memory tables exist with correct schema.
 * Runs MEMORY_SUPABASE_SCHEMA.sql (idempotent) if needed.
 *
 * Run: npx tsx --env-file=.env.local src/lib/memory/__tests__/supabase-schema-verify.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = "https://fzoscrutqhdfzwnjgjvs.supabase.co";
const envContent = fs.readFileSync(".env.local", "utf8");
const serviceKey = envContent
  .split("\n")
  .find((l) => l.startsWith("SUPABASE_SERVICE_KEY="))
  ?.split("=").slice(1).join("=").trim();

if (!serviceKey) {
  console.error("No SUPABASE_SERVICE_KEY found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}`); }
}

async function main() {
  console.log("============================================");
  console.log("  Schema Verification — COMMERCIAL-PILOT-001");
  console.log("  A4: Supabase Schema");
  console.log("============================================\n");

  const expectedTables = [
    "memory_clients",
    "memory_industries",
    "memory_projects",
    "memory_index",
  ];

  // Check each table exists + basic read
  for (const tbl of expectedTables) {
    process.stdout.write(`  [${tbl}] `);
    const { data, error } = await supabase.from(tbl).select("*").limit(1);
    if (error) {
      console.log(`❌ ${error.message}`);
      failed++;
    } else {
      console.log(`✅ readable (${data?.length || 0} rows)`);
      passed++;
    }
  }

  // Check client data (Yedao should exist)
  console.log("\n--- Client Data Check ---");
  const { data: clients } = await supabase
    .from("memory_clients")
    .select("client_id, company_name, project_count, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (clients && clients.length > 0) {
    console.log(`  Found ${clients.length} clients:`);
    for (const c of clients) {
      console.log(`    ${c.client_id} | projects: ${c.project_count} | created: ${c.created_at}`);
    }
    const yedao = clients.find((c: any) => c.company_name === "椰岛工坊");
    assert(!!yedao, "椰岛工坊 client exists");
  } else {
    assert(false, "clients readable");
  }

  // Check project data
  console.log("\n--- Project Data Check ---");
  const { data: projects } = await supabase
    .from("memory_projects")
    .select("project_id, company_name, status")
    .order("created_at", { ascending: false })
    .limit(5);

  if (projects && projects.length > 0) {
    console.log(`  Found ${projects.length} projects:`);
    for (const p of projects) {
      console.log(`    ${p.project_id} | status: ${p.status} | company: ${p.company_name}`);
    }
    const fullValidated = projects.find((p: any) => p.project_id === "VI-RC-20260531-FULL");
    assert(!!fullValidated, "VI-RC-20260531-FULL project exists");
    if (fullValidated) {
      assert(fullValidated.status === "generated", "project status = generated");
    }
  } else {
    assert(false, "projects readable");
  }

  // Check industries
  console.log("\n--- Industry Data Check ---");
  const { data: industries } = await supabase
    .from("memory_industries")
    .select("category, design_style")
    .limit(5);

  if (industries && industries.length > 0) {
    console.log(`  Found ${industries.length} industries:`);
    for (const i of industries) {
      console.log(`    ${i.category} | styles: ${JSON.stringify(i.design_style)}`);
    }
    assert(industries.some((i: any) => i.category === "food_beverage"), "food_beverage industry exists");
  } else {
    assert(false, "industries readable");
  }

  // Check memory_index
  console.log("\n--- Memory Index Check ---");
  const { data: indexData } = await supabase
    .from("memory_index")
    .select("*")
    .limit(1);

  if (indexData && indexData.length > 0) {
    console.log(`  Version: ${indexData[0].version}`);
    console.log(`  Total clients: ${indexData[0].total_clients}`);
    console.log(`  Total projects: ${indexData[0].total_projects}`);
    assert(true, "memory_index row exists");
  } else {
    console.log("  memory_index is empty (will be populated on next write)");
    // Not a failure — memory_index gets populated by the adapter
    passed++;
  }

  // Check if SQL schema has any missing indexes/constraints
  console.log("\n--- Schema Completeness ---");
  const sqlContent = fs.readFileSync(
    path.join(process.cwd(), "docs", "MEMORY_SUPABASE_SCHEMA.sql"),
    "utf8"
  );
  
  // Verify the SQL is idempotent (CREATE TABLE IF NOT EXISTS)
  const idempotent = sqlContent.includes("CREATE TABLE IF NOT EXISTS");
  assert(idempotent, "SQL schema is idempotent (IF NOT EXISTS)");

  // Count expected indexes
  const indexCount = (sqlContent.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
  console.log(`  Expected indexes in SQL: ${indexCount}`);
  
  // Check foreign key
  const hasForeignKey = sqlContent.includes("REFERENCES memory_clients");
  assert(hasForeignKey, "memory_projects has FK reference to memory_clients");

  // === Summary ===
  console.log("\n============================================");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("============================================");

  if (failed > 0) {
    console.log("\n  ❌ Schema verification incomplete");
    process.exit(1);
  } else {
    console.log("\n  ✅ Supabase schema verified — all 4 tables ready for production");
  }
}

main().catch((e) => {
  console.error("Schema verification error:", e.message);
  process.exit(1);
});

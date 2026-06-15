/**
 * PROD-SMOKE-003: Apply Supabase Storage RLS policies
 *
 * Runs the two RLS policies needed for anon browser uploads.
 * If exec_sql RPC is not available, prints the SQL for manual execution.
 *
 * Run: npx tsx --env-file=.env.local src/lib/memory/__tests__/apply-storage-policies.ts
 */

import * as fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const serviceKey = envContent
  .split("\n")
  .find((l) => l.startsWith("SUPABASE_SERVICE_KEY="))
  ?.split("=").slice(1).join("=").trim();

const sql = `
-- Policy 1: Allow anon to SELECT (read) from bucket (for public URLs)
CREATE POLICY IF NOT EXISTS "anon_select_brand_brain_generated"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'brand-brain-generated');

-- Policy 2: Allow anon to INSERT (upload) to uploads/form-assets/ only
CREATE POLICY IF NOT EXISTS "anon_insert_form_assets"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'brand-brain-generated'
  AND (storage.foldername(name))[1] = 'uploads'
  AND (storage.foldername(name))[2] = 'form-assets'
);
`;

async function main() {
  const https = await import("https");

  const data = JSON.stringify({ query: sql });
  const options = {
    hostname: "fzoscrutqhdfzwnjgjvs.supabase.co",
    path: "/rest/v1/rpc/exec_sql",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey!,
    },
  };

  console.log("Attempting to execute SQL via exec_sql RPC...\n");

  const result = await new Promise<string>((resolve, reject) => {
    const req = https.request(options, (res: any) => {
      let body = "";
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () => resolve(`Status ${res.statusCode}: ${body.substring(0, 500)}`));
    });
    req.on("error", (e: Error) => reject(e.message));
    req.write(data);
    req.end();
  });

  console.log(result);

  if (result.includes("Status 200") || result.includes("Status 201") || result.includes("Status 204")) {
    console.log("\n✅ RLS policies applied successfully!");
  } else {
    console.log("\n⚠️  exec_sql RPC not available. Policies need to be executed manually.");
    console.log("\nOpen Supabase Dashboard → SQL Editor and run:\n");
    console.log("https://supabase.com/dashboard/project/fzoscrutqhdfzwnjgjvs/sql/new\n");
    console.log(sql);
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  console.log("\nManual SQL to execute in Supabase Dashboard:\n");
  console.log(sql);
});

// Standalone PPTX generation script for VI-20260608-LVII
// Bypasses Zeabur timeout by running locally

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const SUPABASE_URL = 'https://fzoscrutqhdfzwnjgjvs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3NjcnV0cWhkZnp3bmpnanZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NjA4NjcsImV4cCI6MjA5NTQzNjg2N30.k8X19Q9yw3x3ZNgva0r7Qr6CumqJ_qHH6y_C1c2EQ_8';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const PROJECT_ID = 'VI-20260608-LVII';

async function main() {
  console.log('[standalone] Starting PPTX generation for', PROJECT_ID);
  
  // 1. Read project data
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', PROJECT_ID)
    .single();
  
  if (error || !project) {
    console.error('[standalone] Failed to read project:', error?.message);
    process.exit(1);
  }
  
  console.log('[standalone] Project loaded:', project.client_info?.companyName || 'unknown');
  console.log('[standalone] Industry:', project.client_info?.industry || 'unknown');
  console.log('[standalone] Brand colors:', JSON.stringify(project.brand_colors));
  
  // Save project data for reference
  await writeFile('/tmp/project-data.json', JSON.stringify(project, null, 2));
  console.log('[standalone] Project data saved to /tmp/project-data.json');
}

main().catch(console.error);

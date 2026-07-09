// Supabase data migration v2

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const env = readFileSync(path.join(root, '.env.local'), 'utf-8');
const getEnv = (k) => { const m = env.match(new RegExp('^' + k + '=(.+)', 'm')); return m ? m[1].trim() : ''; };

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_KEY');
if (!url || !key) { console.error('Missing env'); process.exit(1); }

const sb = createClient(url, key);
const load = (f) => { try { return JSON.parse(readFileSync(f, 'utf-8')); } catch { return null; } };

async function run() {
  console.log('=== Migration ===\n');

  // submissions
  let d = load(path.join(root, 'public/mock/submissions.json'));
  if (d && d.length) {
    const { error } = await sb.from('submissions').upsert(d.map(s => ({
      id: s.id, client_name: s.clientName || '', company_name: s.companyName || '',
      phone: s.phone || '', wechat: s.wechat || '', email: s.email || '',
      industry: s.industry || '', budget_range: s.budgetRange || '',
      description: s.description || '', logo_assets: s.logoAssets || [],
      mascot_assets: s.mascotAssets || [], reference_manual: s.referenceManual || null,
      submitted_at: s.submittedAt || new Date().toISOString(),
    })));
    if (error) console.error('FAIL submissions:', error.message); else console.log('OK submissions: ' + d.length);
  }

  // projects
  d = load(path.join(root, 'public/mock/projects.json'));
  if (d && d.length) {
    const { error } = await sb.from('projects').upsert(d.map(p => ({
      id: p.id, submission_id: p.submissionId || null, status: p.status || 'submitted',
      assigned_to: p.assignedTo || null, brand_colors: p.brandColors || null,
      client_info: p.clientInfo || null, created_at: p.createdAt || new Date().toISOString(),
      updated_at: p.updatedAt || new Date().toISOString(), timeline: p.timeline || [],
    })));
    if (error) console.error('FAIL projects:', error.message); else console.log('OK projects: ' + d.length);
  }

  // ai_plans
  const a = [...(load(path.join(root, 'src/lib/mock/ai-plans.json')) || []), ...(load(path.join(root, 'public/mock/ai-plans-runtime.json')) || [])];
  const seen = new Set();
  const unique = a.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  if (unique.length) {
    const { error } = await sb.from('ai_plans').upsert(unique.map(p => ({
      id: p.id, project_id: p.projectId || p.project_id || '', name: p.name || 'unnamed',
      style: p.style || '', description: p.description || '', colors: p.colors || [],
      typography: p.typography || [], preview_url: p.previewUrl || p.preview_url || '',
      mockup_urls: p.mockupUrls || p.mockup_urls || [], is_favorite: p.isFavorite || p.is_favorite || false,
    })));
    if (error) console.error('FAIL ai_plans:', error.message); else console.log('OK ai_plans: ' + unique.length);
  }

  // favorites
  d = load(path.join(root, 'public/mock/favorites.json'));
  if (d && d.length) {
    const { error } = await sb.from('favorites').upsert(d.map(f => ({
      id: f.id, plan_id: f.planId || f.plan_id || '', project_id: f.projectId || f.project_id || '',
      note: f.note || '', created_at: f.createdAt || f.created_at || new Date().toISOString(),
    })));
    if (error) console.error('FAIL favorites:', error.message); else console.log('OK favorites: ' + d.length);
  }

  // employees
  d = load(path.join(root, 'public/mock/employees.json'));
  if (d && d.length) {
    const { error } = await sb.from('employees').upsert(d.map(e => ({
      id: e.id || e.employeeId || '', name: e.name || '', role: e.role || '',
      email: e.email || '', phone: e.phone || '', avatar: e.avatar || '',
      is_active: e.isActive !== undefined ? e.isActive : true,
    })));
    if (error) console.error('FAIL employees:', error.message); else console.log('OK employees: ' + d.length);
  }

  // manual_pages
  const dir = path.join(root, 'public/mock');
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter(f => f.startsWith('manual-pages-') && f.endsWith('.json'))) {
      const data = load(path.join(dir, f));
      if (data && data.pages) {
        const { error } = await sb.from('manual_pages').upsert(data.pages.map(p => ({
          id: data.projectId + '-' + p.pageId, project_id: data.projectId,
          page_id: p.pageId, label: p.label, url: p.url, file_size: 0,
        })));
        if (error) console.error('FAIL manual_pages:', error.message); else console.log('OK manual_pages: ' + data.pages.length);
      }
    }
  }

  // vi_manuals
  const vm = [...(load(path.join(root, 'src/lib/mock/vi-manuals.json')) || []), ...(load(path.join(root, 'public/mock/vi-manuals-runtime.json')) || [])];
  if (vm.length) {
    const { error } = await sb.from('vi_manuals').upsert(vm.map(m => ({
      id: m.id, project_id: m.projectId || m.project_id || '', plan_id: m.planId || m.plan_id || null,
      status: m.status || 'draft', pages: m.pages || [],
      generated_at: m.generatedAt || m.generated_at || new Date().toISOString(),
      updated_at: m.updatedAt || m.updated_at || new Date().toISOString(),
    })));
    if (error) console.error('FAIL vi_manuals:', error.message); else console.log('OK vi_manuals: ' + vm.length);
  }

  console.log('\n=== Done ===');
}

run().catch(console.error);

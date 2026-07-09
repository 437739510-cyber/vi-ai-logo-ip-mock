// Supabase 数据迁移脚本 �?将本�?Mock JSON 数据导入 Supabase
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// 读取 .env.local
const envPath = path.join(root, ".env.local");
const env = readFileSync(envPath, "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.+)`, "m"));
  return m ? m[1].trim() : "";
}

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = getEnv("SUPABASE_SERVICE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("请在 .env.local 中配�?Supabase 环境变量");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function loadJson(filePath) {
  try {
    const data = readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function migrate() {
  console.log("开始迁�?Mock 数据�?Supabase...\n");

  // 1. 迁移 submissions
  const subs = await loadJson(path.join(root, "public/mock/submissions.json"));
  if (subs && subs.length > 0) {
    const mapped = subs.map(s => ({
      id: s.id,
      client_name: s.clientName || "",
      company_name: s.companyName || "",
      phone: s.phone || "",
      wechat: s.wechat || "",
      email: s.email || "",
      industry: s.industry || "",
      budget_range: s.budgetRange || "",
      description: s.description || "",
      logo_assets: s.logoAssets || [],
      mascot_assets: s.mascotAssets || [],
      reference_manual: s.referenceManual || null,
      submitted_at: s.submittedAt || new Date().toISOString(),
    }));
    const { error } = await supabase.from("submissions").upsert(mapped);
    if (error) console.error("submissions 失败:", error.message);
    else console.log(`\u2705 submissions: ${mapped.length} 条`);
  }

  // 2. 迁移 projects
  const projects = await loadJson(path.join(root, "public/mock/projects.json"));
  if (projects && projects.length > 0) {
    const mapped = projects.map(p => ({
      id: p.id,
      submission_id: p.submissionId || null,
      status: p.status || "submitted",
      assigned_to: p.assignedTo || null,
      brand_colors: p.brandColors || null,
      client_info: p.clientInfo || null,
      created_at: p.createdAt || new Date().toISOString(),
      updated_at: p.updatedAt || new Date().toISOString(),
      timeline: p.timeline || [],
    }));
    const { error } = await supabase.from("projects").upsert(mapped);
    if (error) console.error("projects 失败:", error.message);
    else console.log(`\u2705 projects: ${mapped.length} 条`);
  }

  // 3. 迁移 ai_plans
  const plansMock = await loadJson(path.join(root, "src/lib/mock/ai-plans.json"));
  const plansRuntime = await loadJson(path.join(root, "public/mock/ai-plans-runtime.json"));
  const allPlans = [...(plansMock || []), ...(plansRuntime || [])];
  const seen = new Set();
  const uniquePlans = allPlans.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  if (uniquePlans.length > 0) {
    const mapped = uniquePlans.map(p => ({
      id: p.id,
      project_id: p.projectId || p.project_id || "",
      name: p.name || "未命名方�?,
      style: p.style || "",
      description: p.description || "",
      colors: p.colors || [],
      typography: p.typography || [],
      preview_url: p.previewUrl || p.preview_url || "",
      mockup_urls: p.mockupUrls || p.mockup_urls || [],
      is_favorite: p.isFavorite || p.is_favorite || false,
    }));
    const { error } = await supabase.from("ai_plans").upsert(mapped);
    if (error) console.error("ai_plans 失败:", error.message);
    else console.log(`\u2705 ai_plans: ${mapped.length} 条`);
  }

  // 4. 迁移 favorites
  const faves = await loadJson(path.join(root, "public/mock/favorites.json"));
  if (faves && faves.length > 0) {
    const mapped = faves.map(f => ({
      id: f.id,
      plan_id: f.planId || f.plan_id || "",
      project_id: f.projectId || f.project_id || "",
      note: f.note || "",
      created_at: f.createdAt || f.created_at || new Date().toISOString(),
    }));
    const { error } = await supabase.from("favorites").upsert(mapped);
    if (error) console.error("favorites 失败:", error.message);
    else console.log(`\u2705 favorites: ${mapped.length} 条`);
  }

  // 5. 迁移 employees
  const emps = await loadJson(path.join(root, "public/mock/employees.json"));
  if (emps && emps.length > 0) {
    const mapped = emps.map(e => ({
      id: e.id || e.employeeId || ''
      name: e.name || "",
      role: e.role || "",
      email: e.email || "",
      phone: e.phone || "",
      avatar: e.avatar || "",
      is_active: e.isActive !== undefined ? e.isActive : true,
    }));
    const { error } = await supabase.from("employees").upsert(mapped);
    if (error) console.error("employees 失败:", error.message);
    else console.log(`\u2705 employees: ${mapped.length} 条`);
  }

  // 6. 迁移 manual_pages
  const manualDir = path.join(root, "public/mock");
  if (existsSync(manualDir)) {
    const files = readdirSync(manualDir).filter(f => f.startsWith("manual-pages-") && f.endsWith(".json"));
    for (const file of files) {
      const data = await loadJson(path.join(manualDir, file));
      if (data && data.pages) {
        const projectId = data.projectId;
        const mapped = data.pages.map(p => ({
          id: `${projectId}-${p.pageId}`,
          project_id: projectId,
          page_id: p.pageId,
          label: p.label,
          url: p.url,
          file_size: 0,
        }));
        const { error } = await supabase.from("manual_pages").upsert(mapped);
        if (error) console.error(`manual_pages (${file}) 失败:`, error.message);
        else console.log(`\u2705 manual_pages (${file}): ${mapped.length} 条`);
      }
    }
  }

  // 7. 迁移 VI manuals
  const manualsMock = await loadJson(path.join(root, "src/lib/mock/vi-manuals.json"));
  const manualsRuntime = await loadJson(path.join(root, "public/mock/vi-manuals-runtime.json"));
  const allManuals = [...(manualsMock || []), ...(manualsRuntime || [])];
  if (allManuals.length > 0) {
    const mapped = allManuals.map(m => ({
      id: m.id,
      project_id: m.projectId || m.project_id || "",
      plan_id: m.planId || m.plan_id || null,
      status: m.status || "draft",
      pages: m.pages || [],
      generated_at: m.generatedAt || m.generated_at || new Date().toISOString(),
      updated_at: m.updatedAt || m.updated_at || new Date().toISOString(),
    }));
    const { error } = await supabase.from("vi_manuals").upsert(mapped);
    if (error) console.error("vi_manuals 失败:", error.message);
    else console.log(`\u2705 vi_manuals: ${mapped.length} 条`);
  }

  console.log("\n迁移完成�?);
}

migrate().catch(console.error);

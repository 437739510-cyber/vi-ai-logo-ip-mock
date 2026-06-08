// Supabase 数据服务层 — 所有数据库操作统一入口
import { supabaseAdmin } from "./supabase";

// ====== Submissions ======
export async function getSubmissions() {
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSubmission(id: string) {
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

// ====== Projects ======
export async function getProjects() {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProject(id: string) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function updateProject(id: string, updates: Record<string, any>) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string) {
  const { error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

// ====== AI Plans ======
export async function getPlans(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("ai_plans")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function savePlans(plans: any[]) {
  const { error } = await supabaseAdmin
    .from("ai_plans")
    .upsert(plans);
  if (error) throw error;
  return true;
}

// ====== Favorites ======
export async function getFavorites() {
  const { data, error } = await supabaseAdmin
    .from("favorites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function toggleFavorite(planId: string, projectId: string, isFav: boolean) {
  if (isFav) {
    // 添加收藏
    const { error } = await supabaseAdmin
      .from("favorites")
      .insert({ id: `${planId}-fav`, plan_id: planId, project_id: projectId });
    if (error) throw error;
  } else {
    // 取消收藏
    const { error } = await supabaseAdmin
      .from("favorites")
      .delete()
      .eq("plan_id", planId);
    if (error) throw error;
  }
  return true;
}

// ====== VI Manuals ======
export async function getManuals(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("vi_manuals")
    .select("*")
    .eq("project_id", projectId)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveManual(manual: any) {
  const { error } = await supabaseAdmin
    .from("vi_manuals")
    .upsert(manual);
  if (error) throw error;
  return true;
}

// ====== Manual Pages ======
export async function getManualPages(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("manual_pages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveManualPage(page: any) {
  const { error } = await supabaseAdmin
    .from("manual_pages")
    .upsert(page);
  if (error) throw error;
  return true;
}

// ====== Employees ======
export async function getEmployees() {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

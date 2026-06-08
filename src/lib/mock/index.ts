// @ts-nocheck
// Mock 数据加载层
// 通过 NEXT_PUBLIC_USE_MOCK 环境变量切换 Mock / 真实 API
// true = 读取本地 JSON, false = 后续替换为 fetch 调用

import type {
  Submission,
  Project,
  Industry,
  ProjectStatus,
  AiGenerationPlan,
  ViManual,
  Favorite,
  Employee,
  ProjectFilters,
} from "@/types";

import { supabase } from "@/lib/supabase";


// ========== 内存存储（提交的数据暂存在这里，管理端可读取）==========
const inMemorySubmissions: Submission[] = [];
const inMemoryProjects: Project[] = [];
let submissionCounter = 0;
// ========== 导入语句（仅在 Mock 模式下加载） ==========
async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`加载数据失败: ${path}`);
  return res.json();
}

// ========== 客户提交 ==========

export async function getSubmissions(): Promise<Submission[]> {
  const staticList = await loadJson<Submission[]>("/mock/submissions.json");
  return [...inMemorySubmissions, ...staticList];
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  // 先从 Supabase 查询
  try {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data && !error) {
      return mapSubmissionFromDb(data);
    }
  } catch (e) {
    console.warn("[mock] Supabase query failed for submission:", id, e);
  }
  // Fallback to mock JSON
  const list = await getSubmissions();
  return list.find((s) => s.id === id) ?? null;
}

// ========== 项目 ==========

export async function getProjects(filters?: ProjectFilters): Promise<Project[]> {
  let list = [...inMemoryProjects];
  // 加载 static JSON 中的项目
  const staticList = await loadJson<Project[]>("/mock/projects.json");
  // 去重：如果内存中已有相同 ID 的项目，以内存为准
  const staticFiltered = staticList.filter((sp: Project) => !inMemoryProjects.some((ip: Project) => ip.id === sp.id));
  list = [...list, ...staticFiltered];

  // 从 Supabase 查询项目（解决admin列表不显示新项目的问题）
  try {
    const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (data && !error) {
      const sbProjects = data.map(mapProjectFromDb);
      // 去重：Supabase数据优先
      const existingIds = new Set(list.map(p => p.id));
      for (const sp of sbProjects) {
        if (existingIds.has(sp.id)) {
          // 替换已有项（Supabase数据更新）
          const idx = list.findIndex(p => p.id === sp.id);
          if (idx >= 0) list[idx] = sp;
        } else {
          list.push(sp);
        }
      }
    }
  } catch (e) {
    console.warn("[mock] Supabase projects query failed:", e);
  }

  if (filters) {
    if (filters.status !== "all") {
      list = list.filter((p) => p.status === filters.status);
    }
    if (filters.search) {
      const kw = filters.search.toLowerCase();
      list = list.filter((p) => p.id.toLowerCase().includes(kw) || (p.clientName || "").toLowerCase().includes(kw));
    }
  }
  // 按更新时间倒序
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return list;
}

export async function getProjectById(id: string): Promise<Project | null> {
  // 先从 Supabase 查询
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data && !error) {
      // 转换 snake_case → camelCase
      return mapProjectFromDb(data);
    }
  } catch (e) {
    console.warn("[mock] Supabase query failed for project:", id, e);
  }
  // Fallback to mock JSON
  const list = await getProjects();
  return list.find((p) => p.id === id) ?? null;
}

// ========== AI 方案 ==========

export async function getPlansByProject(projectId: string): Promise<AiGenerationPlan[]> {
  const list = await loadJson<AiGenerationPlan[]>("/mock/ai-plans.json");
  // Also load runtime-generated plans
  let runtime: AiGenerationPlan[] = [];
  try {
    const res = await fetch("/mock/ai-plans-runtime.json");
    if (res.ok) runtime = await res.json();
  } catch {}
  const merged = [...list, ...runtime];
  return merged.filter((p) => p.projectId === projectId);
}

// ========== VI 手册 ==========

export async function getManualByProject(projectId: string): Promise<ViManual | null> {
  const list = await loadJson<ViManual[]>("/mock/vi-manuals.json");
  // Also load runtime-generated manuals
  let runtime: ViManual[] = [];
  try {
    const res = await fetch("/mock/vi-manuals-runtime.json");
    if (res.ok) runtime = await res.json();
  } catch {}
  const merged = [...runtime, ...list];
  return merged.find((m) => m.projectId === projectId) ?? null;
}

// ========== 收藏 ==========

export async function getFavorites(): Promise<Favorite[]> {
  return loadJson<Favorite[]>("/mock/favorites.json");
}

export async function toggleFavorite(planId: string): Promise<boolean> {
  // Mock: 模拟切换收藏状态
  console.log(`[Mock] toggleFavorite: ${planId}`);
  return true;
}

// ========== 员工 ==========

export async function getEmployees(): Promise<Employee[]> {
  return loadJson<Employee[]>("/mock/employees.json");
}

// ========== 咨询提交 ==========

export async function submitConsultation(data: Record<string, unknown>): Promise<{ success: boolean; projectId: string }> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const projectId = `VI-${dateStr}-${rand}`;
  console.log("[Mock] submitConsultation:", data);
  return { success: true, projectId };
}


// ========== Supabase → TypeScript 类型映射 ==========

function mapProjectFromDb(row: Record<string, unknown>): Project {
  const createdAt = (row.created_at as string) || new Date().toISOString();
  return {
    id: row.id as string,
    submissionId: (row.submission_id as string) || "",
    status: (row.status as ProjectStatus) || "submitted",
    assignedTo: null,
    createdAt,
    updatedAt: (row.updated_at as string) || createdAt,
    timeline: Array.isArray(row.timeline) ? row.timeline as TimelineEntry[] : [
      { status: (row.status as ProjectStatus) || "submitted", timestamp: createdAt },
    ],
    brandColors: (row.brand_colors as string) || undefined,
    name: (row.company_name as string) || undefined,
    industry: (row.industry as string) || undefined,
    logoUrl: (row.logo_url as string) || undefined,
    description: (row.description as string) || undefined,
    clientName: (row.client_name as string) || undefined,
    studentName: (row.student_name as string) || undefined,
    studentId: (row.student_id as string) || undefined,
  } as Project;
}

function mapSubmissionFromDb(row: Record<string, unknown>): Submission {
  return {
    id: row.id as string,
    clientName: (row.contact_name as string) || (row.client_name as string) || "",
    companyName: (row.company_name as string) || "",
    phone: (row.phone as string) || "",
    email: (row.email as string) || undefined,
    wechat: (row.wechat as string) || undefined,
    industry: (row.industry as Industry) || "其他",
    budgetRange: (row.budget_range as BudgetRange) || undefined,
    description: (row.description as string) || undefined,
    brandVision: (row.brand_vision as string) || "",
    coreValues: (row.core_values as string) || "",
    targetMarket: (row.target_market as string) || "",
    logoPhilosophy: (row.logo_philosophy as string) || undefined,
    mascotPhilosophy: (row.mascot_philosophy as string) || undefined,
    brandColors: row.existing_brand_color || row.brand_colors || undefined,
    logoAssets: Array.isArray(row.logo_assets) ? row.logo_assets : [],
    mascotAssets: Array.isArray(row.mascot_assets) ? row.mascot_assets : [],
    status: (row.status as SubmissionStatus) || "submitted",
    submittedAt: (row.created_at as string) || new Date().toISOString(),
  };
}

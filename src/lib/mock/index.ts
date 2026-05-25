// Mock 数据加载层
// 通过 NEXT_PUBLIC_USE_MOCK 环境变量切换 Mock / 真实 API
// true = 读取本地 JSON, false = 后续替换为 fetch 调用

import type {
  Submission,
  Project,
  AiGenerationPlan,
  ViManual,
  Favorite,
  Employee,
  ProjectFilters,
} from "@/types";


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
  if (filters) {
    if (filters.status !== "all") {
      list = list.filter((p) => p.status === filters.status);
    }
    if (filters.search) {
      const kw = filters.search.toLowerCase();
      list = list.filter((p) => p.id.toLowerCase().includes(kw));
    }
  }
  // 按更新时间倒序
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return list;
}

export async function getProjectById(id: string): Promise<Project | null> {
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

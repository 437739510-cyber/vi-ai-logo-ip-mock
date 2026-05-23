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

// ========== 导入语句（仅在 Mock 模式下加载） ==========
async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`加载数据失败: ${path}`);
  return res.json();
}

// ========== 客户提交 ==========

export async function getSubmissions(): Promise<Submission[]> {
  return loadJson<Submission[]>("/mock/submissions.json");
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const list = await getSubmissions();
  return list.find((s) => s.id === id) ?? null;
}

// ========== 项目 ==========

export async function getProjects(filters?: ProjectFilters): Promise<Project[]> {
  let list = await loadJson<Project[]>("/mock/projects.json");
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
  return list.filter((p) => p.projectId === projectId);
}

// ========== VI 手册 ==========

export async function getManualByProject(projectId: string): Promise<ViManual | null> {
  const list = await loadJson<ViManual[]>("/mock/vi-manuals.json");
  return list.find((m) => m.projectId === projectId) ?? null;
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
  // Mock: 模拟提交成功
  console.log("[Mock] submitConsultation:", data);
  return {
    success: true,
    projectId: `VI-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  };
}

// ========== 辅助函数 ==========

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    submitted: "已提交",
    contacted: "已联系",
    confirmed: "需求已确认",
    ai_analysis: "AI 分析中",
    designing: "设计制作中",
    reviewing: "审核中",
    delivered: "已交付",
    closed: "已关闭",
  };
  return labels[status] ?? status;
}

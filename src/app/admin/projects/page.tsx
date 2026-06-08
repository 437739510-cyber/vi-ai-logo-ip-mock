"use client";

import { useEffect, useState } from "react";
import { ProjectFiltersBar } from "@/components/admin/ProjectFilters";
import { ProjectTable } from "@/components/admin/ProjectTable";
import { getProjects } from "@/lib/mock";
import type { Project, ProjectFilters } from "@/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProjectFilters>({
    status: "all",
    search: "",
  });

  useEffect(() => {
    setLoading(true);
    getProjects(filters).then((list) => {
      setProjects(list);
      setLoading(false);
    });
  }, [filters]);

  const handleDelete = async (projectId: string) => {
    if (!window.confirm("确定要删除此项目吗？此操作不可撤销。")) return;
    setDeletingId(projectId);
    try {
      const res = await fetch("/api/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        alert("删除失败: " + (data.error || "未知错误"));
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">项目列表</h2>

      <ProjectFiltersBar filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <ProjectTable projects={projects} onDelete={handleDelete} deletingId={deletingId} />
        </div>
      )}
    </div>
  );
}

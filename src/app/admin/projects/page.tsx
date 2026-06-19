"use client";

import { useEffect, useState, useCallback } from "react";
import { ProjectFiltersBar } from "@/components/admin/ProjectFilters";
import { ProjectTable } from "@/components/admin/ProjectTable";
import { getProjects } from "@/lib/core/mock";
import type { Project, ProjectFilters } from "@/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  // 选择相关
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map(p => p.id)));
    }
  }, [selectedIds.size, projects]);

  const allSelected = projects.length > 0 && selectedIds.size === projects.length;

  // 删除逻辑
  const handleDelete = async (projectId: string) => {
    // 批量删除
    if (projectId === "batch") {
      if (selectedIds.size === 0) return;
      if (!window.confirm(`确定要删除 ${selectedIds.size} 个项目吗？此操作不可撤销。`)) return;
      setBatchDeleting(true);
      try {
        const res = await fetch("/api/batch-delete-projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: Array.from(selectedIds) }),
        });
        const data = await res.json();
        if (data.success) {
          setProjects(prev => prev.filter(p => !selectedIds.has(p.id)));
          setSelectedIds(new Set());
          if (data.errors && data.errors.length > 0) {
            alert(`删除完成，成功 ${data.deleted} 个，失败 ${data.errors.length} 个`);
          }
        } else {
          alert("批量删除失败: " + (data.error || "未知错误"));
        }
      } catch {
        alert("网络错误，请重试");
      } finally {
        setBatchDeleting(false);
      }
      return;
    }

    // 单个删除
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
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setSelectedIds(prev => { const next = new Set(prev); next.delete(projectId); return next; });
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
          <ProjectTable 
            projects={projects} 
            onDelete={handleDelete} 
            deletingId={deletingId}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            allSelected={allSelected}
            batchDeleting={batchDeleting}
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { getProjects } from "@/lib/core/mock";
import type { Project } from "@/types";
import { getQueueClientName, normalizeQueueView, type QueueViewKey } from "@/lib/core/project-queue";
import { QueueViewTabs } from "./components/QueueViewTabs";
import { QueueTable } from "./components/QueueTable";
import { QueuePagination } from "./components/QueuePagination";
import { SoftDeleteDialog } from "./components/SoftDeleteDialog";

interface DeleteTarget {
  mode: "single" | "batch";
  projectIds: string[];
  project?: Project;
}

export default function ProjectsQueuePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<QueueViewKey>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentUser, setCurrentUser] = useState<{ name?: string; role?: string; userId?: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  // R35 工作台下钻：/admin/projects?view=<key>（awaiting_payment / review / overdue / failed）
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("view");
    if (raw) setView(normalizeQueueView(raw));
  }, []);

  // 当前管理员/学生身份（用于「我的待办」归属过滤）
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) {
          setCurrentUser({ name: data.name || "", role: data.role || "", userId: data.userId || "" });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getProjects(
        {
          view,
          search: search.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        { currentUser }
      );
      setProjects(list);
      setPage(1);
    } catch {
      setError("加载项目列表失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [view, search, dateFrom, dateTo, currentUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = projects.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = projects.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allSelected = pageRows.length > 0 && pageRows.every((p) => selectedIds.has(p.id));

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === pageRows.length && pageRows.length > 0 ? new Set() : new Set(pageRows.map((p) => p.id))
    );
  };

  const handleViewChange = (next: QueueViewKey) => {
    setView(next);
    setSelectedIds(new Set());
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const endpoint =
        deleteTarget.mode === "batch" ? "/api/batch-delete-projects" : "/api/delete-project";
      const body =
        deleteTarget.mode === "batch"
          ? { projectIds: deleteTarget.projectIds }
          : { projectId: deleteTarget.projectIds[0] };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds(new Set());
        setDeleteTarget(null);
        await load();
      } else {
        alert("删除失败: " + (data.error || "未知错误"));
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">项目列表 · 交付队列</h2>
        <p className="mt-1 text-sm text-neutral-500">搜索 / 视图 / 分页 / 软删除；删除后可在「已归档」中查看</p>
      </div>

      <QueueViewTabs view={view} onChange={handleViewChange} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索客户名 / 手机号后四位 / 行业 / 套餐 / 负责人 / 学生 / 项目编号"
            className="w-full pl-9 pr-8 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          创建日期
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span>至</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="text-xs text-neutral-500 underline hover:text-neutral-700"
          >
            清除日期
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 underline">
            重试
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <QueueTable
            projects={pageRows}
            view={view}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            allSelected={allSelected}
            onSoftDelete={(project) => setDeleteTarget({ mode: "single", projectIds: [project.id], project })}
            onBatchSoftDelete={() => setDeleteTarget({ mode: "batch", projectIds: Array.from(selectedIds) })}
            batchDeleting={deleting}
          />
          <QueuePagination
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}

      <SoftDeleteDialog
        isOpen={deleteTarget !== null}
        mode={deleteTarget?.mode ?? "single"}
        projectId={deleteTarget?.mode === "single" ? deleteTarget.projectIds[0] : undefined}
        clientLabel={deleteTarget?.mode === "single" && deleteTarget.project ? getQueueClientName(deleteTarget.project) : undefined}
        count={deleteTarget?.mode === "batch" ? deleteTarget.projectIds.length : undefined}
        deleting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}

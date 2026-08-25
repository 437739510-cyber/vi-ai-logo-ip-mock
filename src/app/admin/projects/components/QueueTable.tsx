"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { Archive, Download, FileText, FolderKanban, Loader2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/core/utils";
import type { Project } from "@/types";
import {
  evaluateDeliverableDownload,
  getBusinessStatusInfo,
  getWorkbenchClientInfo,
} from "@/lib/core/project-workbench";
import {
  getQueueClientName,
  getQueueIndustry,
  getQueueOwner,
  getQueuePlan,
  isProjectOverdue,
  queueWaitLabel,
  type QueueViewKey,
} from "@/lib/core/project-queue";

interface QueueTableProps {
  projects: Project[];
  view: QueueViewKey;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  onSoftDelete: (project: Project) => void;
  onBatchSoftDelete: () => void;
  batchDeleting?: boolean;
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "-";
  return new Date(ts).toLocaleDateString("zh-CN");
}

export function QueueTable({
  projects,
  view,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  allSelected,
  onSoftDelete,
  onBatchSoftDelete,
  batchDeleting = false,
}: QueueTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const archived = view === "archived";
  const selectedCount = selectedIds.size;
  const canSelect = !archived;

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={
          archived ? (
            <Archive className="w-12 h-12 text-neutral-300" />
          ) : (
            <FolderKanban className="w-12 h-12 text-neutral-300" />
          )
        }
        title={archived ? "暂无已归档项目" : "暂无项目"}
        description={archived ? "软删除的项目会出现在这里" : "当前筛选条件下没有找到项目"}
      />
    );
  }

  return (
    <div>
      {canSelect && selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-red-50 border border-red-100 rounded-lg">
          <span className="text-sm text-red-700 font-medium">已选择 {selectedCount} 个项目</span>
          <button type="button" onClick={onToggleAll} className="text-xs text-neutral-500 hover:text-neutral-700 underline">
            {allSelected ? "取消全选" : "全选"}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onBatchSoftDelete}
            disabled={batchDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {batchDeleting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />删除中…
              </>
            ) : (
              "批量软删除"
            )}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {canSelect && (
                <th className="py-3 px-2 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">项目编号</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">客户</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">套餐</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">负责人/学生</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">运营状态</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">等待/逾期</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">创建时间</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">VI 手册</th>
              <th className="text-center py-3 px-2 text-neutral-500 font-medium">下载</th>
              <th className="text-right py-3 px-2 text-neutral-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const biz = getBusinessStatusInfo(project);
              const downloadDecision = evaluateDeliverableDownload(project);
              const ci = getWorkbenchClientInfo(project);
              const gs = ci.generationStatus || "";
              const pptx = ci.pptxResult;
              const done = (gs === "completed" || project.status === "completed") && !!pptx;
              const generating = ["brand_analyzing", "logo_generating", "scene_rendering", "pptx_assembling", "designing"].includes(gs);
              const owner = getQueueOwner(project);
              const overdue = !archived && isProjectOverdue(project);
              const waitLabel = queueWaitLabel(view, project);
              const menuOpen = openMenuId === project.id;
              return (
                <tr
                  key={project.id}
                  className={cn(
                    "border-b border-neutral-50 hover:bg-neutral-50 transition-colors",
                    selectedIds.has(project.id) ? "bg-blue-50/50" : ""
                  )}
                >
                  {canSelect && (
                    <td className="py-3 px-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(project.id)}
                        onChange={() => onToggleSelect(project.id)}
                        className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="py-3 px-2">
                    <Link href={`/admin/projects/${project.id}`} className="font-mono text-xs text-primary hover:underline">
                      {project.id}
                    </Link>
                  </td>
                  <td className="py-3 px-2">
                    <div className="text-neutral-800 font-medium">
                      {getQueueClientName(project) || <span className="text-neutral-300">-</span>}
                    </div>
                    <div className="text-xs text-neutral-400">{getQueueIndustry(project) || "-"}</div>
                  </td>
                  <td className="py-3 px-2 text-neutral-600">
                    {getQueuePlan(project) || <span className="text-neutral-300">-</span>}
                  </td>
                  <td className="py-3 px-2 text-neutral-600">
                    {owner || <span className="text-neutral-300">未分配</span>}
                  </td>
                  <td className="py-3 px-2">
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        biz.color
                      )}
                    >
                      {biz.label}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-500">{waitLabel}</span>
                      {overdue && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-red-600">
                          已逾期
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-neutral-400 text-xs">
                    {formatDate(project.createdAt || project.updatedAt)}
                  </td>
                  <td className="py-3 px-2">
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <FileText className="w-3 h-3" />已生成
                      </span>
                    ) : generating ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                        <Loader2 className="w-3 h-3 animate-spin" />生成中
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                        <FileText className="w-3 h-3" />未生成
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {done && (pptx?.storageUrl || pptx?.url) ? (
                      downloadDecision.allowed ? (
                        <a
                          href={pptx?.storageUrl || pptx?.url}
                          download
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Download className="w-3 h-3" />下载
                        </a>
                      ) : (
                        <span
                          title={downloadDecision.reason}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed"
                        >
                          已锁定
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-neutral-300">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="relative inline-flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(menuOpen ? null : project.id)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                        title="更多操作"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {menuOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-neutral-100 bg-white shadow-lg py-1">
                          <Link
                            href={`/admin/projects/${project.id}`}
                            className="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                          >
                            查看详情
                          </Link>
                          {!archived && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onSoftDelete(project);
                              }}
                              className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              软删除
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

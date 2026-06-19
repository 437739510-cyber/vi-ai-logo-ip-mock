"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { FolderKanban, Trash2, Download, Loader2, FileText } from "lucide-react";
import type { Project } from "@/types";

interface ProjectTableProps {
  projects: Project[];
  onDelete?: (projectId: string) => void;
  deletingId?: string | null;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  batchDeleting?: boolean;
}

function formatDate(project: Project): string {
  const raw = (project as any).createdAt || (project as any).created_at;
  if (!raw) return "-";
  const ts = new Date(raw).getTime();
  if (isNaN(ts)) return "-";
  return new Date(ts).toLocaleDateString("zh-CN");
}

export function ProjectTable({ 
  projects, onDelete, deletingId,
  selectedIds, onToggleSelect, onToggleAll, allSelected, batchDeleting
}: ProjectTableProps) {
  const hasSelection = selectedIds && onToggleSelect;
  const selectedCount = selectedIds?.size || 0;

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderKanban className="w-12 h-12 text-neutral-300" />}
        title="暂无项目"
        description="当前筛选条件下没有找到项目"
      />
    );
  }

  return (
    <div>
      {/* 批量操作栏 */}
      {hasSelection && selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-red-50 border border-red-100 rounded-lg">
          <span className="text-sm text-red-700 font-medium">
            已选择 {selectedCount} 个项目
          </span>
          <button
            onClick={onToggleAll}
            className="text-xs text-neutral-500 hover:text-neutral-700 underline"
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onDelete && onDelete("batch")}
            disabled={batchDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {batchDeleting ? (
              <><Loader2 className="w-3 h-3 animate-spin" />删除中...</>
            ) : (
              <><Trash2 className="w-3 h-3" />批量删除</>
            )}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {hasSelection && (
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
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">状态</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">推荐学生</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">创建时间</th>
              <th className="text-left py-3 px-2 text-neutral-500 font-medium">VI手册</th>
              <th className="text-center py-3 px-2 text-neutral-500 font-medium">下载</th>
              <th className="text-right py-3 px-2 text-neutral-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr
                key={project.id}
                className={`border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${selectedIds?.has(project.id) ? "bg-blue-50/50" : ""}`}
              >
                {hasSelection && (
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
                  <span className="font-mono text-xs text-neutral-900">{project.id}</span>
                </td>
                <td className="py-3 px-2 text-neutral-700 font-medium">
                  {project.clientName || project.name || <span className="text-neutral-300">-</span>}
                </td>
                <td className="py-3 px-2">
                  <StatusBadge status={project.status} />
                </td>
                <td className="py-3 px-2 text-neutral-600">
                  {project.studentName ?? project.assignedTo?.name ?? <span className="text-neutral-300">未分配</span>}
                </td>
                <td className="py-3 px-2 text-neutral-400 text-xs">
                  {formatDate(project)}
                </td>
                {(() => {
                  const ci = project.client_info || {};
                  const gs = ci.generationStatus || "";
                  const pptx = ci.pptxResult;
                  const generating = ["brand_analyzing","logo_generating","scene_rendering","pptx_assembling"].includes(gs);
                  const done = (gs === "completed" || project.status === "completed") && pptx;
                  return (<>
                    <td className="py-3 px-2">
                      {done ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><FileText className="w-3 h-3" />已生成</span>
                        : generating ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"><Loader2 className="w-3 h-3 animate-spin" />生成中</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-neutral-400"><FileText className="w-3 h-3" />未生成</span>}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {done && (pptx.storageUrl || pptx.url) ? (
                        <a href={pptx.storageUrl || pptx.url} download className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                          <Download className="w-3 h-3" />下载
                        </a>
                      ) : <span className="text-xs text-neutral-300">-</span>}
                    </td>
                  </>);
                })()}
                <td className="py-3 px-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/projects/${project.id}`}
                      className="text-primary hover:underline text-xs font-medium"
                    >
                      查看详情
                    </Link>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(project.id)}
                        disabled={deletingId === project.id}
                        className="text-danger hover:text-red-700 disabled:opacity-40 p-1 rounded hover:bg-danger/5 transition-colors"
                        title="删除此项目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { FolderKanban, Trash2 } from "lucide-react";
import type { Project } from "@/types";

interface ProjectTableProps {
  projects: Project[];
  onDelete?: (projectId: string) => void;
  deletingId?: string | null;
}

function formatDate(project: Project): string {
  const raw = (project as any).createdAt || (project as any).created_at;
  if (!raw) return "-";
  const ts = new Date(raw).getTime();
  if (isNaN(ts)) return "-";
  return new Date(ts).toLocaleDateString("zh-CN");
}

export function ProjectTable({ projects, onDelete, deletingId }: ProjectTableProps) {
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100">
            <th className="text-left py-3 px-2 text-neutral-500 font-medium">项目编号</th>
            <th className="text-left py-3 px-2 text-neutral-500 font-medium">客户</th>
            <th className="text-left py-3 px-2 text-neutral-500 font-medium">状态</th>
            <th className="text-left py-3 px-2 text-neutral-500 font-medium">推荐学生</th>
            <th className="text-left py-3 px-2 text-neutral-500 font-medium">创建时间</th>
            <th className="text-right py-3 px-2 text-neutral-500 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors"
            >
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
  );
}

"use client";

import { useState } from "react";
import { Search, FileQuestion, Eye } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { getProjectById } from "@/lib/mock";
import type { Project, ProjectStatus } from "@/types";

const STATUS_STEPS: { key: ProjectStatus; label: string }[] = [
  { key: "submitted", label: "已提交" },
  { key: "confirmed", label: "需求确认中" },
  { key: "ai_analysis", label: "AI 分析中" },
  { key: "designing", label: "设计制作中" },
  { key: "reviewing", label: "审核中" },
  { key: "delivered", label: "已交付" },
];

function getCurrentStep(status: ProjectStatus): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

export default function ProgressPage() {
  const [projectId, setProjectId] = useState("");
  const [phone, setPhone] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!projectId.trim() || !phone.trim()) return;
    setSearched(true);
    const result = await getProjectById(projectId.trim());
    setProject(result);
    // 在真实场景中此处应验证手机号匹配
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-neutral-900">查询项目进度</h1>
        <p className="mt-3 text-neutral-500">输入项目编号和手机号查询当前进度</p>
      </div>

      {/* 查询输入 */}
      <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="项目编号（如 VI-20260523-0001）"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSearch}
            disabled={!projectId.trim() || !phone.trim()}
            className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            查询
          </button>
        </div>
      </div>

      {/* 查询结果 */}
      {searched && !project && (
        <EmptyState
          icon={<FileQuestion className="w-12 h-12 text-neutral-300" />}
          title="未找到匹配的项目"
          description="请检查项目编号和手机号是否正确"
        />
      )}

      {project && (
        <div className="bg-white border border-neutral-100 rounded-2xl p-6 md:p-8 shadow-sm">
          {/* 项目信息 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-neutral-400 mb-1">项目编号</p>
              <p className="font-mono font-medium">{project.id}</p>
            </div>
            <StatusBadge status={project.status} />
          </div>

          {/* 进度时间线 */}
          <div className="relative">
            {STATUS_STEPS.map((step, index) => {
              const currentStep = getCurrentStep(project.status);
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;
              return (
                <div key={step.key} className="flex items-start gap-4 pb-6 last:pb-0">
                  {/* 节点 */}
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                        isCompleted
                          ? "bg-primary border-primary"
                          : "bg-white border-neutral-300"
                      } ${isCurrent ? "ring-2 ring-primary/30" : ""}`}
                    />
                    {index < STATUS_STEPS.length - 1 && (
                      <div
                        className={`w-0.5 h-full mt-1 ${
                          isCompleted ? "bg-primary" : "bg-neutral-200"
                        }`}
                      />
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="pt-0.5">
                    <p
                      className={`text-sm font-medium ${
                        isCompleted ? "text-neutral-900" : "text-neutral-400"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-primary mt-0.5">当前进度</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 查看Logo入口 */}
          {project && (
            <div className="mb-6">
              <Link
                href="/view"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors"
              >
                <Eye className="w-4 h-4" />
                查看Logo方案
              </Link>
              <p className="text-xs text-neutral-400 mt-1">需要项目编号和查看密码</p>
            </div>
          )}

          {/* 项目时间线详情 */}
          {project.timeline.length > 0 && (
            <div className="mt-6 pt-6 border-t border-neutral-100">
              <h4 className="text-sm font-medium text-neutral-700 mb-3">更新时间线</h4>
              <div className="space-y-2">
                {project.timeline
                  .sort(
                    (a, b) =>
                      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  )
                  .map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">
                        {STATUS_STEPS.find((s) => s.key === entry.status)?.label ?? entry.status}
                      </span>
                      <span className="text-neutral-400 text-xs">
                        {new Date(entry.timestamp).toLocaleString("zh-CN")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

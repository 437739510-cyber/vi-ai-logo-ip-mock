"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/admin/StatCard";
import { RecentActivityList } from "@/components/admin/RecentActivityList";
import { getProjects } from "@/lib/mock";
import { FolderKanban, Clock, CheckCircle, AlertCircle } from "lucide-react";
import type { Project } from "@/types";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects().then((list) => {
      setProjects(list);
      setLoading(false);
    });
  }, []);

  const pendingCount = projects.filter((p) => p.status === "submitted").length;
  const inProgressCount = projects.filter(
    (p) => p.status === "ai_analysis" || p.status === "designing"
  ).length;
  const deliveredCount = projects.filter((p) => p.status === "delivered").length;
  const totalCount = projects.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary uppercase tracking-wider">概览</p>
          <h2 className="text-2xl font-bold text-neutral-900">工作台</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-neutral-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary uppercase tracking-wider">概览</p>
          <h2 className="text-2xl font-bold text-neutral-900">工作台</h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 rounded-lg">
          <span className="text-sm font-medium text-neutral-500">共 {totalCount} 个项目</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="待处理" value={pendingCount} description="新提交未分配" icon={<AlertCircle className="w-5 h-5" />} />
        <StatCard title="进行中" value={inProgressCount} description="AI 分析 / 设计中" icon={<Clock className="w-5 h-5" />} />
        <StatCard title="已交付" value={deliveredCount} icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard title="项目总数" value={totalCount} icon={<FolderKanban className="w-5 h-5" />} />
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-neutral-900">最近动态</h3>
          <span className="text-xs text-neutral-400">实时</span>
        </div>
        <RecentActivityList />
      </div>
    </div>
  );
}

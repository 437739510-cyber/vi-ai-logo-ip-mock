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
        <h2 className="text-xl font-semibold text-neutral-900">工作台</h2>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">工作台</h2>
        <p className="text-sm text-neutral-400">
          共 {totalCount} 个项目
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="待处理"
          value={pendingCount}
          description="新提交未分配"
          icon={<AlertCircle className="w-5 h-5" />}
        />
        <StatCard
          title="进行中"
          value={inProgressCount}
          description="AI 分析 / 设计中"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="本月已交付"
          value={deliveredCount}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <StatCard
          title="项目总数"
          value={totalCount}
          icon={<FolderKanban className="w-5 h-5" />}
        />
      </div>

      {/* 最近动态 */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4">最近动态</h3>
        <RecentActivityList />
      </div>
    </div>
  );
}

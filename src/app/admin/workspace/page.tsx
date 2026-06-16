"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ExternalLink, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface ClientProject {
  id: string;
  brand_name: string;
  industry: string;
  status: string;
  plan: string;
  created_at: string;
  student_confirmed: boolean;
}

export default function WorkspacePage() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/me").then((r) => r.json()).then((d) => {
      if (!d.success || d.role !== "student") {
        window.location.href = "/admin/login";
        return;
      }
    });
    // 复用项目列表API，后续可加student_id过滤
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeCount = projects.filter((p) => p.status === "completed" || p.status === "generating").length;
  const pendingCount = projects.filter((p) => p.status === "pending").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">我的客户</h1>
            <p className="text-xs text-neutral-500">管理你服务的品牌项目</p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-neutral-900">{projects.length}</div>
          <div className="text-xs text-neutral-500 mt-1">总客户</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-xs text-neutral-500 mt-1">活跃项目</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          <div className="text-xs text-neutral-500 mt-1">待处理</div>
        </div>
      </div>

      {/* 客户列表 */}
      <div className="space-y-3">
        {projects.length === 0 && (
          <div className="text-center py-16">
            <Briefcase className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">暂无客户项目</p>
            <p className="text-neutral-400 text-xs mt-1">快去跑街找客户吧！</p>
          </div>
        )}
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-neutral-900">{project.brand_name || "未命名品牌"}</h3>
                <p className="text-xs text-neutral-400">{project.industry || "未设置行业"}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                project.status === "completed" ? "bg-green-50 text-green-600" :
                project.status === "generating" ? "bg-blue-50 text-blue-600" :
                "bg-yellow-50 text-yellow-600"
              }`}>
                {project.status === "completed" ? "已完成" :
                 project.status === "generating" ? "进行中" : "待处理"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href={`/admin/projects/${project.id}`}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                查看项目
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

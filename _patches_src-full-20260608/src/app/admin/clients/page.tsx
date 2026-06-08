"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSubmissions, getProjects } from "@/lib/mock";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, Phone, Building2 } from "lucide-react";
import type { Submission, Project } from "@/types";

export default function ClientsPage() {
  const [clients, setClients] = useState<
    (Submission & { project?: Project })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [submissions, projects] = await Promise.all([
        getSubmissions(),
        getProjects(),
      ]);
      const merged = submissions.map((s) => ({
        ...s,
        project: projects.find((p) => p.submissionId === s.id),
      }));
      setClients(merged);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-12 h-12 text-neutral-300" />}
        title="暂无客户"
        description="有新客户提交需求后会显示在这里"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">客户管理</h2>
        <p className="text-sm text-neutral-400">共 {clients.length} 个客户</p>
      </div>

      <div className="space-y-3">
        {clients.map((client) => (
          <div
            key={client.id}
            className="bg-white rounded-xl border border-neutral-100 p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">
                  {client.companyName}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {client.clientName} · {client.industry}
                </p>
              </div>
              {client.project && (
                <Link
                  href={`/admin/projects/${client.project.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  查看项目
                </Link>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {client.phone}
              </span>
              {client.wechat && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> 微信：{client.wechat}
                </span>
              )}
              {client.budgetRange && (
                <span>预算：{client.budgetRange}</span>
              )}
              <span className="text-neutral-400">
                提交于 {new Date(client.submittedAt).toLocaleDateString("zh-CN")}
              </span>
            </div>

            {client.description && (
              <p className="mt-2 text-xs text-neutral-500 line-clamp-2">
                {client.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

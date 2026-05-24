"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AssetPreview } from "@/components/admin/AssetPreview";
import { ErrorState } from "@/components/shared/ErrorState";
import { getProjectById, getSubmissionById, getPlansByProject } from "@/lib/mock";
import type { Project, Submission, AiGenerationPlan } from "@/types";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [plans, setPlans] = useState<AiGenerationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { id } = await params;
        const p = await getProjectById(id);
        if (!p) {
          setLoading(false);
          return;
        }
        setProject(p);

        const [sub, planList] = await Promise.all([
          getSubmissionById(p.submissionId),
          getPlansByProject(p.id),
        ]);
        setSubmission(sub);
        setPlans(planList);
      } catch {
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-neutral-200 rounded w-48" />
        <div className="h-48 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;
  if (!project) return notFound();

  return (
    <div className="space-y-6">
      {/* 返回 */}
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回项目列表
      </Link>

      {/* 项目标题 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-semibold text-neutral-900">项目详情</h2>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-neutral-400 font-mono">{project.id}</p>
        </div>
        {project.assignedTo && (
          <p className="text-sm text-neutral-500">
            负责人：{project.assignedTo.name}
          </p>
        )}
      </div>

      {/* 客户信息 */}
      {submission && (
        <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-700">客户信息</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-neutral-400">联系人</p>
              <p className="text-neutral-700">{submission.clientName}</p>
            </div>
            <div>
              <p className="text-neutral-400">公司</p>
              <p className="text-neutral-700">{submission.companyName}</p>
            </div>
            <div>
              <p className="text-neutral-400">手机</p>
              <p className="text-neutral-700">{submission.phone}</p>
            </div>
            <div>
              <p className="text-neutral-400">行业</p>
              <p className="text-neutral-700">{submission.industry}</p>
            </div>
          </div>
          {submission.description && (
            <div>
              <p className="text-sm text-neutral-400 mb-1">需求描述</p>
              <p className="text-sm text-neutral-700">{submission.description}</p>
            </div>
          )}
        </section>
      )}

      {/* 品牌素材 */}
      {submission && (
        <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-700">品牌素材</h3>
          <AssetPreview
            label="LOGO"
            files={submission.logoAssets}
            emptyText="未上传 LOGO"
          />
          {submission.mascotAssets.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-neutral-700 mb-2">
                IP 公仔（{submission.mascotAssets.length} 个）
              </h4>
              <div className="space-y-3">
                {submission.mascotAssets.map((m, i) => (
                  <div key={i} className="p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-neutral-700">{m.name}</span>
                      {m.personality && (
                        <span className="text-xs text-neutral-400">{m.personality}</span>
                      )}
                    </div>
                    <AssetPreview label="" files={m.files} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {submission.referenceManual && (
            <div>
              <h4 className="text-sm font-medium text-neutral-700 mb-2">参考 VI 手册</h4>
              <div className="flex items-center gap-3 px-3 py-2 bg-neutral-50 rounded-lg text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-neutral-700 truncate">{submission.referenceManual.fileName}</p>
                  <p className="text-xs text-neutral-400">
                    {submission.referenceManual.pageCount} 页 · {submission.referenceManual.referenceMode === "weak" ? "弱参考" : submission.referenceManual.referenceMode === "strong" ? "强参考" : "不参考"}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          )}
        </section>
      )}

      {/* AI 方案 */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">AI 生成方案</h3>
          <Link
            href={`/admin/projects/${project.id}/generate`}
            className="text-xs text-primary hover:underline"
          >
            生成新方案
          </Link>
        </div>
        {plans.length === 0 ? (
          <p className="text-sm text-neutral-400">暂未生成方案</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="border border-neutral-100 rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <div className="aspect-[4/3] bg-neutral-100 rounded mb-2 flex items-center justify-center text-xs text-neutral-400">
                  {plan.styleLabel}
                </div>
                <p className="text-sm font-medium text-neutral-700">{plan.styleLabel}</p>
                <p className="text-xs text-neutral-400">
                  {plan.referenceUsed ? "参考了手册" : "未参考"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 时间线 */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4">项目时间线</h3>
        <div className="space-y-3">
          {project.timeline
            .slice()
            .reverse()
            .map((entry, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary/60 shrink-0" />
                <div className="flex-1">
                  <span className="text-neutral-700">
                    {entry.status === "submitted"
                      ? "已提交"
                      : entry.status === "confirmed"
                      ? "需求已确认"
                      : entry.status === "ai_analysis"
                      ? "AI 分析中"
                      : entry.status === "designing"
                      ? "设计制作中"
                      : entry.status === "reviewing"
                      ? "审核中"
                      : "已交付"}
                  </span>
                </div>
                <span className="text-xs text-neutral-400">
                  {new Date(entry.timestamp).toLocaleString("zh-CN")}
                </span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

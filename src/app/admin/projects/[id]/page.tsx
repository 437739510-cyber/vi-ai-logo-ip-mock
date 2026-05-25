"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2, Sparkles, Loader2 } from "lucide-react";
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
  const [deleting, setDeleting] = useState(false);
  const [generatingManual, setGeneratingManual] = useState(false);
  const router = useRouter();

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
        setError("\u52A0\u8F7D\u5931\u8D25");
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

  const handleDelete = async () => {
    if (!project) return;
    if (!window.confirm("\u786E\u5B9A\u8981\u5220\u9664\u6B64\u9879\u76EE\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/admin/projects");
      } else {
        alert("\u5220\u9664\u5931\u8D25: " + (data.error || "\u672A\u77E5\u9519\u8BEF"));
      }
    } catch {
      alert("\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5");
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateManual = async () => {
    if (!project || !submission) return;
    setGeneratingManual(true);
    try {
      // 先尝试分析参考手册（如果有的话）
      let referenceAnalysis = null;
      if (submission.referenceManual) {
        const analysisRes = await fetch("/api/ai/analyze-manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfPath: submission.referenceManual.url }),
        });
        referenceAnalysis = await analysisRes.json();
      }

      // 调用 AI 生成完整手册
      const generateRes = await fetch("/api/ai/generate-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          clientInfo: {
            companyName: submission.companyName,
            industry: submission.industry,
            description: submission.description,
            logoAssets: submission.logoAssets,
            mascotAssets: submission.mascotAssets,
          },
          referenceAnalysis,
        }),
      });
      const manual = await generateRes.json();

      // 保存手册
      await fetch("/api/ai/save-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual }),
      });

      // 跳转到编辑器查看
      router.push(`/admin/editor/${project.id}`);
    } catch {
      alert("\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
    } finally {
      setGeneratingManual(false);
    }
  };

  if (error) return <ErrorState message={error} />;
  if (!project) return notFound();

  return (
    <div className="space-y-6">
      {/* 返回 + 删除 */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回项目列表
        </Link>
        {project && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-danger border border-danger/30 rounded-lg hover:bg-danger/5 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "删除中..." : "删除项目"}
          </button>
        )}
      </div>

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

      {/* AI 生成方案 */}
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
          <p className="text-sm text-neutral-400">尚未生成方案</p>
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

      {/* AI 一键生成完整手册 */}
      <section className="bg-white rounded-xl border border-primary/20 p-6 space-y-4 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-neutral-900">AI 一键生成完整 VI 手册</h3>
        </div>
        <p className="text-xs text-neutral-500 leading-relaxed">
          AI 将根据客户提交的 LOGO、IP 公仔和参考手册，自动生成一套完整的 VI 视觉识别手册，包括品牌色板、字体规范、Logo 变体、辅助图形和应用场景。
        </p>
        <button
          onClick={handleGenerateManual}
          disabled={generatingManual}
          className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {generatingManual ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              AI 正在生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              AI 一键生成完整手册
            </>
          )}
        </button>
      </section>

      {/* 时间线 */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4">项目时间线</h3>
        <div className="space-y-3">
          {project.timeline
            .sort((a: { timestamp: string }, b: { timestamp: string }) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((entry: { status: string; timestamp: string }, i: number) => {
              const statusLabels: Record<string, string> = {
                submitted: "已提交",
                confirmed: "需求确认中",
                ai_analysis: "AI 分析中",
                designing: "设计制作中",
                reviewing: "审核中",
                delivered: "已交付",
              };
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-neutral-600">{statusLabels[entry.status] || entry.status}</span>
                  <span className="text-xs text-neutral-400">
                    {new Date(entry.timestamp).toLocaleString("zh-CN")}
                  </span>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

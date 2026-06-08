"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GenerationPanel } from "@/components/admin/GenerationPanel";
import { ErrorState } from "@/components/shared/ErrorState";
import { getProjectById } from "@/lib/mock";
import type { Project } from "@/types";

export default function GeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [project, setProject] = useState<Project | null>(null);
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
      } catch {
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-neutral-200 rounded w-48" />
        <div className="h-64 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;
  if (!project) return notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/projects/${project.id}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回项目详情
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-neutral-900">AI 方案生成</h2>
        <p className="text-sm text-neutral-400 mt-1 font-mono">{project.id}</p>
      </div>

      <GenerationPanel projectId={project.id} />
    </div>
  );
}

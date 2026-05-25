"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Wand2, ArrowRight } from "lucide-react";
import { ReferenceModeSelector } from "./ReferenceModeSelector";
import { PlanCard } from "./PlanCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { getPlansByProject, toggleFavorite } from "@/lib/mock";
import type { AiGenerationPlan, ReferenceMode } from "@/types";

interface GenerationPanelProps {
  projectId: string;
}

export function GenerationPanel({ projectId }: GenerationPanelProps) {
  const router = useRouter();
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>("weak");
  const [plans, setPlans] = useState<AiGenerationPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Step 1: Call the real AI generation API (uses DeepSeek if key is set, or auto-falls back to mock)
      const res = await fetch("/api/ai/generate-scheme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, referenceMode }),
      });
      const schemes = await res.json();

      if (Array.isArray(schemes) && schemes.length > 0) {
        // Step 2: Map API response to AiGenerationPlan format
        const plansWithId = schemes.map((s: any, i: number) => ({
          id: `PLAN-${Date.now()}-${i}`,
          projectId,
          styleLabel: s.styleLabel || "Style " + (i + 1),
          thumbnailUrl: "",
          previewUrls: { cover: "", colorPage: "", fontPage: "", appPage: "" },
          referenceUsed: referenceMode !== "none",
          referenceMode,
          isFavorited: false,
          generatedAt: new Date().toISOString(),
        }));

        // Step 3: Persist plans via save-plans API
        await fetch("/api/ai/save-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plans: plansWithId }),
        });

        setPlans(plansWithId);
      } else {
        // Fallback: read from mock data
        const fallback = await getPlansByProject(projectId);
        setPlans(fallback);
      }
    } catch {
      const fallback = await getPlansByProject(projectId);
      setPlans(fallback);
    } finally {
      setHasGenerated(true);
      setIsGenerating(false);
    }
  };

  const handleToggleFavorite = async (planId: string) => {
    await toggleFavorite(planId);
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, isFavorited: !p.isFavorited } : p
      )
    );
  };

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-2xl border border-neutral-100 p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Wand2 className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-neutral-900">生成参数</h3>
        </div>
        <ReferenceModeSelector value={referenceMode} onChange={setReferenceMode} />

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="group w-full py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-neutral-900/10"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              AI 正在分析素材并生成方案...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              AI 生成方案
            </>
          )}
        </button>
      </section>

      {isGenerating && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-16 shadow-sm">
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="absolute inset-0 w-10 h-10 rounded-full bg-primary/5 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-700">AI 正在分析您的品牌素材...</p>
              <p className="text-xs text-neutral-400 mt-1">
                正在提取品牌色彩、字体，匹配参考风格
              </p>
            </div>
          </div>
        </div>
      )}

      {hasGenerated && !isGenerating && plans.length === 0 && (
        <EmptyState
          title=""
          description=""
        />
      )}

      {plans.length > 0 && !isGenerating && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-neutral-900">
              生成方案
              <span className="ml-2 text-xs font-medium text-neutral-400">
                ({plans.length} 个方案)
              </span>
            </h3>
            {selectedPlan && (
                <>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-lighter text-primary text-xs font-medium">
                    已选中
                  </span>
                  <button
                    onClick={() => router.push(`/admin/editor/${projectId}`)}
                    className="ml-2 px-3 py-1 text-xs bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-1"
                  >
                    确认并进入编辑器
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id)}
                onToggleFavorite={() => handleToggleFavorite(plan.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

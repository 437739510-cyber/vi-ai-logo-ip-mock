"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { ReferenceModeSelector } from "./ReferenceModeSelector";
import { PlanCard } from "./PlanCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { getPlansByProject, toggleFavorite } from "@/lib/mock";
import type { AiGenerationPlan, ReferenceMode } from "@/types";

interface GenerationPanelProps {
  projectId: string;
}

export function GenerationPanel({ projectId }: GenerationPanelProps) {
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>("weak");
  const [plans, setPlans] = useState<AiGenerationPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    // 模拟 AI 生成延迟
    await new Promise((r) => setTimeout(r, 2500));
    const result = await getPlansByProject(projectId);
    setPlans(result);
    setHasGenerated(true);
    setIsGenerating(false);
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
      {/* 参数配置 */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-700">生成参数</h3>
        <ReferenceModeSelector value={referenceMode} onChange={setReferenceMode} />

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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

      {/* 生成结果 */}
      {isGenerating && (
        <div className="bg-white rounded-xl border border-neutral-100 p-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-700">AI 正在分析素材...</p>
              <p className="text-xs text-neutral-400 mt-1">
                正在提取品牌色、字体特征，匹配参考风格
              </p>
            </div>
          </div>
        </div>
      )}

      {hasGenerated && !isGenerating && plans.length === 0 && (
        <EmptyState
          title="暂无生成方案"
          description="请检查项目是否有关联的 AI 方案数据"
        />
      )}

      {plans.length > 0 && !isGenerating && (
        <>
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-700">
                生成结果（{plans.length} 套方案）
              </h3>
              {selectedPlan && (
                <p className="text-xs text-primary">已选择一套方案</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="relative">
                  <PlanCard
                    plan={plan}
                    isSelected={selectedPlan === plan.id}
                    onSelect={() => setSelectedPlan(plan.id)}
                    onToggleFavorite={() => handleToggleFavorite(plan.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

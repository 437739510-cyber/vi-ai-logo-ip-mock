"use client";

import { useState, useEffect } from "react";
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
  const [industryAnalysis, setIndustryAnalysis] = useState<string | null>(null);
  const [industryAnalysisLoading, setIndustryAnalysisLoading] = useState(false);

  // 组件加载时自动获取行业 AI 分析
  useEffect(() => {
    (async () => {
      setIndustryAnalysisLoading(true);
      try {
        const res = await fetch("/api/ai/analyze-industry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        if (res.ok) {
          const data = await res.json();
          setIndustryAnalysis(data.summary || null);
        }
      } catch {}
      setIndustryAnalysisLoading(false);
    })();
  }, [projectId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Step 1: Call the real AI generation API (uses DeepSeek if key is set, or auto-falls back to mock)
      const res = await fetch("/api/ai/generate-scheme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, referenceMode, industryAnalysis }),
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
          colorPalette: s.colorPalette || undefined,
          fontPairing: s.fontPairing || undefined,
          description: s.description || undefined,
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
        <ReferenceModeSelector value={referenceMode} onChange={setReferenceMode} industryAnalysis={industryAnalysis || undefined} industryAnalysisLoading={industryAnalysisLoading} />
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
                    onClick={async () => {
                      const plan = plans.find((p) => p.id === selectedPlan);
                      if (!plan) { router.push(`/admin/editor/${projectId}`); return; }
                      try {
                        // Build a manual from the selected plan's data
                        const manual = {
                          id: `MANUAL-${projectId}`,
                          projectId,
                          cover: { title: "", subtitle: "", version: "v1.0", date: new Date().toISOString().slice(0, 7), companyName: "" },
                          tableOfContents: [],
                          logoSpecs: {
                            explanation: plan.description || "",
                            conceptKeywords: [],
                            standardCombinations: [],
                            gridSpec: { imageUrl: "", proportions: "", baseUnit: "", description: "" },
                            clearSpace: { rule: "", minimumSizes: [] },
                            logoColors: [
                              { name: "主色", hex: plan.colorPalette?.primary || "#1A73E8", cmyk: "", rgb: "" },
                              { name: "辅助色", hex: plan.colorPalette?.secondary || "#34A853", cmyk: "", rgb: "" },
                              { name: "强调色", hex: plan.colorPalette?.accent || "#FBBC04", cmyk: "", rgb: "" },
                            ],
                            monochromeBlack: null,
                            reversedOut: null,
                            backgroundControl: { allowedBackgrounds: [], prohibitedBackgrounds: [] },
                            incorrectUsages: [],
                          },
                          brandColors: {
                            primary: { name: "主色", hex: plan.colorPalette?.primary || "#1A73E8", cmyk: "", rgb: "" },
                            secondary: { name: "辅助色", hex: plan.colorPalette?.secondary || "#34A853", cmyk: "", rgb: "" },
                            accent: { name: "强调色", hex: plan.colorPalette?.accent || "#FBBC04", cmyk: "", rgb: "" },
                            neutrals: [{ name: "背景", hex: "#F8F9FA" }, { name: "文字", hex: "#202124" }],
                            hierarchy: [{ level: "主色", colors: ["主色"], usage: "" }],
                            matchingRules: plan.description || "",
                          },
                          typography: {
                            chinese: {
                              brandFont: { font: plan.fontPairing?.heading || "Noto Sans SC", weights: [700, 500] },
                              bodyFont: { font: plan.fontPairing?.body || "Noto Sans SC", weights: [400] },
                              sizeHierarchy: [],
                            },
                            english: {
                              brandFont: { font: plan.fontPairing?.heading || "Inter", weights: [700, 600] },
                              bodyFont: { font: plan.fontPairing?.body || "Inter", weights: [400] },
                              sizeHierarchy: [],
                            },
                            principles: [],
                          },
                          auxiliaryGraphics: { concept: "", graphics: [] },
                          applications: { office: [], signage: [], digital: [] },
                        };
                        await fetch("/api/ai/save-manual", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ manual }),
                        });
                      } catch {}
                      router.push(`/admin/editor/${projectId}`);
                    }}
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

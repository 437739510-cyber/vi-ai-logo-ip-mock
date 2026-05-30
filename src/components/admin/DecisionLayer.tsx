"use client";

import { Loader2, Check, X, Sparkles } from "lucide-react";
import type { RecommendedModule } from "@/lib/module-planner";

interface DecisionLayerProps {
  step: 1 | 2 | 3;
  analyzing: boolean;
  brandAnalysis: any;
  selectedModules: RecommendedModule[];
  genPlan: { pages: number; images: number; minutes: number } | null;
  clientInfo: any;
  onRunAnalysis: () => void;
  onToggleModule: (modId: string) => void;
  onAddModule: (mod: RecommendedModule) => void;
  onConfirmModules: () => void;
  onStartGeneration: () => void;
  onGoToStep: (step: 1 | 2 | 3) => void;
}

export function DecisionLayer({
  step,
  analyzing,
  brandAnalysis,
  selectedModules,
  genPlan,
  onRunAnalysis,
  onToggleModule,
  onAddModule,
  onConfirmModules,
  onStartGeneration,
  onGoToStep,
}: DecisionLayerProps) {
  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "品牌分析" },
          { n: 2, label: "推荐模块" },
          { n: 3, label: "确认生成" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all " +
                (step === s.n
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : step > s.n
                  ? "bg-green-500 text-white"
                  : "bg-neutral-100 text-neutral-400")
              }
            >
              {step > s.n ? <Check className="w-4 h-4" /> : s.n}
            </div>
            <span
              className={
                "text-sm font-medium " +
                (step === s.n ? "text-neutral-900" : step > s.n ? "text-green-600" : "text-neutral-400")
              }
            >
              {s.label}
            </span>
            {i < 2 && <div className="w-16 h-0.5 bg-neutral-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Brand Analysis */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">品牌分析</h2>
          <p className="text-sm text-neutral-500 mb-6">
            系统正在分析您的品牌资料，识别品牌类型、行业特征和视觉方向
          </p>

          {!brandAnalysis && !analyzing && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-neutral-500 mb-6">
                点击下方按钮，系统将自动分析品牌资料
              </p>
              <button
                onClick={onRunAnalysis}
                className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
              >
                开始品牌分析
              </button>
            </div>
          )}

          {analyzing && (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm text-neutral-500">正在分析品牌特征...</p>
              <div className="mt-4 w-full max-w-xs mx-auto bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}

          {brandAnalysis && !analyzing && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <ProfileCard label="品牌类型" value={formatBrandType(brandAnalysis.profile.brandType)} />
                <ProfileCard label="品牌定位" value={brandAnalysis.profile.brandPositioning} />
                <ProfileCard label="品牌原型" value={brandAnalysis.profile.brandArchetype} />
                <ProfileCard label="行业分类" value={brandAnalysis.industryProfile.label} />
                <ProfileCard label="视觉方向" value={brandAnalysis.profile.visualDirection} />
                <ProfileCard label="品牌语气" value={brandAnalysis.profile.brandVoice?.join("、") || "—"} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">品牌人格</h3>
                <div className="flex flex-wrap gap-2">
                  {brandAnalysis.profile.brandPersona.map((p: string) => (
                    <span key={p} className="px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">品牌关键词</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    ...(brandAnalysis.profile.analysis?.brandVisionKeywords || []),
                    ...(brandAnalysis.profile.analysis?.coreValueKeywords || []),
                  ]
                    .filter((k: string) => k.length >= 2)
                    .slice(0, 12)
                    .map((kw: string) => (
                      <span key={kw} className="px-2.5 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full">
                        {kw}
                      </span>
                    ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-neutral-100">
                <button
                  onClick={() => onGoToStep(2)}
                  className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all"
                >
                  查看推荐模块 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Module Recommendation */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">推荐模块</h2>
          <p className="text-sm text-neutral-500 mb-6">
            根据品牌分析结果，系统推荐以下手册模块。点击可移除不需要的模块。
          </p>

          <div className="space-y-2 mb-6">
            {selectedModules.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-600"><Check className="w-4 h-4" /></span>
                  <div>
                    <span className="text-sm font-medium text-neutral-900">{mod.label}</span>
                    <span className="text-xs text-neutral-400 ml-2">
                      {mod.estimatedPages}页 · {mod.priority === "essential" ? "核心" : mod.priority === "recommended" ? "推荐" : "可选"}
                    </span>
                    {mod.protectedAssets && mod.protectedAssets.length > 0 && (
                      <span className="text-xs text-amber-600 ml-2">🔒 {mod.protectedAssets.join("、")}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onToggleModule(mod.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="移除该模块"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Removed modules (re-add) */}
          {brandAnalysis?.modulePlan?.modules
            ?.filter((m: RecommendedModule) => !selectedModules.find((s) => s.id === m.id))
            .filter((m: RecommendedModule) => m.id !== "cover" && m.id !== "closing")
            .length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-500 mb-2">已移除（可重新添加）</h3>
              <div className="flex flex-wrap gap-2">
                {brandAnalysis.modulePlan.modules
                  .filter((m: RecommendedModule) => !selectedModules.find((s) => s.id === m.id))
                  .filter((m: RecommendedModule) => m.id !== "cover" && m.id !== "closing")
                  .map((mod: RecommendedModule) => (
                    <button
                      key={mod.id}
                      onClick={() => onAddModule(mod)}
                      className="px-3 py-1.5 border border-dashed border-neutral-300 text-neutral-500 text-xs rounded-full hover:border-primary hover:text-primary transition-all"
                    >
                      + {mod.label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <span className="text-sm text-neutral-500">
              已选 {selectedModules.length} 个模块，预计 {selectedModules.reduce((s, m) => s + m.estimatedPages, 0)} 页
            </span>
            <div className="flex gap-3">
              <button onClick={() => onGoToStep(1)} className="px-4 py-2 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-all">
                返回分析
              </button>
              <button onClick={onConfirmModules} className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20">
                确认模块 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Generation Plan */}
      {step === 3 && genPlan && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">生成计划</h2>
          <p className="text-sm text-neutral-500 mb-6">确认以下信息后，系统将开始生成 VI 手册页面</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-neutral-50 rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-primary">{genPlan.pages}</div>
              <div className="text-sm text-neutral-500 mt-1">预计页数</div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-amber-600">{genPlan.images}</div>
              <div className="text-sm text-neutral-500 mt-1">需调 API</div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-green-600">~{genPlan.minutes}分钟</div>
              <div className="text-sm text-neutral-500 mt-1">预计耗时</div>
            </div>
          </div>

          <div className="bg-neutral-50 rounded-xl p-4 mb-8">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">包含模块</h3>
            <div className="flex flex-wrap gap-2">
              {selectedModules.map((mod) => (
                <span key={mod.id} className="px-2.5 py-1 bg-white border border-neutral-200 text-neutral-700 text-xs rounded-full">
                  {mod.label}
                </span>
              ))}
            </div>
          </div>

          {/* Protected assets notice */}
          {(() => {
            const protectedMods = selectedModules.filter((m) => m.protectedAssets && m.protectedAssets.length > 0);
            if (protectedMods.length > 0) {
              const allAssets = [...new Set(protectedMods.flatMap((m) => m.protectedAssets || []))];
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    🔒 受保护品牌资产：{allAssets.join("、")}
                  </p>
                  <p className="text-xs text-amber-700">
                    Logo 和 IP 公仔属于受保护资产。系统仅进行缩放和排版，不会通过 AI 重绘、改色或重新设计。
                  </p>
                </div>
              );
            }
            return null;
          })()}

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <span className="text-xs text-neutral-400">确认后将开始调用 AI 生成服务，此过程可能需要数分钟</span>
            <div className="flex gap-3">
              <button onClick={() => onGoToStep(2)} className="px-4 py-2 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-all">
                返回修改
              </button>
              <button onClick={onStartGeneration} className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                确认生成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-50 rounded-xl p-4">
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      <div className="text-sm font-semibold text-neutral-900 leading-tight">{value || "—"}</div>
    </div>
  );
}

function formatBrandType(type: string): string {
  const map: Record<string, string> = {
    consumer: "消费品牌",
    technology: "科技品牌",
    hospitality: "餐饮/酒店品牌",
    healthcare: "健康品牌",
    service: "服务品牌",
    retail: "零售品牌",
    education: "教育品牌",
    industrial: "制造品牌",
    cultural: "文化品牌",
  };
  return map[type] || type || "—";
}

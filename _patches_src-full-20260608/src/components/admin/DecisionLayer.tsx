"use client";

import { Loader2, Check, X, Sparkles, Wand2 } from "lucide-react";
import type { RecommendedModule } from "@/lib/module-planner";

interface DecisionLayerProps {
  step: 1 | 2 | 3 | 4 | 5;
  analyzing: boolean;
  brandAnalysis: any;
  selectedModules: RecommendedModule[];
  genPlan: { pages: number; images: number; minutes: number } | null;
  businessProfile?: { businessStage: string; businessGoal: string; budgetLevel: string };
  onBusinessProfileChange?: (profile: any) => void;
  clientInfo: any;
  onRunAnalysis: () => void;
  onToggleModule: (modId: string) => void;
  onAddModule: (mod: RecommendedModule) => void;
  onConfirmModules: () => void;
  onStartGeneration: () => void;
  onGoToStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  mascotPromptSet?: any;
  onAcceptMascot?: () => void;
  onDeclineMascot?: () => void;
  onEnterSandbox?: () => void;
  costEstimate?: { estimatedTotal: number; currentBalance: number; sufficient: boolean; items: { label: string; subtotal: number }[] };
  /** Separate model balances for display */
  modelBalances?: {
    deepseek: number | null;
    dashscope: number | null;
    deepseekError?: string;
    dashscopeError?: string;
  };
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
  businessProfile,
  onBusinessProfileChange,
  mascotPromptSet,
  onAcceptMascot,
  onDeclineMascot,
  onEnterSandbox,
  costEstimate,
  modelBalances,
}: DecisionLayerProps) {
  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "品牌分析" },
          { n: 2, label: "商业信息" },
          { n: 3, label: "IP策略" },
          { n: 4, label: "推荐模块" },
          { n: 5, label: "确认生成" },
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
            {i < 4 && <div className="w-12 h-0.5 bg-neutral-200 mx-1" />}
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
                  填写商业信息 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2 (Business Profile) */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">商业信息</h2>
          <p className="text-sm text-neutral-500 mb-6">
            请补充您的业务信息，系统将结合品牌特征与商业需求推荐最适合的VI套餐
          </p>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 mb-3">业务阶段</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "startup", label: "初创品牌", desc: "刚成立，需要建立基础视觉" },
                  { value: "growth", label: "成长品牌", desc: "已有基础，需要统一规范" },
                  { value: "chain", label: "连锁品牌", desc: "多门店，需要完整体系" },
                  { value: "enterprise", label: "企业级品牌", desc: "成熟企业，需要全面升级" },
                ].map((opt) => (
                  <button key={opt.value}
                    onClick={() => onBusinessProfileChange?.({ ...businessProfile, businessStage: opt.value })}
                    className={"p-4 rounded-xl border-2 text-left transition-all " + (businessProfile?.businessStage === opt.value ? "border-primary bg-primary/5 shadow-sm" : "border-neutral-200 hover:border-neutral-300")}
                  >
                    <div className="font-semibold text-sm text-neutral-900">{opt.label}</div>
                    <div className="text-xs text-neutral-500 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 mb-3">主要目标</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "branding", label: "建立品牌基础", desc: "Logo、颜色、字体等规范" },
                  { value: "packaging", label: "产品包装升级", desc: "包装系统设计与规范" },
                  { value: "franchise", label: "招商加盟", desc: "加盟手册与门店应用" },
                  { value: "marketing", label: "营销推广", desc: "社媒、宣传物料统一" },
                ].map((opt) => (
                  <button key={opt.value}
                    onClick={() => onBusinessProfileChange?.({ ...businessProfile, businessGoal: opt.value })}
                    className={"p-4 rounded-xl border-2 text-left transition-all " + (businessProfile?.businessGoal === opt.value ? "border-primary bg-primary/5 shadow-sm" : "border-neutral-200 hover:border-neutral-300")}
                  >
                    <div className="font-semibold text-sm text-neutral-900">{opt.label}</div>
                    <div className="text-xs text-neutral-500 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 mb-3">预算范围</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "basic", label: "轻量版", desc: "12-18页" },
                  { value: "standard", label: "标准版", desc: "18-30页" },
                  { value: "premium", label: "高级版", desc: "30-50页" },
                ].map((opt) => (
                  <button key={opt.value}
                    onClick={() => onBusinessProfileChange?.({ ...businessProfile, budgetLevel: opt.value })}
                    className={"p-4 rounded-xl border-2 text-center transition-all " + (businessProfile?.budgetLevel === opt.value ? "border-primary bg-primary/5 shadow-sm" : "border-neutral-200 hover:border-neutral-300")}
                  >
                    <div className="font-semibold text-sm text-neutral-900">{opt.label}</div>
                    <div className="text-xs text-neutral-500 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-6 border-t border-neutral-100 mt-6">
            <button onClick={() => onGoToStep(3)}
              disabled={!businessProfile?.businessStage || !businessProfile?.businessGoal || !businessProfile?.budgetLevel}
              className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              查看IP策略 →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: IP Strategy Confirmation */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">IP策略确认</h2>
          <p className="text-sm text-neutral-500 mb-6">
            根据品牌分析和商业信息，系统生成了以下IP策略建议
          </p>

          {!mascotPromptSet && (
            <div className="text-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-neutral-500">正在分析IP策略...</p>
            </div>
          )}

          {mascotPromptSet && (
            <div className="space-y-6">
              {/* IP Status Badge */}
              <div className={"rounded-xl p-4 border " + getMascotBorder(mascotPromptSet.mode)}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={"text-2xl " + getMascotIcon(mascotPromptSet.mode)}>{getMascotEmoji(mascotPromptSet.mode)}</span>
                  <div>
                    <div className="font-bold text-neutral-900">{getMascotStatusTitle(mascotPromptSet.mode)}</div>
                    <div className="text-sm text-neutral-500">{getMascotStatusDesc(mascotPromptSet.mode)}</div>
                  </div>
                </div>
              </div>

              {/* Strategy Prompt */}
              <div className="bg-neutral-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-neutral-700 mb-2">策略说明</h3>
                <p className="text-sm text-neutral-600 whitespace-pre-line leading-relaxed">{mascotPromptSet.strategyPrompt}</p>
              </div>

              {/* Image Prompt (only for create_new) */}
              {mascotPromptSet.imagePrompt && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2">AI生成提示词</h3>
                  <p className="text-xs text-blue-700 font-mono leading-relaxed break-words">{mascotPromptSet.imagePrompt}</p>
                </div>
              )}

              {/* Negative Prompt */}
              {mascotPromptSet.negativePrompt && (
                <div className="bg-red-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-red-700 mb-2">禁止事项</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {mascotPromptSet.negativePrompt.split("; ").filter(Boolean).map((item: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Usage Notes */}
              {mascotPromptSet.usageNotes?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-2">使用建议</h3>
                  <ul className="space-y-1.5">
                    {mascotPromptSet.usageNotes.map((note: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                        <span className="text-primary mt-0.5">•</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Restrictions */}
              {mascotPromptSet.restrictions?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-2">🔒 保护规则</h3>
                  <ul className="space-y-1">
                    {mascotPromptSet.restrictions.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                        <span>•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                <button onClick={() => onGoToStep(2)} className="px-4 py-2 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-all">
                  返回修改商业信息
                </button>
                <div className="flex gap-3">
                  {mascotPromptSet.mode !== "not_needed" && (
                    <button onClick={onDeclineMascot} className="px-4 py-2 border border-neutral-200 text-neutral-500 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-all">
                      暂不使用IP
                    </button>
                  )}
                  <button onClick={onAcceptMascot} className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20">
                    接受IP策略 →
                  </button>
                  {(onEnterSandbox && (mascotPromptSet?.mode === "create_new" || mascotPromptSet?.mode === "protect_existing")) && (
                    <button onClick={onEnterSandbox}
                      className="px-6 py-2.5 border-2 border-primary/30 text-primary font-semibold rounded-xl hover:bg-primary/5 transition-all flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      IP Sandbox
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4 (Module Recommendation) */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">推荐模块</h2>
          <p className="text-sm text-neutral-500 mb-6">
            根据品牌分析结果，系统推荐以下手册模块。点击可移除不需要的模块。
          </p>
          <div className="space-y-2 mb-6">
            {selectedModules.map((mod: any) => (
              <div key={mod.id}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-600"><Check className="w-4 h-4" /></span>
                  <div>
                    <span className="text-sm font-medium text-neutral-900">{mod.label}</span>
                    <span className="text-xs text-neutral-400 ml-2">{mod.estimatedPages}页 · {mod.priority === "essential" ? "核心" : mod.priority === "recommended" ? "推荐" : "可选"}</span>
                    {mod.protectedAssets && mod.protectedAssets.length > 0 && (
                      <span className="text-xs text-amber-600 ml-2">🔀 {mod.protectedAssets.join("、")}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => onToggleModule(mod.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="移除该模块"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          {brandAnalysis?.modulePlan?.modules
            ?.filter((m: any) => !selectedModules.find((s: any) => s.id === m.id))
            ?.filter((m: any) => m.id !== "cover" && m.id !== "closing")
            ?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-500 mb-2">已移除（可重新添加）</h3>
              <div className="flex flex-wrap gap-2">
                {brandAnalysis.modulePlan.modules
                  .filter((m: any) => !selectedModules.find((s: any) => s.id === m.id))
                  .filter((m: any) => m.id !== "cover" && m.id !== "closing")
                  .map((mod: any) => (
                    <button key={mod.id} onClick={() => onAddModule(mod)}
                      className="px-3 py-1.5 border border-dashed border-neutral-300 text-neutral-500 text-xs rounded-full hover:border-primary hover:text-primary transition-all">
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
              <button onClick={() => onGoToStep(3)} className="px-4 py-2 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-all">返回</button>
              <button onClick={onConfirmModules} className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20">确认模块 →</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5 (Generation Plan) */}
      {step === 5 && genPlan && (
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

          {costEstimate && (
            <div className="bg-neutral-50 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3">费用预估</h3>
              <div className="space-y-2 mb-3">
                {costEstimate.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-neutral-600">{item.label}</span>
                    <span className="font-medium text-neutral-900">¥{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 border-t border-neutral-200 font-semibold">
                  <span className="text-neutral-700">合计</span>
                  <span className="text-primary">¥{costEstimate.estimatedTotal.toFixed(2)}</span>
                </div>
              </div>
              <div className="py-2 px-3 rounded-lg bg-white border border-neutral-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-500">模型账户余额</span>
                </div>
                {modelBalances && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">DeepSeek</span>
                      <span className="font-medium text-green-600">
                        {modelBalances.deepseek !== null
                          ? "¥" + modelBalances.deepseek.toFixed(2)
                          : (modelBalances.deepseekError || "读取失败")}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">通义万相</span>
                      <span className="font-medium text-green-600">
                        {modelBalances.dashscope !== null
                          ? "¥" + modelBalances.dashscope.toFixed(2)
                          : (modelBalances.dashscopeError || "读取失败")}
                      </span>
                    </div>
                  </div>
                )}
                {!modelBalances && (
                  <div className="text-sm">
                    <span className={`font-bold ${costEstimate.sufficient ? 'text-green-600' : 'text-red-500'}`}>
                      ¥{costEstimate.currentBalance.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-neutral-50 rounded-xl p-4 mb-8">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">包含模块</h3>
            <div className="flex flex-wrap gap-2">
              {selectedModules.map((mod: any) => (
                <span key={mod.id} className="px-2.5 py-1 bg-white border border-neutral-200 text-neutral-700 text-xs rounded-full">
                  {mod.label}
                </span>
              ))}
            </div>
          </div>

          {/* Protected assets notice */}
          {(() => {
            const protectedMods = selectedModules.filter((m: any) => m.protectedAssets && m.protectedAssets.length > 0);
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
              <button onClick={() => onGoToStep(4)} className="px-4 py-2 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-all">
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

function getMascotBorder(mode: string): string {
  switch (mode) {
    case "protect_existing": return "border-green-200 bg-green-50";
    case "create_new": return "border-blue-200 bg-blue-50";
    case "optional_recommend": return "border-yellow-200 bg-yellow-50";
    default: return "border-neutral-200 bg-neutral-50";
  }
}

function getMascotEmoji(mode: string): string {
  switch (mode) {
    case "protect_existing": return "🛡️";
    case "create_new": return "✨";
    case "optional_recommend": return "💡";
    default: return "➖";
  }
}

function getMascotIcon(_mode: string): string {
  return "";
}

function getMascotStatusTitle(mode: string): string {
  switch (mode) {
    case "protect_existing": return "保护已有IP形象";
    case "create_new": return "建议创建品牌IP公仔";
    case "optional_recommend": return "可考虑创建轻量IP";
    default: return "不建议创建IP公仔";
  }
}

function getMascotStatusDesc(mode: string): string {
  switch (mode) {
    case "protect_existing": return "系统将保护已有IP形象，禁止AI重绘，仅进行规范化应用";
    case "create_new": return "系统强烈建议创建品牌IP公仔，已生成完整IP策略和生成提示词";
    case "optional_recommend": return "IP公仔非必需，但可作为品牌升级的增值选项";
    default: return "当前品牌类型和行业不适合创建IP公仔，建议优先完善基础VI规范";
  }
}

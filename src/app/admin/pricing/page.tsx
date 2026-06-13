"use client";

import { useEffect, useState } from "react";
import { Settings, Save, RotateCcw, CheckCircle, AlertCircle } from "lucide-react";

interface PlanConfig {
  price: string;
  name: string;
  period: string;
  desc: string;
  enabled: boolean;
}

type PricingConfig = Record<string, PlanConfig>;

const DEFAULT_PRICING: PricingConfig = {
  basic: { price: "99", name: "基础版", period: "一次性", desc: "Logo方案+VI手册", enabled: true },
  standard: { price: "499", name: "标准版", period: "一次性", desc: "品牌故事+Logo+IP+完整VI", enabled: true },
  manager: { price: "299", name: "品牌管家", period: "/月", desc: "每月12条品牌化内容", enabled: true },
};

const PLAN_LABELS: Record<string, string> = {
  basic: "基础版",
  standard: "标准版",
  manager: "品牌管家",
};

const PLAN_COLORS: Record<string, string> = {
  basic: "bg-blue-50 border-blue-200",
  standard: "bg-primary/5 border-primary/30",
  manager: "bg-green-50 border-green-200",
};

export default function PricingPage() {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/config/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (d.pricing) setPricing({ ...DEFAULT_PRICING, ...d.pricing });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/config/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", "定价已保存，首页即时生效");
      } else {
        showToast("error", data.error || "保存失败");
      }
    } catch {
      showToast("error", "网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPricing(DEFAULT_PRICING);
  };

  const updatePlan = (key: string, field: keyof PlanConfig, value: string | boolean) => {
    setPricing((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
        }`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">定价管理</h1>
            <p className="text-xs text-neutral-500">调整后首页与付款页即时生效</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            恢复默认
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="space-y-4">
        {Object.entries(pricing).map(([key, plan]) => (
          <div
            key={key}
            className={`rounded-2xl border p-5 ${PLAN_COLORS[key] || "bg-white border-neutral-200"} ${
              !plan.enabled ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-neutral-900">
                  {PLAN_LABELS[key] || key}
                </h3>
                <span className="text-xs px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded-full font-mono">
                  {key}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-neutral-500">{plan.enabled ? "已启用" : "已禁用"}</span>
                <div
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    plan.enabled ? "bg-primary" : "bg-neutral-300"
                  }`}
                  onClick={() => updatePlan(key, "enabled", !plan.enabled)}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      plan.enabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">价格（元）</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">¥</span>
                  <input
                    type="text"
                    value={plan.price}
                    onChange={(e) => updatePlan(key, "price", e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">名称</label>
                <input
                  type="text"
                  value={plan.name}
                  onChange={(e) => updatePlan(key, "name", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">周期</label>
                <input
                  type="text"
                  value={plan.period}
                  onChange={(e) => updatePlan(key, "period", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  placeholder="一次性 / /月"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">描述</label>
                <input
                  type="text"
                  value={plan.desc}
                  onChange={(e) => updatePlan(key, "desc", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-neutral-900">¥{plan.price}</span>
              <span className="text-sm text-neutral-500">{plan.period}</span>
              <span className="text-sm text-neutral-400 ml-2">· {plan.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
          <strong>注意：</strong>价格修改后首页定价卡片和付款页立即生效，无需重新部署。禁用的套餐不会在首页显示。
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Settings, Save, RotateCcw, CheckCircle, AlertCircle, Palette, Users } from "lucide-react";

interface PlanConfig {
  price: string;
  name: string;
  period: string;
  desc: string;
  enabled: boolean;
}

interface LogoPricingConfig {
  standalone: { price: string; name: string; desc: string; enabled: boolean };
  upgrade_basic: { price: string; name: string; desc: string; enabled: boolean };
  upgrade_standard: { price: string; name: string; desc: string; enabled: boolean };
}

interface CommissionConfig {
  base: number;
  silver: number;
  gold: number;
  upgradeOrders: {
    silver: number;
    gold: number;
  };
}

type PricingConfig = Record<string, PlanConfig>;

const DEFAULT_PRICING: PricingConfig = {
  basic: { price: "49", name: "基础版", period: "一次性", desc: "品牌基建，适合新店起步", enabled: true },
  standard: { price: "99", name: "标准版", period: "一次性", desc: "全套打包，含 IP 公仔，适合老店焕新", enabled: true },
  manager: { price: "299", name: "品牌管家", period: "/月", desc: "持续运营，拍照我们搞定", enabled: true },
};

const DEFAULT_LOGO_PRICING: LogoPricingConfig = {
  standalone: { price: "9.9", name: "Logo单独购买", desc: "仅Logo方案，不含VI手册", enabled: true },
  upgrade_basic: { price: "400", name: "基础版补差价", desc: "从基础版升级到标准版", enabled: true },
  upgrade_standard: { price: "0", name: "标准版补差价", desc: "已有标准版，无需补差", enabled: true },
};

const DEFAULT_COMMISSION: CommissionConfig = {
  base: 30,
  silver: 40,
  gold: 50,
  upgradeOrders: { silver: 20, gold: 50 },
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

const LOGO_COLORS: Record<string, string> = {
  standalone: "bg-purple-50 border-purple-200",
  upgrade_basic: "bg-amber-50 border-amber-200",
  upgrade_standard: "bg-teal-50 border-teal-200",
};

const LOGO_LABELS: Record<string, string> = {
  standalone: "Logo单独购买",
  upgrade_basic: "基础版补差价",
  upgrade_standard: "标准版补差价",
};

export default function PricingPage() {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [logoPricing, setLogoPricing] = useState<LogoPricingConfig>(DEFAULT_LOGO_PRICING);
  const [commission, setCommission] = useState<CommissionConfig>(DEFAULT_COMMISSION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/config/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (d.pricing) setPricing({ ...DEFAULT_PRICING, ...d.pricing });
        if (d.logoPricing) setLogoPricing({ ...DEFAULT_LOGO_PRICING, ...d.logoPricing });
        if (d.commission) setCommission({ ...DEFAULT_COMMISSION, ...d.commission, upgradeOrders: { ...DEFAULT_COMMISSION.upgradeOrders, ...d.commission.upgradeOrders } });
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
        body: JSON.stringify({ pricing, logoPricing, commission }),
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
    setLogoPricing(DEFAULT_LOGO_PRICING);
    setCommission(DEFAULT_COMMISSION);
  };

  const updatePlan = (key: string, field: keyof PlanConfig, value: string | boolean) => {
    setPricing((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const updateLogoPricing = (key: keyof LogoPricingConfig, field: string, value: string | boolean) => {
    setLogoPricing((prev) => ({
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

      {/* VI套餐定价 */}
      <div>
        <h2 className="text-sm font-bold text-neutral-700 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-primary rounded-full" />
          VI 套餐定价
        </h2>
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
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-neutral-900">¥{plan.price}</span>
                <span className="text-sm text-neutral-500">{plan.period}</span>
                <span className="text-sm text-neutral-400 ml-2">· {plan.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logo定价 */}
      <div>
        <h2 className="text-sm font-bold text-neutral-700 mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-purple-500" />
          Logo 定价
        </h2>
        <div className="space-y-4">
          {(Object.entries(logoPricing) as [keyof LogoPricingConfig, { price: string; name: string; desc: string; enabled: boolean }][]).map(([key, item]) => (
            <div
              key={key}
              className={`rounded-2xl border p-5 ${LOGO_COLORS[key] || "bg-white border-neutral-200"} ${
                !item.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {LOGO_LABELS[key] || key}
                  </h3>
                  <span className="text-xs px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded-full font-mono">
                    {key}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-neutral-500">{item.enabled ? "已启用" : "已禁用"}</span>
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      item.enabled ? "bg-primary" : "bg-neutral-300"
                    }`}
                    onClick={() => updateLogoPricing(key, "enabled", !item.enabled)}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        item.enabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">价格（元）</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">¥</span>
                    <input
                      type="text"
                      value={item.price}
                      onChange={(e) => updateLogoPricing(key, "price", e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">名称</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateLogoPricing(key, "name", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">描述</label>
                  <input
                    type="text"
                    value={item.desc}
                    onChange={(e) => updateLogoPricing(key, "desc", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-neutral-900">¥{item.price}</span>
                <span className="text-sm text-neutral-400 ml-2">· {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 合伙人分成方案 */}
      <div>
        <h2 className="text-sm font-bold text-neutral-700 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-500" />
          合伙人分成方案
        </h2>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">新手合伙人（%）</label>
              <input
                type="number"
                value={commission.base}
                onChange={(e) => setCommission(prev => ({ ...prev, base: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">银级合伙人（%）</label>
              <input
                type="number"
                value={commission.silver}
                onChange={(e) => setCommission(prev => ({ ...prev, silver: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">金级合伙人（%）</label>
              <input
                type="number"
                value={commission.gold}
                onChange={(e) => setCommission(prev => ({ ...prev, gold: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">晋升银级（单数）</label>
              <input
                type="number"
                value={commission.upgradeOrders.silver}
                onChange={(e) => setCommission(prev => ({ ...prev, upgradeOrders: { ...prev.upgradeOrders, silver: Number(e.target.value) } }))}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">晋升金级（单数）</label>
              <input
                type="number"
                value={commission.upgradeOrders.gold}
                onChange={(e) => setCommission(prev => ({ ...prev, upgradeOrders: { ...prev.upgradeOrders, gold: Number(e.target.value) } }))}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-100">
            <p className="text-xs text-neutral-500 mb-2">当前方案预览</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 bg-neutral-100 rounded text-neutral-700">新手 {commission.base}%</span>
              <span className="text-neutral-300">→</span>
              <span className="px-2 py-1 bg-blue-50 rounded text-blue-700">银级 {commission.silver}%（{commission.upgradeOrders.silver}单起）</span>
              <span className="text-neutral-300">→</span>
              <span className="px-2 py-1 bg-amber-50 rounded text-amber-700">金级 {commission.gold}%（{commission.upgradeOrders.gold}单起）</span>
            </div>
          </div>
        </div>
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

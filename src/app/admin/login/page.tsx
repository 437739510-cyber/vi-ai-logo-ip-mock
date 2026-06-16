"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Loader2, Eye, EyeOff, ArrowLeft, GraduationCap } from "lucide-react";
import Link from "next/link";

function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/admin/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        // 根据角色跳转
        if (data.role === "student") {
          window.location.replace("/admin/workspace");
        } else {
          window.location.replace(redirectUrl);
        }
      } else {
        setError(data.error || "登录失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-600 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>

        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-neutral-900/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-neutral-700" />
            </div>
            <h1 className="text-xl font-bold text-neutral-900">管理后台</h1>
            <p className="text-sm text-neutral-400 mt-1">管理员 / 合伙人登录</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                inputMode="text"
                autoComplete="current-password"
                className="w-full px-4 py-2.5 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 transition-all"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-neutral-900 text-white font-medium rounded-xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "验证中..." : "进入后台"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-neutral-100">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>大学生合伙人请使用专属密码登录</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}

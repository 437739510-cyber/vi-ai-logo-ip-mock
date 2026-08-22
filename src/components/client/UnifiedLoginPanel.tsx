"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  GraduationCap,
  Store,
  ArrowLeft,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Modal } from "@/components/shared/Modal";

type PanelStep = "phone" | "student" | "member" | "none";

interface UnifiedLoginPanelProps {
  open: boolean;
  onClose: () => void;
}

// TICKET-122-R25：首页统一登录面板。
// 第一步只输手机号，由 /api/auth/identity 按表归属自动分流：
// student_accounts → 大学生密码登录（复用 /api/admin/login）；
// members → 商家/会员密码登录（复用 /api/member/login）；
// 都不在 → 提示商家注册/会员开通与大学生申请入口。
export function UnifiedLoginPanel({ open, onClose }: UnifiedLoginPanelProps) {
  const [step, setStep] = useState<PanelStep>("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setStep("phone");
    setPassword("");
    setError("");
    onClose();
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.match(/^1[3-9]\d{9}$/)) {
      setError("请输入正确的手机号");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "身份识别失败，请稍后重试");
        return;
      }
      if (data.identity === "student") setStep("student");
      else if (data.identity === "member") setStep("member");
      else setStep("none");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/member/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, mode: "password" }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/member/dashboard";
      } else {
        setError(data.error || "登录失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/admin/dashboard";
      } else {
        setError(data.error || "登录失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const backToPhone = () => {
    setStep("phone");
    setPassword("");
    setError("");
  };

  return (
    <Modal isOpen={open} onClose={handleClose} size="sm">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900">统一登录</h2>
        <p className="text-xs text-neutral-400 mt-1">输入手机号，自动识别登录身份</p>
      </div>

      {step === "phone" && (
        <form onSubmit={handleLookup} className="space-y-4">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              maxLength={11}
              autoFocus
            />
          </div>
          {error && (
            <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg text-center">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "识别中..." : "继续"}
          </button>
        </form>
      )}

      {step === "student" && (
        <form onSubmit={handleStudentLogin} className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg">
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">大学生 / 合伙人登录</span>
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="tel"
              value={phone}
              readOnly
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-neutral-50 text-neutral-500 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type={showPw ? "text" : "password"}
              placeholder="请输入登录密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
            <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg text-center">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "登录中..." : "登录工作台"}
          </button>
          <button
            type="button"
            onClick={backToPhone}
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            更换手机号
          </button>
        </form>
      )}

      {step === "member" && (
        <form onSubmit={handleMemberLogin} className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg">
            <Store className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">商家 / 会员登录</span>
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="tel"
              value={phone}
              readOnly
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-neutral-50 text-neutral-500 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type={showPw ? "text" : "password"}
              placeholder="请输入登录密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
            <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg text-center">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "登录中..." : "登录会员中心"}
          </button>
          <button
            type="button"
            onClick={backToPhone}
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            更换手机号
          </button>
        </form>
      )}

      {step === "none" && (
        <div className="space-y-3">
          <div className="px-3 py-2.5 bg-amber-50 text-amber-700 rounded-lg text-center">
            <p className="text-sm font-medium">该手机号尚未开通账号</p>
            <p className="text-xs text-amber-600 mt-0.5">请选择身份完成注册 / 申请</p>
          </div>
          <Link
            href="/member/login"
            onClick={handleClose}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-primary/5 text-primary rounded-xl text-sm font-medium hover:bg-primary/10 transition-colors"
          >
            <Store className="w-4 h-4" />
            我是商家 · 注册会员开通
          </Link>
          <Link
            href="/student/register"
            onClick={handleClose}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            我是大学生 · 申请兼职合伙人
          </Link>
          <button
            type="button"
            onClick={backToPhone}
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            更换手机号
          </button>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-neutral-100 text-center">
        <Link
          href="/admin/login"
          onClick={handleClose}
          className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          管理员入口 →
        </Link>
      </div>
    </Modal>
  );
}

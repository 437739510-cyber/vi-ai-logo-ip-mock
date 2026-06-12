"use client";

import { useState } from "react";
import { Phone, Lock, Loader2, Eye, EyeOff, MessageSquare } from "lucide-react";

type LoginMode = "otp" | "password";

export default function MemberLoginPage() {
  const [mode, setMode] = useState<LoginMode>("otp");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleSendOtp = async () => {
    if (!phone.match(/^1[3-9]\d{9}$/)) {
      setError("请输入正确的手机号");
      return;
    }
    setSendingOtp(true);
    setError("");
    try {
      const res = await fetch("/api/member/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
      } else {
        setError(data.error || "发送失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const body =
        mode === "otp"
          ? { phone, otp, mode: "otp" as const }
          : { phone, password, mode: "password" as const };

      const res = await fetch("/api/member/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-neutral-900">品牌管家</h1>
            <p className="text-sm text-neutral-400 mt-1">拍照上传，我们帮你发内容</p>
          </div>

          <div className="flex mb-6 bg-neutral-100 rounded-xl p-1">
            <button
              onClick={() => { setMode("otp"); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "otp" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              }`}
            >
              验证码登录
            </button>
            <button
              onClick={() => { setMode("password"); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "password" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              }`}
            >
              密码登录
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="tel"
                  placeholder="手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  maxLength={11}
                  autoFocus
                />
              </div>
            </div>

            {mode === "otp" && (
              <div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="验证码"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      maxLength={6}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || !phone.match(/^1[3-9]\d{9}$/)}
                    className="shrink-0 px-4 py-2.5 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {sendingOtp ? "发送中..." : otpSent ? "重新发送" : "获取验证码"}
                  </button>
                </div>
                {otpSent && (
                  <p className="text-xs text-green-600 mt-1.5">验证码已发送，开发期间输入任意6位数字即可</p>
                )}
              </div>
            )}

            {mode === "password" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {error && (
              <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          <p className="text-xs text-neutral-400 text-center mt-6">
            注册即享2条免费体验 · 开通会员¥299/月
          </p>
        </div>

        <p className="text-xs text-neutral-400 text-center mt-4">
          © 2026 Brand Brain 品牌管家
        </p>
      </div>
    </div>
  );
}

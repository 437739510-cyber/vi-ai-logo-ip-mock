"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, QrCode, Phone, Key } from "lucide-react";

function PaymentContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const viewPassword = searchParams.get("viewPassword") ?? "";
  const phone = searchParams.get("phone") ?? "";

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      {/* 成功提示 */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <CheckCircle className="w-14 h-14 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">提交成功！</h1>
        <p className="text-neutral-500">您的 VI 设计需求已收到</p>
      </div>

      {/* 付款卡片 */}
      <div className="bg-white border-2 border-primary/20 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold text-neutral-900 mb-1">完成付款，开始设计</h2>
          <p className="text-sm text-neutral-500">扫码支付后，我们将立即为您生成Logo方案</p>
        </div>

        {/* 收款码区域 */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-56 h-56 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col items-center justify-center p-4">
            {/* 收款码占位 — 替换为真实收款码图片即可 */}
            <QrCode className="w-20 h-20 text-neutral-300 mb-2" />
            <p className="text-xs text-neutral-400">微信扫码支付</p>
            <p className="text-[10px] text-neutral-300 mt-1">收款码待上传</p>
          </div>
        </div>

        {/* 金额 */}
        <div className="text-center mb-4">
          <span className="text-3xl font-bold text-primary">¥99</span>
          <span className="text-sm text-neutral-500 ml-1">基础版 · Logo方案+VI手册</span>
        </div>

        {/* 付款说明 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          <p className="font-medium text-amber-800 mb-2">💰 付款说明</p>
          <ul className="space-y-1.5 text-amber-700">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>微信扫码支付 <strong>¥99</strong>，备注您的手机号</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>确认收款后 <strong>3个工作日内</strong> 出Logo方案</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>方案完成后可在线查看并选择</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 查看凭证 */}
      <div className="bg-neutral-50 rounded-xl p-5 mb-6">
        <p className="text-sm font-medium text-neutral-700 mb-3">📱 付款后如何查看方案？</p>
        <div className="space-y-3">
          {phone && (
            <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-neutral-100">
              <Phone className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">手机号</p>
                <p className="font-mono font-medium text-neutral-900">{phone}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-neutral-100">
            <Key className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-neutral-400">查看密码</p>
              <p className="font-mono font-bold text-lg tracking-widest text-amber-600">{viewPassword}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          请保存以上信息，方案完成后用手机号+查看密码登录查看
        </p>
      </div>

      {/* 项目编号（折叠显示） */}
      {projectId && (
        <div className="text-center mb-6">
          <p className="text-xs text-neutral-400">项目编号：{projectId}</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-col gap-3">
        <Link
          href="/view"
          className="w-full py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors text-center"
        >
          查看Logo方案
        </Link>
        <Link
          href="/"
          className="w-full py-2.5 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors text-center"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="animate-pulse">
          <div className="w-14 h-14 bg-neutral-200 rounded-full mx-auto mb-6" />
          <div className="h-8 bg-neutral-200 rounded w-48 mx-auto mb-4" />
          <div className="h-4 bg-neutral-200 rounded w-64 mx-auto" />
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "VI-XXXXXXXX";
  const viewPassword = searchParams.get("viewPassword") ?? "";

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="flex justify-center mb-6">
        <CheckCircle className="w-16 h-16 text-green-500" />
      </div>

      <h1 className="text-2xl font-bold text-neutral-900 mb-2">提交成功！</h1>
      <p className="text-neutral-500 mb-6">您的 VI 设计需求已收到，我们将尽快与您联系</p>

      <div className="bg-neutral-50 rounded-xl p-6 mb-8">
        <p className="text-sm text-neutral-500 mb-1">项目编号</p>
        <p className="text-lg font-mono font-bold text-primary">{projectId}</p>
      </div>

      {viewPassword && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
          <p className="text-sm font-medium text-amber-800 mb-1">查看密码</p>
          <p className="text-2xl font-mono font-bold tracking-widest text-amber-600">{viewPassword}</p>
          <p className="text-xs text-amber-600 mt-2">请保存此密码，用于查看Logo设计方案</p>
        </div>
      )}

      <div className="space-y-3 text-sm text-neutral-600 mb-8">
        <p>我们将在 <strong>1-2 个工作日内</strong> 联系您确认需求</p>
        <p>届时您可以使用项目编号和查看密码查看Logo方案</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/view"
          className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors"
        >
          查看Logo方案
        </Link>
        <Link
          href="/progress"
          className="px-6 py-2.5 border border-primary text-primary text-sm font-medium rounded-xl hover:bg-primary/5 transition-colors"
        >
          查看项目进度
        </Link>
        <Link
          href="/"
          className="px-6 py-2.5 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors"
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
          <div className="w-16 h-16 bg-neutral-200 rounded-full mx-auto mb-6" />
          <div className="h-8 bg-neutral-200 rounded w-48 mx-auto mb-4" />
          <div className="h-4 bg-neutral-200 rounded w-64 mx-auto" />
        </div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}

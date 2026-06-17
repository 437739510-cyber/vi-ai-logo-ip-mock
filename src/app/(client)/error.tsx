"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ClientError]", error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <h2 className="text-2xl font-bold text-neutral-900 mb-4">页面出错了</h2>
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
        <p className="text-sm text-red-700 font-mono break-all">
          {error.message || "未知错误"}
        </p>
        {error.digest && (
          <p className="text-xs text-red-400 mt-2">digest: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors"
      >
        重试
      </button>
      <a
        href="/"
        className="block mt-4 text-sm text-neutral-500 hover:text-neutral-700"
      >
        返回首页
      </a>
    </div>
  );
}

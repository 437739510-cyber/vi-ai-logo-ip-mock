export const dynamic = "force-dynamic";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">页面未找到</h1>
        <p className="text-gray-500 mb-8">您访问的页面不存在或已被移除</p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-medium shadow-lg hover:shadow-xl transition-all"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

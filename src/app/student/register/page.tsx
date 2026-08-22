"use client";

export const dynamic = "force-dynamic";

import { useState } from 'react';
import Link from 'next/link';

export default function StudentRegisterPage() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    school: '',
    major: '',
    wechat: '',
    intro: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        let message = "提交失败，请稍后重试";
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch {
          // 服务端返回非 JSON 时使用默认错误文案
        }
        setError(message);
      }
    } catch {
      setError("网络错误，提交失败，请稍后重试");
    }

    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">注册成功！</h2>
          <p className="text-gray-500 mb-6">
            我们会在1-2个工作日内审核您的申请，届时会通过微信联系您
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 text-sm font-medium"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">大学生兼职 · 上门拍照代发</h1>
          <p className="text-gray-500 mt-2">帮老店拍门店照片、代发社交平台，时间自由，按次结算</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-400 text-sm"
                placeholder="请输入真实姓名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号 *</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-400 text-sm"
                placeholder="请输入手机号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学校 *</label>
              <input
                type="text"
                required
                value={form.school}
                onChange={e => setForm(prev => ({ ...prev, school: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-400 text-sm"
                placeholder="请输入学校名称"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">专业</label>
              <input
                type="text"
                value={form.major}
                onChange={e => setForm(prev => ({ ...prev, major: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-400 text-sm"
                placeholder="如：视觉传达设计"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">微信号 *</label>
              <input
                type="text"
                required
                value={form.wechat}
                onChange={e => setForm(prev => ({ ...prev, wechat: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-400 text-sm"
                placeholder="请输入微信号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">自我介绍</label>
              <textarea
                value={form.intro}
                onChange={e => setForm(prev => ({ ...prev, intro: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-400 text-sm"
                rows={3}
                placeholder="简单说说您为什么想加入，有什么优势"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? '提交中...' : '提交申请'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}

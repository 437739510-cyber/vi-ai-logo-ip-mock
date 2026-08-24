'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal, CheckCircle, AlertCircle } from 'lucide-react';

interface FormFieldConfig {
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "文本",
  select: "下拉",
  number: "数字",
  file: "文件",
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: "bg-slate-50 text-slate-600 border-slate-200",
  select: "bg-blue-50 text-blue-600 border-blue-200",
  number: "bg-green-50 text-green-600 border-green-200",
  file: "bg-purple-50 text-purple-600 border-purple-200",
};

export default function BasicInfoPage() {
  const [fields, setFields] = useState<FormFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/form-config")
      .then((r) => r.json())
      .then((d) => {
        if (d.fields) setFields(d.fields);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleField = async (fieldKey: string, required: boolean) => {
    setFields((prev) =>
      prev.map((f) => (f.field_key === fieldKey ? { ...f, required } : f))
    );
    try {
      const res = await fetch("/api/admin/form-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_key: fieldKey, required }),
      });
      const data = await res.json();
      if (!data.success) {
        setFields((prev) =>
          prev.map((f) => (f.field_key === fieldKey ? { ...f, required: !required } : f))
        );
        showToast("error", "保存失败，请重试");
      }
    } catch {
      setFields((prev) =>
        prev.map((f) => (f.field_key === fieldKey ? { ...f, required: !required } : f))
      );
      showToast("error", "网络错误");
    }
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
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">基本信息</h1>
          <p className="text-xs text-neutral-500">控制提交表单中各字段是否必填，点开关即时生效</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200">
          <div className="grid grid-cols-12 gap-4 text-xs font-medium text-neutral-500">
            <div className="col-span-5">字段名称</div>
            <div className="col-span-2">类型</div>
            <div className="col-span-3">状态</div>
            <div className="col-span-2">必填开关</div>
          </div>
        </div>
        <div className="divide-y divide-neutral-100">
          {fields.map((field) => (
            <div
              key={field.field_key}
              className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-neutral-50/50 transition-colors"
            >
              <div className="col-span-5">
                <span className="text-sm font-medium text-neutral-800">{field.label}</span>
                <span className="ml-2 text-[10px] text-neutral-400 font-mono">{field.field_key}</span>
              </div>
              <div className="col-span-2">
                <span
                  className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded border ${
                    FIELD_TYPE_COLORS[field.field_type] || "bg-neutral-50 text-neutral-500 border-neutral-200"
                  }`}
                >
                  {FIELD_TYPE_LABELS[field.field_type] || field.field_type}
                </span>
              </div>
              <div className="col-span-3">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    field.required
                      ? "bg-red-50 text-red-600"
                      : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      field.required ? "bg-red-500" : "bg-neutral-400"
                    }`}
                  />
                  {field.required ? "必填" : "选填"}
                </span>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.required}
                  aria-label={`${field.label}（${field.field_key}）：${field.required ? "必填（开）" : "选填（关）"}，点击切换`}
                  onClick={() => toggleField(field.field_key, !field.required)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    field.required ? "bg-primary" : "bg-neutral-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      field.required ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className={`text-[10px] font-medium ${field.required ? "text-red-600" : "text-neutral-400"}`}>
                  {field.required ? "开" : "关"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
          <strong>提示：</strong>修改后提交表单的必填标记和校验逻辑即时生效，无需重启服务。默认配置：店内照片、微信号、邮箱为选填，其余为必填。
        </p>
      </div>
    </div>
  );
}

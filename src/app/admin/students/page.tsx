"use client";

import { useState, useEffect, useCallback } from "react";
import { GraduationCap, Phone, TrendingUp, Trash2, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface Student {
  id: string;
  real_name: string;
  phone: string;
  university: string;
  major: string;
  grade: string;
  wechat: string;
  service_area: string;
  bio: string;
  status: "active" | "pending" | "suspended";
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "已认证", color: "bg-green-100 text-green-700" },
  pending: { label: "待审核", color: "bg-amber-100 text-amber-700" },
  suspended: { label: "已暂停", color: "bg-red-100 text-red-700" },
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "pending">("all");
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/students/register");
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      console.error("获取学生列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/students/delete?id=${id}`, { method: "DELETE" });
      setStudents(prev => prev.filter(s => s.id !== id));
      setDeleteConfirm(null);
    } catch {
      alert("删除失败，请重试");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await fetch("/api/students/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setStudents(prev => prev.map(s => s.id === id ? { ...s, status: status as Student["status"] } : s));
    } catch {
      alert("操作失败，请重试");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = students.filter(s => filter === "all" || s.status === filter);

  const stats = {
    total: students.length,
    active: students.filter(s => s.status === "active").length,
    pending: students.filter(s => s.status === "pending").length,
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-neutral-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">大学生管理</h2>
          <p className="text-sm text-neutral-500 mt-1">管理大学生代理，查看认证状态</p>
        </div>
        <button onClick={fetchStudents} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 text-sm">
          <RefreshCw className="w-3.5 h-3.5" />刷新
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-neutral-500 text-sm"><GraduationCap className="w-4 h-4" />总人数</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-green-600 text-sm"><GraduationCap className="w-4 h-4" />已认证</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-amber-600 text-sm"><GraduationCap className="w-4 h-4" />待审核</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{stats.pending}</div>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: "all", label: "全部" },
          { key: "active", label: "已认证" },
          { key: "pending", label: "待审核" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left px-4 py-3 font-medium text-neutral-500">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">学校/专业</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">微信</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">状态</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">注册时间</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{s.real_name}</div>
                    <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />{s.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-neutral-900">{s.university}</div>
                    <div className="text-xs text-neutral-400">{s.major}{s.grade ? ` · ${s.grade}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{s.wechat || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[s.status]?.color || "bg-gray-100 text-gray-700"}`}>
                      {STATUS_MAP[s.status]?.label || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{s.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {s.status === "pending" && (
                        <button onClick={() => handleStatusChange(s.id, "active")} disabled={actionLoading === s.id}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50" title="通过审核">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {s.status === "active" && (
                        <button onClick={() => handleStatusChange(s.id, "suspended")} disabled={actionLoading === s.id}
                          className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 disabled:opacity-50" title="暂停">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {s.status === "suspended" && (
                        <button onClick={() => handleStatusChange(s.id, "active")} disabled={actionLoading === s.id}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50" title="恢复">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {deleteConfirm === s.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(s.id)} disabled={actionLoading === s.id}
                            className="px-2 py-1 rounded text-xs bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">确认删除</button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded text-xs bg-neutral-100 text-neutral-600 hover:bg-neutral-200">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(s.id)} disabled={actionLoading === s.id}
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50" title="删除">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            暂无大学生数据
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        大学生通过客户端「大学生加入」注册，审核通过后可接单服务客户。标准版每单佣金 ¥150。
      </div>
    </div>
  );
}

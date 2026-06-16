"use client";

import { useState, useEffect, useCallback } from "react";
import { GraduationCap, Phone, Plus, RefreshCw, Trash2, CheckCircle, XCircle, Coins, Eye, EyeOff } from "lucide-react";

interface Student {
  id: string;
  phone: string;
  name: string;
  level: string;
  total_orders: number;
  commission_rate: number;
  active: boolean;
  created_at: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ phone: "", name: "", password: "" });
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [showPw, setShowPw] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/students");
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      console.error("获取大学生列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.phone || !addForm.name || !addForm.password) {
      setAddError("手机号、姓名、密码必填");
      return;
    }
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowAdd(false);
        setAddForm({ phone: "", name: "", password: "" });
        fetchStudents();
      } else {
        setAddError(data.error || "添加失败");
      }
    } catch {
      setAddError("网络错误");
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      setStudents(prev => prev.map(s => s.id === id ? { ...s, active: !currentActive } : s));
    } catch {
      alert("操作失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
      setStudents(prev => prev.filter(s => s.id !== id));
      setDeleteConfirm(null);
    } catch {
      alert("删除失败");
    } finally {
      setActionLoading(null);
    }
  };

  const activeCount = students.filter(s => s.active).length;
  const inactiveCount = students.filter(s => !s.active).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-neutral-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">大学生管理</h2>
          <p className="text-sm text-neutral-500 mt-1">添加和管理大学生合伙人账号</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-medium"
          >
            <Plus className="w-3.5 h-3.5" />添加大学生
          </button>
          <button onClick={fetchStudents} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 text-sm">
            <RefreshCw className="w-3.5 h-3.5" />刷新
          </button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-neutral-500 text-sm"><GraduationCap className="w-4 h-4" />总人数</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{students.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-green-600 text-sm"><CheckCircle className="w-4 h-4" />活跃</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{activeCount}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-red-500 text-sm"><XCircle className="w-4 h-4" />停用</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{inactiveCount}</div>
        </div>
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h3 className="font-bold text-neutral-900 mb-4">添加大学生</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="text-sm text-neutral-600 mb-1 block">姓名</label>
              <input type="text" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="大学生姓名" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
            </div>
            <div>
              <label className="text-sm text-neutral-600 mb-1 block">手机号（登录账号）</label>
              <input type="tel" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                placeholder="11位手机号" maxLength={11} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
            </div>
            <div>
              <label className="text-sm text-neutral-600 mb-1 block">登录密码</label>
              <input type="text" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                placeholder="设置登录密码" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
            </div>
            {addError && <p className="text-sm text-red-500">{addError}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={addLoading}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50">
                {addLoading ? "添加中..." : "确认添加"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setAddError(""); }}
                className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-lg text-sm hover:bg-neutral-200">
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 列表 */}
      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left px-4 py-3 font-medium text-neutral-500">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">手机号</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">等级</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-500">完成单数</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-500">提成比例</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-500">状态</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{s.name}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-neutral-400" />
                      {s.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                      {s.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 font-medium">{s.total_orders}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Coins className="w-3 h-3 text-amber-500" />
                      <span className="font-medium text-neutral-700">{s.commission_rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {s.active ? "活跃" : "停用"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggleActive(s.id, s.active)} disabled={actionLoading === s.id}
                        className={`p-1.5 rounded-lg ${s.active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"} disabled:opacity-50`}
                        title={s.active ? "停用" : "启用"}
                      >
                        {s.active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      {deleteConfirm === s.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(s.id)} disabled={actionLoading === s.id}
                            className="px-2 py-1 rounded text-xs bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">确认</button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded text-xs bg-neutral-100 text-neutral-600 hover:bg-neutral-200">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(s.id)} disabled={actionLoading === s.id}
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50" title="删除"
                        >
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
        {students.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            暂无大学生，点击上方"添加大学生"开始
          </div>
        )}
      </div>
    </div>
  );
}

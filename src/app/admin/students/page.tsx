"use client";

import { useState, useEffect, useCallback } from "react";
import { GraduationCap, Phone, Plus, RefreshCw, Trash2, CheckCircle, XCircle, Link2, Unlink, Loader2, Inbox } from "lucide-react";

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

interface SettlementRules {
  base: { ratio: number; level: string };
  silver: { ratio: number; level: string };
  gold: { ratio: number; level: string };
  silverOrders: number;
  goldOrders: number;
}

interface Assignment {
  studentId: string;
  studentName: string;
  projectId: string;
  status: string;
  source: string | null;
  brandName: string;
  phone: string;
  createdAt: string;
}

interface PublishedContent {
  id: string;
  member_id: string;
  brand_name: string;
  student_name: string;
  caption: string;
  platform: string;
  publish_link: string;
  publish_proof: { url: string; note: string };
  published_at: string;
  published_by: string;
  confirmed: boolean;
}

type Tab = "students" | "attributions" | "published";

export default function StudentsPage() {
  const [tab, setTab] = useState<Tab>("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ phone: "", name: "", password: "" });
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [rules, setRules] = useState<SettlementRules | null>(null);

  // 归属管理
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 代发记录（TICKET-122-R21）
  const [publishedContents, setPublishedContents] = useState<PublishedContent[]>([]);
  const [publishedLoading, setPublishedLoading] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/students");
      const data = await res.json();
      setStudents(data.students || []);
      setRules(data.rules || null);
    } catch {
      console.error("获取大学生列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    setAssignLoading(true);
    setAssignMsg("");
    try {
      const q = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(`/api/admin/student-assignments${q}`);
      const data = await res.json();
      setAssignments(data.success ? data.assignments || [] : []);
    } catch {
      setAssignments([]);
    } finally {
      setAssignLoading(false);
    }
  }, [statusFilter]);

  const fetchPublished = useCallback(async () => {
    setPublishedLoading(true);
    try {
      const res = await fetch("/api/admin/published-contents");
      const data = await res.json();
      setPublishedContents(data.success ? data.records || [] : []);
    } catch {
      setPublishedContents([]);
    } finally {
      setPublishedLoading(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { if (tab === "attributions") fetchAssignments(); }, [tab, fetchAssignments]);
  useEffect(() => { if (tab === "published") fetchPublished(); }, [tab, fetchPublished]);

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


  const handleConfirm = async (a: Assignment) => {
    setActionLoading(`${a.studentId}:${a.projectId}`);
    setAssignMsg("");
    try {
      const res = await fetch("/api/admin/student-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", studentId: a.studentId, projectId: a.projectId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAssignments();
      } else {
        setAssignMsg(data.error || "确认失败");
      }
    } catch {
      setAssignMsg("网络错误");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (a: Assignment) => {
    setActionLoading(`${a.studentId}:${a.projectId}`);
    setAssignMsg("");
    try {
      const res = await fetch("/api/admin/student-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", studentId: a.studentId, projectId: a.projectId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAssignments();
      } else {
        setAssignMsg(data.error || "拒绝失败");
      }
    } catch {
      setAssignMsg("网络错误");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnbind = async (a: Assignment) => {
    setActionLoading(`${a.studentId}:${a.projectId}`);
    setAssignMsg("");
    try {
      const res = await fetch(`/api/admin/student-assignments?studentId=${encodeURIComponent(a.studentId)}&projectId=${encodeURIComponent(a.projectId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        await fetchAssignments();
      } else {
        setAssignMsg(data.error || "解除失败");
      }
    } catch {
      setAssignMsg("网络错误");
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
          <p className="text-sm text-neutral-500 mt-1">管理大学生账号，并处理学生的客户归属申请</p>
          <p className="text-xs text-neutral-400 mt-1">
            提成按累计已确认单数实时计算：新手 {rules?.base.ratio ?? "-"}% → 银级 {rules?.silver.ratio ?? "-"}%（满 {rules?.silverOrders ?? "-"} 单）→ 金级 {rules?.gold.ratio ?? "-"}%（满 {rules?.goldOrders ?? "-"} 单）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-medium">
            <Plus className="w-3.5 h-3.5" />添加大学生
          </button>
          <button onClick={() => { if (tab === "attributions") fetchAssignments(); else fetchStudents(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 text-sm">
            <RefreshCw className="w-3.5 h-3.5" />刷新
          </button>
        </div>
      </div>

      {/* Tab 切换：大学生列表 / 归属管理 */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg w-fit">
        <button onClick={() => setTab("students")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "students" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}>
          <GraduationCap className="w-4 h-4" />大学生列表
        </button>
        <button onClick={() => setTab("attributions")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "attributions" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}>
          <Link2 className="w-4 h-4" />归属管理
        </button>
        <button onClick={() => setTab("published")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "published" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}>
          <CheckCircle className="w-4 h-4" />代发记录
        </button>
      </div>

      {assignMsg && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm">
          {assignMsg}
        </div>
      )}

      {tab === "students" && (
        <>
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

          {showAdd && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-6">
              <h3 className="font-bold text-neutral-900 mb-4">添加大学生</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                        <span className="font-medium text-neutral-700" title="按累计已确认单数实时计算，与结算逻辑一致">
                          {s.commission_rate}%
                        </span>
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
                            title={s.active ? "停用" : "启用"}>
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
            {students.length === 0 && (
              <div className="text-center py-12 text-neutral-400">
                <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                暂无大学生，点击上方"添加大学生"开始
              </div>
            )}
          </div>
        </>
      )}

      {tab === "attributions" && (
        <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-center gap-2">
            <span className="text-sm text-neutral-500">筛选：</span>
            {["all", "pending", "confirmed", "rejected"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${statusFilter === s ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                {s === "all" ? "全部" : s === "pending" ? "待确认" : s === "confirmed" ? "已确认" : "已拒绝"}
              </button>
            ))}
          </div>

          {assignLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">学生</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">客户</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">手机号</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">来源</th>
                    <th className="text-center px-4 py-3 font-medium text-neutral-500">状态</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={`${a.studentId}:${a.projectId}`} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3 text-neutral-900 font-medium">{a.studentName || a.studentId}</td>
                      <td className="px-4 py-3 text-neutral-700">{a.brandName || a.phone || a.projectId}</td>
                      <td className="px-4 py-3 text-neutral-600">{a.phone || "-"}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                          {a.source === "submit" ? "提交线索" : a.source === "claim" ? "认领" : a.source || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "confirmed" ? "bg-green-100 text-green-700" : a.status === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                          {a.status === "confirmed" ? "已确认" : a.status === "rejected" ? "已拒绝" : "待确认"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {a.status === "pending" && (
                            <>
                              <button onClick={() => handleConfirm(a)} disabled={actionLoading === `${a.studentId}:${a.projectId}`}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 disabled:opacity-50">
                                <CheckCircle className="w-3.5 h-3.5" />确认
                              </button>
                              <button onClick={() => handleReject(a)} disabled={actionLoading === `${a.studentId}:${a.projectId}`}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 disabled:opacity-50">
                                <XCircle className="w-3.5 h-3.5" />拒绝
                              </button>
                            </>
                          )}
                          {a.status === "confirmed" && (
                            <button onClick={() => handleUnbind(a)} disabled={actionLoading === `${a.studentId}:${a.projectId}`}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 text-xs font-medium hover:bg-neutral-200 disabled:opacity-50">
                              <Unlink className="w-3.5 h-3.5" />解除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assignments.length === 0 && (
                <div className="text-center py-12 text-neutral-400">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  暂无归属记录
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "published" && (
        <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-center gap-2">
            <span className="text-sm text-neutral-500">已发布记录（代发验收依据）</span>
          </div>

          {publishedLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">学生</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">客户</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">平台</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">链接 / 凭证</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500">发布时间</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedContents.map((p) => {
                    const platformLabel = p.platform === "xiaohongshu" ? "小红书" : p.platform === "wechat" ? "朋友圈" : p.platform === "douyin" ? "抖音" : (p.platform || "-");
                    return (
                      <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                        <td className="px-4 py-3 text-neutral-900 font-medium">{p.student_name || p.published_by}</td>
                        <td className="px-4 py-3 text-neutral-700">{p.brand_name || p.member_id}</td>
                        <td className="px-4 py-3 text-neutral-600">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">{platformLabel}</span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {p.publish_link ? (
                            <a href={p.publish_link} target="_blank" rel="noreferrer"
                              className="text-blue-600 hover:underline break-all text-xs">{p.publish_link}</a>
                          ) : <span className="text-neutral-400 text-xs">-</span>}
                          {p.publish_proof?.note && (
                            <p className="text-xs text-neutral-400 mt-1">凭证说明：{p.publish_proof.note}</p>
                          )}
                          {p.publish_proof?.url && (
                            <a href={p.publish_proof.url} target="_blank" rel="noreferrer"
                              className="text-blue-500 hover:underline text-xs mt-1 inline-block">查看凭证截图</a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">{p.published_at ? new Date(p.published_at).toLocaleString("zh-CN") : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {publishedContents.length === 0 && (
                <div className="text-center py-12 text-neutral-400">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  暂无代发记录
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

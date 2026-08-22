"use client";

import { useState, useEffect, useCallback } from "react";
import { Inbox, CheckCircle2, XCircle, RefreshCw, KeyRound, GraduationCap } from "lucide-react";

interface Application {
  id: string;
  name: string;
  phone: string;
  school: string;
  major: string;
  wechat: string;
  intro: string;
  status: string;
  created_at: string;
}

interface ApproveInfo {
  applicationId: string;
  name: string;
  initialPassword: string;
}

export default function StudentApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [approveInfo, setApproveInfo] = useState<ApproveInfo | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/student-applications");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "读取申请列表失败");
        return;
      }
      setApplications(data.applications || []);
    } catch {
      setError("网络错误，读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const handleApprove = async (app: Application) => {
    setActionLoading(app.id);
    setError("");
    try {
      const res = await fetch("/api/admin/student-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", id: app.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "审核失败");
        return;
      }
      setApproveInfo({
        applicationId: app.id,
        name: app.name,
        initialPassword: data.initialPassword || "",
      });
      setApplications((prev) => prev.filter((a) => a.id !== app.id));
    } catch {
      setError("网络错误");
    } finally {
      setActionLoading(null);
    }
  };

  const startReject = (id: string) => {
    setRejectingId(id);
    setRejectNote("");
    setError("");
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    setError("");
    try {
      const res = await fetch("/api/admin/student-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", id, note: rejectNote }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "拒绝失败");
        return;
      }
      setApplications((prev) => prev.filter((a) => a.id !== id));
      setRejectingId(null);
    } catch {
      setError("网络错误");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-neutral-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">学生申请审核</h2>
          <p className="text-sm text-neutral-500 mt-1">审核通过将一键创建大学生账号（提成默认30%），并回写申请状态</p>
        </div>
        <button onClick={fetchApplications}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 text-sm">
          <RefreshCw className="w-3.5 h-3.5" />刷新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {approveInfo && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-emerald-800 mb-1">
            <KeyRound className="w-4 h-4" />
            已通过「{approveInfo.name}」的申请，账号已创建
          </div>
          <p className="text-emerald-700">
            初始登录密码（仅显示一次，请线下转交给学生并提醒其登录后修改）：
            <span className="font-mono font-semibold ml-1 select-all">{approveInfo.initialPassword}</span>
          </p>
          <button onClick={() => setApproveInfo(null)}
            className="mt-2 text-emerald-600 hover:text-emerald-800 underline">我知道了</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left px-4 py-3 font-medium text-neutral-500">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">手机号</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">学校</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">专业</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">微信</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">简介</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{app.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{app.phone}</td>
                  <td className="px-4 py-3 text-neutral-600">{app.school}</td>
                  <td className="px-4 py-3 text-neutral-600">{app.major || "-"}</td>
                  <td className="px-4 py-3 text-neutral-600">{app.wechat || "-"}</td>
                  <td className="px-4 py-3 text-neutral-500 max-w-xs">
                    <div className="truncate" title={app.intro}>{app.intro || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => handleApprove(app)} disabled={actionLoading === app.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 disabled:opacity-50">
                        <CheckCircle2 className="w-3.5 h-3.5" />通过
                      </button>
                      {rejectingId === app.id ? (
                        <div className="flex items-center gap-1">
                          <input autoFocus type="text" value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleReject(app.id); if (e.key === "Escape") setRejectingId(null); }}
                            placeholder="拒绝备注"
                            className="w-32 px-2 py-1 border border-neutral-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
                          <button onClick={() => handleReject(app.id)} disabled={actionLoading === app.id}
                            className="px-2 py-1 rounded bg-red-500 text-white text-xs disabled:opacity-50">确认</button>
                          <button onClick={() => setRejectingId(null)}
                            className="px-2 py-1 rounded bg-neutral-100 text-neutral-600 text-xs">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => startReject(app.id)} disabled={actionLoading === app.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 disabled:opacity-50">
                          <XCircle className="w-3.5 h-3.5" />拒绝
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {applications.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
            暂无待审核的学生申请
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
        <GraduationCap className="w-3.5 h-3.5" />
        通过后自动创建大学生账号，申请记录将移出待审核列表
      </div>
    </div>
  );
}

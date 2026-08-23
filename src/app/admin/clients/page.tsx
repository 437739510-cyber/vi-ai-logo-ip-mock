"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/shared/Modal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, Phone, Building2, Trash2, Loader2, AlertTriangle } from "lucide-react";

interface ClientProtection {
  hasAssignments: boolean;
  hasMemberContents: boolean;
  hasSettlements: boolean;
  reasons: string[];
}

interface ClientRecordRow {
  id: string;
  clientName: string;
  companyName: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  industry: string;
  budgetRange: string | null;
  description: string | null;
  submittedAt: string;
  status: string;
  projectId: string | null;
  projectStatus: string | null;
  projectUpdatedAt: string | null;
  protection: ClientProtection;
}

interface ProtectedClientRow {
  id: string;
  reasons: string[];
}

const CONFIRM_TEXT = "确认";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [blocked, setBlocked] = useState<ProtectedClientRow[]>([]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/client-records", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setLoadError(data.error || "加载客户列表失败");
        setClients([]);
        return;
      }
      setClients(data.clients || []);
    } catch {
      setLoadError("网络错误，请重试");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === clients.length) return new Set();
      return new Set(clients.map((c) => c.id));
    });
  };

  const allSelected = clients.length > 0 && selectedIds.size === clients.length;

  const openConfirm = () => {
    setNotice("");
    setBlocked([]);
    setConfirmText("");
    setConfirmOpen(true);
  };

  const handleBatchDelete = async () => {
    if (confirmText !== CONFIRM_TEXT || deleting) return;
    setDeleting(true);
    setNotice("");
    setBlocked([]);
    try {
      const res = await fetch("/api/admin/client-records/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionIds: Array.from(selectedIds), confirm: confirmText }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      if (res.status === 409) {
        setBlocked(data.protected || []);
        setNotice(`已拦截：${data.protected?.length || 0} 个客户存在关联数据，未执行删除`);
        return;
      }
      if (!data.success) {
        setNotice("删除失败：" + (data.error || "未知错误"));
        return;
      }
      setNotice(`已删除 ${data.deleted?.length || 0} 个客户`);
      setSelectedIds(new Set());
      setConfirmOpen(false);
      setConfirmText("");
      await fetchClients();
    } catch {
      setNotice("网络错误，删除未执行");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-xl border border-red-100 p-6 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-400 mb-2" />
        <p className="text-sm text-red-600">{loadError}</p>
        <button
          onClick={fetchClients}
          className="mt-4 px-4 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark"
        >
          重新加载
        </button>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-12 h-12 text-neutral-300" />}
        title="暂无客户"
        description="有新客户提交需求后会显示在这里"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">客户管理</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-neutral-400">共 {clients.length} 个客户</p>
          <button
            onClick={openConfirm}
            disabled={selectedIds.size === 0 || deleting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            批量删除{selectedIds.size > 0 ? `（${selectedIds.size}）` : ""}
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            blocked.length > 0
              ? "bg-red-50 border-red-100 text-red-700"
              : "bg-green-50 border-green-100 text-green-700"
          }`}
        >
          {notice}
          {blocked.length > 0 && (
            <ul className="mt-2 space-y-1 list-disc pl-5">
              {blocked.map((b) => (
                <li key={b.id} className="text-xs">
                  {b.id}：{b.reasons.join("；")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-neutral-500 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleAll}
            className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
          />
          全选本页
        </label>

        {clients.map((client) => {
          const selected = selectedIds.has(client.id);
          const protectedReasons = client.protection.reasons;
          return (
            <div
              key={client.id}
              className={`bg-white rounded-xl border p-5 transition-shadow ${
                selected ? "border-primary ring-1 ring-primary" : "border-neutral-100 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => handleToggleSelect(client.id)}
                  className="mt-1 w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  aria-label={`选择客户 ${client.companyName || client.clientName || client.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900">
                        {client.companyName || client.clientName || client.id}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {client.clientName} · {client.industry || "未填写行业"}
                      </p>
                    </div>
                    {client.projectId && (
                      <Link
                        href={`/admin/projects/${client.projectId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        查看项目
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {client.phone || "-"}
                    </span>
                    {client.wechat && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> 微信：{client.wechat}
                      </span>
                    )}
                    {client.budgetRange && <span>预算：{client.budgetRange}</span>}
                    <span className="text-neutral-400">
                      提交于 {client.submittedAt ? new Date(client.submittedAt).toLocaleDateString("zh-CN") : "-"}
                    </span>
                  </div>

                  {client.description && (
                    <p className="mt-2 text-xs text-neutral-500 line-clamp-2">{client.description}</p>
                  )}

                  {protectedReasons.length > 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      ⚠ 有关联数据（{protectedReasons.join("；")}），不可删除
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)} size="sm">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">批量删除客户</h3>
          <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
            已选择 <span className="font-semibold text-red-600">{selectedIds.size}</span> 个客户。
            删除为软删除（标记已删除，不在列表显示）；存在结算/归属/内容关联数据的客户会被拦截。
            此操作不可撤销。
          </p>
          <p className="mt-3 text-sm text-neutral-700">
            请输入 <span className="font-mono font-semibold text-red-600">{CONFIRM_TEXT}</span> 以确认：
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
            placeholder={`输入「${CONFIRM_TEXT}」`}
            className="mt-2 w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          />
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={confirmText !== CONFIRM_TEXT || deleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              确认删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

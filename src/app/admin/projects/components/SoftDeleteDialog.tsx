"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/core/utils";

const DELETE_REASONS = ["测试数据", "客户取消", "重复提交", "已线下交付", "其他"];

interface SoftDeleteDialogProps {
  isOpen: boolean;
  mode: "single" | "batch";
  projectId?: string;
  clientLabel?: string;
  count?: number;
  deleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SoftDeleteDialog({
  isOpen,
  mode,
  projectId,
  clientLabel,
  count,
  deleting = false,
  onClose,
  onConfirm,
}: SoftDeleteDialogProps) {
  const [confirmId, setConfirmId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setConfirmId("");
      setReason("");
    }
  }, [isOpen]);

  const reasonPicked = reason !== "";
  const idTyped = mode === "batch" ? false : confirmId.trim() === projectId;
  const canConfirm = !deleting && (reasonPicked || idTyped);

  return (
    <Modal isOpen={isOpen} onClose={deleting ? () => {} : onClose} size="md">
      <h3 className="text-lg font-semibold text-neutral-900">
        {mode === "batch" ? `批量软删除 ${count ?? 0} 个项目` : "软删除项目"}
      </h3>
      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
        {mode === "batch"
          ? "将给选中的项目写入 deleted_at 标记（软删除）。记录可在「已归档」视图中查看，不会物理删除数据。"
          : `项目 ${projectId}（${clientLabel || "-"}）将被软删除（写入 deleted_at）。记录可在「已归档」视图中查看。`}
      </p>

      <div className="mt-4">
        <p className="text-sm font-medium text-neutral-700">删除原因（选择原因，或输入项目编号确认）</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DELETE_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                reason === r
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {mode === "single" && (
        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-700">或输入项目编号确认</p>
          <input
            type="text"
            value={confirmId}
            onChange={(e) => setConfirmId(e.target.value)}
            placeholder={`输入 ${projectId} 以确认`}
            className="mt-1 w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <div className="mt-6 flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={deleting}
          className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 disabled:opacity-50 transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="px-4 py-2 text-sm font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors"
        >
          {deleting ? "删除中…" : "确认软删除"}
        </button>
      </div>
    </Modal>
  );
}

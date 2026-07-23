"use client";

import { Modal } from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "确定",
  cancelLabel = "取消",
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral-900 mt-2">
          {title}
        </h3>
        <p className="mt-2 text-sm text-neutral-600 whitespace-pre-line leading-relaxed">
          {description}
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors text-white ${variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-dark"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
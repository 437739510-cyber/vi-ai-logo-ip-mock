"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { cn } from "@/lib/utils";
import { UploadCloud } from "lucide-react";

interface FileUploadProps {
  onFiles: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  label?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  onFiles,
  accept,
  maxSize = 20 * 1024 * 1024,
  maxFiles = 5,
  multiple = true,
  label = "鐐瑰嚮鎴栨嫋鎷芥枃浠跺埌姝ゅ",
  hint,
  className,
  disabled,
}: FileUploadProps) {
  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const reasons = rejections
          .map((r) => `${r.file.name}: ${r.errors.map((e) => e.message).join(", ")}`)
          .join("\n");
        alert(`浠ヤ笅鏂囦欢涓嶇鍚堣姹傦細\n${reasons}`);
      }
      if (accepted.length > 0) {
        onFiles(accepted);
      }
    },
    [onFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
    multiple,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 group",
        isDragActive
          ? "border-primary bg-primary-lighter scale-[1.02]"
          : "border-neutral-200 hover:border-primary/50 hover:bg-neutral-50",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Decorative gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <input {...getInputProps()} />
      <div className="relative flex flex-col items-center gap-3">
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
            isDragActive
              ? "bg-primary text-white scale-110"
              : "bg-neutral-100 text-neutral-400 group-hover:bg-primary/10 group-hover:text-primary"
          )}
        >
          <UploadCloud className="w-7 h-7" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-700">
            {isDragActive ? "閲婃斁浠ヤ笂浼犳枃浠?" : label}
          </p>
          {hint && <p className="text-xs text-neutral-400">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

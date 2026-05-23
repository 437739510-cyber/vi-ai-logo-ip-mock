"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFiles: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxSize?: number; // bytes
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
  maxSize = 20 * 1024 * 1024, // 20MB
  maxFiles = 5,
  multiple = true,
  label = "点击或拖拽文件到此处",
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
        alert(`以下文件不符合要求：\n${reasons}`);
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
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-neutral-200 hover:border-neutral-400",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2">
        <svg
          className="w-8 h-8 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-sm text-neutral-600">{isDragActive ? "释放以上传文件" : label}</p>
        {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      </div>
    </div>
  );
}

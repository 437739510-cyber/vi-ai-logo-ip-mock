"use client";

import { useState } from "react";
import { FileUpload } from "@/components/shared/FileUpload";
import { X, FileText, Image } from "lucide-react";

// ========== 通用文件预览 ==========

interface UploadedFile {
  name: string;
  size: number;
  url?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilePreview({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm">
      <Image className="w-4 h-4 text-neutral-400 shrink-0" />
      <span className="truncate flex-1 text-neutral-700">{file.name}</span>
      <span className="text-neutral-400 text-xs shrink-0">{formatSize(file.size)}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-danger transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ========== Logo 上传区域 ==========

interface LogoUploadAreaProps {
  files: UploadedFile[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}

export function LogoUploadArea({ files, onAdd, onRemove }: LogoUploadAreaProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-2">
        LOGO 上传 <span className="text-danger">*</span>
      </label>
      {files.length > 0 && (
        <div className="mb-3 space-y-1">
          {files.map((f, i) => (
            <FilePreview key={i} file={f} onRemove={() => onRemove(i)} />
          ))}
        </div>
      )}
      <FileUpload
        onFiles={onAdd}
        accept={{
          "image/png": [".png"],
          "image/jpeg": [".jpg", ".jpeg"],
          "image/svg+xml": [".svg"],
          "application/postscript": [".ai", ".eps"],
        }}
        maxFiles={5}
        label={files.length > 0 ? "继续添加 LOGO" : "点击上传品牌 Logo（PNG/SVG/AI/EPS）"}
        hint="支持 PNG / SVG / AI / EPS，单文件 ≤ 20MB"
      />
    </div>
  );
}

// ========== IP 公仔上传区域 ==========

interface MascotFile extends UploadedFile {
  name_value: string;
  personality_value: string;
}

interface MascotUploadAreaProps {
  items: MascotFile[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onNameChange: (index: number, value: string) => void;
  onPersonalityChange: (index: number, value: string) => void;
}

export function MascotUploadArea({
  items,
  onAdd,
  onRemove,
  onNameChange,
  onPersonalityChange,
}: MascotUploadAreaProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-2">
        IP 公仔 / 吉祥物上传
      </label>
      {items.length > 0 && (
        <div className="mb-3 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="p-3 border border-neutral-200 rounded-lg bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm text-neutral-700">{item.name}</span>
                  <span className="text-xs text-neutral-400">{formatSize(item.size)}</span>
                </div>
                <button
                  onClick={() => onRemove(i)}
                  className="p-0.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-danger transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="IP 名称（必填）"
                  value={item.name_value}
                  onChange={(e) => onNameChange(i, e.target.value)}
                  className="px-2 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="性格描述（选填）"
                  value={item.personality_value}
                  onChange={(e) => onPersonalityChange(i, e.target.value)}
                  className="px-2 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <FileUpload
        onFiles={onAdd}
        accept={{
          "image/png": [".png"],
          "image/jpeg": [".jpg", ".jpeg"],
          "image/gif": [".gif"],
        }}
        maxFiles={10}
        multiple
        label={items.length > 0 ? "继续添加 IP 公仔" : "点击上传 IP 公仔（PNG/JPG/GIF）"}
        hint="支持 PNG / JPG / GIF，可上传多角度，单文件 ≤ 20MB"
      />
    </div>
  );
}

// ========== 参考手册上传区域 ==========

interface ReferenceUploadAreaProps {
  file: UploadedFile | null;
  referenceEnabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: () => void;
  onToggleReference: (enabled: boolean) => void;
}

export function ReferenceUploadArea({
  file,
  referenceEnabled,
  onAdd,
  onRemove,
  onToggleReference,
}: ReferenceUploadAreaProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-2">
        参考 VI 手册上传（可选）
      </label>
      <p className="text-xs text-neutral-400 mb-3">
        如果您已有品牌倾向的视觉参考手册，请上传 PDF，AI 会优先学习您偏好的风格
      </p>

      {file ? (
        <div className="mb-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm">
            <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="truncate flex-1 text-neutral-700">{file.name}</span>
            <span className="text-neutral-400 text-xs shrink-0">{formatSize(file.size)}</span>
            <button
              onClick={onRemove}
              className="p-0.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-danger transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={referenceEnabled}
              onChange={(e) => onToggleReference(e.target.checked)}
              className="rounded border-neutral-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-neutral-600">AI 生成时参考本手册的风格</span>
          </label>
        </div>
      ) : (
        <FileUpload
          onFiles={onAdd}
          accept={{ "application/pdf": [".pdf"] }}
          maxFiles={1}
          multiple={false}
          maxSize={50 * 1024 * 1024}
          label="点击上传参考 VI 手册（PDF）"
          hint="支持 PDF 格式，≤ 50MB"
        />
      )}
    </div>
  );
}

"use client";

import { FileUpload } from "@/components/shared/FileUpload";
import { X, FileText, Image } from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function FilePreview({ name, size, onRemove, icon }: { name: string; size: number; onRemove: () => void; icon?: React.ReactNode }) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm hover:border-neutral-300 transition-all">
      {icon || <Image className="w-4 h-4 text-neutral-400 shrink-0" />}
      <span className="truncate flex-1 text-neutral-700 font-medium">{name}</span>
      <span className="text-neutral-400 text-xs shrink-0">{formatSize(size)}</span>
      <button onClick={onRemove} className="p-0.5 rounded-lg hover:bg-neutral-200 text-neutral-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function LogoUploadArea({ files, onAdd, onRemove }: { files: File[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm font-semibold text-neutral-700">Logo 上传</label>
        {files.length > 0 && <span className="text-xs text-primary font-medium">({files.length}/5)</span>}
        <span className="text-red-500 text-xs">* 必填</span>
      </div>
      {files.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {files.map((f, i) => (<FilePreview key={i} name={f.name} size={f.size} onRemove={() => onRemove(i)} />))}
        </div>
      )}
      <FileUpload onFiles={onAdd} accept={{ "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/svg+xml": [".svg"], "application/postscript": [".ai", ".eps"] }} maxFiles={5} label="上传品牌 Logo" hint="支持 PNG、SVG、AI、EPS 格式，每文件最大 20MB" />
    </div>
  );
}

export function MascotUploadArea({
  files, names, personalities, onAdd, onRemove, onNameChange, onPersonalityChange,
}: {
  files: File[];
  names: string[];
  personalities: string[];
  onAdd: (f: File[]) => void;
  onRemove: (i: number) => void;
  onNameChange: (i: number, v: string) => void;
  onPersonalityChange: (i: number, v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm font-semibold text-neutral-700">IP 公仔上传</label>
        {files.length > 0 && <span className="text-xs text-neutral-400 font-medium">({files.length}/10)</span>}
      </div>
      {files.length > 0 && (
        <div className="mb-3 space-y-2">
          {files.map((item, i) => (
            <div key={i} className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Image className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span className="text-sm text-neutral-700 font-medium truncate">{item.name}</span>
                  <span className="text-xs text-neutral-400 shrink-0">{formatSize(item.size)}</span>
                </div>
                <button onClick={() => onRemove(i)} className="p-0.5 rounded-lg hover:bg-neutral-200 text-neutral-400 hover:text-red-500 transition-all"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="名称（必填）" value={names[i] || ""} onChange={(e) => onNameChange(i, e.target.value)} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <input type="text" placeholder="性格描述（选填）" value={personalities[i] || ""} onChange={(e) => onPersonalityChange(i, e.target.value)} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
      <FileUpload onFiles={onAdd} accept={{ "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/gif": [".gif"] }} maxFiles={10} multiple label="上传 IP 公仔" hint="支持 PNG、JPG、GIF 格式，每文件最大 20MB" />
    </div>
  );
}

export function ReferenceUploadArea({ file, referenceEnabled, onAdd, onRemove, onToggleReference }: {
  file: File | null;
  referenceEnabled: boolean;
  onAdd: (f: File[]) => void;
  onRemove: () => void;
  onToggleReference: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm font-semibold text-neutral-700">参考 VI 手册</label>
        <span className="text-xs text-neutral-400">（选填）</span>
      </div>
      <p className="text-xs text-neutral-400 mb-3 leading-relaxed">上传已有的品牌手册 PDF，AI 将参考其风格、色彩和字体</p>

      {file ? (
        <div className="mb-3">
          <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="truncate flex-1 text-sm text-neutral-700 font-medium">{file.name}</span>
            <span className="text-neutral-400 text-xs shrink-0">{formatSize(file.size)}</span>
            <button onClick={onRemove} className="p-0.5 rounded-lg hover:bg-neutral-200 text-neutral-400 hover:text-red-500 transition-all"><X className="w-3.5 h-3.5" /></button>
          </div>
          <label className="flex items-center gap-2.5 mt-3 cursor-pointer group">
            <input type="checkbox" checked={referenceEnabled} onChange={(e) => onToggleReference(e.target.checked)} className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary/20 focus:ring-2 transition-all" />
            <span className="text-sm text-neutral-600 group-hover:text-neutral-700 transition-colors">AI 生成时参考此手册</span>
          </label>
        </div>
      ) : (
        <FileUpload onFiles={onAdd} accept={{ "application/pdf": [".pdf"] }} maxFiles={1} multiple={false} maxSize={50 * 1024 * 1024} label="上传参考手册" hint="支持 PDF 格式，最大 50MB" />
      )}
    </div>
  );
}

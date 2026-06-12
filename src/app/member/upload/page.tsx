"use client";

import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2, CheckCircle, ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MemberUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  // 选择照片
  const handleSelectPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPhotos: string[] = [];
    const newFiles: File[] = [];

    files.forEach((file) => {
      if (photoFiles.length + newFiles.length >= 6) return; // 最多6张
      const url = URL.createObjectURL(file);
      newPhotos.push(url);
      newFiles.push(file);
    });

    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 6));
    setPhotoFiles((prev) => [...prev, ...newFiles].slice(0, 6));
  };

  // 拍照
  const handleCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
    }
  };

  // 从相册选择
  const handleAlbum = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.click();
    }
  };

  // 删除照片
  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 提交
  const handleSubmit = async () => {
    if (photoFiles.length === 0) return;
    setUploading(true);

    try {
      const formData = new FormData();
      photoFiles.forEach((file) => {
        formData.append("photos", file);
      });
      if (note.trim()) {
        formData.append("note", note.trim());
      }

      const res = await fetch("/api/member/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploaded(true);
      } else {
        alert(data.error || "上传失败，请重试");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setUploading(false);
    }
  };

  // 上传成功
  if (uploaded) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-2">上传成功！</h2>
        <p className="text-sm text-neutral-500 mb-6">
          我们正在为您生成品牌化内容，通常1-2小时内完成
        </p>
        <button
          onClick={() => router.push("/member/dashboard")}
          className="px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-all"
        >
          查看我的内容
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900 mb-1">拍照上传</h2>
        <p className="text-sm text-neutral-500">拍一张店里的照片，我们帮你做成品牌内容</p>
      </div>

      {/* 照片区域 */}
      <div>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {photos.length < 6 && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
              <ImagePlus className="w-6 h-6 text-neutral-300 mb-1" />
              <span className="text-xs text-neutral-400">添加</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleSelectPhotos}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleCamera}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-all"
        >
          <Camera className="w-5 h-5" />
          拍照
        </button>
        <button
          onClick={handleAlbum}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-neutral-200 text-neutral-700 font-medium rounded-xl hover:bg-neutral-50 transition-all"
        >
          <Upload className="w-5 h-5" />
          相册
        </button>
      </div>

      {/* 备注 */}
      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
          备注说明（可选）
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="比如：这是新出的酸菜鱼、店里刚装修完..."
          className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
          rows={3}
        />
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={photoFiles.length === 0 || uploading}
        className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            上传中...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            提交（{photoFiles.length}张）
          </>
        )}
      </button>

      <p className="text-xs text-neutral-400 text-center">
        每次最多6张 · 每月12条 · AI自动生成品牌化文案
      </p>
    </div>
  );
}

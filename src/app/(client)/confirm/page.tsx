"use client";

import { Suspense, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, QrCode, Phone, Key, Upload, Loader2, ImageIcon } from "lucide-react";

function PaymentContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const viewPassword = searchParams.get("viewPassword") ?? "";
  const phone = searchParams.get("phone") ?? "";

  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("请选择图片文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("图片不能超过10MB");
      return;
    }
    setScreenshotFile(file);
    setUploadError(null);
    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!screenshotFile || !projectId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", screenshotFile);
      formData.append("projectId", projectId);
      const res = await fetch("/api/payment/upload-screenshot", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "上传失败");
      }
      setUploaded(true);
    } catch (e: any) {
      setUploadError(e.message || "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      {/* 成功提示 */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <CheckCircle className="w-14 h-14 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">提交成功！</h1>
        <p className="text-neutral-500">您的 VI 设计需求已收到</p>
      </div>

      {/* 付款卡片 */}
      <div className="bg-white border-2 border-primary/20 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold text-neutral-900 mb-1">完成付款，开始设计</h2>
          <p className="text-sm text-neutral-500">扫码支付后，上传付款截图即可</p>
        </div>

        {/* 收款码区域 */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-56 h-56 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col items-center justify-center p-4">
            <QrCode className="w-20 h-20 text-neutral-300 mb-2" />
            <p className="text-xs text-neutral-400">微信扫码支付</p>
            <p className="text-[10px] text-neutral-300 mt-1">收款码待上传</p>
          </div>
        </div>

        {/* 金额 */}
        <div className="text-center mb-4">
          <span className="text-3xl font-bold text-primary">¥99</span>
          <span className="text-sm text-neutral-500 ml-1">基础版 · Logo方案+VI手册</span>
        </div>

        {/* 付款说明 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          <p className="font-medium text-amber-800 mb-2">💰 付款步骤</p>
          <ol className="space-y-1.5 text-amber-700 list-decimal list-inside">
            <li>微信扫码支付 <strong>¥99</strong>，备注您的手机号</li>
            <li>截图付款成功页面</li>
            <li>在下方上传付款截图</li>
            <li>确认后 <strong>3个工作日内</strong> 出Logo方案</li>
          </ol>
        </div>
      </div>

      {/* 上传付款截图 */}
      {!uploaded ? (
        <div className="bg-white border border-neutral-100 rounded-2xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">📷 上传付款截图</h3>
          
          {/* 选择/预览截图 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors mb-4"
          >
            {screenshotPreview ? (
              <div className="space-y-2">
                <img src={screenshotPreview} alt="付款截图预览" className="max-h-48 mx-auto rounded-lg" />
                <p className="text-xs text-neutral-400">点击重新选择</p>
              </div>
            ) : (
              <div className="py-6">
                <ImageIcon className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">点击选择付款截图</p>
                <p className="text-xs text-neutral-400 mt-1">支持 JPG/PNG，不超过10MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 上传按钮 */}
          {screenshotFile && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  确认上传付款截图
                </>
              )}
            </button>
          )}
          {uploadError && (
            <p className="mt-2 text-sm text-red-500">{uploadError}</p>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-green-700 font-medium">付款截图已上传！</p>
          <p className="text-green-600 text-sm mt-1">我们确认收款后将开始为您设计Logo</p>
          <p className="text-green-500 text-xs mt-2">预计3个工作日内出方案</p>
        </div>
      )}

      {/* 查看凭证 */}
      <div className="bg-neutral-50 rounded-xl p-5 mb-6">
        <p className="text-sm font-medium text-neutral-700 mb-3">📱 付款后如何查看方案？</p>
        <div className="space-y-3">
          {phone && (
            <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-neutral-100">
              <Phone className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">手机号</p>
                <p className="font-mono font-medium text-neutral-900">{phone}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-neutral-100">
            <Key className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-neutral-400">查看密码</p>
              <p className="font-mono font-bold text-lg tracking-widest text-amber-600">{viewPassword}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          请保存以上信息，方案完成后用手机号+查看密码登录查看
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col gap-3">
        <Link
          href="/view"
          className="w-full py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors text-center"
        >
          查看Logo方案
        </Link>
        <Link
          href="/"
          className="w-full py-2.5 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors text-center"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="animate-pulse">
          <div className="w-14 h-14 bg-neutral-200 rounded-full mx-auto mb-6" />
          <div className="h-8 bg-neutral-200 rounded w-48 mx-auto mb-4" />
          <div className="h-4 bg-neutral-200 rounded w-64 mx-auto" />
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}

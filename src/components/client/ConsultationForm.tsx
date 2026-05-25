"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  consultationSchema,
  INDUSTRY_OPTIONS,
  BUDGET_OPTIONS,
  type ConsultationFormData,
} from "@/lib/consultation-schema";
import { LogoUploadArea, MascotUploadArea, ReferenceUploadArea } from "./FileUploadArea";
import { Loader2 } from "lucide-react";

export function ConsultationForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Store actual File objects for real upload
  const [logoFileList, setLogoFileList] = useState<File[]>([]);
  const [mascotFileList, setMascotFileList] = useState<File[]>([]);
  const [referenceFileList, setReferenceFileList] = useState<File[]>([]);

  // Mascot metadata
  const [mascotNames, setMascotNames] = useState<string[]>([]);
  const [mascotPersonalities, setMascotPersonalities] = useState<string[]>([]);

  const [referenceEnabled, setReferenceEnabled] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
  });

  // Uploaded file previews are derived from File[] state directly in component renders

  // Upload a list of files to /api/upload, returns file metadata array
  async function uploadFiles(files: File[], fieldName = "files"): Promise<{ fileName: string; url: string; size: number }[]> {
    if (files.length === 0) return [];
    const formData = new FormData();
    for (const f of files) {
      formData.append(fieldName, f);
    }
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    return data.files || [];
  }

  const onSubmit = async (data: ConsultationFormData) => {
    if (logoFileList.length === 0) {
      alert("请至少上传一个品牌 Logo");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Upload all files in parallel
      const [logoAssets, mascotAssetsList, refAssets] = await Promise.all([
        uploadFiles(logoFileList),
        uploadFiles(mascotFileList, "files"),
        referenceFileList.length > 0 ? uploadFiles(referenceFileList, "files") : Promise.resolve([] as { fileName: string; url: string; size: number }[]),
      ]);

      // Step 2: Build mascot items with metadata
      const mascotItems = mascotAssetsList.map((file, i) => ({
        name: mascotNames[i] || file.fileName,
        personality: mascotPersonalities[i] || "",
        files: [file],
      }));

      // Step 3: Build reference manual
      const referenceManual = refAssets.length > 0
        ? { ...refAssets[0], pageCount: 0, isReferenceEnabled: referenceEnabled, referenceMode: (referenceEnabled ? "weak" as const : "none" as const) }
        : undefined;

      // Step 4: Submit to /api/submit
      const submitRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          logoFiles: logoAssets,
          mascotItems,
          referenceFile: referenceManual,
          referenceEnabled,
        }),
      });

      if (!submitRes.ok) {
        const errData = await submitRes.json().catch(() => ({}));
        throw new Error(errData.error || `Submit failed: ${submitRes.status}`);
      }

      const result = await submitRes.json();
      router.push(`/confirm?projectId=${result.projectId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "提交失败，请稍后重试";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ========== 基本信息 ========== */}
      <section>
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">基本信息</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* 姓名 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              联系人姓名<span className="text-danger">*</span>
            </label>
            <input
              {...register("clientName")}
              placeholder="请输入您的姓名"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.clientName && (
              <p className="mt-1 text-xs text-danger">{errors.clientName.message}</p>
            )}
          </div>

          {/* 公司 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              公司名称 <span className="text-danger">*</span>
            </label>
            <input
              {...register("companyName")}
              placeholder="请输入公司名称"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.companyName && (
              <p className="mt-1 text-xs text-danger">{errors.companyName.message}</p>
            )}
          </div>

          {/* 手机 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              联系电话 <span className="text-danger">*</span>
            </label>
            <input
              {...register("phone")}
              placeholder="请输入手机号"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-danger">{errors.phone.message}</p>
            )}
          </div>

          {/* 微信 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">微信号</label>
            <input
              {...register("wechat")}
              placeholder="选填"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* 行业 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              所属行业<span className="text-danger">*</span>
            </label>
            <select
              {...register("industry")}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            >
              <option value="">请选择行业</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {errors.industry && (
              <p className="mt-1 text-xs text-danger">{errors.industry.message}</p>
            )}
          </div>

          {/* 预算 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">预算范围</label>
            <select
              {...register("budgetRange")}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            >
              <option value="">请选择预算（选填）</option>
              {BUDGET_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 需求描述 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">需求描述</label>
          <textarea
            {...register("description")}
            rows={4}
            placeholder="请描述您的品牌情况、设计需求和期望风格（选填）"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
          )}
        </div>
      </section>

      {/* ========== 素材上传 ========== */}
      <section>
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">品牌素材</h3>
        <div className="space-y-6">
          <LogoUploadArea
            files={logoFileList}
            onAdd={(files) => setLogoFileList((prev) => [...prev, ...files].slice(0, 5))}
            onRemove={(i) => setLogoFileList((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <MascotUploadArea
            files={mascotFileList}
            names={mascotNames}
            personalities={mascotPersonalities}
            onAdd={(files) => {
              setMascotFileList((prev) => [...prev, ...files].slice(0, 10));
              setMascotNames((prev) => [...prev, ...files.map(() => "")].slice(0, 10));
              setMascotPersonalities((prev) => [...prev, ...files.map(() => "")].slice(0, 10));
            }}
            onRemove={(i) => {
              setMascotFileList((prev) => prev.filter((_, idx) => idx !== i));
              setMascotNames((prev) => prev.filter((_, idx) => idx !== i));
              setMascotPersonalities((prev) => prev.filter((_, idx) => idx !== i));
            }}
            onNameChange={(i, v) =>
              setMascotNames((prev) => prev.map((item, idx) => (idx === i ? v : item)))
            }
            onPersonalityChange={(i, v) =>
              setMascotPersonalities((prev) => prev.map((item, idx) => (idx === i ? v : item)))
            }
          />
          <ReferenceUploadArea
            file={referenceFileList[0] || null}
            referenceEnabled={referenceEnabled}
            onAdd={(files) => setReferenceFileList(files.slice(0, 1))}
            onRemove={() => setReferenceFileList([])}
            onToggleReference={setReferenceEnabled}
          />
        </div>
      </section>

      {/* ========== 提交按钮 ========== */}
      {submitError && (
        <div className="p-3 bg-danger/10 text-danger text-sm rounded-lg">{submitError}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            正在上传并提交...
          </>
        ) : (
          "提交需求"
        )}
      </button>
    </form>
  );
}

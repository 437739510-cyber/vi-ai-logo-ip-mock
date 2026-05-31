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
import { createClient } from "@supabase/supabase-js";

// File size limits (matching FileUploadArea hints)
const MAX_LOGO_SIZE = 20 * 1024 * 1024;      // 20MB
const MAX_MASCOT_SIZE = 20 * 1024 * 1024;    // 20MB
const MAX_PDF_SIZE = 50 * 1024 * 1024;       // 50MB

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_BUCKET = "brand-brain-generated";
const STORAGE_PREFIX = "uploads/form-assets";

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

  // Upload files directly to Supabase Storage from the browser.
  // Bypasses Vercel Serverless Function 4.5MB payload limit.
  async function uploadFiles(files: File[], type: "logo" | "mascot" | "pdf"): Promise<{ fileName: string; url: string; size: number }[]> {
    if (files.length === 0) return [];

    const limits: Record<string, number> = { logo: MAX_LOGO_SIZE, mascot: MAX_MASCOT_SIZE, pdf: MAX_PDF_SIZE };
    const limit = limits[type];
    for (const f of files) {
      if (f.size > limit) {
        const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
        const limitMB = (limit / (1024 * 1024)).toFixed(0);
        throw new Error(`${f.name} (${sizeMB}MB) 超过文件大小限制 (${limitMB}MB)`);
      }
    }

    const results: { fileName: string; url: string; size: number }[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "";
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 6);
      const safeName = `${timestamp}-${rand}.${ext}`;
      const storagePath = `${STORAGE_PREFIX}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        throw new Error(`上传失败: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      results.push({ fileName: file.name, url: publicUrlData.publicUrl, size: file.size });
    }
    return results;
  }

  const onSubmit = async (data: ConsultationFormData) => {
    if (logoFileList.length === 0) {
      alert("请至少上传一个品牌 Logo");
      return;
    }
    if (mascotFileList.length === 0) {
      alert("请至少上传一个 IP 公仔");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Upload all files in parallel
      const [logoAssets, mascotAssetsList, refAssets] = await Promise.all([
        uploadFiles(logoFileList, "logo"),
        uploadFiles(mascotFileList, "mascot"),
        referenceFileList.length > 0 ? uploadFiles(referenceFileList, "pdf") : Promise.resolve([] as { fileName: string; url: string; size: number }[]),
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

        {/* 品牌愿景 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            品牌愿景 <span className="text-danger">*</span>
          </label>
          <textarea
            {...register("brandVision")}
            rows={3}
            placeholder="例：成为行业领先的品牌视觉标杆，让每一个品牌都拥有专属的视觉语言"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          {errors.brandVision && (
            <p className="mt-1 text-xs text-danger">{errors.brandVision.message}</p>
          )}
        </div>

        {/* 核心价值 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            核心价值 <span className="text-danger">*</span>
          </label>
          <textarea
            {...register("coreValues")}
            rows={3}
            placeholder="例：专业品质、创新突破、客户至上、诚信责任（请用顿号分隔多个价值）"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          {errors.coreValues && (
            <p className="mt-1 text-xs text-danger">{errors.coreValues.message}</p>
          )}
        </div>

        {/* 目标市场 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            目标市场 <span className="text-danger">*</span>
          </label>
          <textarea
            {...register("targetMarket")}
            rows={3}
            placeholder="例：25-45岁追求品质生活的都市白领，注重品牌调性的中高端消费群体"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          {errors.targetMarket && (
            <p className="mt-1 text-xs text-danger">{errors.targetMarket.message}</p>
          )}
        </div>
      </section>

      {/* ========== 素材上传 ========== */}
      <section>
      {/* ========== 品牌色选择 ========== */}
      <section className="mt-8">
        <h3 className="text-lg font-semibold text-neutral-900 mb-3">品牌色调</h3>
        <p className="text-xs text-neutral-500 mb-4">选择您品牌的主色、辅助色和强调色，AI 生成时会优先使用这些颜色。</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">主色</label>
            <input type="color" defaultValue="#1A73E8" {...register("brandColors.primary")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">辅助色</label>
            <input type="color" defaultValue="#34A853" {...register("brandColors.secondary")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">强调色</label>
            <input type="color" defaultValue="#FBBC04" {...register("brandColors.accent")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" />
          </div>
        </div>
      </section>

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

          {/* LOGO 设计理念 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              LOGO 设计理念 <span className="text-neutral-400 text-xs">（选填，AI 会自动分析）</span>
            </label>
            <textarea
              {...register("logoPhilosophy")}
              rows={3}
              placeholder="描述您的 LOGO 设计思路、图形含义、色彩选择原因等。如不填写，AI 将根据上传的 LOGO 图片自动分析生成。"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            {errors.logoPhilosophy && (
              <p className="mt-1 text-xs text-danger">{errors.logoPhilosophy.message}</p>
            )}
          </div>

          {/* IP 公仔设计理念 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              IP 公仔设计理念 <span className="text-neutral-400 text-xs">（选填，AI 会自动分析）</span>
            </label>
            <textarea
              {...register("mascotPhilosophy")}
              rows={3}
              placeholder="描述您的 IP 公仔设计思路、角色设定、性格特点等。如不填写，AI 将根据上传的 IP 公仔图片自动分析生成。"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            {errors.mascotPhilosophy && (
              <p className="mt-1 text-xs text-danger">{errors.mascotPhilosophy.message}</p>
            )}
          </div>
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




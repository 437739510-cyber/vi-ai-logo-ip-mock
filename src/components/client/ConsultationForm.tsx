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
import { submitConsultation } from "@/lib/mock";
import { LogoUploadArea, MascotUploadArea, ReferenceUploadArea } from "./FileUploadArea";
import { Loader2 } from "lucide-react";

interface UploadedFile {
  name: string;
  size: number;
}

interface MascotItem extends UploadedFile {
  name_value: string;
  personality_value: string;
}

export function ConsultationForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 文件状态
  const [logoFiles, setLogoFiles] = useState<UploadedFile[]>([]);
  const [mascotItems, setMascotItems] = useState<MascotItem[]>([]);
  const [referenceFile, setReferenceFile] = useState<UploadedFile | null>(null);
  const [referenceEnabled, setReferenceEnabled] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
  });

  // 文件添加处理
  const addLogoFiles = (files: File[]) => {
    const newFiles = files.map((f) => ({ name: f.name, size: f.size }));
    setLogoFiles((prev) => [...prev, ...newFiles].slice(0, 5));
  };

  const addMascotFiles = (files: File[]) => {
    const newItems = files.map((f) => ({
      name: f.name,
      size: f.size,
      name_value: "",
      personality_value: "",
    }));
    setMascotItems((prev) => [...prev, ...newItems].slice(0, 10));
  };

  const addReferenceFile = (files: File[]) => {
    if (files.length > 0) {
      setReferenceFile({ name: files[0].name, size: files[0].size });
    }
  };

  // 提交处理
  const onSubmit = async (data: ConsultationFormData) => {
    // 验证至少上传了 LOGO
    if (logoFiles.length === 0) {
      alert("请至少上传一个品牌 Logo");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitConsultation({
        ...data,
        logoFiles: logoFiles.map((f) => f.name),
        mascotItems: mascotItems.map((m) => ({
          name: m.name,
          name_value: m.name_value,
          personality: m.personality_value,
        })),
        referenceFile: referenceFile?.name ?? null,
        referenceEnabled,
      });

      // 跳转到确认页
      router.push(`/confirm?projectId=${result.projectId}`);
    } catch {
      setSubmitError("提交失败，请稍后重试");
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
              联系人姓名 <span className="text-danger">*</span>
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
              所属行业 <span className="text-danger">*</span>
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
            files={logoFiles}
            onAdd={addLogoFiles}
            onRemove={(i) => setLogoFiles((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <MascotUploadArea
            items={mascotItems}
            onAdd={addMascotFiles}
            onRemove={(i) => setMascotItems((prev) => prev.filter((_, idx) => idx !== i))}
            onNameChange={(i, v) =>
              setMascotItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, name_value: v } : item)))
            }
            onPersonalityChange={(i, v) =>
              setMascotItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, personality_value: v } : item)))
            }
          />
          <ReferenceUploadArea
            file={referenceFile}
            referenceEnabled={referenceEnabled}
            onAdd={addReferenceFile}
            onRemove={() => setReferenceFile(null)}
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
            提交中...
          </>
        ) : (
          "提交需求"
        )}
      </button>
    </form>
  );
}

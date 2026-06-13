"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  consultationSchema,
  INDUSTRY_CATEGORIES,
  INDUSTRY_OPTIONS,
  BUDGET_OPTIONS,
  INDUSTRY_HIGHLIGHT_MAP,
  INDUSTRY_VISION_MAP,
  CUSTOMER_PROFILE_OPTIONS,
  BUSINESS_FORM_OPTIONS,
  normalizeIndustry,
  type ConsultationFormData,
} from "@/lib/consultation-schema";
import { PROVINCE_CITY_DATA, PROVINCE_OPTIONS } from "@/lib/province-city-data";
import { LogoUploadArea, MascotUploadArea, ReferenceUploadArea } from "./FileUploadArea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// File size limits (matching FileUploadArea hints)
const MAX_LOGO_SIZE = 20 * 1024 * 1024;      // 20MB
const MAX_MASCOT_SIZE = 20 * 1024 * 1024;    // 20MB
const MAX_PDF_SIZE = 50 * 1024 * 1024;       // 50MB
const STORAGE_BUCKET = "brand-brain-generated";
const STORAGE_PREFIX = "uploads/form-assets";

export function ConsultationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "basic";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);

  // Store actual File objects for real upload
  const [logoFileList, setLogoFileList] = useState<File[]>([]);
  const [mascotFileList, setMascotFileList] = useState<File[]>([]);
  const [referenceFileList, setReferenceFileList] = useState<File[]>([]);

  // Mascot metadata
  const [mascotNames, setMascotNames] = useState<string[]>([]);
  const [mascotPersonalities, setMascotPersonalities] = useState<string[]>([]);

  const [referenceEnabled, setReferenceEnabled] = useState(true);

  // V14: New field states
  const [selectedIndustryCategory, setSelectedIndustryCategory] = useState("");
  const [selectedIndustrySub, setSelectedIndustrySub] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [showIndustryCustom, setShowIndustryCustom] = useState(false);
  const [selectedBusinessForm, setSelectedBusinessForm] = useState("");
  const [highlightTags, setHighlightTags] = useState<string[]>([]);
  const [visionTags, setVisionTags] = useState<string[]>([]);
  const [selectedCustomerProfiles, setSelectedCustomerProfiles] = useState<string[]>([]);
  const [showExistingColor, setShowExistingColor] = useState(false);
  const [highlightText, setHighlightText] = useState("");
  const [visionText, setVisionText] = useState("");
  const [existingColorText, setExistingColorText] = useState("");

  // Province/City state
  const [selectedProvince, setSelectedProvince] = useState("");
  const [cityOptions, setCityOptions] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
  });

  // Province change handler
  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province);
    setValue("province", province);
    setValue("city", "");
    setCityOptions(province ? (PROVINCE_CITY_DATA[province] || []) : []);
  };

  // Prefill from interview
  useEffect(() => {
    const fromInterview = searchParams.get("from") === "interview";
    const sid = searchParams.get("sid");
    if (!fromInterview || !sid) return;

    setPrefillLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("submissions")
          .select("*")
          .eq("id", sid)
          .single();

        if (error || !data) {
          console.warn("Prefill: submission not found", error);
          return;
        }

        // Prefill form fields from interview data
        if (data.company_name) setValue("companyName", data.company_name);
        if (data.industry) {
          const normalized = normalizeIndustry(data.industry);
          setValue("industry", normalized);
          if (normalized.includes(":")) {
            const [cat, sub] = normalized.split(":");
            setSelectedIndustryCategory(cat);
            setSelectedIndustrySub(sub);
            setSelectedIndustry(normalized);
            const hl = INDUSTRY_HIGHLIGHT_MAP[normalized];
            if (hl) setHighlightTags(hl.tags);
            const vn = INDUSTRY_VISION_MAP[normalized];
            if (vn) setVisionTags(vn.tags);
          } else {
            setSelectedIndustry(data.industry);
          }
        }
        if (data.brand_vision) setValue("brandVision", data.brand_vision);
        if (data.core_values) setValue("coreValues", data.core_values);
        if (data.target_market) setValue("targetMarket", data.target_market);
        if (data.logo_philosophy) setValue("logoPhilosophy", data.logo_philosophy);
        if (data.mascot_philosophy) setValue("mascotPhilosophy", data.mascot_philosophy);
        if (data.description) setValue("description", data.description);
        if (data.main_products) setValue("mainProducts", data.main_products);
        if (data.province) {
          handleProvinceChange(data.province);
          if (data.city) setValue("city", data.city);
        }
        // Prefill brand colors
        if (data.brand_colors) {
          try {
            const bc = typeof data.brand_colors === "string" ? JSON.parse(data.brand_colors) : data.brand_colors;
            if (bc.primary) setValue("brandColors.primary", bc.primary);
            if (bc.secondary) setValue("brandColors.secondary", bc.secondary);
            if (bc.accent) setValue("brandColors.accent", bc.accent);
          } catch (e) { console.warn("Prefill brandColors failed:", e); }
        }
      } catch (e) {
        console.warn("Prefill failed:", e);
      } finally {
        setPrefillLoading(false);
      }
    })();
  }, [searchParams]);

  // Upload files directly to Supabase Storage from the browser.
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
    // Logo and Mascot uploads are optional - checks removed

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
      // 推荐码：从URL ?ref=STU001 抓取学生ID
      const studentId = searchParams.get("ref") || "";

      const submitRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          logoFiles: logoAssets,
          mascotItems,
          referenceFile: referenceManual,
          referenceEnabled,
          studentId,
        }),
      });

      if (!submitRes.ok) {
        const errData = await submitRes.json().catch(() => ({}));
        throw new Error(errData.error || `Submit failed: ${submitRes.status}`);
      }

      const result = await submitRes.json();
      router.push(`/confirm?projectId=${result.projectId}&viewPassword=${result.viewPassword || ""}&phone=${encodeURIComponent(data.phone || "")}&plan=${plan}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "提交失败，请稍后重试";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (prefillLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-neutral-500">正在加载访谈数据...</span>
      </div>
    );
  }

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

          {/* 公司/店铺名 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              公司名或店铺名 <span className="text-danger">*</span>
            </label>
            <input
              {...register("companyName")}
              placeholder="请输入公司名或店铺名"
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

          {/* 省份 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              所在省份 <span className="text-danger">*</span>
            </label>
            <select
              {...register("province")}
              value={selectedProvince}
              onChange={(e) => handleProvinceChange(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            >
              <option value="">请选择省份</option>
              {PROVINCE_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {errors.province && (
              <p className="mt-1 text-xs text-danger">{errors.province.message}</p>
            )}
          </div>

          {/* 城市 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              所在城市 <span className="text-danger">*</span>
            </label>
            <select
              {...register("city")}
              disabled={!selectedProvince}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              <option value="">{selectedProvince ? "请选择城市" : "请先选择省份"}</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.city && (
              <p className="mt-1 text-xs text-danger">{errors.city.message}</p>
            )}
          </div>

          {/* 行业 - V14 二级联动 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              所属行业<span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedIndustryCategory}
                onChange={(e) => {
                  const cat = e.target.value;
                  setSelectedIndustryCategory(cat);
                  setSelectedIndustrySub("");
                  setSelectedIndustry("");
                  setValue("industry", "");
                  setShowIndustryCustom(false);
                  setHighlightTags([]);
                  setVisionTags([]);
                }}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              >
                <option value="">选择大类</option>
                {Object.keys(INDUSTRY_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={selectedIndustrySub}
                disabled={!selectedIndustryCategory}
                onChange={(e) => {
                  const sub = e.target.value;
                  setSelectedIndustrySub(sub);
                  const fullIndustry = selectedIndustryCategory ? `${selectedIndustryCategory}:${sub}` : sub;
                  setSelectedIndustry(fullIndustry);
                  setShowIndustryCustom(sub === "（自定义填写）");
                  setValue("industry", fullIndustry);
                  // Update highlight/vision tags
                  const hl = INDUSTRY_HIGHLIGHT_MAP[fullIndustry];
                  if (hl) setHighlightTags(hl.tags);
                  else setHighlightTags([]);
                  const vn = INDUSTRY_VISION_MAP[fullIndustry];
                  if (vn) setVisionTags(vn.tags);
                  else setVisionTags([]);
                }}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
              >
                <option value="">{selectedIndustryCategory ? "选择子类" : "请先选大类"}</option>
                {selectedIndustryCategory && INDUSTRY_CATEGORIES[selectedIndustryCategory]?.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            <input type="hidden" {...register("industry")} name="industry" />
            {errors.industry && (
              <p className="mt-1 text-xs text-danger">{errors.industry.message}</p>
            )}
            {showIndustryCustom && (
              <input
                {...register("industryCustom")}
                placeholder="请描述您的行业，如：管道疏通/家政服务"
                className="mt-2 w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
          </div>

          {/* 经营形态 - V14 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              经营形态<span className="text-neutral-400 text-xs">（选填）</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_FORM_OPTIONS.map((form) => (
                <button
                  key={form}
                  type="button"
                  onClick={() => {
                    setSelectedBusinessForm(form);
                    setValue("businessForm", form);
                  }}
                  className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${
                    selectedBusinessForm === form
                      ? "bg-primary text-white border-primary"
                      : "border-neutral-200 text-neutral-600 hover:bg-primary hover:text-white hover:border-primary"
                  }`}
                >
                  {form}
                </button>
              ))}
            </div>
            <input type="hidden" {...register("businessForm")} name="businessForm" />
          </div>

          {/* 主营产品 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              主营产品<span className="text-neutral-400 text-xs">（选填，如：汉堡、炸鸡、可乐）</span>
            </label>
            <input
              {...register("mainProducts")}
              placeholder="填写主要产品或服务，帮助AI更精准设计"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* 经营年限 V13 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              经营年限<span className="text-neutral-400 text-xs">（选填）</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                {...register("businessYears", { valueAsNumber: true })}
                min={0}
                max={200}
                placeholder="如：15"
                className="w-24 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-sm text-neutral-500">年</span>
            </div>
          </div>

          {/* 品牌独特点 V13 */}
          {selectedIndustry && INDUSTRY_HIGHLIGHT_MAP[selectedIndustry] && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              {INDUSTRY_HIGHLIGHT_MAP[selectedIndustry].question}
              <span className="text-neutral-400 text-xs">（选填，点选或自己写）</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {highlightTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = highlightText ? highlightText + "、" + tag : tag;
                    setHighlightText(next);
                    setValue("brandHighlight", next);
                  }}
                  className="px-3 py-1 text-xs border border-neutral-200 rounded-full text-neutral-600 hover:bg-primary hover:text-white hover:border-primary transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
            <input
              {...register("brandHighlight")}
              name="brandHighlight"
              placeholder="点选上方标签或自己写..."
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          )}

          {/* 客户群体 V13 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              您最常见的客人是什么样的？<span className="text-neutral-400 text-xs">（选填，可多选）</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CUSTOMER_PROFILE_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSelectedCustomerProfiles(prev => {
                      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag];
                      setValue("customerProfile", next.join("、"));
                      return next;
                    });
                  }}
                  className={`px-3 py-1 text-xs border rounded-full transition-colors ${
                    selectedCustomerProfiles.includes(tag)
                      ? "bg-primary text-white border-primary"
                      : "border-neutral-200 text-neutral-600 hover:bg-primary hover:text-white hover:border-primary"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 现有门头色 V13 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              您现在店招/门头的颜色？<span className="text-neutral-400 text-xs">（选填）</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {["红色系", "橙色系", "黄色系", "绿色系", "蓝色系", "紫色系", "棕色系", "黑色系", "白色系"].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { setExistingColorText(color); setValue("existingBrandColor", color); }}
                  className={`px-3 py-1 text-xs border rounded-full transition-colors ${
                    existingColorText === color
                      ? "bg-primary text-white border-primary"
                      : "border-neutral-200 text-neutral-600 hover:bg-primary hover:text-white hover:border-primary"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
            <input
              type="hidden"
              {...register("existingBrandColor")}
              name="existingBrandColor"
            />
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

        {/* 品牌愿景 V13: 动态话术+标签 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {selectedIndustry && INDUSTRY_VISION_MAP[selectedIndustry]
              ? INDUSTRY_VISION_MAP[selectedIndustry].question
              : "品牌愿景"}
            <span className="text-neutral-400 text-xs">（选填，点选或自己写）</span>
          </label>
          {visionTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {visionTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = visionText ? visionText + "、" + tag : tag;
                    setVisionText(next);
                    setValue("brandVision", next);
                  }}
                  className="px-3 py-1 text-xs border border-neutral-200 rounded-full text-neutral-600 hover:bg-primary hover:text-white hover:border-primary transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <textarea
            {...register("brandVision")}
            name="brandVision"
            rows={3}
            placeholder={selectedIndustry && INDUSTRY_VISION_MAP[selectedIndustry]
              ? "点选上方标签或自己写..."
              : "例：成为行业领先的品牌视觉标杆"}
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
        <p className="text-xs text-neutral-500 mb-4">选择您品牌的主色、辅助色和强调色。如不确定可留白，AI 会根据行业和素材自动推荐品牌色。</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">主色</label>
            <input type="color" defaultValue="#FFFFFF" {...register("brandColors.primary")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">辅助色</label>
            <input type="color" defaultValue="#FFFFFF" {...register("brandColors.secondary")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">强调色</label>
            <input type="color" defaultValue="#FFFFFF" {...register("brandColors.accent")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" />
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

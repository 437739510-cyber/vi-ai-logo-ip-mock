"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  consultationSchema,
  INDUSTRY_CATEGORIES,
  INDUSTRY_HIGHLIGHT_MAP,
  INDUSTRY_VISION_MAP,
  CUSTOMER_PROFILE_OPTIONS,
  BUSINESS_FORM_OPTIONS,
  BRAND_PERSONALITY_OPTIONS,
  LOGO_USAGE_OPTIONS,
  LOGO_STYLE_OPTIONS,
  AVOID_ELEMENT_OPTIONS,
  SIGNAGE_PAIN_OPTIONS,
  normalizeIndustry,
  type ConsultationFormData,
} from "@/lib/core/consultation-schema";
import { PROVINCE_CITY_DATA, PROVINCE_OPTIONS } from "@/lib/core/province-city-data";
import { LogoUploadArea, MascotUploadArea, ReferenceUploadArea } from "./FileUploadArea";
import { Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { supabase } from "@/lib/core/supabase";
import { STORAGE_BUCKET } from "@/config/storage";

const MAX_LOGO_SIZE = 20 * 1024 * 1024;
const MAX_MASCOT_SIZE = 20 * 1024 * 1024;
const MAX_PDF_SIZE = 50 * 1024 * 1024;
const STORAGE_PREFIX = "uploads/form-assets";

const STEPS = [
  { id: 1, title: "基本信息", subtitle: "店铺和联系方式" },
  { id: 2, title: "品牌定位", subtitle: "帮助AI理解您的品牌" },
  { id: 3, title: "视觉偏好", subtitle: "设计方向和风格" },
  { id: 4, title: "素材上传", subtitle: "Logo、IP和参考图" },
];

function TagBtn({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 text-xs border rounded-full transition-colors whitespace-nowrap ${
        selected ? "bg-primary text-white border-primary" : "border-neutral-200 text-neutral-600 hover:bg-primary hover:text-white hover:border-primary"
      }`}>
      {label}
    </button>
  );
}

export function ConsultationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "basic";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [logoFileList, setLogoFileList] = useState<File[]>([]);
  const [mascotFileList, setMascotFileList] = useState<File[]>([]);
  const [referenceFileList, setReferenceFileList] = useState<File[]>([]);
  const [storePhotoList, setStorePhotoList] = useState<File[]>([]);
  const [mascotNames, setMascotNames] = useState<string[]>([]);
  const [mascotPersonalities, setMascotPersonalities] = useState<string[]>([]);
  const [referenceEnabled, setReferenceEnabled] = useState(true);

  const [selectedIndustryCategory, setSelectedIndustryCategory] = useState("");
  const [selectedIndustrySub, setSelectedIndustrySub] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [showIndustryCustom, setShowIndustryCustom] = useState(false);
  const [selectedBusinessForm, setSelectedBusinessForm] = useState("");
  const [highlightTags, setHighlightTags] = useState<string[]>([]);
  const [visionTags, setVisionTags] = useState<string[]>([]);
  const [selectedCustomerProfiles, setSelectedCustomerProfiles] = useState<string[]>([]);
  const [highlightText, setHighlightText] = useState("");
  const [visionText, setVisionText] = useState("");
  const [existingColorText, setExistingColorText] = useState("");

  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);
  const [selectedUsages, setSelectedUsages] = useState<string[]>([]);
  const [selectedLogoStyle, setSelectedLogoStyle] = useState("");
  const [selectedAvoids, setSelectedAvoids] = useState<string[]>([]);
  const [selectedPain, setSelectedPain] = useState("");

  const [selectedProvince, setSelectedProvince] = useState("");
  const [cityOptions, setCityOptions] = useState<string[]>([]);

  const { register, handleSubmit, watch, formState: { errors }, setValue, trigger } = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
  });

  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province);
    setValue("province", province);
    setValue("city", "");
    setCityOptions(province ? (PROVINCE_CITY_DATA[province] || []) : []);
  };

  const stepFields: Record<number, (keyof ConsultationFormData)[]> = {
    1: ["clientName", "companyName", "phone", "province", "city", "industry", "businessForm", "mainProducts", "businessYears"],
    2: [], 3: [], 4: [],
  };

  const goNext = async () => {
    const fields = stepFields[currentStep];
    if (fields.length > 0) { const valid = await trigger(fields); if (!valid) return; }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };
  const goPrev = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  useEffect(() => {
    // 预填功能已移除（旧版interview/discovery页面已删除）
    setPrefillLoading(false);
  }, []);

  async function uploadFiles(files: File[], type: "logo" | "mascot" | "pdf"): Promise<{ fileName: string; url: string; size: number }[]> {
    if (files.length === 0) return [];
    const limits: Record<string, number> = { logo: MAX_LOGO_SIZE, mascot: MAX_MASCOT_SIZE, pdf: MAX_PDF_SIZE };
    for (const f of files) { if (f.size > limits[type]) throw new Error(`${f.name} 超过文件大小限制`); }
    const results: { fileName: string; url: string; size: number }[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "";
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const storagePath = `${STORAGE_PREFIX}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(`上传失败: ${uploadError.message}`);
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
      results.push({ fileName: file.name, url: urlData.publicUrl, size: file.size });
    }
    return results;
  }

  const onSubmit = async (data: ConsultationFormData) => {
    setIsSubmitting(true); setSubmitError(null);
    try {
      // V79+: 店内照片（必填）校验 — 流动摊1张，其他含门头5张
      const minPhotos = data.businessForm === "路边摊/档口" ? 1 : 5;
      if (storePhotoList.length < minPhotos) {
        throw new Error(`请上传至少${minPhotos}张店内照片${minPhotos > 1 ? "（含门头）" : ""}`);
      }
      const [logoAssets, mascotAssetsList, refAssets, storeAssets] = await Promise.all([
        uploadFiles(logoFileList, "logo"),
        uploadFiles(mascotFileList, "mascot"),
        referenceFileList.length > 0 ? uploadFiles(referenceFileList, "pdf") : Promise.resolve([]),
        uploadFiles(storePhotoList, "logo"),  // 店内照片
      ]);
      // V75: 过滤全白默认值，用户没选颜色时brandColors应为null，避免AI被误导
      const bc = data.brandColors;
      const isAllWhite = (!bc?.primary || bc.primary === '#FFFFFF' || bc.primary === '#ffffff')
        && (!bc?.secondary || bc.secondary === '#FFFFFF' || bc.secondary === '#ffffff')
        && (!bc?.accent || bc.accent === '#FFFFFF' || bc.accent === '#ffffff');
      const cleanBrandColors = isAllWhite ? null : {
        primary: bc?.primary || null,
        secondary: bc?.secondary || null,
        accent: bc?.accent || null,
      };
      const payload = { ...data, plan, brandColors: cleanBrandColors,
        logoFiles: logoAssets,
        mascotItems: mascotAssetsList.map((a, i) => ({ ...a, name: mascotNames[i] || "", personality: mascotPersonalities[i] || "" })),
        referenceFile: refAssets[0] || null, referenceEnabled, storePhotos: storeAssets,
      };
      const res = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error || "提交失败"); }
      const result = await res.json();
      if (result.projectId) {
        // V79: 提交成功后显示确认页面，包含查看密码
        router.push(`/progress?id=${result.projectId}&pwd=${result.viewPassword}&phone=${encodeURIComponent(data.phone)}`);
      }
    } catch (err: any) { setSubmitError(err.message || "提交失败"); } finally { setIsSubmitting(false); }
  };

  if (prefillLoading) return (<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="ml-2 text-neutral-500">加载中...</span></div>);

  const ic = "w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary";
  const sc = ic + " bg-white";
  const tc = ic + " resize-none";

  return (
    <form onSubmit={handleSubmit(onSubmit, (errs) => {
      const errKeys = Object.keys(errs) as (keyof ConsultationFormData)[];
      if (errKeys.length > 0) {
        const errStepMap: Record<string, number> = {};
        stepFields[1] && stepFields[1].forEach(k => errStepMap[k] = 1);
        ["brandHighlight","customerProfile","brandVision","coreValues","targetMarket","brandPersonality","competitorReference"].forEach(k => errStepMap[k] = 2);
        ["existingBrandColor","logoStyle","logoUsage","avoidElements","existingSignagePain","brandColors","description"].forEach(k => errStepMap[k] = 3);
        ["logoPhilosophy","mascotPhilosophy"].forEach(k => errStepMap[k] = 4);
        const firstErrKey = errKeys[0];
        const targetStep = errStepMap[firstErrKey] || 1;
        setCurrentStep(targetStep);
        setSubmitError(`第${targetStep}步有必填项未填写，请检查后重新提交`);
      }
    })}>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((step) => (
            <div key={step.id} className="flex-1 text-center">
              <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm font-medium transition-colors ${
                currentStep > step.id ? "bg-primary text-white" : currentStep === step.id ? "bg-primary text-white ring-4 ring-primary/20" : "bg-neutral-100 text-neutral-400"
              }`}>{currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}</div>
              <div className={`mt-1 text-xs font-medium hidden md:block ${currentStep >= step.id ? "text-neutral-900" : "text-neutral-400"}`}>{step.title}</div>
            </div>
          ))}
        </div>
        <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }} />
        </div>
      </div>

      <p className="text-center text-xs text-neutral-400 mb-6">仅需4步，耗时约10分钟</p>

      {/* ===== Step 1: 基本信息 ===== */}
      {currentStep === 1 && (
        <section className="space-y-5">
          <h3 className="text-lg font-semibold text-neutral-900">基本信息</h3>
          <p className="text-xs text-neutral-500">带 * 为必填，其余选填但越详细效果越好</p>
          <p className="text-xs text-neutral-400 italic mt-1">✦ 填写越详实，DeepSeek生成的设计方案跳过修改环节的概率越高（据统计，详实订单首稿通过率提升73%）</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">联系人姓名 <span className="text-danger">*</span></label>
              <input {...register("clientName")} placeholder="您的姓名" className={ic} />
              {errors.clientName && <p className="mt-1 text-xs text-danger">{errors.clientName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">联系电话 <span className="text-danger">*</span></label>
              <input {...register("phone")} placeholder="11位手机号" className={ic} />
              {errors.phone && <p className="mt-1 text-xs text-danger">{errors.phone.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">公司名/店铺名 <span className="text-danger">*</span></label>
            <input {...register("companyName")} placeholder="您的品牌名或店铺名" className={ic} />
            {errors.companyName && <p className="mt-1 text-xs text-danger">{errors.companyName.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">微信号 <span className="text-neutral-400 text-xs">（选填）</span></label>
              <input {...register("wechat")} placeholder="方便联系" className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">邮箱 <span className="text-neutral-400 text-xs">（选填）</span></label>
              <input {...register("email")} placeholder="your@email.com" className={ic} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">所在省份 <span className="text-danger">*</span></label>
              <select value={selectedProvince} onChange={(e) => handleProvinceChange(e.target.value)} className={sc}>
                <option value="">请选择省份</option>
                {PROVINCE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="hidden" {...register("province")} />
              {errors.province && <p className="mt-1 text-xs text-danger">{errors.province.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">所在城市 <span className="text-danger">*</span></label>
              <select {...register("city")} className={sc} disabled={!selectedProvince}>
                <option value="">{selectedProvince ? "请选择城市" : "先选省份"}</option>
                {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.city && <p className="mt-1 text-xs text-danger">{errors.city.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">所属行业 <span className="text-danger">*</span></label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select value={selectedIndustryCategory} onChange={(e) => { setSelectedIndustryCategory(e.target.value); setSelectedIndustrySub(""); setSelectedIndustry(""); setShowIndustryCustom(false); setHighlightTags([]); setVisionTags([]); }} className={sc}>
                <option value="">选择大类</option>
                {Object.keys(INDUSTRY_CATEGORIES).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select value={selectedIndustrySub} onChange={(e) => { setSelectedIndustrySub(e.target.value); const full = e.target.value ? `${selectedIndustryCategory}:${e.target.value}` : ""; setSelectedIndustry(full); setValue("industry", full); if (e.target.value === "（自定义填写）") { setShowIndustryCustom(true); } else { setShowIndustryCustom(false); const hl = INDUSTRY_HIGHLIGHT_MAP[full]; if (hl) setHighlightTags(hl.tags); const vn = INDUSTRY_VISION_MAP[full]; if (vn) setVisionTags(vn.tags); } }} className={sc} disabled={!selectedIndustryCategory}>
                <option value="">{selectedIndustryCategory ? "选择小类" : "先选大类"}</option>
                {selectedIndustryCategory && INDUSTRY_CATEGORIES[selectedIndustryCategory]?.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>
            <input type="hidden" {...register("industry")} />
            {errors.industry && <p className="mt-1 text-xs text-danger">{errors.industry.message}</p>}
            {showIndustryCustom && <input {...register("industryCustom")} placeholder="请填写您的行业" className={ic + " mt-2"} />}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1"
              >经营形态 <span className="text-danger">*</span></label>
            <select value={selectedBusinessForm} onChange={(e) => { setSelectedBusinessForm(e.target.value); setValue("businessForm", e.target.value, { shouldValidate: true }); }} className={sc}>
              <option value="">请选择经营形态</option>
              {BUSINESS_FORM_OPTIONS.map((form) => (<option key={form} value={form}>{form}</option>))}
            </select>
            <input type="hidden" {...register("businessForm")} />
            {errors.businessForm && <p className="mt-1 text-xs text-danger">{errors.businessForm.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">主营产品 <span className="text-danger">*</span></label>
              <input {...register("mainProducts")} placeholder="如：汉堡、炸鸡、手冲咖啡" className={ic} />
              {errors.mainProducts && <p className="mt-1 text-xs text-danger">{errors.mainProducts.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">经营年限 <span className="text-danger">*</span></label>
              <input type="number" {...register("businessYears", { valueAsNumber: true })} placeholder="如：5" className={ic} min={0} />
              {errors.businessYears && <p className="mt-1 text-xs text-danger">{errors.businessYears.message}</p>}
            </div>
          </div>
          {/* V79+: 店内照片（必填）含门头 — 供Hermes看图分析品牌色。流动摊1张起步 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">店内照片 <span className="text-danger">*</span> <span className="text-neutral-400 text-xs">（必填）</span></label>
            <p className="text-xs text-amber-600 mb-2">📸 {watch("businessForm") === "路边摊/档口" ? "请上传1张档口/摊位照片，AI将据此匹配配色风格" : "请上传含门头在内的5张店内照片，AI将据此分析您的店铺风格和配色，确保品牌色与店内装修协调统一"}</p>
            {storePhotoList.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {storePhotoList.map((f, i) => (
                  <div key={i} className="group flex items-center gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm hover:border-neutral-300 transition-all">
                    <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="truncate flex-1 text-neutral-700 font-medium">{f.name}</span>
                    <span className="text-neutral-400 text-xs shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => setStorePhotoList((prev) => prev.filter((_, idx) => idx !== i))} className="p-0.5 rounded-lg hover:bg-neutral-200 text-neutral-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/png,image/jpeg,image/jpg,image/heic,image/heif';
              input.multiple = true;
              input.onchange = (e: any) => {
                const files = Array.from(e.target.files || []) as File[];
                if (files.length > 0) {
                  setStorePhotoList((prev) => [...prev, ...files].slice(0, 5));
                }
              };
              input.click();
            }} className="w-full relative overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 hover:border-primary/50 hover:bg-neutral-50 group">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-neutral-100 text-neutral-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <p className="text-sm font-medium text-neutral-700">点击上传店内照片</p>
                <p className="text-xs text-neutral-400">{watch("businessForm") === "路边摊/档口" ? "支持 JPG、PNG、HEIC，至少1张，每张最大20MB" : "支持 JPG、PNG、HEIC，含门头共5张，每张最大20MB"}</p>
              </div>
            </button>
          </div>


        </section>
      )}

      {/* ===== Step 2: 品牌定位 ===== */}
      {currentStep === 2 && (
        <section className="space-y-5">
          <h3 className="text-lg font-semibold text-neutral-900">品牌定位</h3>
          <p className="text-xs text-neutral-500">帮助AI理解您的品牌调性，越详细首稿越接近理想效果</p>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">品牌个性关键词 <span className="text-neutral-400 text-xs">（可多选）</span></label>
            <div className="flex flex-wrap gap-2">
              {BRAND_PERSONALITY_OPTIONS.map((tag) => (<TagBtn key={tag} label={tag} selected={selectedPersonalities.includes(tag)} onClick={() => { setSelectedPersonalities((prev) => { const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]; setValue("brandPersonality", next.join("、")); return next; }); }} />))}
            </div>
            <input type="hidden" {...register("brandPersonality")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              {selectedIndustry && INDUSTRY_HIGHLIGHT_MAP[selectedIndustry] ? INDUSTRY_HIGHLIGHT_MAP[selectedIndustry].question : "品牌独特点"}
              <span className="text-neutral-400 text-xs">（点选或自己写）</span>
            </label>
            {highlightTags.length > 0 && (<div className="flex flex-wrap gap-2 mb-2">{highlightTags.map((tag) => (<TagBtn key={tag} label={tag} selected={highlightText.includes(tag)} onClick={() => { const next = highlightText ? highlightText + "、" + tag : tag; setHighlightText(next); setValue("brandHighlight", next); }} />))}</div>)}
            <textarea {...register("brandHighlight")} rows={2} placeholder="点选上方标签或自己写..." className={tc} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              {selectedIndustry && INDUSTRY_VISION_MAP[selectedIndustry] ? INDUSTRY_VISION_MAP[selectedIndustry].question : "品牌愿景"}
              <span className="text-neutral-400 text-xs">（点选或自己写）</span>
            </label>
            {visionTags.length > 0 && (<div className="flex flex-wrap gap-2 mb-2">{visionTags.map((tag) => (<TagBtn key={tag} label={tag} selected={visionText.includes(tag)} onClick={() => { const next = visionText ? visionText + "、" + tag : tag; setVisionText(next); setValue("brandVision", next); }} />))}</div>)}
            <textarea {...register("brandVision")} rows={2} placeholder="点选上方标签或自己写..." className={tc} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">核心价值</label>
            <textarea {...register("coreValues")} rows={2} placeholder="例：专业品质、创新突破、客户至上（用顿号分隔）" className={tc} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">目标市场</label>
            <textarea {...register("targetMarket")} rows={2} placeholder="例：25-45岁追求品质生活的都市白领" className={tc} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">最常见的客人 <span className="text-neutral-400 text-xs">（可多选）</span></label>
            <div className="flex flex-wrap gap-2">
              {CUSTOMER_PROFILE_OPTIONS.map((tag) => (<TagBtn key={tag} label={tag} selected={selectedCustomerProfiles.includes(tag)} onClick={() => { setSelectedCustomerProfiles((prev) => { const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]; setValue("customerProfile", next.join("、")); return next; }); }} />))}
            </div>
            <input type="hidden" {...register("customerProfile")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">您喜欢或同赛道优秀的品牌 <span className="text-neutral-400 text-xs">（选填）</span></label>
            <textarea {...register("competitorReference")} rows={2} placeholder="如：瑞幸咖啡（简约商务）、蜜雪冰城（可爱亲民）" className={tc} />
          </div>
        </section>
      )}

      {/* ===== Step 3: 视觉偏好 ===== */}
      {currentStep === 3 && (
        <section className="space-y-5">
          <h3 className="text-lg font-semibold text-neutral-900">视觉偏好</h3>
          <p className="text-xs text-neutral-500">确定设计方向，不确定的可以留空让AI推荐</p>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Logo图形偏好 <span className="text-neutral-400 text-xs">（单选）</span></label>
            <div className="flex flex-wrap gap-2">
              {LOGO_STYLE_OPTIONS.map((tag) => (<TagBtn key={tag} label={tag} selected={selectedLogoStyle === tag} onClick={() => { const val = selectedLogoStyle === tag ? "" : tag; setSelectedLogoStyle(val); setValue("logoStyle", val); }} />))}
            </div>
            <input type="hidden" {...register("logoStyle")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Logo主要用在哪些地方？ <span className="text-neutral-400 text-xs">（可多选，影响图形复杂度）</span></label>
            <div className="flex flex-wrap gap-2">
              {LOGO_USAGE_OPTIONS.map((tag) => (<TagBtn key={tag} label={tag} selected={selectedUsages.includes(tag)} onClick={() => { setSelectedUsages((prev) => { const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]; setValue("logoUsage", next.join("、")); return next; }); }} />))}
            </div>
            <input type="hidden" {...register("logoUsage")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">不希望出现什么？ <span className="text-neutral-400 text-xs">（可多选）</span></label>
            <div className="flex flex-wrap gap-2 mb-2">
              {AVOID_ELEMENT_OPTIONS.map((tag) => (<TagBtn key={tag} label={tag} selected={selectedAvoids.includes(tag)} onClick={() => { setSelectedAvoids((prev) => { const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]; setValue("avoidElements", next.join("、")); return next; }); }} />))}
            </div>
            <input type="hidden" {...register("avoidElements")} />
            <textarea {...register("avoidElements")} rows={2} placeholder="补充其他不想出现的元素（选填）" className={tc} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">现在店招/门头的颜色 <span className="text-neutral-400 text-xs">（单选）</span></label>
            <div className="flex flex-wrap gap-2">
              {["红色系", "橙色系", "黄色系", "绿色系", "蓝色系", "紫色系", "棕色系", "黑色系", "白色系"].map((color) => (<TagBtn key={color} label={color} selected={existingColorText === color} onClick={() => { setExistingColorText(color); setValue("existingBrandColor", color); }} />))}
            </div>
            <input type="hidden" {...register("existingBrandColor")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">对现有门头最不满意的一点 <span className="text-neutral-400 text-xs">（单选）</span></label>
            <div className="flex flex-wrap gap-2">
              {SIGNAGE_PAIN_OPTIONS.map((tag) => (<TagBtn key={tag} label={tag} selected={selectedPain === tag} onClick={() => { const val = selectedPain === tag ? "" : tag; setSelectedPain(val); setValue("existingSignagePain", val); }} />))}
            </div>
            <input type="hidden" {...register("existingSignagePain")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">品牌色调 <span className="text-neutral-400 text-xs">（不确定可留白，AI会推荐）</span></label>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-neutral-600 mb-1">主色</label><input type="color" defaultValue="#FFFFFF" {...register("brandColors.primary")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" /></div>
              <div><label className="block text-xs font-medium text-neutral-600 mb-1">辅助色</label><input type="color" defaultValue="#FFFFFF" {...register("brandColors.secondary")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" /></div>
              <div><label className="block text-xs font-medium text-neutral-600 mb-1">强调色</label><input type="color" defaultValue="#FFFFFF" {...register("brandColors.accent")} className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer" /></div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">补充说明</label>
            <textarea {...register("description")} rows={3} placeholder="有任何额外想法，请写在这里（选填）" className={tc} />
          </div>
        </section>
      )}

      {/* ===== Step 4: 素材上传 ===== */}
      {currentStep === 4 && (
        <section className="space-y-5">
          <h3 className="text-lg font-semibold text-neutral-900">素材上传</h3>
          <p className="text-xs text-neutral-500">上传现有Logo/IP图片，AI会自动分析（选填）</p>
          <LogoUploadArea files={logoFileList} onAdd={(files) => setLogoFileList((prev) => [...prev, ...files].slice(0, 5))} onRemove={(i) => setLogoFileList((prev) => prev.filter((_, idx) => idx !== i))} />
          <MascotUploadArea files={mascotFileList} names={mascotNames} personalities={mascotPersonalities}
            onAdd={(files) => { setMascotFileList((prev) => [...prev, ...files].slice(0, 10)); setMascotNames((prev) => [...prev, ...files.map(() => "")].slice(0, 10)); setMascotPersonalities((prev) => [...prev, ...files.map(() => "")].slice(0, 10)); }}
            onRemove={(i) => { setMascotFileList((prev) => prev.filter((_, idx) => idx !== i)); setMascotNames((prev) => prev.filter((_, idx) => idx !== i)); setMascotPersonalities((prev) => prev.filter((_, idx) => idx !== i)); }}
            onNameChange={(i, v) => setMascotNames((prev) => prev.map((item, idx) => (idx === i ? v : item)))}
            onPersonalityChange={(i, v) => setMascotPersonalities((prev) => prev.map((item, idx) => (idx === i ? v : item)))}
          />
          <ReferenceUploadArea file={referenceFileList[0] || null} referenceEnabled={referenceEnabled} onAdd={(files) => setReferenceFileList(files.slice(0, 1))} onRemove={() => setReferenceFileList([])} onToggleReference={setReferenceEnabled} />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">LOGO 设计理念 <span className="text-neutral-400 text-xs">（选填，AI会自动分析）</span></label>
            <textarea {...register("logoPhilosophy")} rows={2} placeholder="描述设计思路、图形含义等" className={tc} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">IP 公仔设计理念 <span className="text-neutral-400 text-xs">（选填，AI会自动分析）</span></label>
            <textarea {...register("mascotPhilosophy")} rows={2} placeholder="描述角色设定、性格特点等" className={tc} />
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-4">
        {currentStep > 1 ? (
          <button type="button" onClick={goPrev} className="flex items-center gap-1 px-5 py-2.5 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"><ChevronLeft className="w-4 h-4" />上一步</button>
        ) : <div />}
        {currentStep < 4 ? (
          <button type="button" onClick={goNext} className="flex items-center gap-1 px-6 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors">下一步<ChevronRight className="w-4 h-4" /></button>
        ) : (
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-8 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" />正在上传并提交...</>) : "提交需求"}
          </button>
        )}
      </div>
      {submitError && <div className="mt-4 p-3 bg-danger/10 text-danger text-sm rounded-lg">{submitError}</div>}
    </form>
  );
}

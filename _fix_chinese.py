#!/usr/bin/env python3
"""Fix English text -> Chinese in multiple TSX files."""

import os

BASE = r"C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock"

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Wrote {path}")

# ─── 1. ConsultationForm.tsx ───────────────────────────────────────
cf_path = os.path.join(BASE, "src", "components", "client", "ConsultationForm.tsx")
cf_content = '''"use client";

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
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";

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

  const onSubmit = async (data: ConsultationFormData) => {
    if (logoFiles.length === 0) {
      alert("\u8bf7\u81f3\u5c11\u4e0a\u4f20\u4e00\u4e2a Logo");
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

      router.push("/confirm?projectId=" + result.projectId);
    } catch {
      setSubmitError("\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
      <section className="bg-white rounded-2xl border border-neutral-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white text-xs font-bold">01</div>
          <h3 className="text-lg font-bold text-neutral-900">\u57fa\u672c\u4fe1\u606f</h3>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u59d3\u540d <span className="text-danger">*</span></label>
            <input {...register("clientName")} placeholder="\u8bf7\u8f93\u5165\u59d3\u540d" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            {errors.clientName && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.clientName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u516c\u53f8\u540d\u79f0 <span className="text-danger">*</span></label>
            <input {...register("companyName")} placeholder="\u8bf7\u8f93\u5165\u516c\u53f8\u540d\u79f0" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            {errors.companyName && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.companyName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u624b\u673a\u53f7 <span className="text-danger">*</span></label>
            <input {...register("phone")} placeholder="\u8bf7\u8f93\u5165\u624b\u673a\u53f7" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            {errors.phone && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.phone.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u5fae\u4fe1</label>
            <input {...register("wechat")} placeholder="\u9009\u586b" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u884c\u4e1a <span className="text-danger">*</span></label>
            <select {...register("industry")} className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">\u8bf7\u9009\u62e9\u884c\u4e1a</option>
              {INDUSTRY_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
            </select>
            {errors.industry && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.industry.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u9884\u7b97\u8303\u56f4</label>
            <select {...register("budgetRange")} className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">\u8bf7\u9009\u62e9\u9884\u7b97</option>
              {BUDGET_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-1.5">
          <label className="block text-sm font-medium text-neutral-700">\u9700\u6c42\u63cf\u8ff0</label>
          <textarea {...register("description")} rows={4} placeholder="\u8bf7\u63cf\u8ff0\u60a8\u7684\u54c1\u724c\u3001\u8bbe\u8ba1\u9700\u6c42\u548c\u98ce\u683c\u504f\u597d\uff08\u9009\u586b\uff09" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
          {errors.description && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.description.message}</p>}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white text-xs font-bold">02</div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">\u54c1\u724c\u7d20\u6750</h3>
            <p className="text-xs text-neutral-400 mt-0.5">\u4e0a\u4f20\u60a8\u7684\u54c1\u724c\u7d20\u6750\uff0cAI \u5c06\u8fdb\u884c\u5206\u6790</p>
          </div>
        </div>
        <div className="space-y-8">
          <LogoUploadArea files={logoFiles} onAdd={addLogoFiles} onRemove={(i) => setLogoFiles((prev) => prev.filter((_, idx) => idx !== i))} />
          <MascotUploadArea items={mascotItems} onAdd={addMascotFiles} onRemove={(i) => setMascotItems((prev) => prev.filter((_, idx) => idx !== i))} onNameChange={(i, v) => setMascotItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, name_value: v } : item)))} onPersonalityChange={(i, v) => setMascotItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, personality_value: v } : item)))} />
          <ReferenceUploadArea file={referenceFile} referenceEnabled={referenceEnabled} onAdd={addReferenceFile} onRemove={() => setReferenceFile(null)} onToggleReference={setReferenceEnabled} />
        </div>
      </section>

      {submitError && (<div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl"><AlertCircle className="w-4 h-4 shrink-0" />{submitError}</div>)}

      <button type="submit" disabled={isSubmitting} className="group w-full py-3.5 bg-neutral-900 text-white font-semibold rounded-2xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-neutral-900/10">
        {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" />\u63d0\u4ea4\u4e2d...</>) : (>\u63d0\u4ea4\u9700\u6c42<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>)}
      </button>
    </form>
  );
}
'''

# Hmm, the JSX with <> fragments will cause issues with unicode escaping in the final line.
# Let me write the content more carefully.

cf_content = '''"use client";

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
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";

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

  const onSubmit = async (data: ConsultationFormData) => {
    if (logoFiles.length === 0) {
      alert("\u8bf7\u81f3\u5c11\u4e0a\u4f20\u4e00\u4e2a Logo");
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

      router.push("/confirm?projectId=" + result.projectId);
    } catch {
      setSubmitError("\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
      <section className="bg-white rounded-2xl border border-neutral-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white text-xs font-bold">01</div>
          <h3 className="text-lg font-bold text-neutral-900">\u57fa\u672c\u4fe1\u606f</h3>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u59d3\u540d <span className="text-danger">*</span></label>
            <input {...register("clientName")} placeholder="\u8bf7\u8f93\u5165\u59d3\u540d" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            {errors.clientName && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.clientName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u516c\u53f8\u540d\u79f0 <span className="text-danger">*</span></label>
            <input {...register("companyName")} placeholder="\u8bf7\u8f93\u5165\u516c\u53f8\u540d\u79f0" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            {errors.companyName && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.companyName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u624b\u673a\u53f7 <span className="text-danger">*</span></label>
            <input {...register("phone")} placeholder="\u8bf7\u8f93\u5165\u624b\u673a\u53f7" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            {errors.phone && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.phone.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u5fae\u4fe1</label>
            <input {...register("wechat")} placeholder="\u9009\u586b" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u884c\u4e1a <span className="text-danger">*</span></label>
            <select {...register("industry")} className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">\u8bf7\u9009\u62e9\u884c\u4e1a</option>
              {INDUSTRY_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
            </select>
            {errors.industry && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.industry.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">\u9884\u7b97\u8303\u56f4</label>
            <select {...register("budgetRange")} className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">\u8bf7\u9009\u62e9\u9884\u7b97</option>
              {BUDGET_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-1.5">
          <label className="block text-sm font-medium text-neutral-700">\u9700\u6c42\u63cf\u8ff0</label>
          <textarea {...register("description")} rows={4} placeholder="\u8bf7\u63cf\u8ff0\u60a8\u7684\u54c1\u724c\u3001\u8bbe\u8ba1\u9700\u6c42\u548c\u98ce\u683c\u504f\u597d\uff08\u9009\u586b\uff09" className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
          {errors.description && <p className="text-xs text-danger flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.description.message}</p>}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white text-xs font-bold">02</div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">\u54c1\u724c\u7d20\u6750</h3>
            <p className="text-xs text-neutral-400 mt-0.5">\u4e0a\u4f20\u60a8\u7684\u54c1\u724c\u7d20\u6750\uff0cAI \u5c06\u8fdb\u884c\u5206\u6790</p>
          </div>
        </div>
        <div className="space-y-8">
          <LogoUploadArea files={logoFiles} onAdd={addLogoFiles} onRemove={(i) => setLogoFiles((prev) => prev.filter((_, idx) => idx !== i))} />
          <MascotUploadArea items={mascotItems} onAdd={addMascotFiles} onRemove={(i) => setMascotItems((prev) => prev.filter((_, idx) => idx !== i))} onNameChange={(i, v) => setMascotItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, name_value: v } : item)))} onPersonalityChange={(i, v) => setMascotItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, personality_value: v } : item)))} />
          <ReferenceUploadArea file={referenceFile} referenceEnabled={referenceEnabled} onAdd={addReferenceFile} onRemove={() => setReferenceFile(null)} onToggleReference={setReferenceEnabled} />
        </div>
      </section>

      {submitError && (<div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl"><AlertCircle className="w-4 h-4 shrink-0" />{submitError}</div>)}

      <button type="submit" disabled={isSubmitting} className="group w-full py-3.5 bg-neutral-900 text-white font-semibold rounded-2xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-neutral-900/10">
        {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" />\u63d0\u4ea4\u4e2d...</>) : (<>\u63d0\u4ea4\u9700\u6c42<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>)}
      </button>
    </form>
  );
}
'''

write_file(cf_path, cf_content)

# ─── 2. FileUploadArea.tsx ─────────────────────────────────────────
fu_path = os.path.join(BASE, "src", "components", "client", "FileUploadArea.tsx")
fu_content = '''"use client";

import { useState } from "react";
import { FileUpload } from "@/components/shared/FileUpload";
import { X, FileText, Image } from "lucide-react";

interface UploadedFile {
  name: string;
  size: number;
  url?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function FilePreview({ file, onRemove, icon }: { file: UploadedFile; onRemove: () => void; icon?: React.ReactNode }) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm hover:border-neutral-300 transition-all">
      {icon || <Image className="w-4 h-4 text-neutral-400 shrink-0" />}
      <span className="truncate flex-1 text-neutral-700 font-medium">{file.name}</span>
      <span className="text-neutral-400 text-xs shrink-0">{formatSize(file.size)}</span>
      <button onClick={onRemove} className="p-0.5 rounded-lg hover:bg-neutral-200 text-neutral-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface MascotFile extends UploadedFile {
  name_value: string;
  personality_value: string;
}

export function LogoUploadArea({ files, onAdd, onRemove }: { files: UploadedFile[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm font-semibold text-neutral-700">Logo \u4e0a\u4f20</label>
        {files.length > 0 && <span className="text-xs text-primary font-medium">({files.length}/5)</span>}
        <span className="text-red-500 text-xs">* \u5fc5\u586b</span>
      </div>
      {files.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {files.map((f, i) => (<FilePreview key={i} file={f} onRemove={() => onRemove(i)} />))}
        </div>
      )}
      <FileUpload onFiles={onAdd} accept={{ "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/svg+xml": [".svg"], "application/postscript": [".ai", ".eps"] }} maxFiles={5} label="\u4e0a\u4f20\u54c1\u724c Logo" hint="\u652f\u6301 PNG\u3001SVG\u3001AI\u3001EPS \u683c\u5f0f\uff0c\u6bcf\u6587\u4ef6\u6700\u5927 20MB" />
    </div>
  );
}

export function MascotUploadArea({ items, onAdd, onRemove, onNameChange, onPersonalityChange }: { items: MascotFile[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void; onNameChange: (i: number, v: string) => void; onPersonalityChange: (i: number, v: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm font-semibold text-neutral-700">IP \u516c\u4ed4\u4e0a\u4f20</label>
        {items.length > 0 && <span className="text-xs text-neutral-400 font-medium">({items.length}/10)</span>}
      </div>
      {items.length > 0 && (
        <div className="mb-3 space-y-2">
          {items.map((item, i) => (
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
                <input type="text" placeholder="\u540d\u79f0\uff08\u5fc5\u586b\uff09" value={item.name_value} onChange={(e) => onNameChange(i, e.target.value)} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <input type="text" placeholder="\u6027\u683c\u63cf\u8ff0\uff08\u9009\u586b\uff09" value={item.personality_value} onChange={(e) => onPersonalityChange(i, e.target.value)} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
      <FileUpload onFiles={onAdd} accept={{ "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/gif": [".gif"] }} maxFiles={10} multiple label="\u4e0a\u4f20 IP \u516c\u4ed4" hint="\u652f\u6301 PNG\u3001JPG\u3001GIF \u683c\u5f0f\uff0c\u6bcf\u6587\u4ef6\u6700\u5927 20MB" />
    </div>
  );
}

export function ReferenceUploadArea({ file, referenceEnabled, onAdd, onRemove, onToggleReference }: { file: UploadedFile | null; referenceEnabled: boolean; onAdd: (f: File[]) => void; onRemove: () => void; onToggleReference: (v: boolean) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm font-semibold text-neutral-700">\u53c2\u8003 VI \u624b\u518c</label>
        <span className="text-xs text-neutral-400">\uff08\u9009\u586b\uff09</span>
      </div>
      <p className="text-xs text-neutral-400 mb-3 leading-relaxed">\u4e0a\u4f20\u5df2\u6709\u7684\u54c1\u724c\u624b\u518c PDF\uff0cAI \u5c06\u53c2\u8003\u5176\u98ce\u683c\u3001\u8272\u5f69\u548c\u5b57\u4f53</p>

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
            <span className="text-sm text-neutral-600 group-hover:text-neutral-700 transition-colors">AI \u751f\u6210\u65f6\u53c2\u8003\u6b64\u624b\u518c</span>
          </label>
        </div>
      ) : (
        <FileUpload onFiles={onAdd} accept={{ "application/pdf": [".pdf"] }} maxFiles={1} multiple={false} maxSize={50 * 1024 * 1024} label="\u4e0a\u4f20\u53c2\u8003\u624b\u518c" hint="\u652f\u6301 PDF \u683c\u5f0f\uff0c\u6700\u5927 50MB" />
      )}
    </div>
  );
}
'''

write_file(fu_path, fu_content)

# ─── 3. GenerationPanel.tsx ────────────────────────────────────────
gp_path = os.path.join(BASE, "src", "components", "admin", "GenerationPanel.tsx")
gp_content = '''"use client";

import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { ReferenceModeSelector } from "./ReferenceModeSelector";
import { PlanCard } from "./PlanCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { getPlansByProject, toggleFavorite } from "@/lib/mock";
import type { AiGenerationPlan, ReferenceMode } from "@/types";

interface GenerationPanelProps {
  projectId: string;
}

export function GenerationPanel({ projectId }: GenerationPanelProps) {
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>("weak");
  const [plans, setPlans] = useState<AiGenerationPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 2500));
    const result = await getPlansByProject(projectId);
    setPlans(result);
    setHasGenerated(true);
    setIsGenerating(false);
  };

  const handleToggleFavorite = async (planId: string) => {
    await toggleFavorite(planId);
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, isFavorited: !p.isFavorited } : p
      )
    );
  };

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-2xl border border-neutral-100 p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Wand2 className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-neutral-900">\u751f\u6210\u53c2\u6570</h3>
        </div>
        <ReferenceModeSelector value={referenceMode} onChange={setReferenceMode} />

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="group w-full py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-neutral-900/10"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              AI \u6b63\u5728\u5206\u6790\u7d20\u6750\u5e76\u751f\u6210\u65b9\u6848...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              AI \u751f\u6210\u65b9\u6848
            </>
          )}
        </button>
      </section>

      {isGenerating && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-16 shadow-sm">
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="absolute inset-0 w-10 h-10 rounded-full bg-primary/5 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-700">AI \u6b63\u5728\u5206\u6790\u60a8\u7684\u54c1\u724c\u7d20\u6750...</p>
              <p className="text-xs text-neutral-400 mt-1">
                \u6b63\u5728\u63d0\u53d6\u54c1\u724c\u8272\u5f69\u3001\u5b57\u4f53\uff0c\u5339\u914d\u53c2\u8003\u98ce\u683c
              </p>
            </div>
          </div>
        </div>
      )}

      {hasGenerated && !isGenerating && plans.length === 0 && (
        <EmptyState
          title=""
          description=""
        />
      )}

      {plans.length > 0 && !isGenerating && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-neutral-900">
              \u751f\u6210\u65b9\u6848
              <span className="ml-2 text-xs font-medium text-neutral-400">
                ({plans.length} \u4e2a\u65b9\u6848)
              </span>
            </h3>
            {selectedPlan && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-lighter text-primary text-xs font-medium">
                  \u5df2\u9009\u4e2d
                </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id)}
                onToggleFavorite={() => handleToggleFavorite(plan.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
'''

write_file(gp_path, gp_content)

# ─── 4. dashboard/page.tsx ─────────────────────────────────────────
db_path = os.path.join(BASE, "src", "app", "admin", "dashboard", "page.tsx")
db_content = '''"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/admin/StatCard";
import { RecentActivityList } from "@/components/admin/RecentActivityList";
import { getProjects } from "@/lib/mock";
import { FolderKanban, Clock, CheckCircle, AlertCircle } from "lucide-react";
import type { Project } from "@/types";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects().then((list) => {
      setProjects(list);
      setLoading(false);
    });
  }, []);

  const pendingCount = projects.filter((p) => p.status === "submitted").length;
  const inProgressCount = projects.filter(
    (p) => p.status === "ai_analysis" || p.status === "designing"
  ).length;
  const deliveredCount = projects.filter((p) => p.status === "delivered").length;
  const totalCount = projects.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary uppercase tracking-wider">\u6982\u89c8</p>
          <h2 className="text-2xl font-bold text-neutral-900">\u5de5\u4f5c\u53f0</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-neutral-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary uppercase tracking-wider">\u6982\u89c8</p>
          <h2 className="text-2xl font-bold text-neutral-900">\u5de5\u4f5c\u53f0</h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 rounded-lg">
          <span className="text-sm font-medium text-neutral-500">\u5171 {totalCount} \u4e2a\u9879\u76ee</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="\u5f85\u5904\u7406" value={pendingCount} description="\u65b0\u63d0\u4ea4\u672a\u5206\u914d" icon={<AlertCircle className="w-5 h-5" />} />
        <StatCard title="\u8fdb\u884c\u4e2d" value={inProgressCount} description="AI \u5206\u6790 / \u8bbe\u8ba1\u4e2d" icon={<Clock className="w-5 h-5" />} />
        <StatCard title="\u5df2\u4ea4\u4ed8" value={deliveredCount} icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard title="\u9879\u76ee\u603b\u6570" value={totalCount} icon={<FolderKanban className="w-5 h-5" />} />
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-neutral-900">\u6700\u8fd1\u52a8\u6001</h3>
          <span className="text-xs text-neutral-400">\u5b9e\u65f6</span>
        </div>
        <RecentActivityList />
      </div>
    </div>
  );
}
'''

write_file(db_path, db_content)

# ─── 5. ReferenceModeSelector.tsx ──────────────────────────────────
rm_path = os.path.join(BASE, "src", "components", "admin", "ReferenceModeSelector.tsx")
rm_content = '''"use client";

import { cn } from "@/lib/utils";
import type { ReferenceMode } from "@/types";

interface ReferenceModeSelectorProps {
  value: ReferenceMode;
  onChange: (mode: ReferenceMode) => void;
}

const MODES: { value: ReferenceMode; label: string; desc: string }[] = [
  { value: "strong", label: "\u5f3a\u53c2\u8003", desc: "\u4e25\u683c\u9075\u5faa\u53c2\u8003\u624b\u518c\u7684\u8272\u5f69\u548c\u5b57\u4f53\u89c4\u8303" },
  { value: "weak", label: "\u5f31\u53c2\u8003", desc: "\u63d0\u53d6\u98ce\u683c\u503e\u5411\uff0c\u5141\u8bb8\u5927\u80c6\u53d8\u5316" },
  { value: "none", label: "\u4e0d\u53c2\u8003", desc: "\u57fa\u4e8e Logo \u548c\u884c\u4e1a\u5c5e\u6027\u4ece\u96f6\u751f\u6210" },
];

export function ReferenceModeSelector({ value, onChange }: ReferenceModeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
        \u53c2\u8003\u6a21\u5f0f
      </label>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((mode) => {
          const isActive = value === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              className={cn(
                "p-3 rounded-xl text-left transition-all duration-200 border",
                isActive
                  ? "bg-primary-lighter border-primary/20 text-primary shadow-sm"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
              )}
            >
              <div className="text-sm font-semibold">{mode.label}</div>
              <div className="text-[11px] mt-0.5 opacity-70">{mode.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
'''

write_file(rm_path, rm_content)

print("\nAll files fixed!")

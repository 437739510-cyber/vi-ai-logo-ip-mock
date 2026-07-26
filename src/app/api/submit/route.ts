export const dynamic = "force-dynamic"
﻿// API Route: POST /api/submit
// Save to Supabase + local JSON fallback
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { detectCompanyScale, type CompanyScale, getScaleLabel } from "@/lib/brand/company-scale";
import { writeFile, readFile, mkdir } from "fs/promises";
import { getCategoryDict } from "@/lib/vi-manual/category-dict";
import path from "path";

const MOCK_DIR = path.join(process.cwd(), "public", "mock");

async function loadJson<T>(filePath: string): Promise<T> {
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch { return [] as unknown as T; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const projectId = `VI-${dateStr}-${rand}`;
    const submissionId = `SBM-${dateStr}-${String(Date.now()).slice(-4)}`;

    // M1.2: infer subIndustry from mainProducts + industry
    const mainProducts = body.mainProducts || "";
    const industry = body.industry || "";
    const subIndustry = inferSubIndustry(mainProducts, industry);

    const isoNow = now.toISOString();

    // V78: 智能识别公司规模（后端提交时检测，~0.001元/次）
    let companyScale: CompanyScale = "micro";
    let scaleReason = "";
    try {
      const scaleResult = await detectCompanyScale(
        body.companyName || "",
        body.industry || "",
        body.province || "",
        body.city || "",
      );
      companyScale = scaleResult.scale;
      scaleReason = scaleResult.reason;
      console.log(`[SUBMIT] Company scale: ${body.companyName} → ${getScaleLabel(companyScale)} (${scaleReason})`);
    } catch (e) {
      console.warn("[SUBMIT] Company scale detection skipped:", e);
    }

    const submission = {
      id: submissionId,
      clientName: body.clientName || "",
      companyName: body.companyName || "",
      brandVision: body.brandVision || "",
      coreValues: body.coreValues || "",
      targetMarket: body.targetMarket || "",
      logoPhilosophy: body.logoPhilosophy || "",
      mascotPhilosophy: body.mascotPhilosophy || "",
      phone: body.phone || "",
      wechat: body.wechat || "",
      email: body.email || "",
      industry: body.industry || "",
      industryCustom: body.industryCustom || "",
      businessYears: body.businessYears || null,
      brandHighlight: body.brandHighlight || "",
      customerProfile: body.customerProfile || "",
      existingBrandColor: body.existingBrandColor || "",
      budgetRange: body.budgetRange || "",
      province: body.province || "",
      city: body.city || "",
      description: body.description || "",
      mainProducts: body.mainProducts || "",
      businessForm: body.businessForm || "",
      viewPassword: generateViewPassword(),
      logoAssets: body.logoFiles || [],
      mascotAssets: body.mascotItems || [],
      brandPersonality: body.brandPersonality || "",
      logoUsage: body.logoUsage || "",
      logoStyle: body.logoStyle || "",
      avoidElements: body.avoidElements || "",
      existingSignagePain: body.existingSignagePain || "",
      competitorReference: body.competitorReference || "",
          colorOverrides: body.brandColors ? { primary: { hex: body.brandColors.primary || "", name: "品牌主色" }, secondary: { hex: body.brandColors.secondary || "", name: "辅助色" }, accent: { hex: body.brandColors.accent || "", name: "强调色" } } : null,
          industryKey: getCategoryDict(mainProducts || "")?.category_key || "",
      referenceManual: body.referenceFile
        ? { fileName: body.referenceFile.fileName, url: body.referenceFile.url, pageCount: 0, isReferenceEnabled: true, referenceMode: body.referenceEnabled ? "weak" : "none" }
        : null,
      storePhotos: body.storePhotos || [],  // V79+: 店内照片（必填）含门头，供Hermes看图分析
      submittedAt: isoNow,
      status: "submitted",
    };

    const project = {
      id: projectId,
      submissionId: submissionId,
      status: "submitted" as const,
      brandColors: body.brandColors || null,
      viewPassword: submission.viewPassword,
          companyName: submission.companyName || "",
          industry: submission.industry || "",
          brandVision: body.brandVision || "",
          coreValues: body.coreValues || "",
          targetMarket: body.targetMarket || "",
      mainProducts: submission.mainProducts,
      businessForm: submission.businessForm,
      createdAt: isoNow,
      updatedAt: isoNow,
      created_at: isoNow,
      updated_at: isoNow,
      assignedTo: null,
      timeline: [{ status: "submitted" as const, timestamp: isoNow }],
    };

    // Write to Supabase (silently skip if not configured)
    try {
      const supabaseSub = {
        id: submissionId,
        client_name: submission.clientName,
        company_name: submission.companyName,
        brand_vision: body.brandVision || "",
        core_values: body.coreValues || "",
        target_market: body.targetMarket || "",
        logo_philosophy: body.logoPhilosophy || "",
        mascot_philosophy: body.mascotPhilosophy || "",
        phone: submission.phone,
        wechat: submission.wechat,
        email: submission.email,
        industry: submission.industry,
        industry_custom: submission.industryCustom,
        business_years: submission.businessYears,
        brand_highlight: submission.brandHighlight,
        customer_profile: submission.customerProfile,
        existing_brand_color: submission.existingBrandColor,
        budget_range: submission.budgetRange,
        province: submission.province,
        city: submission.city,
        description: submission.description,
        logo_assets: submission.logoAssets,
        mascot_assets: submission.mascotAssets,
        brand_personality: body.brandPersonality || "",
        logo_usage: body.logoUsage || "",
        logo_style: body.logoStyle || "",
        avoid_elements: body.avoidElements || "",
        existing_signage_pain: body.existingSignagePain || "",
        competitor_reference: body.competitorReference || "",
        main_products: body.mainProducts || "",
        business_form: body.businessForm || "",
        company_scale: companyScale,
        scale_reason: scaleReason,
        store_photos: body.storePhotos || [],
        reference_manual: submission.referenceManual,
        submitted_at: isoNow,
        student_id: body.studentId || null,
      };
      const { error: subErr } = await supabaseAdmin.from("submissions").insert(supabaseSub);
      if (subErr) {
        console.warn("[SUBMIT] Supabase submission error:", subErr.message);
        // Fallback: 如果Supabase缺新列（如刚部署未执行SQL），去掉新列重试
        if (subErr.message.includes('does not exist') || subErr.code === '42703') {
          const { main_products, business_form, company_scale, scale_reason, store_photos, brand_personality, logo_usage, logo_style, avoid_elements, existing_signage_pain, competitor_reference, ...fallbackSub } = supabaseSub as any;
          const { error: retryErr } = await supabaseAdmin.from("submissions").insert(fallbackSub);
          if (retryErr) console.warn("[SUBMIT] Supabase fallback submission error:", retryErr.message);
        }
      }
    } catch (e) {
      console.warn("[SUBMIT] Supabase submission skipped:", e);
    }
    try {
      const supabaseProj = {
        id: projectId,
        submission_id: submissionId,
        status: "submitted",
        brand_colors: body.brandColors || null,
        client_name: submission.companyName || submission.clientName || "",  // V95: 品牌名优先于联系人
        industry: submission.industry || "",
        student_id: body.studentId || null,
        client_info: {
          viewPassword: submission.viewPassword,
          companyName: submission.companyName || "",
          industry: submission.industry || "",
          brandVision: body.brandVision || "",
          coreValues: body.coreValues || "",
          targetMarket: body.targetMarket || "",
          mainProducts: submission.mainProducts || body.mainProducts || "",
          subIndustry,
          businessForm: submission.businessForm || body.businessForm || "",
          companyScale,
          companyScaleLabel: getScaleLabel(companyScale),
          companyScaleReason: scaleReason,
          generationStatus: "pending_logo",
          brandPersonality: body.brandPersonality || "",
          logoUsage: body.logoUsage || "",
          logoStyle: body.logoStyle || "",
          avoidElements: body.avoidElements || "",
          existingSignagePain: body.existingSignagePain || "",
          competitorReference: body.competitorReference || "",
          colorOverrides: body.brandColors ? { primary: { hex: body.brandColors.primary || "", name: "品牌主色" }, secondary: { hex: body.brandColors.secondary || "", name: "辅助色" }, accent: { hex: body.brandColors.accent || "", name: "强调色" } } : null,
          industryKey: getCategoryDict(mainProducts || "")?.category_key || "",
        },
        created_at: isoNow,
        updated_at: isoNow,
      };
      const { error: projErr } = await supabaseAdmin.from("projects").insert(supabaseProj);
      if (projErr) console.warn("[SUBMIT] Supabase project error:", projErr.message);
    } catch (e) {
      console.warn("[SUBMIT] Supabase project skipped:", e);
    }

    // Local JSON backup — Vercel production only writes to Supabase
    if (process.env.VERCEL !== "1") {
      await mkdir(MOCK_DIR, { recursive: true });

      const subsPath = path.join(MOCK_DIR, "submissions.json");
      const subs = await loadJson<any[]>(subsPath);
      subs.unshift(submission);
      await writeFile(subsPath, JSON.stringify(subs, null, 2));

      const projsPath = path.join(MOCK_DIR, "projects.json");
      const projs = await loadJson<any[]>(projsPath);
      projs.unshift(project);
      await writeFile(projsPath, JSON.stringify(projs, null, 2));
    }

    return NextResponse.json({ success: true, projectId, submissionId, viewPassword: submission.viewPassword });
  } catch (error) {
    console.error("[SUBMIT] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Submit failed" }, { status: 500 });
  }
}


// M1.2: infer sub-industry from main products
function inferSubIndustry(mainProducts: string, industry: string): string {
  if (!mainProducts) return "";
  const lower = mainProducts.toLowerCase();
  if (lower.includes("面") || lower.includes("刀削")) return "面馆";
  if (lower.includes("火锅")) return "火锅";
  if (lower.includes("奶茶") || lower.includes("茶饮")) return "茶饮";
  if (lower.includes("花") || lower.includes("花卉")) return "花艺";
  if (lower.includes("海鲜") || lower.includes("水产")) return "海鲜";
  if (lower.includes("美容") || lower.includes("护肤")) return "美容";
  return "";
}

// V79: Generate 4-digit same-number password (easy for elderly to remember)
function generateViewPassword(): string {
  const digit = Math.floor(Math.random() * 9) + 1; // 1-9
  return String(digit).repeat(4); // e.g. "1111", "6666"
}

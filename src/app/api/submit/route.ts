// API Route: POST /api/submit
// Save to Supabase + local JSON fallback
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { writeFile, readFile, mkdir } from "fs/promises";
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

    const isoNow = now.toISOString();

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
      referenceManual: body.referenceFile
        ? { fileName: body.referenceFile.fileName, url: body.referenceFile.url, pageCount: 0, isReferenceEnabled: true, referenceMode: body.referenceEnabled ? "weak" : "none" }
        : null,
      submittedAt: isoNow,
      status: "submitted",
    };

    const project = {
      id: projectId,
      submissionId: submissionId,
      status: "submitted" as const,
      brandColors: body.brandColors || null,
      viewPassword: submission.viewPassword,
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
        submitted_at: isoNow,
        student_id: body.studentId || null,
      };
      const { error: subErr } = await supabaseAdmin.from("submissions").insert(supabaseSub);
      if (subErr) console.warn("[SUBMIT] Supabase submission error:", subErr.message);
    } catch (e) {
      console.warn("[SUBMIT] Supabase submission skipped:", e);
    }
    try {
      const supabaseProj = {
        id: projectId,
        submission_id: submissionId,
        status: "submitted",
        brand_colors: body.brandColors || null,
        client_name: submission.clientName || submission.companyName || "",
        industry: submission.industry || "",
        student_id: body.studentId || null,
        client_info: {
          viewPassword: submission.viewPassword,
          mainProducts: submission.mainProducts || body.mainProducts || "",
          businessForm: submission.businessForm || body.businessForm || "",
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

// Generate 6-digit view password for client
function generateViewPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Remove confusing chars: I/O/0/1
  let pwd = "";
  for (let i = 0; i < 6; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

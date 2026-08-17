// API Route: POST /api/view
// Client view logo - verify by phone + password (or projectId + password for backward compat)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { resolveGenerationState } from "@/lib/core/generation-state";
import { filterCustomerLogos } from "@/lib/vi-manual/customer-logo-filter";
import { buildCustomerFormEcho } from "@/lib/vi-manual/customer-form-echo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, viewPassword, projectId } = body;

    // Support both phone-based and projectId-based lookup
    const hasPhone = phone && phone.trim();
    const hasProjectId = projectId && projectId.trim();

    if (!hasPhone && !hasProjectId) {
      return NextResponse.json(
        { error: "请输入手机号或项目编号" },
        { status: 400 }
      );
    }
    if (!viewPassword) {
      return NextResponse.json(
        { error: "请输入查看密码" },
        { status: 400 }
      );
    }

    let project: any = null;

    if (hasPhone) {
      // Phone-based lookup: find submission by phone, then get project
      const { data: submission, error: subErr } = await supabaseAdmin
        .from("submissions")
        .select("id, phone")
        .eq("phone", phone.trim())
        .order("submitted_at", { ascending: false })
        .limit(1)
        .single();

      if (subErr || !submission) {
        return NextResponse.json(
          { error: "未找到该手机号关联的项目" },
          { status: 404 }
        );
      }

      // Find project by submission_id
      const { data: proj, error: projErr } = await supabaseAdmin
        .from("projects")
        .select("id, status, client_info, submission_id")
        .eq("submission_id", submission.id)
        .single();

      if (projErr || !proj) {
        return NextResponse.json(
          { error: "未找到关联项目" },
          { status: 404 }
        );
      }
      project = proj;
    } else {
      // Legacy projectId-based lookup
      const { data: proj, error: projErr } = await supabaseAdmin
        .from("projects")
        .select("id, status, client_info, submission_id")
        .eq("id", projectId.trim())
        .single();

      if (projErr || !proj) {
        return NextResponse.json(
          { error: "项目不存在，请检查项目编号" },
          { status: 404 }
        );
      }
      project = proj;
    }

    // Verify password from client_info
    const clientInfo = (project.client_info as Record<string, any>) || {};
    const storedPassword = clientInfo.viewPassword || "";

    if (!storedPassword || storedPassword !== viewPassword) {
      return NextResponse.json(
        { error: "查看密码不正确" },
        { status: 403 }
      );
    }

    // Get logo data from client_info
    const brandProfile = clientInfo.brandProfile || {};
    const logoResults = brandProfile.logoGenerationResults || [];
    const selectedLogo = brandProfile.selectedLogo || null;
    const generationState = resolveGenerationState(clientInfo.generationStatus, project.status);

    // Get company name and industry from submission if available
    let companyName = clientInfo.companyName || "";
    let industry = clientInfo.industry || "";
    let mainProducts = clientInfo.mainProducts || "";
    
    const submissionId = project.submission_id;
    let submittedAt: string | null = null;
    if (submissionId) {
      const { data: sub } = await supabaseAdmin
        .from("submissions")
        .select("company_name, industry, submitted_at")
        .eq("id", submissionId)
        .single();
      if (sub) {
        companyName = companyName || sub.company_name || "";
        industry = industry || sub.industry || "";
        submittedAt = sub.submitted_at || null;
      }
    }

    // 工单 036：客户可见 Logo 过滤（needs_review/failed/error 不展示；skipped/passed 保留）
    const validLogos = filterCustomerLogos(logoResults);

    // Get logo history
    const logoHistory = clientInfo.logoHistory || [];

    // Get preferred logo
    const preferredLogo = brandProfile.preferredLogo || null;

    // 工单 050：客户查看页公仔区数据（sanitized，不返回 viewPassword 等敏感字段）
    // 工单 087：我的填写资料只读回显（仅 LOGO/IP 相关提交字段，白名单契约）。
    const clientInfoForView = {
      wantMascot: clientInfo.wantMascot || "",
      mascotSamples: Array.isArray(clientInfo.mascotSamples) ? clientInfo.mascotSamples : [],
      mascotSelectedId: clientInfo.mascotSelectedId || null,
      formEcho: buildCustomerFormEcho(clientInfo, submittedAt),
    };

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        status: project.status,
        companyName,
        industry,
        mainProducts,
        generationStatus: generationState.state,
        generationStateSource: generationState.source,
        generationStateNeedsReview: generationState.hasResolutionAnomaly,
        generationStateMirrorMatches: generationState.mirrorMatches,
        logos: validLogos,
        selectedLogo,
        preferredLogo,
        logoHistory,
        client_info: clientInfoForView,
        submission: { wantMascot: clientInfo.wantMascot || "" },
      },
    });
  } catch (error: any) {
    console.error("[view] Error:", error);
    return NextResponse.json(
      { error: error.message || "查询失败" },
      { status: 500 }
    );
  }
}

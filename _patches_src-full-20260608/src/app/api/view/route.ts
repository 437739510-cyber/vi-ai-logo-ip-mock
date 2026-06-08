// API Route: POST /api/view
// Client view logo - verify password and return logo data
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, viewPassword } = body;

    if (!projectId || !viewPassword) {
      return NextResponse.json(
        { error: "请输入项目编号和查看密码" },
        { status: 400 }
      );
    }

    // Find project by ID
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, status, client_info, submission_id")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json(
        { error: "项目不存在，请检查项目编号" },
        { status: 404 }
      );
    }

    // Verify password from client_info
    const clientInfo = (project.client_info as Record<string, any>) || {};
    const storedPassword = clientInfo.viewPassword || "";

    if (!storedPassword || storedPassword.toUpperCase() !== viewPassword.toUpperCase()) {
      return NextResponse.json(
        { error: "查看密码不正确" },
        { status: 403 }
      );
    }

    // Get logo data from client_info
    const brandProfile = clientInfo.brandProfile || {};
    const logoResults = brandProfile.logoGenerationResults || [];
    const selectedLogo = brandProfile.selectedLogo || null;
    const generationStatus = clientInfo.generationStatus || "pending";

    // Also get company name and industry from submission if available
    let companyName = clientInfo.companyName || "";
    let industry = clientInfo.industry || "";
    let mainProducts = clientInfo.mainProducts || "";
    let businessForm = clientInfo.businessForm || "";
    
    const submissionId = project.submission_id;
    if (submissionId) {
      const { data: sub } = await supabaseAdmin
        .from("submissions")
        .select("company_name, industry")
        .eq("id", submissionId)
        .single();
      if (sub) {
        companyName = companyName || sub.company_name || "";
        industry = industry || sub.industry || "";
      }
    }

    // Filter only successful logo results
    const validLogos = logoResults.filter(
      (r: any) => r.imageUrl && !r.error
    );

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        status: project.status,
        companyName,
        industry,
        mainProducts,
        businessForm,
        generationStatus,
        logos: validLogos,
        selectedLogo,
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

// API Route: GET /api/member/vi-manuals
// Member views their VI manuals (linked via phone)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });

    const { data: session } = await supabaseAdmin
      .from("member_sessions").select("member_id").eq("token", token).single();
    if (!session) return NextResponse.json({ success: false, error: "session无效" }, { status: 401 });

    const { data: member } = await supabaseAdmin
      .from("members").select("id, phone").eq("id", session.member_id).single();
    if (!member) return NextResponse.json({ success: false, error: "用户不存在" }, { status: 401 });

    // Find all submissions by phone
    const { data: submissions } = await supabaseAdmin
      .from("submissions")
      .select("id, company_name, industry")
      .eq("phone", member.phone);

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ success: true, manuals: [] });
    }

    const submissionIds = submissions.map(s => s.id);

    // Find all projects for these submissions
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, status, client_info, created_at")
      .in("submission_id", submissionIds);

    if (!projects || projects.length === 0) {
      return NextResponse.json({ success: true, manuals: [] });
    }

    // Extract VI generation history from each project
    const manuals = projects.map(p => {
      const ci = (p.client_info as Record<string, any>) || {};
      const bp = ci.brandProfile || {};
      const history = ci.viGenerationHistory || [];
      const completedHistory = history.filter((h: any) => h.status === "completed");
      const selectedLogo = bp.selectedLogo || null;
      const logoResults = bp.logoGenerationResults || [];

      // Find submission info
      const sub = submissions.find(s => s.id === p.submission_id);

      return {
        projectId: p.id,
        companyName: sub?.company_name || ci.companyName || "未命名品牌",
        industry: sub?.industry || ci.industry || "",
        status: p.status,
        createdAt: p.created_at,
        // Logo info
        selectedLogo: selectedLogo ? {
          imageUrl: selectedLogo.imageUrl,
          selectedAt: selectedLogo.selectedAt,
        } : null,
        logoCount: logoResults.filter((l: any) => l.imageUrl).length,
        // VI Manual info
        viManuals: completedHistory.map((h: any) => ({
          id: h.id,
          format: h.format || "pptx",
          pageCount: h.pageCount || 0,
          completedAt: h.completedAt,
          downloadUrl: h.downloadUrl || h.storageUrl || null,
          fileName: h.fileName || "",
        })),
      };
    });

    return NextResponse.json({ success: true, manuals });
  } catch (err: any) {
    console.error("[member/vi-manuals] Error:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}

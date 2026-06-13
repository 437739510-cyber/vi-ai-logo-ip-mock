// API Route: POST /api/ai/save-logo-preference
// Client saves their preferred logo (not final confirm, can change)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, viewPassword, projectId, logoIndex } = body;

    const hasPhone = phone?.trim();
    const hasProjectId = projectId?.trim();

    if (!hasPhone && !hasProjectId) {
      return NextResponse.json({ error: "请提供手机号或项目编号" }, { status: 400 });
    }
    if (!viewPassword || logoIndex === undefined) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // Find and verify project
    let project: any = null;

    if (hasPhone) {
      const { data: submission } = await supabaseAdmin
        .from("submissions")
        .select("id")
        .eq("phone", phone.trim())
        .order("submitted_at", { ascending: false })
        .limit(1)
        .single();
      if (!submission) return NextResponse.json({ error: "未找到项目" }, { status: 404 });

      const { data: proj } = await supabaseAdmin
        .from("projects")
        .select("id, status, client_info")
        .eq("submission_id", submission.id)
        .single();
      if (!proj) return NextResponse.json({ error: "未找到项目" }, { status: 404 });
      project = proj;
    } else {
      const { data: proj } = await supabaseAdmin
        .from("projects")
        .select("id, status, client_info")
        .eq("id", projectId.trim())
        .single();
      if (!proj) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
      project = proj;
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    const storedPassword = clientInfo.viewPassword || "";
    if (!storedPassword || storedPassword.toUpperCase() !== viewPassword.toUpperCase()) {
      return NextResponse.json({ error: "查看密码不正确" }, { status: 403 });
    }

    // Save preference
    const brandProfile = clientInfo.brandProfile || {};
    const logos = brandProfile.logoGenerationResults || [];
    const selectedLogo = logos.find((l: any) => l.index === logoIndex);

    if (!selectedLogo) {
      return NextResponse.json({ error: "Logo不存在" }, { status: 400 });
    }

    clientInfo.brandProfile = {
      ...brandProfile,
      preferredLogo: {
        index: logoIndex,
        imageUrl: selectedLogo.imageUrl,
        savedAt: new Date().toISOString(),
      },
    };

    await supabaseAdmin.from("projects").update({
      client_info: clientInfo,
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[save-preference] Error:", error);
    return NextResponse.json({ error: error.message || "保存失败" }, { status: 500 });
  }
}

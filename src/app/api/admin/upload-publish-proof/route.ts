export const dynamic = "force-dynamic"
// API Route: POST /api/admin/upload-publish-proof
// 大学生发布凭证（截图）上传，复用 member-photos Storage，返回公开 URL。
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);

    if (session?.role !== "student") {
      return NextResponse.json({ success: false, error: "仅大学生可操作" }, { status: 403 });
    }
    const userId = session.userId;

    const formData = await req.formData();
    const contentId = formData.get("contentId") as string;
    const proof = formData.get("proof") as File | null;

    if (!contentId) {
      return NextResponse.json({ success: false, error: "缺少contentId" }, { status: 400 });
    }
    if (!proof || proof.size === 0) {
      return NextResponse.json({ success: false, error: "请上传凭证截图" }, { status: 400 });
    }

    // 归属校验：内容必须属于该学生
    const { data: content } = await supabaseAdmin
      .from("member_contents")
      .select("id, member_id")
      .eq("id", contentId)
      .eq("student_id", userId)
      .single();

    if (!content) {
      return NextResponse.json({ success: false, error: "内容不存在或无权操作" }, { status: 404 });
    }

    const ext = (proof.name.split(".").pop() || "png").toLowerCase();
    const fileName = `publish-proof/${content.member_id}/${contentId}_${Date.now()}.${ext}`;
    const arrayBuffer = await proof.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("member-photos")
      .upload(fileName, arrayBuffer, {
        contentType: proof.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-publish-proof] Storage upload error:", uploadError);
      return NextResponse.json({ success: false, error: "凭证上传失败" }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("member-photos")
      .getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (err: any) {
    console.error("[upload-publish-proof] Error:", err);
    return NextResponse.json({ success: false, error: "上传失败" }, { status: 500 });
  }
}

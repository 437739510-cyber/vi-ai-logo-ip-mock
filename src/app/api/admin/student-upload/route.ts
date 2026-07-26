export const dynamic = "force-dynamic"
// API Route: POST /api/admin/student-upload
// 大学生为客户上传照片到已有内容记录
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get("admin_role")?.value;
    const userId = cookieStore.get("admin_user_id")?.value;

    if (role !== "student" || !userId) {
      return NextResponse.json({ success: false, error: "仅大学生可操作" }, { status: 403 });
    }

    const formData = await req.formData();
    const contentId = formData.get("contentId") as string;
    const photos = formData.getAll("photos") as File[];

    if (!contentId) {
      return NextResponse.json({ success: false, error: "缺少contentId" }, { status: 400 });
    }

    // 验证内容记录属于该大学生
    const { data: content } = await supabaseAdmin
      .from("member_contents")
      .select("id, images, member_id")
      .eq("id", contentId)
      .eq("student_id", userId)
      .single();

    if (!content) {
      return NextResponse.json({ success: false, error: "内容不存在" }, { status: 404 });
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json({ success: false, error: "请上传至少1张照片" }, { status: 400 });
    }

    // 上传照片到Supabase Storage
    const existingImages: string[] = content.images || [];
    const newImageUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${content.member_id}/${Date.now()}_${i}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("member-photos")
        .upload(fileName, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[student-upload] Storage upload error:", uploadError);
        newImageUrls.push(`pending_${existingImages.length + i}`);
      } else {
        const { data: urlData } = supabaseAdmin.storage
          .from("member-photos")
          .getPublicUrl(fileName);
        newImageUrls.push(urlData.publicUrl);
      }
    }

    // 更新内容记录的images
    const updatedImages = [...existingImages, ...newImageUrls];
    const { error: updateError } = await supabaseAdmin
      .from("member_contents")
      .update({ images: updatedImages })
      .eq("id", contentId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      images: updatedImages,
      message: `已上传${newImageUrls.length}张照片`,
    });
  } catch (err: any) {
    console.error("[student-upload] Error:", err);
    return NextResponse.json({ success: false, error: "上传失败" }, { status: 500 });
  }
}

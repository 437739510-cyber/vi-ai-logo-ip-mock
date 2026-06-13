// API Route: POST /api/payment/upload-screenshot
// Guest uploads payment screenshot after scanning QR code
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;

    if (!file || !projectId) {
      return NextResponse.json({ error: "缺少文件或项目编号" }, { status: 400 });
    }

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "文件不能超过10MB" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }

    // Upload to Supabase storage
    const ext = file.name.split(".").pop() || "png";
    const filePath = `payment-screenshots/${projectId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("brand-brain-generated")
      .upload(filePath, buffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
      console.error("[payment-upload] Storage error:", uploadErr);
      return NextResponse.json({ error: "上传失败" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("brand-brain-generated")
      .getPublicUrl(filePath);

    const screenshotUrl = urlData.publicUrl;

    // Update project: save screenshot URL + change status
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("client_info")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    clientInfo.paymentScreenshot = screenshotUrl;
    clientInfo.paymentUploadedAt = new Date().toISOString();

    const { error: updateErr } = await supabaseAdmin
      .from("projects")
      .update({
        status: "payment_uploaded",
        client_info: clientInfo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (updateErr) {
      console.error("[payment-upload] Update error:", updateErr);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, screenshotUrl });
  } catch (error: any) {
    console.error("[payment-upload] Error:", error);
    return NextResponse.json({ error: error.message || "上传失败" }, { status: 500 });
  }
}

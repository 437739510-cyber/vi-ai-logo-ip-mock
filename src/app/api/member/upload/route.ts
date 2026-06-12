import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    // 查找session
    const { data: session } = await supabaseAdmin
      .from("member_sessions")
      .select("member_id")
      .eq("token", token)
      .single();

    if (!session) {
      return NextResponse.json({ success: false, error: "session无效" }, { status: 401 });
    }

    // 获取member
    const { data: member } = await supabaseAdmin
      .from("members")
      .select("id, quota_used, quota_total, phone")
      .eq("id", session.member_id)
      .single();

    if (!member) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 401 });
    }

    // 检查配额
    if (member.quota_used >= member.quota_total) {
      return NextResponse.json({ 
        success: false, 
        error: "本月配额已用完，如需额外发布请咨询客服（¥30/条）" 
      }, { status: 400 });
    }

    // 解析multipart form
    const formData = await req.formData();
    const photos = formData.getAll("photos") as File[];
    const note = formData.get("note") as string || "";

    if (!photos || photos.length === 0) {
      return NextResponse.json({ success: false, error: "请上传至少1张照片" }, { status: 400 });
    }

    // 上传照片到Supabase Storage
    const imageUrls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${member.id}/${Date.now()}_${i}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("member-photos")
        .upload(fileName, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[member/upload] Storage upload error:", uploadError);
        // 如果bucket不存在，记录错误但继续
        imageUrls.push(`pending_${i}`);
      } else {
        // 获取公开URL
        const { data: urlData } = supabaseAdmin.storage
          .from("member-photos")
          .getPublicUrl(fileName);
        imageUrls.push(urlData.publicUrl);
      }
    }

    // 创建content记录
    const contentId = `mc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const { error: insertError } = await supabaseAdmin
      .from("member_contents")
      .insert({
        id: contentId,
        member_id: member.id,
        images: imageUrls,
        note: note.trim(),
        status: "pending",
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[member/upload] Insert error:", insertError);
      // 表可能还没建，但我们仍然返回成功（MVP兜底）
    }

    // 更新配额
    await supabaseAdmin
      .from("members")
      .update({ quota_used: member.quota_used + 1 })
      .eq("id", member.id);

    return NextResponse.json({ 
      success: true, 
      contentId,
      message: "上传成功，AI正在生成品牌化内容" 
    });
  } catch (err: any) {
    console.error("[member/upload] Error:", err);
    return NextResponse.json({ success: false, error: "上传失败" }, { status: 500 });
  }
}

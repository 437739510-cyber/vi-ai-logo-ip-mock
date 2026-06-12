import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET() {
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
      .select("id, quota_used, quota_total, plan")
      .eq("id", session.member_id)
      .single();

    if (!member) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 401 });
    }

    // 获取内容列表
    const { data: contents, error } = await supabaseAdmin
      .from("member_contents")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // 表可能还没建，返回空列表
      return NextResponse.json({ success: true, contents: [], quotaUsed: member.quota_used, quotaTotal: member.quota_total, plan: member.plan || "free" });
    }

    // 处理数据：从images中分离composed_前缀的合成图
    const processedContents = (contents || []).map((item: any) => {
      const images: string[] = item.images || [];
      const composedFromImages: { template: string; url: string }[] = [];
      const realImages: string[] = [];
      
      for (const img of images) {
        if (typeof img === 'string' && img.startsWith('composed_')) {
          const colonIdx = img.indexOf(':');
          if (colonIdx > 0) {
            composedFromImages.push({
              template: img.substring(9, colonIdx), // skip "composed_"
              url: img.substring(colonIdx + 1),
            });
          }
        } else {
          realImages.push(img);
        }
      }
      
      return {
        ...item,
        images: realImages,
        composed_images: [...(item.composed_images || []), ...composedFromImages],
      };
    });

    return NextResponse.json({ 
      success: true, 
      contents: processedContents, 
      quotaUsed: member.quota_used, 
      quotaTotal: member.quota_total, 
      plan: member.plan || "free" 
    });
  } catch (err: any) {
    console.error("[member/contents] Error:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}

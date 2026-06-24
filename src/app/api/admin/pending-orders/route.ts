// API Route: GET /api/admin/pending-orders
// Hermes 巡检用：返回需要人工/智能处理的订单
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = req.cookies.get("admin_auth")?.value;
    const role = req.cookies.get("admin_role")?.value;
    if (auth !== "true" || !role) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    // 查三种待处理状态：
    // 1. submitted + storePhotos有图 → 需要我看图分析
    // 2. payment_uploaded → 需要确认付款
    const { data: projects, error } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, status, client_info, created_at, updated_at")
      .in("status", ["submitted", "payment_uploaded"])
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 补充 submission 信息（公司名、手机号、店內照等）
    const submissionIds = projects
      .map((p: any) => p.submission_id)
      .filter(Boolean);

    let submissions: any[] = [];
    if (submissionIds.length > 0) {
      const { data: subs } = await supabaseAdmin
        .from("submissions")
        .select("id, company_name, phone, store_photos, description")
        .in("id", submissionIds);
      submissions = subs || [];
    }

    const subMap = new Map(submissions.map((s: any) => [s.id, s]));

    const orders = projects.map((p: any) => {
      const ci = (p.client_info || {}) as Record<string, any>;
      const sub = subMap.get(p.submission_id);
      const storePhotos: string[] = sub?.store_photos || ci?.storePhotos || [];
      const paymentScreenshot: string | null = ci?.paymentScreenshot || null;
      const needsPhotoAnalysis = p.status === "submitted" && storePhotos.length > 0;
      const needsPaymentConfirm = p.status === "payment_uploaded";

      return {
        projectId: p.id,
        status: p.status,
        companyName: sub?.company_name || ci?.companyName || "",
        phone: sub?.phone || "",
        description: (sub?.description || "").slice(0, 200),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        hasStorePhotos: storePhotos.length > 0,
        storePhotoCount: storePhotos.length,
        storePhotos: storePhotos,
        hasPaymentScreenshot: !!paymentScreenshot,
        paymentScreenshot: paymentScreenshot,
        needsPhotoAnalysis,
        needsPaymentConfirm,
      };
    });

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error("[pending-orders] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "服务器错误" }, { status: 500 });
  }
}

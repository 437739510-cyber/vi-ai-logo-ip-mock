export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);

    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    const { role, userId } = session;

    let memberPhones: string[] = [];
    let brandMap: Record<string, string> = {};

    if (role === "student" && userId) {
      // 大学生：通过student_assignments -> projects -> submissions 找客户phone
      const { data: assignments } = await supabaseAdmin
        .from("student_assignments")
        .select("project_id")
        .eq("student_id", userId);

      const projectIds = (assignments || []).map((a: any) => a.project_id).filter(Boolean);
      if (projectIds.length === 0) {
        return NextResponse.json({ success: true, clients: [] });
      }

      // projects -> submission_id
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("id, submission_id")
        .in("id", projectIds);

      const submissionIds = (projects || []).map((p: any) => p.submission_id).filter(Boolean);
      if (submissionIds.length === 0) {
        return NextResponse.json({ success: true, clients: [] });
      }

      // submissions -> phone + company_name
      const { data: subs } = await supabaseAdmin
        .from("submissions")
        .select("phone, company_name")
        .in("id", submissionIds);

      memberPhones = (subs || []).map((s: any) => s.phone).filter(Boolean);
      (subs || []).forEach((s: any) => {
        if (s.phone && s.company_name) brandMap[s.phone] = s.company_name;
      });
    }

    // 查members
    let query = supabaseAdmin.from("members").select("id, phone, name, plan, quota_used, quota_total");
    if (memberPhones.length > 0) {
      query = query.in("phone", memberPhones);
    }

    const { data: members, error } = await query.order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 管理员需补brand_name
    const allPhones = [...new Set((members || []).map((m: any) => m.phone).filter(Boolean))];
    if (allPhones.length > 0 && Object.keys(brandMap).length === 0) {
      const { data: subs } = await supabaseAdmin
        .from("submissions")
        .select("phone, company_name")
        .in("phone", allPhones);
      (subs || []).forEach((s: any) => {
        if (s.company_name) brandMap[s.phone] = s.company_name;
      });
    }

    const result = (members || []).map(m => ({
      ...m,
      brand_name: brandMap[m.phone] || m.name || m.phone,
    }));

    return NextResponse.json({ success: true, clients: result });
  } catch {
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}

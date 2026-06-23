import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export async function POST(req: NextRequest) {
  try {
    const auth = req.cookies.get("admin_auth")?.value;
    const role = req.cookies.get("admin_role")?.value;
    if (auth !== "true" || !role) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ success: false, error: "缺少项目ID" }, { status: 400 });
    }

    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects").select("*").eq("id", projectId).single();

    if (projErr || !project) {
      return NextResponse.json({ success: false, error: "项目不存在" }, { status: 404 });
    }

    if (project.status === "paid") {
      await supabaseAdmin.from("projects")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", projectId);
      return NextResponse.json({ success: true, status: "reverted" });
    }

    await supabaseAdmin.from("projects")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    // Fire-and-forget generation chain
    const baseUrl = req.headers.get("origin") || "";
    const ci = (project.client_info || {}) as Record<string, any>;
    const bp = (ci.brandProfile || {}) as Record<string, any>;
    const needsAnalysis = !bp.logoDesignSuggestions?.prompts?.length;

    const triggerGen = (url: string, body: any) => {
      fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(e => console.warn("[mark-paid] trigger failed:", e));
    };

    if (needsAnalysis) {
      triggerGen(`${baseUrl}/api/ai/analyze-brand`, {
        projectId, clientInfo: {
          companyName: ci.companyName || "",
          industry: ci.industry || "", province: ci.province || "",
          city: ci.city || "", brandVision: ci.brandVision || "",
          coreValues: ci.coreValues || "", targetMarket: ci.targetMarket || "",
          mainProducts: ci.mainProducts || "", description: ci.description || "",
          logoPhilosophy: ci.logoPhilosophy || "", mascotPhilosophy: ci.mascotPhilosophy || "",
        },
      });
      setTimeout(() => triggerGen(`${baseUrl}/api/ai/generate-logo`, { projectId }), 2000);
    } else {
      triggerGen(`${baseUrl}/api/ai/generate-logo`, { projectId });
    }

    return NextResponse.json({ success: true, status: "paid", message: "已收款，正在生成" });
  } catch (error) {
    console.error("[mark-paid] Error:", error);
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}

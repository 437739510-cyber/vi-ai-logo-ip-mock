// API Route: GET /api/ai/get-project-status
// V12: Get project generation status for real-time progress tracking
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Generation status workflow
export type GenerationStatus = 
  | "pending"           // 初始状态
  | "brand_analyzing"   // 品牌分析中
  | "logo_generating"   // Logo生成中
  | "logo_selecting"    // Logo选择中
  | "scene_rendering"   // 场景渲染中
  | "pptx_assembling"   // PPTX组装中
  | "completed"         // 完成
  | "failed";           // 失败

const STATUS_LABELS: Record<GenerationStatus, string> = {
  pending: "等待处理",
  brand_analyzing: "AI品牌分析中",
  logo_generating: "Logo生成中",
  logo_selecting: "Logo选择中",
  scene_rendering: "场景图渲染中",
  pptx_assembling: "手册组装中",
  completed: "已完成",
  failed: "生成失败"
};

const STATUS_PROGRESS: Record<GenerationStatus, number> = {
  pending: 0,
  brand_analyzing: 20,
  logo_generating: 40,
  logo_selecting: 50,
  scene_rendering: 70,
  pptx_assembling: 90,
  completed: 100,
  failed: 0
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Query project from Supabase
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, status, client_info, updated_at, created_at")
      .eq("id", projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get current status
    const clientInfo = (project.client_info as Record<string, any>) || {};
    const currentStatus = (clientInfo.generationStatus as GenerationStatus) || "pending";
    const statusMessage = clientInfo.generationMessage || STATUS_LABELS[currentStatus];
    const progress = STATUS_PROGRESS[currentStatus];

    // Get additional details
    const details = {
      logoGenerated: !!clientInfo.logoAssets?.length,
      logoSelected: !!clientInfo.selectedLogo,
      manualGenerated: !!clientInfo.manualGenerated,
      pdfGenerated: !!clientInfo.pdfUrl,
    };

    return NextResponse.json({
      projectId,
      status: currentStatus,
      statusLabel: STATUS_LABELS[currentStatus],
      statusMessage,
      progress,
      details,
      updatedAt: project.updated_at,
      createdAt: project.created_at,
    });
  } catch (error) {
    console.error("[get-project-status] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

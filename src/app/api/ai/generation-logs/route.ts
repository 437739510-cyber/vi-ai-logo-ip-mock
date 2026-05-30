/**
 * API: GET /api/ai/generation-logs
 * 获取生成日志列表和详情
 */
import { NextRequest, NextResponse } from "next/server";
import { listGenerationLogs, getLatestProjectLog } from "@/lib/generation-logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    if (projectId) {
      const log = await getLatestProjectLog(projectId);
      return NextResponse.json({ success: true, log });
    }

    const logs = await listGenerationLogs(limit);
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load logs" }, { status: 500 });
  }
}

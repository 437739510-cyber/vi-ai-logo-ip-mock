export const dynamic = "force-dynamic"
import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/core/supabase";

export async function GET() {
  try {
    // V89: 合并两个数据源 - projects.arkUsageLog + api_usage_log

    // 1. 从projects.arkUsageLog读取图片/视觉数据
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, client_info, created_at");

    // 2. 从api_usage_log读取qwen-vl-plus等追踪数据
    const { data: usageLogs } = await supabaseAdmin
      .from("api_usage_log")
      .select("route, model, cost_cny, request_summary, response_status, created_at")
      .order("created_at", { ascending: false });

    const summary = {
      totalImageCost: 0,
      totalVisionCost: 0,
      totalImages: 0,
      totalVisionCalls: 0,
      totalDeepseekCost: 0,
      totalDeepseekCalls: 0,
      byModel: {} as Record<string, { count: number; cost: number }>,
      byProject: [] as Array<{ id: string; images: number; visionCalls: number; cost: number }>,
      byType: {} as Record<string, { count: number; cost: number }>,
      byRoute: {} as Record<string, { count: number; cost: number }>,
    };

    // 处理projects.arkUsageLog（图片生成+视觉识别）
    if (projects) {
      for (const p of projects) {
        const ci = p.client_info || {};
        const ark = ci.arkUsageLog || [];
        let projectImages = 0;
        let projectVision = 0;
        let projectCost = 0;

        for (const entry of ark) {
          const model = entry.model || 'unknown';
          const type = entry.type || 'unknown';
          const cost = entry.cost || 0;

          if (type === 'vision') {
            projectVision++;
            summary.totalVisionCalls++;
            summary.totalVisionCost += cost;
          } else {
            projectImages++;
            summary.totalImages++;
            summary.totalImageCost += cost;
          }
          projectCost += cost;

          if (!summary.byModel[model]) summary.byModel[model] = { count: 0, cost: 0 };
          summary.byModel[model].count++;
          summary.byModel[model].cost += cost;

          if (!summary.byType[type]) summary.byType[type] = { count: 0, cost: 0 };
          summary.byType[type].count++;
          summary.byType[type].cost += cost;
        }

        if (projectCost > 0) {
          summary.byProject.push({ id: p.id, images: projectImages, visionCalls: projectVision, cost: Math.round(projectCost * 100) / 100 });
        }
      }
    }

    // V89: 处理api_usage_log（qwen-vl + DeepSeek等）
    if (usageLogs) {
      for (const log of usageLogs) {
        const model = log.model || 'unknown';
        const route = log.route || 'unknown';
        const cost = log.cost_cny || 0;

        // 按模型分类
        if (!summary.byModel[model]) summary.byModel[model] = { count: 0, cost: 0 };
        summary.byModel[model].count++;
        summary.byModel[model].cost += cost;

        // 按路由分类
        if (!summary.byRoute[route]) summary.byRoute[route] = { count: 0, cost: 0 };
        summary.byRoute[route].count++;
        summary.byRoute[route].cost += cost;

        // 按类型分类
        if (model.includes('qwen-vl')) {
          summary.totalVisionCalls++;
          summary.totalVisionCost += cost;
          if (!summary.byType['vision']) summary.byType['vision'] = { count: 0, cost: 0 };
          summary.byType['vision'].count++;
          summary.byType['vision'].cost += cost;
        } else if (model.includes('deepseek')) {
          summary.totalDeepseekCalls++;
          summary.totalDeepseekCost += cost;
          if (!summary.byType['deepseek']) summary.byType['deepseek'] = { count: 0, cost: 0 };
          summary.byType['deepseek'].count++;
          summary.byType['deepseek'].cost += cost;
        } else if (model.includes('wan') || model.includes('seedream') || model.includes('t2i') || model.includes('liblibai')) {
          summary.totalImages++;
          summary.totalImageCost += cost;
          if (!summary.byType['image']) summary.byType['image'] = { count: 0, cost: 0 };
          summary.byType['image'].count++;
          summary.byType['image'].cost += cost;
        }
      }
    }

    // Sort
    summary.byProject.sort((a, b) => b.cost - a.cost);

    return NextResponse.json(summary);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

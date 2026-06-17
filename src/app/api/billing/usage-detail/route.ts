import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

export async function GET() {
  try {
    // Fetch all projects with arkUsageLog
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/projects?select=id,client_info,created_at`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });

    const projects = await res.json();

    const summary = {
      totalImageCost: 0,
      totalVisionCost: 0,
      totalImages: 0,
      totalVisionCalls: 0,
      byModel: {} as Record<string, { count: number; cost: number }>,
      byProject: [] as Array<{ id: string; images: number; visionCalls: number; cost: number }>,
      byType: {} as Record<string, { count: number; cost: number }>,
    };

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

        // Count
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

        // By model
        if (!summary.byModel[model]) summary.byModel[model] = { count: 0, cost: 0 };
        summary.byModel[model].count++;
        summary.byModel[model].cost += cost;

        // By type
        if (!summary.byType[type]) summary.byType[type] = { count: 0, cost: 0 };
        summary.byType[type].count++;
        summary.byType[type].cost += cost;
      }

      if (projectCost > 0) {
        summary.byProject.push({ id: p.id, images: projectImages, visionCalls: projectVision, cost: Math.round(projectCost * 100) / 100 });
      }
    }

    // Sort by cost desc
    summary.byProject.sort((a, b) => b.cost - a.cost);

    return NextResponse.json(summary);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

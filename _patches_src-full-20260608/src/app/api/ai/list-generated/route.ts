import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const manuals: any[] = [];

    // Query vi_manuals from Supabase (primary source)
    try {
      // Use anon key (supabase) since the vi_manuals table allows SELECT via RLS for anon
      const { data: viManuals } = await supabase
        .from("vi_manuals")
        .select("id, project_id, pages, generated_at, pdf_url")
        .eq("project_id", projectId)
        .order("generated_at", { ascending: false })
        .limit(1);

      if (viManuals && viManuals.length > 0) {
        const vm = viManuals[0];
        manuals.push({
          id: vm.project_id || projectId,
          generatedAt: vm.generated_at || new Date().toISOString(),
          totalPages: vm.pages?.length || 0,
          failedPages: 0,
          hasPdf: !!vm.pdf_url,
          pdfUrl: vm.pdf_url,
          source: "vi_manuals",
        });
      }
    } catch (dbErr) {
      console.warn("[list-generated] Supabase query error:", dbErr);
    }

    return NextResponse.json({ success: true, manuals });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

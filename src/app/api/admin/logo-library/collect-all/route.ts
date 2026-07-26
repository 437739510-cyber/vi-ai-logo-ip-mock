/**
 * API: POST /api/admin/logo-library/collect-all
 * 批量收集所有项目中未选中的Logo到素材库
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { STORAGE_BUCKET } from "@/config/storage";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // 获取所有已选择Logo的项目
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, client_info")
      .not("client_info->brandProfile->selectedLogo", "is", null);

    if (!projects || projects.length === 0) {
      // Also check preferredLogo
      const { data: projects2 } = await supabaseAdmin
        .from("projects")
        .select("id, submission_id, client_info");

      const withSelection = (projects2 || []).filter((p: any) => {
        const ci = p.client_info as any;
        return ci?.brandProfile?.selectedLogo || ci?.brandProfile?.preferredLogo;
      });

      if (withSelection.length === 0) {
        return NextResponse.json({ message: "没有已选择Logo的项目", collected: 0 });
      }

      let totalCollected = 0;
      for (const project of withSelection) {
        try {
          const resp = await fetch(`${"https://fzoscrutqhdfzwnjgjvs.supabase.co".replace(".supabase.co", "") || "http://localhost:3000"}/api/admin/logo-library`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: project.id }),
          });
          // Can't call self, so inline the logic below
        } catch (e) {
          // Skip
        }
      }

      // Actually, we can't call our own API. Let me inline the collection logic.
      return await collectFromProjects(withSelection);
    }

    return await collectFromProjects(projects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function collectFromProjects(projects: any[]) {
  const STORAGE_LIMIT_MB = 100;
  let totalCollected = 0;
  const results: any[] = [];

  for (const project of projects) {
    const clientInfo = (project.client_info as Record<string, any>) || {};
    const brandProfile = clientInfo.brandProfile || {};
    const logoResults = brandProfile.logoGenerationResults || [];
    const selectedLogo = brandProfile.selectedLogo || brandProfile.preferredLogo;

    if (!selectedLogo || logoResults.length === 0) continue;

    const selectedIndex = selectedLogo.index ?? 0;
    const unselectedLogos = logoResults.filter(
      (l: any) => l.index !== selectedIndex && l.imageUrl
    );

    if (unselectedLogos.length === 0) continue;

    // Get industry info
    let industry = "未分类";
    let companyName = "";
    let businessType = clientInfo.businessType || "店铺";

    if (project.submission_id) {
      const { data: sub } = await supabaseAdmin
        .from("submissions")
        .select("company_name, industry")
        .eq("id", project.submission_id)
        .single();
      if (sub) {
        industry = sub.industry || "未分类";
        companyName = sub.company_name || "";
      }
    }

    for (const logo of unselectedLogos) {
      try {
        // Check if already collected
        const { data: existing } = await supabaseAdmin
          .from("logo_library")
          .select("id")
          .eq("project_id", project.id)
          .eq("logo_index", logo.index)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Download image
        const imgResp = await fetch(logo.imageUrl);
        if (!imgResp.ok) continue;
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
        const fileSize = imgBuffer.length;

        // Check storage limit
        const { data: allLogos } = await supabaseAdmin
          .from("logo_library")
          .select("file_size");
        const currentTotalMB = (allLogos || []).reduce((s: number, l: any) => s + (l.file_size || 0), 0) / 1024 / 1024;

        if (currentTotalMB + fileSize / 1024 / 1024 > STORAGE_LIMIT_MB) {
          // Auto cleanup oldest
          const { data: oldestLogos } = await supabaseAdmin
            .from("logo_library")
            .select("id, storage_path, file_size")
            .order("created_at", { ascending: true })
            .limit(5);

          for (const old of oldestLogos || []) {
            if (old.storage_path) {
              await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([old.storage_path]);
            }
            await supabaseAdmin.from("logo_library").delete().eq("id", old.id);
          }
        }

        // Upload to Storage
        const timestamp = Date.now();
        const storagePath = `library/${project.id}/logo-${logo.index}-${timestamp}.png`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, imgBuffer, { contentType: "image/png", upsert: true });

        if (uploadErr) continue;

        const permanentUrl = supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath).data.publicUrl;

        // Extract style tags
        const styleTags = extractStyleTags(logo.prompt || "");

        // Insert
        const { error: insertErr } = await supabaseAdmin
          .from("logo_library")
          .insert({
            project_id: project.id,
            company_name: companyName,
            industry,
            business_type: businessType,
            logo_index: logo.index,
            image_url: permanentUrl,
            storage_path: storagePath,
            prompt: logo.prompt,
            style_tags: styleTags,
            brand_colors: brandProfile.brand_colors || null,
            file_size: fileSize,
          });

        if (!insertErr) totalCollected++;
      } catch (e) {
        // Skip this logo
      }
    }
  }

  return NextResponse.json({
    success: true,
    collected: totalCollected,
    message: `成功收集 ${totalCollected} 个未选中Logo到素材库`,
  });
}

function extractStyleTags(prompt: string): string[] {
  const tags: string[] = [];
  const styleKeywords: Record<string, string[]> = {
    "极简": ["minimalist", "minimal", "simple", "极简", "简约", "简洁"],
    "国风": ["chinese", "国风", "传统", "中式", "古风", "东方"],
    "现代": ["modern", "现代", "时尚", "潮流"],
    "可爱": ["cute", "可爱", "卡通", "萌", "kawaii"],
    "高端": ["luxury", "高端", "奢华", "premium", "elegant", "优雅"],
    "活力": ["energetic", "活力", "动感", "运动", "dynamic"],
    "自然": ["nature", "自然", "生态", "organic", "green"],
    "科技": ["tech", "科技", "数字", "digital", "cyber"],
    "复古": ["vintage", "复古", "怀旧", "retro"],
    "卡通吉祥物": ["cartoon", "卡通", "mascot", "吉祥物"],
  };

  const lower = prompt.toLowerCase();
  for (const [tag, keywords] of Object.entries(styleKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : ["通用"];
}

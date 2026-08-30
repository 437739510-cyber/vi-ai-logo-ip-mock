/**
 * API: GET /api/admin/logo-library
 * 获取Logo素材库列表，支持按行业/经营形态筛选
 * 
 * API: POST /api/admin/logo-library
 * 收集未选中的Logo到素材库（客户选择Logo时自动调用）
 * 
 * API: DELETE /api/admin/logo-library
 * 支持单条删除（传id参数）或批量清理最旧（传free_mb参数）
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { STORAGE_BUCKET } from "@/config/storage";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";

export const dynamic = "force-dynamic";

const STORAGE_LIMIT_MB = 100;

// GET: 获取素材库列表
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const industry = searchParams.get("industry");
    const businessType = searchParams.get("business_type");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "40");

    let query = supabaseAdmin
      .from("logo_library")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (industry) query = query.eq("industry", industry);
    if (businessType) query = query.eq("business_type", businessType);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 获取存储统计
    const { data: allLogos } = await supabaseAdmin
      .from("logo_library")
      .select("file_size, industry, business_type");

    const totalSize = (allLogos || []).reduce((sum: number, l: any) => sum + (l.file_size || 0), 0);
    const totalSizeMB = totalSize / 1024 / 1024;

    // 按行业统计
    const industryStats: Record<string, number> = {};
    (allLogos || []).forEach((l: any) => {
      const ind = l.industry || "未分类";
      industryStats[ind] = (industryStats[ind] || 0) + 1;
    });

    // 按经营形态统计
    const typeStats: Record<string, number> = {};
    (allLogos || []).forEach((l: any) => {
      const bt = l.business_type || "店铺";
      typeStats[bt] = (typeStats[bt] || 0) + 1;
    });

    return NextResponse.json({
      logos: data || [],
      total: count || 0,
      page,
      pageSize,
      storage: {
        usedMB: Math.round(totalSizeMB * 100) / 100,
        limitMB: STORAGE_LIMIT_MB,
        usedPercent: Math.round((totalSizeMB / STORAGE_LIMIT_MB) * 1000) / 10,
      },
      industryStats,
      typeStats,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 收集未选中的Logo到素材库
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
    }
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // 获取项目数据
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, client_info")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    const brandProfile = clientInfo.brandProfile || {};
    const logoResults = brandProfile.logoGenerationResults || [];
    const selectedLogo = brandProfile.selectedLogo || brandProfile.preferredLogo;

    if (!selectedLogo) {
      return NextResponse.json({ error: "尚未选择Logo，无法收集未选中方案" }, { status: 400 });
    }

    const selectedIndex = selectedLogo.index ?? 0;

    // 获取行业信息
    let industry = "未分类";
    let companyName = "";
    let businessType = "店铺";

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

    // 从品牌分析中获取经营形态
    if (clientInfo.businessType) {
      businessType = clientInfo.businessType;
    }

    // 收集未选中的Logo
    const unselectedLogos = logoResults.filter(
      (l: any) => l.index !== selectedIndex && l.imageUrl
    );

    if (unselectedLogos.length === 0) {
      return NextResponse.json({ message: "没有未选中的Logo可收集" });
    }

    // 检查存储空间
    const { data: allLogos } = await supabaseAdmin
      .from("logo_library")
      .select("file_size");

    const currentTotal = (allLogos || []).reduce((sum: number, l: any) => sum + (l.file_size || 0), 0);
    const currentTotalMB = currentTotal / 1024 / 1024;

    // 下载每个未选中的Logo并转存到brand-brain-generated/library/目录
    const results = [];
    for (const logo of unselectedLogos) {
      try {
        // 检查是否已存在
        const { data: existing } = await supabaseAdmin
          .from("logo_library")
          .select("id")
          .eq("project_id", projectId)
          .eq("logo_index", logo.index)
          .limit(1);

        if (existing && existing.length > 0) {
          results.push({ index: logo.index, status: "already_exists" });
          continue;
        }

        // 下载图片
        const imgResp = await fetch(logo.imageUrl);
        if (!imgResp.ok) {
          results.push({ index: logo.index, status: "download_failed" });
          continue;
        }
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
        const fileSize = imgBuffer.length;

        // 检查是否超限
        if ((currentTotalMB + fileSize / 1024 / 1024) > STORAGE_LIMIT_MB) {
          // 自动清理最旧的
          await cleanupOldest(fileSize / 1024 / 1024);
        }

        // 上传到Storage
        const timestamp = Date.now();
        const storagePath = `library/${projectId}/logo-${logo.index}-${timestamp}.png`;

        const { error: uploadErr } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, imgBuffer, { contentType: "image/png", upsert: true });

        if (uploadErr) {
          results.push({ index: logo.index, status: "upload_failed", error: uploadErr.message });
          continue;
        }

        const permanentUrl = supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath).data.publicUrl;

        // 提取风格标签
        const styleTags = extractStyleTags(logo.prompt || "");

        // 插入数据库
        const { error: insertErr } = await supabaseAdmin
          .from("logo_library")
          .insert({
            project_id: projectId,
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

        if (insertErr) {
          results.push({ index: logo.index, status: "insert_failed", error: insertErr.message });
        } else {
          results.push({ index: logo.index, status: "collected", size: fileSize });
        }
      } catch (err: any) {
        results.push({ index: logo.index, status: "error", error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      collected: results.filter((r) => r.status === "collected").length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 单条删除(id参数) 或 批量清理最旧(free_mb参数)
export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    
    // 单条删除模式
    const deleteId = searchParams.get("id");
    if (deleteId) {
      // 先获取记录（需要storage_path来删除文件）
      const { data: logo, error: fetchErr } = await supabaseAdmin
        .from("logo_library")
        .select("id, storage_path, file_size")
        .eq("id", deleteId)
        .single();

      if (fetchErr || !logo) {
        return NextResponse.json({ error: "Logo不存在" }, { status: 404 });
      }

      // 删除Storage文件
      if (logo.storage_path) {
        await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .remove([logo.storage_path]);
      }

      // 删除数据库记录
      const { error: delErr } = await supabaseAdmin
        .from("logo_library")
        .delete()
        .eq("id", deleteId);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      const freedKB = Math.round((logo.file_size || 0) / 1024);
      return NextResponse.json({ 
        success: true, 
        deleted: 1, 
        freedKB,
        message: `已删除，释放${freedKB}KB`
      });
    }

    // 批量清理最旧模式
    const targetFreeMB = parseFloat(searchParams.get("free_mb") || "5");
    const result = await cleanupOldest(targetFreeMB);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 自动清理最旧的Logo直到腾出足够空间
async function cleanupOldest(targetFreeMB: number): Promise<{ deleted: number; freedMB: number }> {
  let deleted = 0;
  let freedMB = 0;

  const { data: allLogos } = await supabaseAdmin
    .from("logo_library")
    .select("id, storage_path, file_size")
    .order("created_at", { ascending: true });

  if (!allLogos || allLogos.length === 0) return { deleted: 0, freedMB: 0 };

  for (const logo of allLogos) {
    if (freedMB >= targetFreeMB) break;

    // 从Storage删除文件
    if (logo.storage_path) {
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove([logo.storage_path]);
    }

    // 从数据库删除记录
    await supabaseAdmin.from("logo_library").delete().eq("id", logo.id);

    freedMB += (logo.file_size || 0) / 1024 / 1024;
    deleted++;
  }

  return { deleted, freedMB: Math.round(freedMB * 100) / 100 };
}

// 从prompt中提取风格标签
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
    "可爱卡通": ["cartoon", "卡通", "mascot", "吉祥物"],
  };

  const lower = prompt.toLowerCase();
  for (const [tag, keywords] of Object.entries(styleKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : ["通用"];
}

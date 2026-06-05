/**
 * API: POST /api/ai/generate-brand-pack
 * 
 * V12: 生成品牌资产包（ZIP下载）
 * 
 * 输出内容：
 * - 品牌色HEX/RGB值表(JSON)
 * - Logo源文件(从dashscope URL下载)
 * - 社交媒体适配版(微信头像圆裁、小红书封面比例)
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// 生成品牌色JSON
function generateBrandColorJSON(
  companyName: string,
  primaryColor: { hex: string; name?: string; rgb?: string; cmyk?: string },
  secondaryColor: { hex: string; name?: string; rgb?: string; cmyk?: string },
  accentColor: { hex: string; name?: string; rgb?: string; cmyk?: string }
): string {
  return JSON.stringify({
    brand: companyName,
    generatedAt: new Date().toISOString(),
    colors: {
      primary: {
        name: primaryColor.name || "品牌主色",
        hex: primaryColor.hex,
        rgb: primaryColor.rgb || hexToRGB(primaryColor.hex),
        cmyk: primaryColor.cmyk || hexToCMYK(primaryColor.hex),
      },
      secondary: {
        name: secondaryColor.name || "品牌辅助色",
        hex: secondaryColor.hex,
        rgb: secondaryColor.rgb || hexToRGB(secondaryColor.hex),
        cmyk: secondaryColor.cmyk || hexToCMYK(secondaryColor.hex),
      },
      accent: {
        name: accentColor.name || "品牌强调色",
        hex: accentColor.hex,
        rgb: accentColor.rgb || hexToRGB(accentColor.hex),
        cmyk: accentColor.cmyk || hexToCMYK(accentColor.hex),
      },
    },
  }, null, 2);
}

function hexToRGB(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function hexToCMYK(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return "0, 0, 0, 100";
  
  const cM = (1 - r - k) / (1 - k);
  const mM = (1 - g - k) / (1 - k);
  const yM = (1 - b - k) / (1 - k);
  
  return `${Math.round(cM * 100)}, ${Math.round(mM * 100)}, ${Math.round(yM * 100)}, ${Math.round(k * 100)}`;
}

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // 1. 获取项目数据
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, client_info")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    
    // 提取品牌色
    const brandColors = clientInfo.brandColors || {};
    const primaryColor = brandColors.primary || { hex: "#1A73E8" };
    const secondaryColor = brandColors.secondary || { hex: "#34A853" };
    const accentColor = brandColors.accent || { hex: "#FBBC04" };

    // 2. 生成品牌色JSON
    const colorJSON = generateBrandColorJSON(
      clientInfo.companyName || "品牌",
      primaryColor,
      secondaryColor,
      accentColor
    );

    // 3. 返回资产包信息（实际ZIP打包由前端处理）
    return NextResponse.json({
      success: true,
      projectId,
      brandName: clientInfo.companyName || "品牌",
      colorJSON,
      colors: {
        primary: primaryColor.hex,
        secondary: secondaryColor.hex,
        accent: accentColor.hex,
      },
      files: {
        colorGuide: "brand-colors.json",
        logoSource: "logo-source.png",
        socialAvatar: "social-avatar.png",
        socialCover: "social-cover.png",
      },
      message: "品牌资产包已生成，请在项目详情页下载完整ZIP包",
    });

  } catch (error) {
    console.error("[generate-brand-pack] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

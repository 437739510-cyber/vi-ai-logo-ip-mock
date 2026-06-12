// API Route: POST /api/member/compose
// AI模板合成：照片底图 + Logo水印 + 品牌名文字 + 行业模板装饰 → 品牌化图片
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import sharp from "sharp";

// 3个模板
const TEMPLATES = {
  product_showcase: {
    name: "产品展示",
    layout: "bottom_bar",
    brandPos: "bottom_left",
    logoPos: "bottom_right",
    overlayColor: { r: 0, g: 0, b: 0, alpha: 0.45 },
    barHeight: 0.22,
  },
  promo: {
    name: "促销活动",
    layout: "top_banner",
    brandPos: "center",
    logoPos: "bottom_right",
    overlayColor: { r: 0, g: 0, b: 0, alpha: 0.35 },
    barHeight: 0.18,
  },
  daily: {
    name: "日常种草",
    layout: "corner_badge",
    brandPos: "bottom_left",
    logoPos: "top_right",
    overlayColor: { r: 0, g: 0, b: 0, alpha: 0.25 },
    barHeight: 0,
  },
};

export async function POST(req: NextRequest) {
  try {
    // 验证登录
    const cookieStore = await cookies();
    const token = cookieStore.get("member_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });

    const { data: session } = await supabaseAdmin
      .from("member_sessions").select("member_id").eq("token", token).single();
    if (!session) return NextResponse.json({ success: false, error: "session无效" }, { status: 401 });

    const { data: member } = await supabaseAdmin
      .from("members").select("id, phone, plan, quota_used, quota_total").eq("id", session.member_id).single();
    if (!member) return NextResponse.json({ success: false, error: "用户不存在" }, { status: 401 });

    const body = await req.json();
    const { contentId, template = "product_showcase" } = body;
    if (!contentId) return NextResponse.json({ success: false, error: "缺少contentId" }, { status: 400 });

    const tpl = TEMPLATES[template as keyof typeof TEMPLATES] || TEMPLATES.product_showcase;

    // 获取内容记录
    const { data: content } = await supabaseAdmin
      .from("member_contents").select("*").eq("id", contentId).eq("member_id", member.id).single();
    if (!content) return NextResponse.json({ success: false, error: "内容不存在" }, { status: 404 });

    // 获取品牌数据
    const { data: submissions } = await supabaseAdmin
      .from("submissions")
      .select("company_name, industry, brand_highlight, logo_url, existing_brand_color, main_products")
      .eq("phone", member.phone)
      .limit(5);

    const brand = submissions && submissions.length > 0 ? submissions[0] : null;
    const brandName = brand?.company_name || "品牌名";
    const brandSlogan = brand?.brand_highlight || "";
    const brandColor = brand?.existing_brand_color || "#FF6B35";
    const logoUrl = brand?.logo_url || "";

    // 找第一张真实照片
    const imageUrls: string[] = content.images || [];
    const photoUrl = imageUrls.find((u: string) => !u.startsWith("pending_"));
    if (!photoUrl) {
      return NextResponse.json({ success: false, error: "没有可用照片" }, { status: 400 });
    }

    // 下载照片
    const photoRes = await fetch(photoUrl);
    if (!photoRes.ok) return NextResponse.json({ success: false, error: "照片下载失败" }, { status: 400 });
    const photoBuffer = Buffer.from(await photoRes.arrayBuffer());

    // 加载照片到sharp
    const photoMeta = await sharp(photoBuffer).metadata();
    const origW = photoMeta.width || 1080;
    const origH = photoMeta.height || 1080;

    // 统一输出为1080x1080（社交平台最佳尺寸）
    const OUT = 1080;
    const resizedPhoto = await sharp(photoBuffer)
      .resize(OUT, OUT, { fit: "cover", position: "center" })
      .jpeg({ quality: 92 })
      .toBuffer();

    // 构建合成图层
    const composites: sharp.OverlayOptions[] = [];

    // 1. 半透明遮罩条
    if (tpl.barHeight > 0) {
      const barH = Math.round(OUT * tpl.barHeight);
      const barY = tpl.layout === "top_banner" ? 0 : OUT - barH;
      const { r, g, b, alpha } = tpl.overlayColor;
      const overlaySvg = `<svg width="${OUT}" height="${barH}"><rect width="${OUT}" height="${barH}" fill="rgba(${r},${g},${b},${alpha})"/></svg>`;
      composites.push({ input: Buffer.from(overlaySvg), top: barY, left: 0 });
    } else {
      // corner_badge: 全图轻微暗角
      const vignetteSvg = `<svg width="${OUT}" height="${OUT}">
        <defs><radialGradient id="v" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.3)"/>
        </radialGradient></defs>
        <rect width="${OUT}" height="${OUT}" fill="url(#v)"/>
      </svg>`;
      composites.push({ input: Buffer.from(vignetteSvg), top: 0, left: 0 });
    }

    // 2. 品牌名文字
    const fontSize = 52;
    const subFontSize = 28;
    const textColor = "#FFFFFF";
    const brandLines = [brandName];
    if (brandSlogan && brandSlogan.length <= 20) {
      brandLines.push(brandSlogan);
    }
    const textSvg = `<svg width="${OUT}" height="${OUT}">
      <style>
        .brand { font: bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif; fill: ${textColor}; }
        .slogan { font: ${subFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif; fill: rgba(255,255,255,0.85); }
      </style>
      ${tpl.brandPos === "center"
        ? `<text x="${OUT/2}" y="${OUT * 0.5 - 20}" text-anchor="middle" class="brand">${escapeXml(brandLines[0])}</text>
           ${brandLines[1] ? `<text x="${OUT/2}" y="${OUT * 0.5 + 30}" text-anchor="middle" class="slogan">${escapeXml(brandLines[1])}</text>` : ""}`
        : `<text x="40" y="${OUT - (tpl.barHeight > 0 ? Math.round(OUT * tpl.barHeight) - 40 : 50)}" class="brand">${escapeXml(brandLines[0])}</text>
           ${brandLines[1] ? `<text x="40" y="${OUT - (tpl.barHeight > 0 ? Math.round(OUT * tpl.barHeight) - 40 : 50) + 40}" class="slogan">${escapeXml(brandLines[1])}</text>` : ""}`
      }
    </svg>`;
    composites.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

    // 3. Logo水印（如果有）
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl);
        if (logoRes.ok) {
          const logoBuffer = Buffer.from(await logoRes.arrayBuffer());
          const logoSize = 120;
          const resizedLogo = await sharp(logoBuffer)
            .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
          
          const logoLeft = tpl.logoPos === "bottom_right" ? OUT - logoSize - 30 : OUT - logoSize - 30;
          const logoTop = tpl.logoPos === "top_right" ? 30 : OUT - logoSize - (tpl.barHeight > 0 ? Math.round(OUT * tpl.barHeight) + 10 : 40);
          composites.push({ input: resizedLogo, top: logoTop, left: logoLeft });
        }
      } catch (e) {
        console.error("[member/compose] Logo overlay error:", e);
      }
    }

    // 4. 品牌色角标装饰
    const badgeSize = 8;
    const badgeSvg = `<svg width="${badgeSize}" height="${badgeSize}"><rect width="${badgeSize}" height="${badgeSize}" rx="2" fill="${brandColor}"/></svg>`;
    const badgeX = 40;
    const badgeY = tpl.brandPos === "center"
      ? OUT * 0.5 - 70
      : OUT - (tpl.barHeight > 0 ? Math.round(OUT * tpl.barHeight) - 40 : 50) - 60;
    composites.push({ input: Buffer.from(badgeSvg), top: badgeY, left: badgeX });

    // 合成
    const resultBuffer = await sharp(resizedPhoto)
      .composite(composites)
      .jpeg({ quality: 92 })
      .toBuffer();

    // 上传合成图到Storage
    const composeFileName = `${member.id}/composed_${template}_${Date.now()}.jpg`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("member-photos")
      .upload(composeFileName, resultBuffer, { contentType: "image/jpeg", upsert: false });

    let composedUrl = "";
    if (!uploadError) {
      const { data: urlData } = supabaseAdmin.storage.from("member-photos").getPublicUrl(composeFileName);
      composedUrl = urlData.publicUrl;
    } else {
      console.error("[member/compose] Upload error:", uploadError);
      // 转base64返回
      composedUrl = `data:image/jpeg;base64,${resultBuffer.toString("base64")}`;
    }

    // 更新content记录
    const existingComposed = content.composed_images || [];
    await supabaseAdmin.from("member_contents").update({
      composed_images: [...existingComposed, { template, url: composedUrl }],
      status: "ready",
    }).eq("id", contentId);

    return NextResponse.json({
      success: true,
      composedUrl,
      template,
      templateName: tpl.name,
    });
  } catch (err: any) {
    console.error("[member/compose] Error:", err);
    return NextResponse.json({ success: false, error: "合成失败: " + (err.message || "未知错误") }, { status: 500 });
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

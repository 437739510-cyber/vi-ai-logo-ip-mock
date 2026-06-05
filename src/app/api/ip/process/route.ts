/**
 * IP资产处理API
 * POST /api/ip/process
 * 
 * 接收上传的IP图片，执行：识别→裁剪→抠图
 * 
 * Body (multipart/form-data):
 *   - image: 图片文件
 *   - mode: "full"（完整管线：裁剪+抠图）| "quick"（仅裁剪，不抠图，用于预览）
 * 
 * 返回：
 *   - isThreeView: boolean
 *   - views: [{ viewName, url, width, height }]
 *   - cutouts: [{ viewName, url, width, height }]（仅full模式）
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { processIPAsset, quickProcess, detectThreeView } from "@/lib/ip-asset-pipeline";

const UPLOAD_DIR = "public/uploads/ip-assets";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const mode = (formData.get("mode") as string) || "quick"; // 默认快速预览

    if (!imageFile) {
      return NextResponse.json(
        { error: "请上传图片文件（字段名: image）" },
        { status: 400 }
      );
    }

    // 读取图片buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 确保上传目录存在
    const uploadDir = path.join(process.cwd(), UPLOAD_DIR);
    await mkdir(uploadDir, { recursive: true });

    // 生成唯一ID
    const assetId = `ip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 保存原始图片
    const originalPath = path.join(uploadDir, `${assetId}-original.png`);
    await writeFile(originalPath, imageBuffer);

    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY || "";

    let result;

    if (mode === "full" && dashscopeApiKey) {
      // 完整管线：裁剪 + 抠图
      result = await processIPAsset(
        { imageBuffer, fileName: imageFile.name, source: "upload" },
        dashscopeApiKey
      );
    } else {
      // 快速模式：仅裁剪
      result = await quickProcess(
        { imageBuffer, fileName: imageFile.name, source: "upload" }
      );
    }

    // 保存处理结果并生成URL
    const views = [];
    for (const view of result.views) {
      const viewFileName = `${assetId}-${view.viewName}.png`;
      const viewPath = path.join(uploadDir, viewFileName);
      await writeFile(viewPath, view.buffer);
      views.push({
        viewName: view.viewName,
        url: `/uploads/ip-assets/${viewFileName}`,
        width: view.width,
        height: view.height,
      });
    }

    const cutouts = [];
    for (const cutout of result.cutouts) {
      const cutoutFileName = `${assetId}-${cutout.viewName}-cutout.png`;
      const cutoutPath = path.join(uploadDir, cutoutFileName);
      await writeFile(cutoutPath, cutout.buffer);
      cutouts.push({
        viewName: cutout.viewName,
        url: `/uploads/ip-assets/${cutoutFileName}`,
        width: cutout.width,
        height: cutout.height,
        isCutout: cutout.isCutout,
      });
    }

    return NextResponse.json({
      assetId,
      isThreeView: result.isThreeView,
      confidence: result.confidence,
      views,
      cutouts,
      status: result.status,
      errors: result.errors,
      originalUrl: `/uploads/ip-assets/${assetId}-original.png`,
    });

  } catch (err: any) {
    console.error("[ip-process] Error:", err);
    return NextResponse.json(
      { error: "IP资产处理失败", detail: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET: 快速检测图片是否为三视图（不保存文件）
 */
export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json(
      { error: "请提供图片URL参数（?url=...）" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return NextResponse.json({ error: "无法下载图片" }, { status: 400 });
    }
    const arrayBuffer = await res.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const detection = await detectThreeView(imageBuffer);

    return NextResponse.json({
      isThreeView: detection.isThreeView,
      confidence: detection.confidence,
      aspectRatio: Math.round(detection.aspectRatio * 100) / 100,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "检测失败", detail: err.message },
      { status: 500 }
    );
  }
}

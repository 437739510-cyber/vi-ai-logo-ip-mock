/**
 * IP资产处理管线
 * 流程：上传 → 识别三视图 → 裁剪单图 → 抠图去背景 → 入库
 * 
 * 三视图裁剪：sharp（免费，本地）
 * 抠图去背景：通义万相 imageseg API（~0.02元/次）
 */

import sharp from "sharp";

// ========== 类型定义 ==========

export interface IPAssetInput {
  /** 图片buffer */
  imageBuffer: Buffer;
  /** 原始文件名 */
  fileName: string;
  /** 上传来源 */
  source: "upload" | "url";
}

export interface IPAssetResult {
  /** 是否为三视图 */
  isThreeView: boolean;
  /** 识别置信度 */
  confidence: number;
  /** 裁剪后的单视角图（三视图时3张，否则1张） */
  views: IPViewImage[];
  /** 抠图后的透明背景图 */
  cutouts: IPViewImage[];
  /** 处理状态 */
  status: "success" | "partial" | "failed";
  /** 错误信息 */
  errors: string[];
}

export interface IPViewImage {
  /** 视角名称 */
  viewName: "front" | "side" | "back" | "full";
  /** 图片buffer（PNG） */
  buffer: Buffer;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 是否已抠图 */
  isCutout: boolean;
}

// ========== 三视图识别 ==========

/**
 * 识别图片是否为三视图
 * 判断逻辑：
 * 1. 宽高比 > 2.5:1 → 大概率三视图
 * 2. 宽高比 2:1~2.5:1 → 可能，需进一步确认
 * 3. 宽高比 < 2:1 → 单图
 */
export async function detectThreeView(imageBuffer: Buffer): Promise<{
  isThreeView: boolean;
  confidence: number;
  aspectRatio: number;
}> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const aspectRatio = width / height;

    if (aspectRatio >= 3.0) {
      return { isThreeView: true, confidence: 0.95, aspectRatio };
    } else if (aspectRatio >= 2.5) {
      return { isThreeView: true, confidence: 0.8, aspectRatio };
    } else if (aspectRatio >= 2.0) {
      return { isThreeView: true, confidence: 0.5, aspectRatio };
    } else {
      return { isThreeView: false, confidence: 0.9, aspectRatio };
    }
  } catch (err) {
    console.error("[ip-pipeline] detectThreeView failed:", err);
    return { isThreeView: false, confidence: 0, aspectRatio: 0 };
  }
}

// ========== 三视图裁剪 ==========

/**
 * 将三视图裁剪为3张单视角图
 * 策略：均分3等份，取中间区域
 * 每份之间留2px间距避免切割到内容
 */
export async function cropThreeView(imageBuffer: Buffer): Promise<IPViewImage[]> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 900;
  const height = metadata.height || 300;
  
  const viewWidth = Math.floor(width / 3);
  const gap = 2; // 间距像素
  
  const views: IPViewImage[] = [];
  const viewNames: ("front" | "side" | "back")[] = ["front", "side", "back"];
  
  for (let i = 0; i < 3; i++) {
    const left = i * viewWidth + (i > 0 ? gap : 0);
    const cropWidth = viewWidth - gap * 2;
    
    try {
      const cropped = await sharp(imageBuffer)
        .extract({ left, top: 0, width: Math.max(1, cropWidth), height })
        .trim({ threshold: 10 }) // 去白边
        .png()
        .toBuffer();
      
      const croppedMeta = await sharp(cropped).metadata();
      
      views.push({
        viewName: viewNames[i],
        buffer: cropped,
        width: croppedMeta.width || cropWidth,
        height: croppedMeta.height || height,
        isCutout: false,
      });
    } catch (err) {
      console.error(`[ip-pipeline] crop view ${i} failed:`, err);
    }
  }
  
  return views;
}

/**
 * 单图直接返回（非三视图）
 */
export async function singleView(imageBuffer: Buffer): Promise<IPViewImage> {
  const trimmed = await sharp(imageBuffer)
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
  
  const metadata = await sharp(trimmed).metadata();
  
  return {
    viewName: "full",
    buffer: trimmed,
    width: metadata.width || 0,
    height: metadata.height || 0,
    isCutout: false,
  };
}

// ========== 通义万相抠图 ==========

/**
 * 调用通义万相抠图API (imageseg)
 * API文档：https://help.aliyun.com/document_detail/2710213.html
 * 接口：POST https://dashscope.aliyuncs.com/api/v1/services/aigc/image-segmentation/generation
 * 成本：~0.02元/次
 */
export async function removeBackground(
  imageBuffer: Buffer,
  apiKey: string
): Promise<Buffer> {
  // 将图片转为base64
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:image/png;base64,${base64}`;
  
  const response = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-segmentation/generation",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "false", // 同步调用
      },
      body: JSON.stringify({
        model: "imageseg",
        input: {
          image_url: dataUrl,
        },
        parameters: {
          output_format: "png",
          // 不传ref_prompt让模型自动识别主体
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`通义万相抠图API错误 (${response.status}): ${errText}`);
  }

  const body = await response.json();
  
  // 同步模式返回格式
  // { output: { image_url: "..." } }
  const imageUrl = body?.output?.image_url;
  
  if (!imageUrl) {
    // 可能是异步模式，需要轮询
    const taskId = body?.output?.task_id;
    if (taskId) {
      return await pollAsyncTask(taskId, apiKey);
    }
    throw new Error(`通义万相抠图返回异常: ${JSON.stringify(body)}`);
  }
  
  // 下载抠图结果
  return await downloadImage(imageUrl);
}

/**
 * 异步任务轮询
 */
async function pollAsyncTask(taskId: string, apiKey: string): Promise<Buffer> {
  const maxRetries = 20;
  const interval = 2000; // 2秒
  
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, interval));
    
    const res = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: { "Authorization": `Bearer ${apiKey}` },
      }
    );
    
    if (!res.ok) continue;
    
    const body = await res.json();
    const status = body?.output?.task_status;
    
    if (status === "SUCCEEDED") {
      const imageUrl = body?.output?.results?.[0]?.url || body?.output?.image_url;
      if (imageUrl) {
        return await downloadImage(imageUrl);
      }
      throw new Error("抠图成功但未返回图片URL");
    }
    
    if (status === "FAILED") {
      throw new Error(`抠图任务失败: ${body?.output?.message || "未知错误"}`);
    }
    
    // PENDING / RUNNING 继续等待
  }
  
  throw new Error("抠图任务超时");
}

/**
 * 下载图片为Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`下载图片失败: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ========== 完整管线 ==========

/**
 * IP资产处理完整管线
 * 1. 识别是否三视图
 * 2. 裁剪（三视图）或直接使用（单图）
 * 3. 抠图去背景
 * 4. 返回处理结果
 */
export async function processIPAsset(
  input: IPAssetInput,
  dashscopeApiKey: string
): Promise<IPAssetResult> {
  const errors: string[] = [];
  const result: Partial<IPAssetResult> = {
    errors,
    status: "success",
  };
  
  try {
    // Step 1: 识别三视图
    const detection = await detectThreeView(input.imageBuffer);
    result.isThreeView = detection.isThreeView;
    result.confidence = detection.confidence;
    
    // Step 2: 裁剪或单图处理
    let views: IPViewImage[];
    
    if (detection.isThreeView && detection.confidence >= 0.5) {
      views = await cropThreeView(input.imageBuffer);
      if (views.length < 3) {
        errors.push(`三视图裁剪只得到${views.length}张，期望3张`);
        result.status = "partial";
      }
    } else {
      const single = await singleView(input.imageBuffer);
      views = [single];
    }
    
    result.views = views;
    
    // Step 3: 抠图去背景
    const cutouts: IPViewImage[] = [];
    
    for (const view of views) {
      try {
        const cutoutBuffer = await removeBackground(view.buffer, dashscopeApiKey);
        const cutoutMeta = await sharp(cutoutBuffer).metadata();
        
        cutouts.push({
          viewName: view.viewName,
          buffer: cutoutBuffer,
          width: cutoutMeta.width || view.width,
          height: cutoutMeta.height || view.height,
          isCutout: true,
        });
      } catch (err: any) {
        console.error(`[ip-pipeline] 抠图失败 (${view.viewName}):`, err.message);
        errors.push(`抠图失败 (${view.viewName}): ${err.message}`);
        // 抠图失败时使用原图
        cutouts.push({ ...view, isCutout: false });
        result.status = "partial";
      }
    }
    
    result.cutouts = cutouts;
    
  } catch (err: any) {
    console.error("[ip-pipeline] 管线执行失败:", err);
    errors.push(err.message);
    result.status = "failed";
  }
  
  return result as IPAssetResult;
}

/**
 * 快速处理：只裁剪不抠图（用于预览）
 */
export async function quickProcess(input: IPAssetInput): Promise<IPAssetResult> {
  const errors: string[] = [];
  
  const detection = await detectThreeView(input.imageBuffer);
  
  let views: IPViewImage[];
  if (detection.isThreeView && detection.confidence >= 0.5) {
    views = await cropThreeView(input.imageBuffer);
  } else {
    const single = await singleView(input.imageBuffer);
    views = [single];
  }
  
  return {
    isThreeView: detection.isThreeView,
    confidence: detection.confidence,
    views,
    cutouts: [], // 不抠图
    status: "success",
    errors,
  };
}

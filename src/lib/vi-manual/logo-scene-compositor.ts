import sharp from "sharp";
import React from "react";
import { extractExpectedText } from "../vision-check";

export type LogoSceneCompositeKey =
  | "stationery-1"
  | "packaging-1"
  | "packaging-2"
  | "marketing-storefront"
  | "marketing-1";

export interface LogoSceneLayout {
  name: string;
  leftRatio: number;
  topRatio: number;
  maxWidthRatio: number;
  maxHeightRatio: number;
}

export interface AppliedLogoPlacement {
  layoutName: string;
  left: number;
  top: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}

export type LogoSceneCompositeResult =
  | {
      ok: true;
      imageUrl: string;
      executorStatus: "ready";
      strategy: "composite";
      sceneKey: LogoSceneCompositeKey;
      layoutName: string;
      placement: AppliedLogoPlacement;
    }
  | {
      ok: false;
      executorStatus: "failed";
      strategy: "composite";
      sceneKey: string;
      errorCode:
        | "UNSUPPORTED_SCENE_KEY"
        | "INVALID_LAYOUT"
        | "INVALID_BACKGROUND_IMAGE"
        | "INVALID_LOGO_IMAGE"
        | "LOGO_OPAQUE_WHITE_BACKGROUND"
        | "COMPOSITE_FAILED";
      message: string;
    };

export interface LogoSceneRequestLike {
  key: string;
  routeStatus: string;
  strategy?: "reference_anchor" | "composite";
  logoPlacement?: {
    strategy?: "reference_anchor" | "composite";
  };
}

/**
 * 工单 085-A-R1：把不透明白底 Logo 转为透明 PNG（保留 alpha）。
 *
 * 只清除「与图像边缘连通的近似白色（rgb≥245 且不透明）」区域，Logo 内部本应
 * 存在的白色不会被掏空。输入可为 Buffer 或 base64/dataURI 字符串；输出始终为
 * 带 alpha 的 PNG Buffer。幂等：已透明的 Logo 再次处理不受影响。
 */
export async function removeOpaqueWhiteBackground(input: Buffer | string): Promise<Buffer> {
  const source = decodeImageInput(input);
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  if (!width || !height) {
    throw new Error("INVALID_LOGO_IMAGE: zero dimensions");
  }
  const channels = info.channels;
  const isNearWhite = (offset: number): boolean =>
    data[offset] >= 245 && data[offset + 1] >= 245 && data[offset + 2] >= 245 && data[offset + 3] >= 250;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const posAt = (x: number, y: number): number => y * width + x;

  // BFS 起点：四条边缘上的近似白像素
  for (let x = 0; x < width; x += 1) {
    if (isNearWhite(posAt(x, 0) * channels) && !visited[posAt(x, 0)]) {
      visited[posAt(x, 0)] = 1;
      queue.push(posAt(x, 0));
    }
    if (height > 1 && isNearWhite(posAt(x, height - 1) * channels) && !visited[posAt(x, height - 1)]) {
      visited[posAt(x, height - 1)] = 1;
      queue.push(posAt(x, height - 1));
    }
  }
  for (let y = 0; y < height; y += 1) {
    if (isNearWhite(posAt(0, y) * channels) && !visited[posAt(0, y)]) {
      visited[posAt(0, y)] = 1;
      queue.push(posAt(0, y));
    }
    if (width > 1 && isNearWhite(posAt(width - 1, y) * channels) && !visited[posAt(width - 1, y)]) {
      visited[posAt(width - 1, y)] = 1;
      queue.push(posAt(width - 1, y));
    }
  }

  // BFS 四邻域扩散，只覆盖与边缘连通的近似白
  while (queue.length > 0) {
    const pos = queue.pop() as number;
    const x = pos % width;
    const y = Math.floor(pos / width);
    const neighbors: number[] = [];
    if (x > 0) neighbors.push(pos - 1);
    if (x < width - 1) neighbors.push(pos + 1);
    if (y > 0) neighbors.push(pos - width);
    if (y < height - 1) neighbors.push(pos + width);
    for (const n of neighbors) {
      if (visited[n]) continue;
      const o = n * channels;
      if (isNearWhite(o)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  // 边缘连通的近似白 → alpha 置 0
  for (let p = 0; p < width * height; p += 1) {
    if (visited[p]) data[p * channels + 3] = 0;
  }

  return sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

export interface LogoSceneDeliveryGateResult {
  ready: boolean;
  status: "ready" | "needs_review";
  message: string;
  blockers: { key: string; reason: string }[];
  /** 工单 085-A-R2：测试单降级通道显式排除的槽位（reason 固定 pending_074，不得静默当作已就绪）。 */
  missing: { key: string; reason: string }[];
}

export interface LogoSceneDeliveryGateOptions {
  /**
   * 工单 085-A-R2：仅测试单（client_info 显式标记）生效的降级通道。
   * 为 true 时，A 类营销场景（marketing-*）中未就绪的槽位从 requiredKeys 排除，
   * 并在结果 missing 中标 pending_074；正式单契约（5 张齐全）保持不变。
   */
  allowMissingMarketingOnlyForTestOrder?: boolean;
}

const LOGO_SCENE_LAYOUTS: Record<LogoSceneCompositeKey, LogoSceneLayout> = {
  "stationery-1": {
    name: "stationery-clean-zone",
    leftRatio: 0.62,
    topRatio: 0.18,
    maxWidthRatio: 0.25,
    maxHeightRatio: 0.22,
  },
  "packaging-1": {
    name: "packaging-primary-panel",
    leftRatio: 0.33,
    topRatio: 0.28,
    maxWidthRatio: 0.34,
    maxHeightRatio: 0.25,
  },
  "packaging-2": {
    name: "packaging-secondary-panel",
    leftRatio: 0.35,
    topRatio: 0.32,
    maxWidthRatio: 0.3,
    maxHeightRatio: 0.22,
  },
  "marketing-storefront": {
    name: "storefront-primary-sign",
    leftRatio: 0.31,
    topRatio: 0.17,
    maxWidthRatio: 0.38,
    maxHeightRatio: 0.2,
  },
  "marketing-1": {
    name: "marketing-primary-carrier",
    leftRatio: 0.34,
    topRatio: 0.24,
    maxWidthRatio: 0.32,
    maxHeightRatio: 0.24,
  },
};

function isCompositeKey(sceneKey: string): sceneKey is LogoSceneCompositeKey {
  return Object.prototype.hasOwnProperty.call(LOGO_SCENE_LAYOUTS, sceneKey);
}

export function getLogoSceneLayout(sceneKey: string): LogoSceneLayout | null {
  if (!isCompositeKey(sceneKey)) return null;
  return { ...LOGO_SCENE_LAYOUTS[sceneKey] };
}

export function buildLogoCompositeFallbackPrompt(scenePrompt: string): string {
  return [
    scenePrompt,
    "Fallback background plate only: ignore prior instructions to draw any brand mark or lettering",
    "render the complete commercial environment and leave the designated physical carrier clean and blank",
    "no logo, no text, no letters, no watermark, no floating graphic",
  ].join(", ");
}

export function partitionLogoSceneRequests<T extends LogoSceneRequestLike>(requests: T[]): {
  ready: T[];
  pending: T[];
} {
  return {
    ready: requests.filter((request) => request.routeStatus === "ready" || request.routeStatus === "candidate_074"),
    pending: requests.filter((request) => request.routeStatus !== "ready" && request.routeStatus !== "candidate_074"),
  };
}

/**
 * 工单 085-B-R2：场景合成文字层契约。
 * - composite 载板（stationery/packaging）：背景 prompt 明确 no text/no letters/no words，
 *   合成器只叠加 logo，不生成任何文字层 → 'none'；
 * - reference_anchor（marketing 营销槽）：提示词携带品牌文字 → 'brand_text'。
 */
export function logoSceneTextLayerContract(sceneKey: string): "none" | "brand_text" {
  return String(sceneKey || "").startsWith("marketing") ? "brand_text" : "none";
}

export type SceneTextGateMode = "none" | "chinese" | "pinyin";

export interface SceneTextGateInput {
  sceneKey: string;
  prompt?: string;
  mode: "chinese" | "pinyin";
  companyName: string;
  /** 纯图形 logo=false；有文字=true；OCR 不可用/未证实=null（调用方应 fail-closed） */
  logoHasText: boolean | null;
  /** logo OCR 实际提取到的文字（如有），动态、不写死 */
  logoText: string;
}

export interface SceneTextGateResult {
  mode: SceneTextGateMode;
  expectedText: string;
  /** mode='none' 时的显式跳过理由 */
  reason?: string;
}

/**
 * 工单 085-B-R2：场景文字门显式契约（主窗决策方案 a）。
 * expectedText 来源 = 场景合成实际文字层（如有）+ logo OCR 文字（如有）；
 * 两者皆空且 logo 无文字 → mode='none'（显式 skipped，记录理由）；
 * 否则按实际文字严格 OCR 逐字相等（mode 照旧 chinese/pinyin）。
 * 禁止写死品牌名：companyName/logoText 全部来自调用方数据。
 */
export function resolveSceneTextGate(input: SceneTextGateInput): SceneTextGateResult {
  const textLayerKind = logoSceneTextLayerContract(input.sceneKey);
  const sceneTextLayer =
    textLayerKind === "brand_text"
      ? extractExpectedText(input.prompt, input.mode, input.companyName)
      : "";
  const expectedText = `${sceneTextLayer}${input.logoText || ""}`.trim();
  if (!expectedText && input.logoHasText !== true) {
    return {
      mode: "none",
      expectedText: "",
      reason: "scene_text_mode_none_no_text_layer_logo_no_text",
    };
  }
  return { mode: input.mode, expectedText };
}

export function evaluateLogoSceneDeliveryGate(input: {
  requiredKeys: string[];
  sceneImages: Record<string, string>;
  sceneVision: Record<string, string>;
  requests: LogoSceneRequestLike[];
}, options?: LogoSceneDeliveryGateOptions): LogoSceneDeliveryGateResult {
  const requestByKey = new Map(input.requests.map((request) => [request.key, request]));
  const blockers: { key: string; reason: string }[] = [];
  const missing: { key: string; reason: string }[] = [];

  for (const key of input.requiredKeys) {
    const hasImage = typeof input.sceneImages[key] === "string" && input.sceneImages[key].length > 0;
    const vision = input.sceneVision[key] || "missing";
    const request = requestByKey.get(key);
    const strategy = request?.logoPlacement?.strategy || request?.strategy || "composite";
    // 073 只交付 074 实测候选：即使 Mock/本地视觉通过，也不能在本工单释放到最终交付。
    if (request?.routeStatus === "candidate_074") {
      blockers.push({ key, reason: "candidate_074" });
      continue;
    }
    // 073-R1：reference-anchor 是双图 Logo 保真路径。以后路由变为 ready 时，
    // 仍必须有候选图且严格视觉 passed；skipped/未知状态不得沿用 composite 的降级语义。
    if (strategy === "reference_anchor") {
      if (request?.routeStatus !== "ready") {
        blockers.push({ key, reason: request?.routeStatus || "missing_route_status" });
      } else if (!hasImage) {
        blockers.push({ key, reason: "reference_anchor_missing_image" });
      } else if (vision !== "passed") {
        blockers.push({ key, reason: `reference_anchor_${vision}` });
      }
      continue;
    }
    if (hasImage && (vision === "passed" || vision === "skipped")) continue;

    let reason = request?.routeStatus || vision;
    if (hasImage && (vision === "failed" || vision === "needs_review" || vision === "suspect")) {
      reason = vision;
    } else if (!hasImage && reason === "ready") {
      reason = "failed";
    } else if (!hasImage && !request) {
      reason = "missing_required_scene";
    }
    blockers.push({ key, reason });
  }

  // 工单 085-A-R2：测试单降级通道——A 类营销场景未就绪时显式排除并标记
  // pending_074，不静默当作已就绪；正式单（未开启选项）路径完全不变。
  const testOrderDowngrade = options?.allowMissingMarketingOnlyForTestOrder === true;
  if (testOrderDowngrade) {
    const marketingBlockers = blockers.filter((blocker) => blocker.key.startsWith("marketing-"));
    for (const blocker of marketingBlockers) {
      blockers.splice(blockers.indexOf(blocker), 1);
      missing.push({ key: blocker.key, reason: "pending_074" });
    }
  }

  if (testOrderDowngrade && missing.length > 0) {
    const pendingSummary = missing.map((item) => `${item.key}:${item.reason}`).join(", ");
    if (blockers.length === 0) {
      return {
        ready: true,
        status: "ready",
        message: `测试单降级通道启用：必需场景已就绪；A 类营销场景待补：${pendingSummary}`,
        blockers,
        missing,
      };
    }
    const blockerSummary = blockers.map((blocker) => `${blocker.key}:${blocker.reason}`).join(", ");
    return {
      ready: false,
      status: "needs_review",
      message: `A 类场景尚未就绪，已在页面规划前停止：${blockerSummary}；测试单降级通道待补：${pendingSummary}`,
      blockers,
      missing,
    };
  }

  if (blockers.length === 0) {
    return { ready: true, status: "ready", message: "A 类必需场景已就绪", blockers: [], missing: [] };
  }
  const summary = blockers.map((blocker) => `${blocker.key}:${blocker.reason}`).join(", ");
  return {
    ready: false,
    status: "needs_review",
    message: `A 类场景尚未就绪，已在页面规划前停止：${summary}`,
    blockers,
    missing: [],
  };
}

function decodeImageInput(input: Buffer | string): Buffer {
  if (Buffer.isBuffer(input)) return input;
  const value = input.trim();
  const dataUri = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/);
  return Buffer.from(dataUri ? dataUri[1] : value, "base64");
}

async function hasUnsafeOpaqueWhiteBackground(logo: Buffer): Promise<boolean> {
  const { data, info } = await sharp(logo)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let whiteBorderPixels = 0;
  let borderPixels = 0;
  const channels = info.channels;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * channels;
      const alpha = data[offset + 3];
      if (alpha < 250) transparentPixels += 1;
      const isBorder = x < 2 || y < 2 || x >= info.width - 2 || y >= info.height - 2;
      if (!isBorder) continue;
      borderPixels += 1;
      if (data[offset] >= 245 && data[offset + 1] >= 245 && data[offset + 2] >= 245 && alpha >= 250) {
        whiteBorderPixels += 1;
      }
    }
  }

  const isFullyOpaque = transparentPixels === 0;
  const whiteBorderRatio = borderPixels > 0 ? whiteBorderPixels / borderPixels : 0;
  return isFullyOpaque && whiteBorderRatio >= 0.9;
}

function failure(
  sceneKey: string,
  errorCode: Extract<LogoSceneCompositeResult, { ok: false }>["errorCode"],
  message: string,
): LogoSceneCompositeResult {
  return { ok: false, executorStatus: "failed", strategy: "composite", sceneKey, errorCode, message };
}

export async function compositeLogoOnScene(input: {
  background: Buffer | string;
  logo: Buffer | string;
  sceneKey: string;
  layout?: LogoSceneLayout;
}): Promise<LogoSceneCompositeResult> {
  const standardLayout = getLogoSceneLayout(input.sceneKey);
  if (!standardLayout || !isCompositeKey(input.sceneKey)) {
    return failure(input.sceneKey, "UNSUPPORTED_SCENE_KEY", `没有场景布局：${input.sceneKey}`);
  }
  if (input.layout) {
    const fields: (keyof LogoSceneLayout)[] = ["name", "leftRatio", "topRatio", "maxWidthRatio", "maxHeightRatio"];
    const matchesStandard = fields.every((field) => input.layout?.[field] === standardLayout[field]);
    if (!matchesStandard) {
      return failure(input.sceneKey, "INVALID_LAYOUT", `布局必须来自通用场景布局表：${input.sceneKey}`);
    }
  }
  const layout = input.layout || standardLayout;

  let background: Buffer;
  let logo: Buffer;
  let backgroundMeta: sharp.Metadata;
  let logoMeta: sharp.Metadata;
  try {
    background = decodeImageInput(input.background);
    backgroundMeta = await sharp(background).metadata();
    if (!backgroundMeta.width || !backgroundMeta.height) throw new Error("background dimensions missing");
  } catch (error) {
    return failure(input.sceneKey, "INVALID_BACKGROUND_IMAGE", `背景图无法读取：${(error as Error).message}`);
  }
  try {
    logo = decodeImageInput(input.logo);
    logoMeta = await sharp(logo).metadata();
    if (!logoMeta.width || !logoMeta.height) throw new Error("logo dimensions missing");
    if (await hasUnsafeOpaqueWhiteBackground(logo)) {
      return failure(
        input.sceneKey,
        "LOGO_OPAQUE_WHITE_BACKGROUND",
        "Logo 为不透明白底，已拒绝把白方框静默贴入场景",
      );
    }
  } catch (error) {
    return failure(input.sceneKey, "INVALID_LOGO_IMAGE", `Logo 无法读取：${(error as Error).message}`);
  }

  const canvasWidth = backgroundMeta.width;
  const canvasHeight = backgroundMeta.height;
  const maxWidth = Math.max(1, Math.round(canvasWidth * layout.maxWidthRatio));
  const maxHeight = Math.max(1, Math.round(canvasHeight * layout.maxHeightRatio));
  const scale = Math.min(maxWidth / logoMeta.width, maxHeight / logoMeta.height);
  const width = Math.max(1, Math.round(logoMeta.width * scale));
  const height = Math.max(1, Math.round(logoMeta.height * scale));
  const unclampedLeft = Math.round(canvasWidth * layout.leftRatio);
  const unclampedTop = Math.round(canvasHeight * layout.topRatio);
  const left = Math.max(0, Math.min(unclampedLeft, canvasWidth - width));
  const top = Math.max(0, Math.min(unclampedTop, canvasHeight - height));

  try {
    const resizedLogo = await sharp(logo)
      .resize({ width, height, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    const output = await sharp(background)
      .composite([{ input: resizedLogo, left, top }])
      .png()
      .toBuffer();
    const placement: AppliedLogoPlacement = {
      layoutName: layout.name,
      left,
      top,
      width,
      height,
      canvasWidth,
      canvasHeight,
    };
    return {
      ok: true,
      imageUrl: `data:image/png;base64,${output.toString("base64")}`,
      executorStatus: "ready",
      strategy: "composite",
      sceneKey: input.sceneKey,
      layoutName: layout.name,
      placement,
    };
  } catch (error) {
    return failure(input.sceneKey, "COMPOSITE_FAILED", `Logo 合成失败：${(error as Error).message}`);
  }
}

/**
 * 工单 086-R1：场景图文字后期叠加（根治 AI 中文乱码）。
 * 用 satori + 系统 SimHei 字体把品牌名/标语渲染成透明 PNG，再按比例合成到场景图。
 * 输入/输出均为 base64/dataURI PNG；渲染失败时返回原始图（不静默报错）。
 */
export async function overlayBrandTextOnScene(input: {
  background: Buffer | string;
  text: string;
  /** 文字相对画布的横向比例（0-1），默认 0.5（居中） */
  xRatio?: number;
  /** 文字相对画布的纵向比例（0-1），默认 0.88（底部） */
  yRatio?: number;
  /** 文字高度占画布比例，默认 0.06 */
  textHeightRatio?: number;
  color?: string;
  strokeColor?: string;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; message: string }> {
  const text = (input.text || "").trim();
  if (!text) return { ok: false, message: "empty text" };
  try {
    const background = decodeImageInput(input.background);
    const meta = await sharp(background).metadata();
    const width = meta.width || 1024;
    const height = meta.height || 1024;
    const textHeight = Math.max(24, Math.round(height * (input.textHeightRatio ?? 0.06)));
    const fontSize = textHeight;
    const padX = Math.round(width * 0.04);
    const textW = width - padX * 2;
    const textH = textHeight + Math.round(textHeight * 0.4);

    // satori → SVG → sharp PNG（SimHei 保证中文字形）
    const { default: satori } = await import("satori");
    const fs = await import("node:fs");
    const font = fs.readFileSync("C:/Windows/Fonts/simhei.ttf");
    const element = React.createElement("div", {
      style: {
        width: `${textW}px`,
        height: `${textH}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        color: input.color || "#FFFFFF",
        fontFamily: "SimHei",
        textShadow: input.strokeColor === "none" ? undefined : `0 0 ${Math.round(fontSize / 14)}px ${input.strokeColor || "rgba(60,30,10,0.85)"}, 0 0 ${Math.round(fontSize / 8)}px rgba(0,0,0,0.6)`,
        whiteSpace: "nowrap",
      },
    }, text);
    const svg = await satori(element, { width: textW, height: textH, fonts: [{ name: "SimHei", data: font, weight: 700, style: "normal" }] });
    const textPng = await sharp(Buffer.from(svg)).png().toBuffer();

    const left = Math.max(0, Math.min(Math.round(width * (input.xRatio ?? 0.5) - textW / 2), width - textW));
    const top = Math.max(0, Math.min(Math.round(height * (input.yRatio ?? 0.88)), height - textH));
    const output = await sharp(background)
      .composite([{ input: textPng, left, top }])
      .png()
      .toBuffer();
    return { ok: true, imageUrl: `data:image/png;base64,${output.toString("base64")}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/**
 * 工单 086-R1：公仔/IP 场景 LOGO 后期贴入（AI 不画 LOGO，避免错乱）。
 * 不校验标准布局（与 compositeLogoOnScene 不同，供 IP 场景自由定位），
 * 默认贴入右下角，宽度约为画布 16%。
 */
export async function pasteLogoOnScene(input: {
  background: Buffer | string;
  logo: Buffer | string;
  xRatio?: number;
  yRatio?: number;
  widthRatio?: number;
  opacity?: number;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; errorCode: string; message: string }> {
  try {
    const background = decodeImageInput(input.background);
    const logo = decodeImageInput(input.logo);
    const bgMeta = await sharp(background).metadata();
    const logoMeta = await sharp(logo).metadata();
    const canvasWidth = bgMeta.width || 1024;
    const canvasHeight = bgMeta.height || 1024;
    if (!logoMeta.width || !logoMeta.height) throw new Error("logo dimensions missing");
    const widthRatio = input.widthRatio ?? 0.16;
    const width = Math.max(32, Math.round(canvasWidth * widthRatio));
    const height = Math.max(32, Math.round(width * (logoMeta.height / logoMeta.width)));
    const resized = await sharp(logo).resize({ width, height, fit: "inside", withoutEnlargement: false }).png().toBuffer();
    const left = Math.max(0, Math.min(Math.round(canvasWidth * (input.xRatio ?? 0.82)), canvasWidth - width));
    const top = Math.max(0, Math.min(Math.round(canvasHeight * (input.yRatio ?? 0.8)), canvasHeight - height));
    const output = await sharp(background)
      .composite([{ input: resized, left, top, ...(input.opacity !== undefined ? { blend: "over" } : {}) }])
      .png()
      .toBuffer();
    return { ok: true, imageUrl: `data:image/png;base64,${output.toString("base64")}` };
  } catch (error) {
    return { ok: false, errorCode: "SCENE_POSTPROCESS_FAILED", message: (error as Error).message };
  }
}

/**
 * 工单 086-R2：三视图横版合拼（参考成功案例 3152×1194 单角色三面板）。
 * 输入 front/side/back 三张单角色图，输出白底横排三面板 PNG（正/侧/背），
 * 面板间留细缝；只做代码合拼，不生成任何额外角色。
 */
export async function combineThreeViewSheet(input: {
  front: Buffer | string;
  side: Buffer | string;
  back: Buffer | string;
  sheetWidth?: number;
  sheetHeight?: number;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; message: string }> {
  try {
    const images = {
      front: decodeImageInput(input.front),
      side: decodeImageInput(input.side),
      back: decodeImageInput(input.back),
    };
    const sheetW = input.sheetWidth ?? 3152;
    const sheetH = input.sheetHeight ?? 1194;
    const gap = Math.max(4, Math.round(sheetW * 0.008));
    const panelW = Math.round((sheetW - gap * 2) / 3);
    const panelH = sheetH;

    const layers = [];
    let x = 0;
    for (const key of ["front", "side", "back"] as const) {
      const meta = await sharp(images[key]).metadata();
      const w = meta.width || 1;
      const h = meta.height || 1;
      const scale = Math.min(panelW / w, panelH / h);
      const rw = Math.max(1, Math.round(w * scale));
      const rh = Math.max(1, Math.round(h * scale));
      const left = x + Math.round((panelW - rw) / 2);
      const top = Math.round((panelH - rh) / 2);
      const resized = await sharp(images[key]).resize({ width: rw, height: rh, fit: "fill" }).png().toBuffer();
      layers.push({ input: resized, left, top });
      x += panelW + gap;
    }

    const canvas = await sharp({
      create: { width: sheetW, height: sheetH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite(layers)
      .png()
      .toBuffer();
    return { ok: true, imageUrl: `data:image/png;base64,${canvas.toString("base64")}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/**
 * Image processing cache system.
 * Caches background-removed LOGO and mascot images.
 * Supports mascot three-view detection and splitting.
 *
 * Cache location: public/generated/processed/
 * Index file: public/generated/processed/processed-index.json
 */

import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { createHash } from "crypto";

const PROCESSED_DIR = path.join(process.cwd(), "public", "generated", "processed");
const INDEX_PATH = path.join(PROCESSED_DIR, "processed-index.json");

export interface CacheEntry {
  originalPath: string;
  processedPath: string;
  method: "sharp" | "wanxiang";
  assetType: "logo" | "mascot-single" | "mascot-threeview";
  detectedBgColor?: string;
  /** For three-view mascots: array of split view paths */
  splitViews?: string[];
  processedAt: string;

  // === Semantic analysis results ===
  /** Analysis status: pending = not analyzed yet, completed = done, failed = error */
  analysisStatus?: "pending" | "completed" | "failed";
  /** LOGO: extracted design elements (e.g. ["椰子树", "海浪", "18°N"]) */
  logoElements?: string[];
  /** LOGO: style tags (e.g. ["手绘", "热带", "自然"]) */
  logoSyleTags?: string[];
  /** LOGO: design meaning description */
  logoMeaning?: string;
  /** LOGO: extracted brand colors from the image */
  extractedColors?: { hex: string; name?: string; usage?: string }[];
  /** IP: mascot name */
  mascotName?: string;
  /** IP: style (3D/Flat/Q版/Hand-drawn) */
  mascotStyle?: string;
  /** IP: personality description */
  mascotPersonality?: string;
  /** IP: general description */
  mascotDescription?: string;
  /** IP: text labels found on image (e.g. "正面", "侧面") */
  mascotLabels?: string[];
}

interface CacheIndex {
  version: number;
  entries: Record<string, CacheEntry>;
}

async function loadIndex(): Promise<CacheIndex> {
  try {
    const content = await readFile(INDEX_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { version: 1, entries: {} };
  }
}

async function saveIndex(index: CacheIndex): Promise<void> {
  await mkdir(PROCESSED_DIR, { recursive: true });
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

function cacheKey(originalPath: string): string {
  return createHash("md5").update(originalPath).digest("hex");
}

/** Get project ID from an asset path (e.g., /uploads/xxx.jpg → extract from context) */
/** We use the cache key as the lookup, so project info is stored separately */

/**
 * Analyze a mascot image: determine if it's single view or three-view.
 * Uses image dimension heuristics (three-views typically have width:height > 2.5:1 or height:width > 2.5:1).
 */
export async function analyzeMascotType(filePath: string): Promise<{
  type: "single" | "threeview-horizontal" | "threeview-vertical";
  splitRects?: { left: number; top: number; width: number; height: number }[];
}> {
  try {
    const meta = await sharp(filePath).metadata();
    const w = meta.width || 1;
    const h = meta.height || 1;
    const ratio = w / h;

    if (ratio > 2.3) {
      // Horizontal three-view (3 panels side by side)
      const panelW = Math.floor(w / 3);
      return {
        type: "threeview-horizontal",
        splitRects: [
          { left: 0, top: 0, width: panelW, height: h },
          { left: panelW, top: 0, width: panelW, height: h },
          { left: panelW * 2, top: 0, width: w - panelW * 2, height: h },
        ],
      };
    } else if (1 / ratio > 2.3) {
      // Vertical three-view (3 panels stacked)
      const panelH = Math.floor(h / 3);
      return {
        type: "threeview-vertical",
        splitRects: [
          { left: 0, top: 0, width: w, height: panelH },
          { left: 0, top: panelH, width: w, height: panelH },
          { left: 0, top: panelH * 2, width: w, height: h - panelH * 2 },
        ],
      };
    } else {
      return { type: "single" };
    }
  } catch {
    return { type: "single" };
  }
}

/**
 * Remove background from an image using chroma-key.
 * Returns the transparent PNG buffer.
 */
async function removeBackground(
  image: sharp.Sharp,
  meta: sharp.Metadata
): Promise<{ buffer: Buffer; bgColor: string }> {
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const channels = meta.channels || 3;

  // Sample border pixels to find background color
  let rSum = 0, gSum = 0, bSum = 0, pxCount = 0;
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const idx = (y * w + x) * channels;
      rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2];
      pxCount++;
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (const x of [0, w - 1]) {
      const idx = (y * w + x) * channels;
      rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2];
      pxCount++;
    }
  }

  const bgR = Math.round(rSum / pxCount);
  const bgG = Math.round(gSum / pxCount);
  const bgB = Math.round(bSum / pxCount);
  const bgHex = `#${bgR.toString(16).padStart(2, "0")}${bgG.toString(16).padStart(2, "0")}${bgB.toString(16).padStart(2, "0")}`;

  const bgBrightness = (bgR + bgG + bgB) / 3;
  const threshold = bgBrightness > 230 ? 35 : bgBrightness > 150 ? 45 : 55;

  const rgbaBuf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const si = i * channels;
    const di = i * 4;
    const r = data[si], g = data[si + 1], b = data[si + 2];
    const dr = r - bgR, dg = g - bgG, db = b - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    rgbaBuf[di] = r;
    rgbaBuf[di + 1] = g;
    rgbaBuf[di + 2] = b;
    rgbaBuf[di + 3] = dist > threshold ? 255 : 0;
  }

  const buf = await sharp(rgbaBuf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return { buffer: buf, bgColor: bgHex };
}

/** Get cached processed info for an original path */
export async function getCachedEntry(
  originalPath: string
): Promise<CacheEntry | null> {
  const index = await loadIndex();
  const key = cacheKey(originalPath);
  return index.entries[key] || null;
}

/** Check if a cached image file still exists */
async function cachedFileExists(entry: CacheEntry): Promise<boolean> {
  try {
    const fullPath = path.join(process.cwd(), "public", entry.processedPath);
    await readFile(fullPath);
    // Also check split views if any
    if (entry.splitViews) {
      for (const sv of entry.splitViews) {
        await readFile(path.join(process.cwd(), "public", sv));
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cached processed image path, or null if not cached.
 */
export async function getCachedProcessedPath(
  originalPath: string,
  forceReprocess: boolean = false
): Promise<string | null> {
  if (forceReprocess) return null;
  const entry = await getCachedEntry(originalPath);
  if (!entry) return null;
  if (!await cachedFileExists(entry)) return null;
  return entry.processedPath;
}

/**
 * Process an image: detect type, remove background, split if three-view, cache.
 * Returns the cache entry with all paths.
 */
export async function processAndCacheImage(
  originalPath: string,
  method: "sharp" | "wanxiang" = "sharp",
  assetType?: "logo" | "mascot-single" | "mascot-threeview"
): Promise<CacheEntry> {
  const fullPath = path.join(process.cwd(), "public", originalPath.replace(/^\//, ""));
  const key = cacheKey(originalPath);

  await mkdir(PROCESSED_DIR, { recursive: true });

  // Read original
  const image = sharp(fullPath);
  const meta = await image.metadata();

  // Check existing alpha
  let hasTransparency = false;
  if (meta.channels === 4) {
    const rawBuf = await image.raw().toBuffer();
    for (let i = 3; i < rawBuf.length; i += 4) {
      if (rawBuf[i] < 250) { hasTransparency = true; break; }
    }
  }

  let mainProcessedPath: string;
  let bgHex = "";
  let splitViews: string[] | undefined;

  if (hasTransparency) {
    // Already transparent, just copy as PNG
    const buf = await image.png().toBuffer();
    mainProcessedPath = `/generated/processed/${key}-main.png`;
    await writeFile(path.join(PROCESSED_DIR, `${key}-main.png`), buf);
  } else if (assetType === "mascot-threeview") {
    // Three-view mascot: split into individual views first
    const analysis = await analyzeMascotType(fullPath);
    if (analysis.splitRects && analysis.splitRects.length === 3) {
      splitViews = [];
      for (let i = 0; i < analysis.splitRects.length; i++) {
        const r = analysis.splitRects[i];
        const viewKey = `${key}-view-${i}`;
        const viewPath = `/generated/processed/${viewKey}.png`;
        const viewFull = path.join(PROCESSED_DIR, `${viewKey}.png`);

        // Crop the view, then remove background
        const cropped = sharp(fullPath).extract({ left: r.left, top: r.top, width: r.width, height: r.height });
        const { buffer, bgColor } = await removeBackground(cropped, await cropped.metadata());
        if (!bgHex) bgHex = bgColor;
        await writeFile(viewFull, buffer);
        splitViews.push(viewPath);
      }
      // Main processed image = first view (front view)
      mainProcessedPath = splitViews[0];
    } else {
      // Fallback: treat as single
      const { buffer, bgColor } = await removeBackground(image, meta);
      mainProcessedPath = `/generated/processed/${key}-main.png`;
      bgHex = bgColor;
      await writeFile(path.join(PROCESSED_DIR, `${key}-main.png`), buffer);
    }
  } else {
    // Standard background removal
    const { buffer, bgColor } = await removeBackground(image, meta);
    mainProcessedPath = `/generated/processed/${key}-main.png`;
    bgHex = bgColor;
    await writeFile(path.join(PROCESSED_DIR, `${key}-main.png`), buffer);
  }

  // Determine asset type if not provided
  if (!assetType) {
    if (originalPath.toLowerCase().includes("logo")) {
      assetType = "logo";
    } else {
      // Analyze to determine
      const analysis = await analyzeMascotType(fullPath);
      assetType = analysis.type !== "single" ? "mascot-threeview" : "mascot-single";
    }
  }

  const entry: CacheEntry = {
    originalPath,
    processedPath: mainProcessedPath,
    method,
    assetType,
    detectedBgColor: bgHex || undefined,
    splitViews: splitViews && splitViews.length > 0 ? splitViews : undefined,
    processedAt: new Date().toISOString(),
  };

  // Update index
  const index = await loadIndex();
  index.entries[key] = entry;
  await saveIndex(index);

  // Trigger semantic analysis in background (fire-and-forget)
  triggerAssetAnalysis(originalPath, assetType || "logo").catch(() => {});

  return entry;
}

/** Trigger semantic analysis for an asset (calls analyze-asset API, updates cache). */
async function triggerAssetAnalysis(originalPath: string, assetType: string): Promise<void> {
  try {
    const resp = await fetch(process.env.NEXT_PUBLIC_SITE_URL ? process.env.NEXT_PUBLIC_SITE_URL + "/api/ai/analyze-asset" : "http://localhost:3001/api/ai/analyze-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: originalPath, assetType }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return;
    const analysis = await resp.json();
    if (analysis.analysisStatus !== "completed") return;

    // Update the cache entry with analysis results
    const key = cacheKey(originalPath);
    const idx = await loadIndex();
    const entry = idx.entries[key];
    if (!entry) return;

    // Merge analysis fields into entry
    entry.analysisStatus = "completed";
    if (analysis.logoElements) entry.logoElements = analysis.logoElements;
    if (analysis.logoSyleTags) entry.logoSyleTags = analysis.logoSyleTags;
    if (analysis.logoMeaning) entry.logoMeaning = analysis.logoMeaning;
    if (analysis.extractedColors) entry.extractedColors = analysis.extractedColors;
    if (analysis.mascotName) entry.mascotName = analysis.mascotName;
    if (analysis.mascotStyle) entry.mascotStyle = analysis.mascotStyle;
    if (analysis.mascotPersonality) entry.mascotPersonality = analysis.mascotPersonality;
    if (analysis.mascotDescription) entry.mascotDescription = analysis.mascotDescription;
    if (analysis.mascotLabels) entry.mascotLabels = analysis.mascotLabels;

    idx.entries[key] = entry;
    await saveIndex(idx);
  } catch {
    // Background analysis failed silently; entry stays without analysis
  }
}

/**
 * Force reprocess an image, returning the updated cache entry.
 */
export async function reprocessImage(
  originalPath: string,
  method?: "sharp" | "wanxiang",
  assetType?: "logo" | "mascot-single" | "mascot-threeview"
): Promise<CacheEntry> {
  const key = cacheKey(originalPath);
  const index = await loadIndex();

  // Delete old cache entry and files
  delete index.entries[key];
  await saveIndex(index);

  // Remove old cached files
  try {
    const files = await readFile(PROCESSED_DIR).then(() =>
      import("fs").then(fs => fs.readdirSync(PROCESSED_DIR))
    ).catch(() => []);
    for (const f of files) {
      if (f.startsWith(key)) {
        try { await unlink(path.join(PROCESSED_DIR, f)); } catch {}
      }
    }
  } catch {}

  return processAndCacheImage(originalPath, method || "sharp", assetType);
}

/**
 * Get all processed assets (for visualization).
 * Returns entries grouped by project (derived from originalPath prefixes).
 */
export async function getAllProcessedEntries(): Promise<CacheEntry[]> {
  const index = await loadIndex();
  return Object.values(index.entries);
}


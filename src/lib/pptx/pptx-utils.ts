// V111: Shared PPTX utilities extracted from render-pptx.ts, vi-page-renderer.ts, spec-page-renderer.ts
import PptxGenJS from "pptxgenjs";

export const SW = 8.27;
export const SH = 11.69;
export const MARGIN = 0.7;
export const CONTENT_W = SW - MARGIN * 2;
export const LEFT_BAR_W = 0.12;

export function createSlide(pptx: PptxGenJS): PptxGenJS.Slide {
  return pptx.addSlide();
}

export function addLeftBar(slide: PptxGenJS.Slide, color: string): void {
  slide.addShape(pptx.shapes.RECT, {
    x: 0, y: 0, w: LEFT_BAR_W, h: SH,
    fill: { color },
  });
}

export function addBottomLine(slide: PptxGenJS.Slide, color: string): void {
  slide.addShape(pptx.shapes.RECT, {
    x: MARGIN, y: SH - 0.3, w: CONTENT_W, h: 0.02,
    fill: { color },
  });
}

export function resolveColor(c?: string, fallback?: string): string {
  if (!c || c === "#FFFFFF" || c === "#ffffff" || c === "FFFFFF" || c === "#1A73E8" || c === "#1a73e8") {
    return fallback || "#37474F";
  }
  return c;
}

export function darken(hex: string, amount = 20): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max((num >> 16) - amount, 0);
  const g = Math.max(((num >> 8) & 0xff) - amount, 0);
  const b = Math.max((num & 0xff) - amount, 0);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function lighten(hex: string, amount = 30): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min((num >> 16) + amount, 255);
  const g = Math.min(((num >> 8) & 0xff) + amount, 255);
  const b = Math.min((num & 0xff) + amount, 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function hx(c: string): string {
  return c.startsWith("#") ? c : `#${c}`;
}

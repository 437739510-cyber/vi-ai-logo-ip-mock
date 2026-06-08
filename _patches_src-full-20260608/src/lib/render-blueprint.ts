/**
 * Blueprint Renderer — 按 PageBlueprint 渲染 SVG
 *
 * 接收 Page Planner 输出的施工图，逐元素渲染为 SVG 字符串
 * 最后与通义万相背景图通过 sharp 合成
 */
import type { PageBlueprint, PageElement } from "./page-planner";

// ========== 页面常量 ==========

const PW = 1024;  // 页面宽度
const PH = 1024;  // 页面高度

// ========== 主渲染函数 ==========

/**
 * 根据 PageBlueprint 渲染完整的 SVG 页面
 */
export function renderBlueprintToSvg(
  blueprint: PageBlueprint,
  logoDataUri: string | null,
  mascotDataUri: string | null,
  mascotSplitViews?: string[] | null
): string {
  const { backgroundColor } = resolveBackground(blueprint.background);
  const isDarkBg = isDarkColor(backgroundColor);

  let svg = `<svg width="${PW}" height="${PH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;

  // Defs
  svg += `<defs>`;
  svg += `<filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.15"/></filter>`;
  svg += `<filter id="shadow-light"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.08"/></filter>`;
  svg += `<filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  svg += `</defs>`;

  // 背景填充
  svg += renderBackgroundFill(blueprint.background);

  // 遍历元素按 Z-order 渲染
  for (const el of blueprint.elements) {
    svg += renderElement(el, logoDataUri, mascotDataUri, mascotSplitViews, isDarkBg);
  }

  svg += `</svg>`;
  return svg;
}

// ========== 颜色工具 ==========

function isDarkColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 140;
}

function hexToRgba(hex: string, opacity: number = 1): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** 计算位置：按百分比和边距返回 x,y */
function resolvePosition(
  el: PageElement
): { x: number; y: number; w: number; h: number } {
  let x = 0, y = 0;
  const w = Math.round((el.widthPct || 20) / 100 * PW);
  const h = Math.round((el.heightPct || 10) / 100 * PH);

  switch (el.position) {
    case "top-center":
      x = (PW - w) / 2;
      y = el.marginTop || 20;
      break;
    case "center":
      x = (PW - w) / 2;
      y = el.marginTop ? (el.marginTop) : ((PH - h) / 2);
      break;
    case "bottom-center":
      x = (PW - w) / 2;
      y = PH - h - (el.marginBottom || 30);
      break;
    case "bottom-right":
      x = PW - w - (el.marginRight || 30);
      y = PH - h - (el.marginBottom || 30);
      break;
    case "left":
      x = el.marginLeft || 60;
      y = el.marginTop || 20;
      break;
    case "right":
      x = PW - w - (el.marginRight || 60);
      y = el.marginTop || 20;
      break;
  }
  return { x, y, w, h };
}

// ========== 背景渲染 ==========

interface BackgroundColors {
  backgroundColor: string;
  gradientColor?: string;
}

function resolveBackground(bg: PageBlueprint["background"]): BackgroundColors {
  return {
    backgroundColor: bg.primaryColor,
    gradientColor: bg.secondaryColor,
  };
}

function renderBackgroundFill(bg: PageBlueprint["background"]): string {
  if (bg.type === "gradient" && bg.secondaryColor) {
    return (
      `<defs><linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">` +
      `<stop offset="0%" style="stop-color:${bg.primaryColor};stop-opacity:1"/>` +
      `<stop offset="100%" style="stop-color:${bg.secondaryColor};stop-opacity:1"/>` +
      `</linearGradient></defs>` +
      `<rect width="${PW}" height="${PH}" fill="url(#bgGrad)"/>`
    );
  }
  return `<rect width="${PW}" height="${PH}" fill="${bg.primaryColor}"/>`;
}

// ========== 元素渲染调度 ==========

function renderElement(
  el: PageElement,
  logoDataUri: string | null,
  mascotDataUri: string | null,
  mascotSplitViews?: string[] | null,
  isDarkBg?: boolean
): string {
  switch (el.type) {
    case "logo": return renderLogo(el, logoDataUri);
    case "text": return renderText(el, isDarkBg ?? false);
    case "ip-mascot": return renderMascot(el, mascotDataUri, mascotSplitViews);
    case "color-swatch": return renderColorSwatch(el);
    case "decoration": return renderDecoration(el);
    case "divider": return renderDivider(el);
    case "image": return renderImage(el);
    case "table": return renderTable(el);
    case "threeview": return renderThreeView(el, mascotSplitViews);
    default: return "";
  }
}

// ========== 元素渲染器 ==========

/** LOGO */
function renderLogo(el: PageElement, dataUri: string | null): string {
  const { x, y, w, h } = resolvePosition(el);
  if (!dataUri) {
    // 占位
    const textColor = "#999";
    return (
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#f0f0f0" stroke="#ddd" stroke-width="1"/>` +
      `<text x="${x + w/2}" y="${y + h/2}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="${textColor}">LOGO</text>`
    );
  }
  const filterAttr = el.shadow ? ' filter="url(#shadow)"' : '';
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${dataUri}" preserveAspectRatio="xMidYMid meet"${filterAttr}/>`;
}

/** 文字 */
function renderText(el: PageElement, isDarkBg: boolean): string {
  const { x, y, w, h } = resolvePosition(el);
  const fontSize = el.fontSize || 16;
  const fontWeight = el.fontWeight || 400;
  const textColor = el.color || (isDarkBg ? "#FFFFFF" : "#333333");
  const opacity = el.opacity ?? 1;
  const align = el.params?.align || "center";
  const textAnchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const lx = align === "left" ? x : align === "right" ? x + w : x + w / 2;

  // 多行文本处理
  const lines = (el.content || "").split("\n");
  const lineHeight = el.params?.lineHeight || 1.4;
  const totalHeight = lines.length * fontSize * lineHeight;
  const startY = y + (h > 0 ? Math.max(0, (h - totalHeight) / 2) : 0) + fontSize;

  let result = "";
  lines.forEach((line, i) => {
    const ly = startY + i * fontSize * lineHeight;
    const filterAttr = el.shadow ? ' filter="url(#shadow)"' : '';
    const italic = el.params?.italic ? ' font-style="italic"' : '';
    const letterSpacing = el.params?.letterSpacing ? ` letter-spacing="${el.params.letterSpacing}"` : '';
    result += `<text x="${lx}" y="${ly}" text-anchor="${textAnchor}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${textColor}" opacity="${opacity}"${filterAttr}${italic}${letterSpacing}>${escapeXml(line)}</text>`;
  });

  return result;
}

/** IP 公仔 */
function renderMascot(
  el: PageElement,
  dataUri: string | null,
  splitViews?: string[] | null
): string {
  const { x, y, w, h } = resolvePosition(el);
  if (!dataUri) return "";
  const filterAttr = el.shadow ? ' filter="url(#shadow)"' : '';
  const opacity = el.opacity ?? 1;
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${dataUri}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}"${filterAttr}/>`;
}

/** 色块 */
function renderColorSwatch(el: PageElement): string {
  const { x, y, w, h } = resolvePosition(el);
  const hex = el.color || "#000000";
  const label = el.params?.label || "";
  const name = el.params?.name || "";
  const swatchH = Math.max(80, h * 0.7);

  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${swatchH}" rx="8" fill="${hex}" filter="url(#shadow-light)"/>` +
    `<text x="${x + w/2}" y="${y + swatchH/2}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="600" fill="${isDarkColor(hex) ? "#FFFFFF" : "#333"}">${escapeXml(label)}</text>` +
    `<text x="${x + w/2}" y="${y + swatchH + 18}" text-anchor="middle" font-size="11" fill="#666">${escapeXml(name)}</text>` +
    `<text x="${x + w/2}" y="${y + swatchH + 34}" text-anchor="middle" font-size="10" fill="#888">${hex}</text>`
  );
}

/** 装饰 */
function renderDecoration(el: PageElement): string {
  const { x, y, w, h } = resolvePosition(el);
  const color = el.color || "#000";
  const opacity = el.opacity ?? 0.3;

  if (el.params?.shape === "circle") {
    const r = Math.min(w, h) / 2;
    return `<circle cx="${x + w/2}" cy="${y + h/2}" r="${r}" fill="${color}" opacity="${opacity}"/>`;
  }

  if (el.params?.barType === "thick") {
    return `<rect x="0" y="${PH - 6}" width="${PW}" height="6" fill="${color}" opacity="${opacity}"/>`;
  }

  // 默认：细条装饰
  return `<rect x="${x}" y="${y}" width="${w}" height="${h || 1}" fill="${color}" opacity="${opacity}"/>`;
}

/** 分隔线 */
function renderDivider(el: PageElement): string {
  const { x, y, w } = resolvePosition(el);
  const color = el.color || "#000";
  const opacity = el.opacity ?? 0.3;
  const lineY = el.position === "center" ? y : (el.marginTop || 150);
  return `<line x1="${x}" y1="${lineY}" x2="${x + w}" y2="${lineY}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
}

/** 图片占位（场景图区域 — 由通义万相生成，渲染时留空让 sharp 合成） */
function renderImage(el: PageElement): string {
  const { x, y, w, h } = resolvePosition(el);
  const sceneType = el.params?.sceneType || "";
  // 留一个半透明占位，最终背景图会覆盖
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="6,3"/>` +
    `<text x="${x + w/2}" y="${y + h/2}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="rgba(255,255,255,0.4)">${escapeXml(sceneType)}</text>`
  );
}

/** 表格 */
function renderTable(el: PageElement): string {
  const { x, y, w, h } = resolvePosition(el);
  const headers: string[] = el.params?.headers || [];
  const rows: string[][] = el.params?.rows || [];
  const colW = w / Math.max(headers.length, 1);
  const rowH = Math.max(28, h / (rows.length + 1));

  let html = "";

  // Header row
  headers.forEach((header, ci) => {
    const hx = x + ci * colW;
    html += `<rect x="${hx}" y="${y}" width="${colW}" height="${rowH}" fill="#f5f5f5" stroke="#e0e0e0" stroke-width="0.5"/>`;
    html += `<text x="${hx + colW/2}" y="${y + rowH/2}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" fill="#333">${escapeXml(header)}</text>`;
  });

  // Data rows
  rows.forEach((row, ri) => {
    const ry = y + (ri + 1) * rowH;
    (row.length >= headers.length ? row : [...row, ...Array(headers.length - row.length).fill("")]).forEach((cell, ci) => {
      const cx = x + ci * colW;
      const bg = ri % 2 === 0 ? "#FAFAFA" : "#FFFFFF";
      html += `<rect x="${cx}" y="${ry}" width="${colW}" height="${rowH}" fill="${bg}" stroke="#e0e0e0" stroke-width="0.5"/>`;
      html += `<text x="${cx + colW/2}" y="${ry + rowH/2}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#555">${escapeXml(cell)}</text>`;
    });
  });

  return html;
}

/** 三视图 */
function renderThreeView(
  el: PageElement,
  splitViews?: string[] | null
): string {
  if (!splitViews || splitViews.length === 0) return "";

  const { x, y, w, h } = resolvePosition(el);
  const viewW = w / 3;
  const labels = ["正面", "侧面", "背面"];

  let html = "";
  splitViews.forEach((uri, i) => {
    const vx = x + i * viewW;
    html += `<image x="${vx}" y="${y}" width="${viewW}" height="${h}" href="${uri}" preserveAspectRatio="xMidYMid meet"/>`;
    html += `<text x="${vx + viewW/2}" y="${y + h + 16}" text-anchor="middle" font-size="10" fill="#888">${labels[i] || `View ${i+1}`}</text>`;
  });

  return html;
}

// ========== 工具 ==========

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

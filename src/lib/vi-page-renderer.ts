/**
 * Brand Brain — 专业VI手册页面渲染器 V4
 *
 * V3问题：1037行switch-case填表机器，没有"脑子"
 * V4改进：
 * 1. 接收DesignDecision（AI设计决策），色彩/字号/布局由AI驱动
 * 2. 3页应用页嵌入万相2.7写实图（左写实图+右文字规范）
 * 3. 新增目录页(toc) + 数字应用规范页(digital)
 * 4. 14页完整VI手册
 * 5. 降级安全：任何AI环节失败，输出不低于V3质量
 */

// ===== A4竖版画布参数 =====
const PW = 794;   // A4 width @96dpi
const PH = 1122;  // A4 height @96dpi

// ===== 专业边距系统 =====
const M = {
  top: 40,
  bottom: 35,
  left: 45,
  right: 35,
  content: {
    x: 45,
    y: 40,
    w: PW - 45 - 35,  // 714
    h: PH - 40 - 35,  // 1047
  }
};

// ===== 工具函数 =====
function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      break;
    }
    let breakAt = maxCharsPerLine;
    for (let i = maxCharsPerLine; i > maxCharsPerLine * 0.6; i--) {
      if ("，。、；：！？,. ;:!?\n".includes(remaining[i])) {
        breakAt = i + 1;
        break;
      }
    }
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt);
  }
  return lines;
}

function renderTextBlock(
  x: number, y: number, maxWidth: number,
  text: string, fontSize: number, fontWeight: number,
  color: string, opacity: number = 1,
  maxCharsPerLine: number = 28,
  lineHeight: number = 1.6,
  align: "start" | "middle" | "end" = "start"
): string {
  const lines = wrapText(text, maxCharsPerLine);
  const textAnchor = align;
  const lx = align === "middle" ? x + maxWidth / 2 : align === "end" ? x + maxWidth : x;
  return lines
    .map((line, i) =>
      `<text x="${lx}" y="${y + i * fontSize * lineHeight}" text-anchor="${textAnchor}" ` +
      `font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" opacity="${opacity}" ` +
      `font-family="'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif">${esc(line)}</text>`
    )
    .join("");
}

function isDarkColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 140;
}

function hexToCmyk(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 0.99) return "0, 0, 0, 100";
  const cc = Math.round((1 - r - k) / (1 - k) * 100);
  const mm = Math.round((1 - g - k) / (1 - k) * 100);
  const yy = Math.round((1 - b - k) / (1 - k) * 100);
  return `${cc}, ${mm}, ${yy}, ${Math.round(k * 100)}`;
}

function hexToRgb(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// ===== 通用组件 =====

/** 顶部品牌色条（V4加粗到30px，对标MANUS） */
function topBar(color: string, height: number = 30): string {
  return `<rect x="0" y="0" width="${PW}" height="${height}" fill="${color}"/>`;
}

/** 页面标题区 */
function pageTitle(title: string, subtitle: string, priHex: string, accHex: string, titleSize: number = 20): string {
  let svg = "";
  svg += `<text x="${M.left}" y="${M.top + 24}" font-size="${titleSize}" font-weight="700" fill="${priHex}" font-family="'Noto Sans SC', 'PingFang SC', sans-serif">${esc(title)}</text>`;
  svg += `<text x="${M.left}" y="${M.top + 42}" font-size="9" fill="#BBB" letter-spacing="3" font-family="sans-serif">${esc(subtitle)}</text>`;
  svg += `<line x1="${M.left}" y1="${M.top + 52}" x2="${M.left + 160}" y2="${M.top + 52}" stroke="${accHex}" stroke-width="1.5" opacity="0.5"/>`;
  return svg;
}

/** 页脚 */
function pageFooter(brandName: string, pageNum: number | null, totalPages: number): string {
  let svg = "";
  const footY = PH - M.bottom;
  svg += `<line x1="${M.left}" y1="${footY - 8}" x2="${PW - M.right}" y2="${footY - 8}" stroke="#E8E8E8" stroke-width="0.5"/>`;
  svg += `<text x="${M.left}" y="${footY + 6}" font-size="8" fill="#BBB" font-family="'Noto Sans SC', sans-serif">${esc(brandName)} · 品牌视觉识别规范</text>`;
  if (pageNum !== null) {
    svg += `<text x="${PW - M.right}" y="${footY + 6}" text-anchor="end" font-size="8" fill="#BBB" font-family="sans-serif">${String(pageNum).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}</text>`;
  }
  return svg;
}

function pageBackground(): string {
  return `<rect width="${PW}" height="${PH}" fill="#F7F8FA"/>`;
}

function contentPanel(x: number, y: number, w: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#FFFFFF" stroke="#EEEEEE" stroke-width="0.5"/>`;
}

function chapterNumber(num: number, color: string): string {
  return `<text x="${PW - M.right}" y="${M.top + 26}" text-anchor="end" font-size="32" font-weight="800" fill="${color}" opacity="0.12" font-family="sans-serif">${String(num).padStart(2, '0')}</text>`;
}

// ===== DesignDecision 类型（与route.ts一致） =====
interface DesignDecision {
  colorScheme: {
    primary:   { hex: string; oklch: string; name: string; nameEn: string; meaning: string };
    secondary: { hex: string; oklch: string; name: string; nameEn: string; meaning: string };
    accent:    { hex: string; oklch: string; name: string; nameEn: string; meaning: string };
    reasoning: string;
  };
  pageLayouts: Array<{
    pageId: string;
    layout: string;
    fontSize: { title: number; subtitle: number; body: number };
    needsRealPhoto: boolean;
  }>;
  photoPrompts: Array<{
    pageId: string;
    prompt: string;
    promptCn: string;
    refImages: ('logo' | 'mascot')[];
    refStrength: number;
  }>;
  typography: {
    heading: { family: string; weights: number[] };
    body: { family: string; weights: number[] };
    modularScale: number;
  };
  logoIntegrationStrategy: string;
}

// ===== 渲染上下文（V4扩展） =====
interface RenderContext {
  companyName: string;
  brandVision: string;
  coreValues: string;
  targetMarket: string;
  brandPositioning: string;
  brandArchetype: string;
  brandPersona: string;
  logoPhilosophy: string;
  mascotPhilosophy: string;
  industry: string;
  primaryColor: { hex: string; name?: string; rgb?: string; cmyk?: string };
  secondaryColor: { hex: string; name?: string; rgb?: string; cmyk?: string };
  accentColor: { hex: string; name?: string; rgb?: string; cmyk?: string };
  logoDataUri: string | null;
  mascotDataUri: string | null;
  pageIndex: number;
  totalPages: number;
  // V4新增
  designDecision: DesignDecision;
  realPhotoBase64: string | null;
}

/** 从DesignDecision获取某页的字号配置 */
function getPageFontSize(ctx: RenderContext): { title: number; subtitle: number; body: number } {
  const layout = ctx.designDecision?.pageLayouts?.find(p => p.pageId === getPageId(ctx));
  return layout?.fontSize || { title: 20, subtitle: 9, body: 11 };
}

function getPageId(ctx: RenderContext): string {
  // 从pageIndex推断pageId（需要外部传入时使用）
  return "";
}

// ===== 1. 封面 =====
function renderCover(ctx: RenderContext): string {
  const { companyName, brandVision, primaryColor: pri, accentColor: acc, secondaryColor: sec, logoDataUri, designDecision } = ctx;
  const fs = designDecision?.pageLayouts?.find(p => p.pageId === "cover")?.fontSize || { title: 44, subtitle: 16, body: 12 };
  let svg = "";

  svg += `<rect width="${PW}" height="${PH}" fill="#FFFFFF"/>`;

  // V4: 加粗品牌色条（30px，对标MANUS）
  svg += `<rect x="0" y="0" width="${PW}" height="30" fill="${pri.hex}"/>`;
  svg += `<rect x="0" y="${PH - 30}" width="${PW}" height="30" fill="${acc.hex}"/>`;

  // 左侧竖线装饰
  svg += `<rect x="${M.left}" y="120" width="3" height="200" fill="${pri.hex}" opacity="0.3" rx="1.5"/>`;

  // Logo
  const logoAreaY = 160;
  const logoAreaH = 260;
  if (logoDataUri) {
    const logoW = 300, logoH = 160;
    const logoX = (PW - logoW) / 2;
    const logoY = logoAreaY + (logoAreaH - logoH) / 2;
    svg += `<image x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    svg += `<text x="${PW / 2}" y="${logoAreaY + logoAreaH / 2 + 30}" text-anchor="middle" font-size="80" font-weight="800" fill="${pri.hex}" font-family="'Noto Sans SC', sans-serif">${esc(companyName.charAt(0) || "B")}</text>`;
  }

  // 品牌名
  const nameY = 460;
  const nameSize = companyName.length > 6 ? 36 : fs.title;
  svg += `<text x="${PW / 2}" y="${nameY}" text-anchor="middle" font-size="${nameSize}" font-weight="800" fill="${pri.hex}" font-family="'Noto Sans SC', 'PingFang SC', sans-serif">${esc(companyName)}</text>`;

  // Slogan
  if (brandVision && brandVision.length <= 24) {
    svg += `<text x="${PW / 2}" y="${nameY + 40}" text-anchor="middle" font-size="${fs.subtitle}" font-weight="400" fill="${sec.hex}" font-family="'Noto Sans SC', sans-serif">${esc(brandVision)}</text>`;
  }

  // 副标题
  const subY = nameY + 80;
  svg += `<text x="${PW / 2}" y="${subY}" text-anchor="middle" font-size="16" font-weight="600" fill="#333333" font-family="'Noto Sans SC', sans-serif">品牌视觉识别系统（VI）规范手册</text>`;
  svg += `<line x1="${PW / 2 - 100}" y1="${subY + 12}" x2="${PW / 2 + 100}" y2="${subY + 12}" stroke="${acc.hex}" stroke-width="1" opacity="0.4"/>`;
  svg += `<text x="${PW / 2}" y="${subY + 32}" text-anchor="middle" font-size="10" font-weight="300" fill="#999999" letter-spacing="3" font-family="sans-serif">VISUAL IDENTITY GUIDELINES</text>`;

  // 底部
  svg += `<text x="${PW / 2}" y="${PH - 50}" text-anchor="middle" font-size="10" fill="#AAAAAA" font-family="'Noto Sans SC', sans-serif">品牌管理部 · v1.0 · ${new Date().getFullYear()}</text>`;

  return svg;
}

// ===== 2. 目录页（V4新增） =====
function renderToc(ctx: RenderContext): string {
  const { companyName, primaryColor: pri, accentColor: acc, secondaryColor: sec } = ctx;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("目录", "TABLE OF CONTENTS", pri.hex, acc.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 40;
  let yCur = panelY + 40;

  const tocItems = [
    { num: "01", title: "品牌核心理念", en: "Brand Philosophy" },
    { num: "02", title: "标识诠释", en: "Logo Interpretation" },
    { num: "03", title: "标准色彩规范", en: "Color System" },
    { num: "04", title: "字体系统", en: "Typography" },
    { num: "05", title: "基础规范", en: "Basic Specification" },
    { num: "06", title: "IP公仔规范", en: "Mascot Guidelines" },
    { num: "07", title: "办公应用系统", en: "Stationery System" },
    { num: "08", title: "产品包装系统", en: "Packaging System" },
    { num: "09", title: "营销展示系统", en: "Marketing Materials" },
    { num: "10", title: "数字应用规范", en: "Digital Application" },
    { num: "11", title: "品牌资产总结", en: "Summary" },
  ];

  tocItems.forEach((item, i) => {
    const rowY = yCur + i * 56;

    // 编号
    svg += `<text x="${contentX}" y="${rowY + 20}" font-size="24" font-weight="800" fill="${pri.hex}" opacity="0.15" font-family="sans-serif">${item.num}</text>`;

    // 中文标题
    svg += `<text x="${contentX + 50}" y="${rowY + 18}" font-size="14" font-weight="600" fill="#333" font-family="'Noto Sans SC', sans-serif">${esc(item.title)}</text>`;

    // 英文
    svg += `<text x="${contentX + 50}" y="${rowY + 34}" font-size="9" fill="#999" font-family="sans-serif" letter-spacing="1">${esc(item.en)}</text>`;

    // 分隔线（虚线）
    if (i < tocItems.length - 1) {
      svg += `<line x1="${contentX + 50}" y1="${rowY + 46}" x2="${contentX + panelW - 80}" y2="${rowY + 46}" stroke="#E8E8E8" stroke-width="0.5" stroke-dasharray="4,3"/>`;
      // 右侧页码指示
      svg += `<text x="${contentX + panelW - 40}" y="${rowY + 18}" font-size="10" fill="#BBB" font-family="sans-serif">${item.num}</text>`;
    }
  });

  svg += pageFooter(companyName, 0, ctx.totalPages);
  return svg;
}

// ===== 3. 品牌核心理念（V4: 左侧品牌色竖条装饰） =====
function renderBrandPhilosophy(ctx: RenderContext): string {
  const { companyName, brandVision, coreValues, targetMarket, brandPositioning, brandArchetype, brandPersona, primaryColor: pri, accentColor: acc, secondaryColor: sec } = ctx;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("品牌核心理念", "BRAND CORE PHILOSOPHY", pri.hex, acc.hex);
  svg += chapterNumber(1, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  // V4: 左侧品牌色竖条装饰
  svg += `<rect x="${panelX}" y="${panelY}" width="6" height="${panelH}" rx="3" fill="${pri.hex}"/>`;

  const contentX = panelX + 28;
  const contentW = panelW - 56;
  let yCur = panelY + 30;

  // 品牌愿景
  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">品牌愿景</text>`;
  svg += renderTextBlock(contentX, yCur + 18, contentW, brandVision || "构建值得信赖的品牌形象", 12, 400, "#444", 1, 32, 1.7);
  const visionLines = wrapText(brandVision || "构建值得信赖的品牌形象", 32).length;
  yCur += 20 + visionLines * 12 * 1.7 + 20;

  // V4: 金色分隔线
  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="${acc.hex}" stroke-width="1" opacity="0.4"/>`;
  yCur += 20;

  // 品牌定位
  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">品牌定位</text>`;
  svg += `<text x="${contentX}" y="${yCur + 20}" font-size="14" font-weight="600" fill="${pri.hex}">${esc(brandPositioning || "行业领先品牌")}</text>`;
  yCur += 48;

  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="#ECECEC" stroke-width="0.5"/>`;
  yCur += 20;

  // 核心价值
  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">核心价值</text>`;
  yCur += 16;
  const values = (coreValues || "品质,创新,服务").split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  let pillX = contentX;
  values.forEach(v => {
    const w = v.length * 11 + 22;
    svg += `<rect x="${pillX}" y="${yCur}" width="${w}" height="24" rx="12" fill="${pri.hex}"/>`;
    svg += `<text x="${pillX + w / 2}" y="${yCur + 16}" text-anchor="middle" font-size="10" font-weight="500" fill="#FFF">${esc(v)}</text>`;
    pillX += w + 8;
  });
  yCur += 42;

  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="#ECECEC" stroke-width="0.5"/>`;
  yCur += 20;

  // 品牌性格
  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">品牌性格</text>`;
  yCur += 16;
  const personas = (brandPersona || "专业,亲和,可信赖").split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  pillX = contentX;
  personas.forEach(p => {
    const w = p.length * 11 + 22;
    svg += `<rect x="${pillX}" y="${yCur}" width="${w}" height="24" rx="12" fill="none" stroke="${pri.hex}" stroke-width="1.2"/>`;
    svg += `<text x="${pillX + w / 2}" y="${yCur + 16}" text-anchor="middle" font-size="10" font-weight="500" fill="${pri.hex}">${esc(p)}</text>`;
    pillX += w + 8;
  });
  yCur += 42;

  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="#ECECEC" stroke-width="0.5"/>`;
  yCur += 20;

  // 两栏：目标市场 + 品牌原型
  const halfW = (contentW - 30) / 2;
  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">目标市场</text>`;
  svg += renderTextBlock(contentX, yCur + 18, halfW, targetMarket || "面向中高端消费群体", 11, 400, "#555", 1, 20, 1.6);

  svg += `<text x="${contentX + halfW + 30}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">品牌原型</text>`;
  svg += `<text x="${contentX + halfW + 30}" y="${yCur + 20}" font-size="13" font-weight="500" fill="#555">${esc(brandArchetype || "智者")}</text>`;

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

// ===== 4. 标识诠释 =====
function renderLogoInterpretation(ctx: RenderContext): string {
  const { companyName, logoPhilosophy, logoDataUri, primaryColor: pri, accentColor: acc } = ctx;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("标识诠释", "LOGO INTERPRETATION", pri.hex, acc.hex);
  svg += chapterNumber(2, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 28;
  const contentW = panelW - 56;

  // Logo展示区（左侧）
  const logoBoxW = 300;
  const logoBoxH = 220;
  svg += `<rect x="${contentX}" y="${panelY + 24}" width="${logoBoxW}" height="${logoBoxH}" rx="6" fill="#FAFAFA" stroke="#F0F0F0" stroke-width="0.5"/>`;
  if (logoDataUri) {
    svg += `<image x="${contentX + 20}" y="${panelY + 44}" width="${logoBoxW - 40}" height="${logoBoxH - 40}" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    svg += `<text x="${contentX + logoBoxW / 2}" y="${panelY + 24 + logoBoxH / 2 + 12}" text-anchor="middle" font-size="40" font-weight="800" fill="${pri.hex}">${esc(companyName.charAt(0))}</text>`;
  }

  // 设计理念（右侧）
  const rightX = contentX + logoBoxW + 24;
  const rightW = contentW - logoBoxW - 24;
  svg += `<text x="${rightX}" y="${panelY + 46}" font-size="12" font-weight="700" fill="${pri.hex}">设计理念</text>`;
  svg += renderTextBlock(rightX, panelY + 64, rightW, logoPhilosophy || "品牌标识体现了企业的核心价值与愿景", 11, 400, "#444", 1, 22, 1.7);

  // 视觉符号解读
  let yCur = panelY + 24 + logoBoxH + 24;
  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="#ECECEC" stroke-width="0.5"/>`;
  yCur += 20;
  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">视觉符号解读</text>`;
  yCur += 22;

  const symbols = extractSymbols(logoPhilosophy, companyName);
  symbols.forEach((sym, i) => {
    const symY = yCur + i * 50;
    svg += `<rect x="${contentX}" y="${symY}" width="3" height="36" fill="${pri.hex}" rx="1"/>`;
    svg += `<text x="${contentX + 14}" y="${symY + 13}" font-size="11" font-weight="600" fill="${pri.hex}">${esc(sym.name)}</text>`;
    svg += renderTextBlock(contentX + 14, symY + 28, contentW - 14, sym.desc, 10, 400, "#666", 1, 30, 1.5);
  });

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

function extractSymbols(philosophy: string, brandName: string): { name: string; desc: string }[] {
  if (philosophy && philosophy.length > 20) {
    const parts = philosophy.split(/[。；]/).filter(s => s.trim().length > 5);
    if (parts.length >= 2) return parts.slice(0, 4).map((p, i) => ({ name: `符号 ${i + 1}`, desc: p.trim() }));
  }
  return [
    { name: "品牌图形", desc: "标识的核心图形元素，承载品牌识别的第一视觉印象" },
    { name: "品牌字标", desc: `${brandName}的标准字体呈现，传递品牌的专业与可信赖` },
    { name: "色彩语言", desc: "品牌色的运用体现了行业特征与品牌调性的统一" },
  ];
}

// ===== 5. 标准色彩规范（V4: OKLCH+Logo整合） =====
function renderBrandColors(ctx: RenderContext): string {
  const { companyName, primaryColor: pri, secondaryColor: sec, accentColor: acc, logoDataUri, designDecision } = ctx;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("标准色彩规范", "COLOR SYSTEM", pri.hex, acc.hex);
  svg += chapterNumber(3, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 28;
  const contentW = panelW - 56;
  let yCur = panelY + 30;

  // V4: 左侧Logo+三色整合模块
  const leftW = 240;
  if (logoDataUri) {
    svg += `<image x="${contentX}" y="${yCur}" width="100" height="50" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // 三色圆形色卡
  const circleY = yCur + 70;
  const colors = [
    { hex: pri.hex, name: designDecision?.colorScheme?.primary?.name || pri.name || "品牌主色", label: "Primary" },
    { hex: sec.hex, name: designDecision?.colorScheme?.secondary?.name || sec.name || "辅助色", label: "Secondary" },
    { hex: acc.hex, name: designDecision?.colorScheme?.accent?.name || acc.name || "强调色", label: "Accent" },
  ];
  const circleR = 32;
  colors.forEach((c, i) => {
    const cx = contentX + 40 + i * 80;
    svg += `<circle cx="${cx}" cy="${circleY}" r="${circleR}" fill="${c.hex}"/>`;
    svg += `<text x="${cx}" y="${circleY + circleR + 14}" text-anchor="middle" font-size="8" font-weight="600" fill="#555">${esc(c.label)}</text>`;
  });

  // 色彩关键词（来自AI决策）
  const meaningY = circleY + circleR + 30;
  if (designDecision?.colorScheme?.primary?.meaning) {
    svg += `<text x="${contentX}" y="${meaningY}" font-size="9" fill="#777">主色寓意：${esc(designDecision.colorScheme.primary.meaning)}</text>`;
  }
  if (designDecision?.colorScheme?.reasoning) {
    svg += renderTextBlock(contentX, meaningY + 16, leftW, designDecision.colorScheme.reasoning, 8, 400, "#999", 0.8, 24, 1.5);
  }

  // 右侧色卡详情
  const rightX = contentX + leftW + 20;
  const rightW = contentW - leftW - 20;

  // 主色+辅色大色卡
  const cardW = (rightW - 16) / 2;
  const swatchH = 120;
  svg += renderColorCard(rightX, yCur, cardW, swatchH, pri.hex, pri.name || designDecision?.colorScheme?.primary?.name || "品牌主色", "主色 Primary", pri.rgb || hexToRgb(pri.hex), pri.cmyk || hexToCmyk(pri.hex));
  svg += renderColorCard(rightX + cardW + 16, yCur, cardW, swatchH, sec.hex, sec.name || designDecision?.colorScheme?.secondary?.name || "辅助色", "辅助色 Secondary", sec.rgb || hexToRgb(sec.hex), sec.cmyk || hexToCmyk(sec.hex));
  yCur += swatchH + 16;

  // 强调色
  svg += renderColorCard(rightX, yCur, cardW, 90, acc.hex, acc.name || designDecision?.colorScheme?.accent?.name || "强调色", "强调色 Accent", acc.rgb || hexToRgb(acc.hex), acc.cmyk || hexToCmyk(acc.hex));

  // 色彩比例
  const ratioX = rightX + cardW + 16;
  svg += `<text x="${ratioX}" y="${yCur + 14}" font-size="10" font-weight="700" fill="${pri.hex}">色彩搭配比例</text>`;
  const barY = yCur + 24;
  const barW = cardW;
  svg += `<rect x="${ratioX}" y="${barY}" width="${barW * 0.6}" height="18" rx="3" fill="${pri.hex}"/>`;
  svg += `<rect x="${ratioX + barW * 0.6}" y="${barY}" width="${barW * 0.3}" height="18" fill="${sec.hex}"/>`;
  svg += `<rect x="${ratioX + barW * 0.9}" y="${barY}" width="${barW * 0.1}" height="18" rx="3" fill="${acc.hex}"/>`;
  svg += `<text x="${ratioX}" y="${barY + 32}" font-size="8" fill="#888">主色 60%</text>`;
  svg += `<text x="${ratioX + barW * 0.6}" y="${barY + 32}" font-size="8" fill="#888">辅色 30%</text>`;
  svg += `<text x="${ratioX + barW * 0.9}" y="${barY + 32}" font-size="8" fill="#888">10%</text>`;
  yCur += 106;

  // 色彩使用规范
  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="#ECECEC" stroke-width="0.5"/>`;
  yCur += 18;
  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">色彩使用规范</text>`;
  yCur += 18;
  const rules = [
    "主色用于品牌标识、标题和核心视觉元素",
    "辅助色用于背景、副标题和辅助信息",
    "强调色仅用于按钮、标签和关键交互提示",
    "色彩比例应遵循 60:30:10 法则",
    "禁止使用非规范色值的近似色替代",
  ];
  rules.forEach((rule, i) => {
    svg += `<circle cx="${contentX + 4}" cy="${yCur + i * 20 - 3}" r="2.5" fill="${pri.hex}"/>`;
    svg += `<text x="${contentX + 14}" y="${yCur + i * 20}" font-size="10" fill="#555">${esc(rule)}</text>`;
  });

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

function renderColorCard(
  x: number, y: number, w: number, h: number,
  hex: string, name: string, label: string,
  rgb: string, cmyk: string
): string {
  const swatchH = h * 0.5;
  const isDark = isDarkColor(hex);
  const labelColor = isDark ? "#FFFFFF" : "#333333";
  let svg = "";
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${swatchH}" rx="6" fill="${hex}"/>`;
  svg += `<text x="${x + w / 2}" y="${y + swatchH / 2 + 4}" text-anchor="middle" font-size="11" font-weight="600" fill="${labelColor}" opacity="0.9">${esc(label)}</text>`;
  svg += `<text x="${x + 8}" y="${y + swatchH + 18}" font-size="11" font-weight="600" fill="#333">${esc(name)}</text>`;
  svg += `<text x="${x + 8}" y="${y + swatchH + 32}" font-size="9" fill="#666" font-family="monospace">${hex}</text>`;
  svg += `<text x="${x + 8}" y="${y + swatchH + 44}" font-size="8" fill="#888" font-family="monospace">RGB ${rgb}</text>`;
  svg += `<text x="${x + 8}" y="${y + swatchH + 56}" font-size="8" fill="#888" font-family="monospace">CMYK ${cmyk}</text>`;
  return svg;
}

// ===== 6. 字体系统（V4: Logo整合+模块化比例） =====
function renderTypography(ctx: RenderContext): string {
  const { companyName, primaryColor: pri, accentColor: acc, logoDataUri, designDecision } = ctx;
  const scale = designDecision?.typography?.modularScale || 1.25;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("字体系统", "TYPOGRAPHY", pri.hex, acc.hex);
  svg += chapterNumber(4, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 28;
  const contentW = panelW - 56;
  let yCur = panelY + 30;

  // V4: 左侧Logo+字体名整合
  if (logoDataUri) {
    svg += `<image x="${contentX}" y="${yCur - 6}" width="80" height="40" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // 品牌专用字体
  svg += `<text x="${contentX}" y="${yCur + 48}" font-size="11" font-weight="700" fill="${pri.hex}">品牌专用字体</text>`;
  yCur += 66;
  svg += `<text x="${contentX}" y="${yCur + 28}" font-size="32" font-weight="800" fill="#333" font-family="'Noto Sans SC', 'PingFang SC', sans-serif">AaBbCc 品牌视觉</text>`;
  yCur += 36;
  const headingFamily = designDecision?.typography?.heading?.family || "Noto Sans SC";
  svg += `<text x="${contentX}" y="${yCur + 24}" font-size="10" fill="${pri.hex}" font-weight="600">${esc(headingFamily)}</text>`;
  svg += `<text x="${contentX}" y="${yCur + 40}" font-size="9" fill="#888">字重：Regular 400 / Medium 500 / Bold 700 · 用途：标题、品牌名、核心信息</text>`;
  yCur += 56;

  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="#ECECEC" stroke-width="0.5"/>`;
  yCur += 18;

  // 辅助字体
  svg += `<text x="${contentX}" y="${yCur}" font-size="11" font-weight="700" fill="${pri.hex}">辅助字体</text>`;
  yCur += 18;
  svg += `<text x="${contentX}" y="${yCur + 24}" font-size="24" font-weight="600" fill="#555" font-family="'Noto Serif SC', 'SimSun', serif">AaBbCc 品牌视觉</text>`;
  yCur += 32;
  const bodyFamily = designDecision?.typography?.body?.family || "Noto Serif SC";
  svg += `<text x="${contentX}" y="${yCur + 20}" font-size="10" fill="${pri.hex}" font-weight="600">${esc(bodyFamily)}</text>`;
  svg += `<text x="${contentX}" y="${yCur + 36}" font-size="9" fill="#888">字重：Regular 400 / SemiBold 600 · 用途：正文、说明文字、段落文本</text>`;
  yCur += 50;

  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="#ECECEC" stroke-width="0.5"/>`;
  yCur += 18;

  // 字号规范表（V4: 使用模块化比例）
  svg += `<text x="${contentX}" y="${yCur}" font-size="11" font-weight="700" fill="${pri.hex}">字号规范（模块化比例 ${scale}）</text>`;
  yCur += 16;

  const baseSize = 12;
  const scaleRows = [
    ["H1 / 封面标题", `${Math.round(baseSize * scale * scale * scale)}px`, "Bold 700", "封面、主标题"],
    ["H2 / 章节标题", `${Math.round(baseSize * scale * scale)}px`, "Bold 700", "页面标题"],
    ["H3 / 小标题", `${Math.round(baseSize * scale)}px`, "SemiBold 600", "段落标题"],
    ["正文", `${baseSize}px`, "Regular 400", "正文内容"],
    ["注释 / 页脚", `${Math.round(baseSize / scale)}px`, "Light 300", "注释、页脚"],
  ];

  const colWidths = [160, 100, 120, 180];
  const headers = ["层级", "字号", "字重", "用途"];
  let colX = contentX;
  headers.forEach((h, i) => {
    svg += `<rect x="${colX}" y="${yCur}" width="${colWidths[i]}" height="22" fill="#F5F5F5"/>`;
    svg += `<text x="${colX + 8}" y="${yCur + 15}" font-size="9" font-weight="600" fill="#333">${esc(h)}</text>`;
    colX += colWidths[i];
  });
  yCur += 22;

  scaleRows.forEach((row, ri) => {
    colX = contentX;
    const bg = ri % 2 === 0 ? "#FAFAFA" : "#FFF";
    row.forEach((cell, ci) => {
      svg += `<rect x="${colX}" y="${yCur}" width="${colWidths[ci]}" height="20" fill="${bg}"/>`;
      svg += `<text x="${colX + 8}" y="${yCur + 14}" font-size="9" fill="#555">${esc(cell)}</text>`;
      colX += colWidths[ci];
    });
    yCur += 20;
  });

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

// ===== 7. 基础规范 =====
function renderBasicSpec(ctx: RenderContext): string {
  const { companyName, logoDataUri, primaryColor: pri, accentColor: acc } = ctx;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("基础规范", "BASIC SPECIFICATION", pri.hex, acc.hex);
  svg += chapterNumber(5, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 28;
  const contentW = panelW - 56;
  let yCur = panelY + 28;

  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">LOGO 使用规范</text>`;
  yCur += 18;

  const halfW = (contentW - 16) / 2;

  // 正确用法
  svg += `<rect x="${contentX}" y="${yCur}" width="${halfW}" height="140" rx="6" fill="#F0FAF0" stroke="#D0E8D0" stroke-width="0.5"/>`;
  svg += `<text x="${contentX + 12}" y="${yCur + 18}" font-size="10" font-weight="600" fill="#2A7D2A">✓ 正确用法</text>`;
  ["等比例缩放，保持宽高比不变", "可转换为单色（黑白/反白）", "四周保留安全空间（≥0.5倍标识高度）", "最小尺寸：印刷≥15mm，数码≥60px"].forEach((r, i) => {
    svg += `<text x="${contentX + 20}" y="${yCur + 36 + i * 22}" font-size="9" fill="#555">· ${esc(r)}</text>`;
  });

  // 禁止用法
  const wrongX = contentX + halfW + 16;
  svg += `<rect x="${wrongX}" y="${yCur}" width="${halfW}" height="140" rx="6" fill="#FDF0F0" stroke="#F0D0D0" stroke-width="0.5"/>`;
  svg += `<text x="${wrongX + 12}" y="${yCur + 18}" font-size="10" font-weight="600" fill="#C0392B">✗ 禁止用法</text>`;
  ["拉伸/压缩变形", "旋转标识角度", "更换标识颜色", "添加阴影/描边/特效", "在复杂背景上使用"].forEach((r, i) => {
    svg += `<text x="${wrongX + 20}" y="${yCur + 36 + i * 22}" font-size="9" fill="#555">· ${esc(r)}</text>`;
  });
  yCur += 160;

  // 安全空间示意
  svg += `<text x="${contentX}" y="${yCur}" font-size="11" font-weight="700" fill="${pri.hex}">安全空间示意</text>`;
  yCur += 14;
  const safeW = contentW * 0.6;
  const safeH = 100;
  const safeX = (contentX + contentX + contentW) / 2 - safeW / 2;
  svg += `<rect x="${safeX}" y="${yCur}" width="${safeW}" height="${safeH}" rx="4" fill="#FFF" stroke="${pri.hex}" stroke-width="1" stroke-dasharray="5,3"/>`;
  if (logoDataUri) {
    svg += `<image x="${safeX + safeW * 0.2}" y="${yCur + 10}" width="${safeW * 0.6}" height="${safeH - 20}" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    svg += `<text x="${safeX + safeW / 2}" y="${yCur + safeH / 2 + 6}" text-anchor="middle" font-size="20" font-weight="800" fill="${pri.hex}">${esc(companyName)}</text>`;
  }
  svg += `<text x="${safeX + safeW + 8}" y="${yCur + 14}" font-size="8" fill="${pri.hex}">X = 标识高度 × 0.5</text>`;
  yCur += safeH + 20;

  // 最小尺寸
  svg += `<text x="${contentX}" y="${yCur}" font-size="11" font-weight="700" fill="${pri.hex}">最小使用尺寸</text>`;
  yCur += 14;
  const miniColW = contentW / 2;
  svg += `<rect x="${contentX}" y="${yCur}" width="${miniColW - 8}" height="20" fill="#F5F5F5"/>`;
  svg += `<text x="${contentX + 8}" y="${yCur + 14}" font-size="9" font-weight="600" fill="#333">场景</text>`;
  svg += `<rect x="${contentX + miniColW}" y="${yCur}" width="${miniColW - 8}" height="20" fill="#F5F5F5"/>`;
  svg += `<text x="${contentX + miniColW + 8}" y="${yCur + 14}" font-size="9" font-weight="600" fill="#333">最小尺寸</text>`;
  yCur += 20;
  [["印刷", "≥ 15mm (0.31 in)"], ["屏幕", "≥ 60px"]].forEach(([scene, size], ri) => {
    const bg = ri % 2 === 0 ? "#FAFAFA" : "#FFF";
    svg += `<rect x="${contentX}" y="${yCur}" width="${miniColW - 8}" height="18" fill="${bg}"/>`;
    svg += `<text x="${contentX + 8}" y="${yCur + 13}" font-size="9" fill="#555">${esc(scene)}</text>`;
    svg += `<rect x="${contentX + miniColW}" y="${yCur}" width="${miniColW - 8}" height="18" fill="${bg}"/>`;
    svg += `<text x="${contentX + miniColW + 8}" y="${yCur + 13}" font-size="9" fill="#555">${esc(size)}</text>`;
    yCur += 18;
  });

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

// ===== 8. IP公仔规范 =====
function renderMascotSpec(ctx: RenderContext): string {
  const { companyName, mascotPhilosophy, mascotDataUri, primaryColor: pri, accentColor: acc } = ctx;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("IP公仔规范", "MASCOT GUIDELINES", pri.hex, acc.hex);
  svg += chapterNumber(6, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 28;
  const contentW = panelW - 56;

  if (mascotDataUri) {
    const leftW = 300;
    svg += `<text x="${contentX}" y="${panelY + 24}" font-size="11" font-weight="700" fill="${pri.hex}">IP公仔展示</text>`;
    svg += `<rect x="${contentX}" y="${panelY + 34}" width="${leftW}" height="280" rx="6" fill="#FAFAFA" stroke="#F0F0F0" stroke-width="0.5"/>`;
    svg += `<image x="${contentX + 20}" y="${panelY + 54}" width="${leftW - 40}" height="240" href="${mascotDataUri}" preserveAspectRatio="xMidYMid meet"/>`;

    const rightX = contentX + leftW + 24;
    const rightW = contentW - leftW - 24;
    svg += `<text x="${rightX}" y="${panelY + 24}" font-size="11" font-weight="700" fill="${pri.hex}">设计理念</text>`;
    svg += renderTextBlock(rightX, panelY + 40, rightW, mascotPhilosophy || "品牌IP公仔承载品牌亲和力与记忆点", 11, 400, "#444", 1, 22, 1.7);
  } else {
    svg += `<text x="${contentX}" y="${panelY + 24}" font-size="11" font-weight="700" fill="${pri.hex}">IP公仔展示</text>`;
    svg += `<rect x="${contentX}" y="${panelY + 34}" width="280" height="200" rx="6" fill="#F8F8F8"/>`;
    svg += `<text x="${contentX + 140}" y="${panelY + 140}" text-anchor="middle" font-size="12" fill="#CCC">暂无IP公仔</text>`;
  }

  let yCur = panelY + 340;
  svg += `<line x1="${contentX}" y1="${yCur}" x2="${contentX + contentW}" y2="${yCur}" stroke="#ECECEC" stroke-width="0.5"/>`;
  yCur += 18;
  svg += `<text x="${contentX}" y="${yCur}" font-size="11" font-weight="700" fill="${pri.hex}">IP公仔使用规范</text>`;
  yCur += 18;
  [
    "IP公仔必须等比例缩放，禁止变形或拉伸",
    "公仔周围保留足够安全空间",
    "可用于包装、周边、营销物料，但不可作为LOGO替代",
    "公仔表情/姿势变更需品牌管理部审批",
    "禁止将公仔与其他角色混排或重新上色",
  ].forEach((rule, i) => {
    svg += `<circle cx="${contentX + 4}" cy="${yCur + i * 20 - 3}" r="2.5" fill="${pri.hex}"/>`;
    svg += `<text x="${contentX + 14}" y="${yCur + i * 20}" font-size="10" fill="#555">${esc(rule)}</text>`;
  });

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

// ===== V4核心: 9/10/11 三个应用页（左写实图+右文字） =====

function renderApplicationPage(
  ctx: RenderContext,
  chapterNum: number,
  titleCn: string,
  titleEn: string,
  specItems: { label: string; desc: string }[],
  fallbackContent: string,
): string {
  const { companyName, primaryColor: pri, accentColor: acc, realPhotoBase64, designDecision } = ctx;
  const hasPhoto = Boolean(realPhotoBase64);
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle(titleCn, titleEn, pri.hex, acc.hex);
  svg += chapterNumber(chapterNum, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 28;
  const contentW = panelW - 56;

  if (hasPhoto) {
    // V4: 左写实图 + 右文字规范
    const photoW = contentW * 0.55;  // 左侧占55%
    const photoH = panelH - 40;
    const photoX = contentX;
    const photoY = panelY + 20;

    // 写实图嵌入
    svg += `<image x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" href="${realPhotoBase64}" preserveAspectRatio="xMidYMid slice" style="clip-path: inset(0 round 6px)"/>`;

    // 右侧文字规范
    const textX = contentX + photoW + 20;
    const textW = contentW - photoW - 20;
    let yCur = panelY + 30;

    svg += `<text x="${textX}" y="${yCur}" font-size="13" font-weight="700" fill="${pri.hex}">设计规范</text>`;
    yCur += 24;

    specItems.forEach((item) => {
      svg += `<rect x="${textX}" y="${yCur}" width="3" height="20" fill="${pri.hex}" rx="1"/>`;
      svg += `<text x="${textX + 12}" y="${yCur + 12}" font-size="10" font-weight="600" fill="#333">${esc(item.label)}</text>`;
      svg += renderTextBlock(textX + 12, yCur + 22, textW - 12, item.desc, 9, 400, "#666", 1, 22, 1.5);
      const lines = wrapText(item.desc, 22).length;
      yCur += 26 + lines * 9 * 1.5 + 12;
    });

    // 底部提示
    svg += `<text x="${textX}" y="${panelY + panelH - 30}" font-size="8" fill="#BBB" font-style="italic">* 实景效果由AI生成，仅供参考</text>`;
  } else {
    // 降级：无写实图时用SVG简笔画
    let yCur = panelY + 28;
    svg += renderTextBlock(contentX, yCur, contentW, `品牌在${titleCn.replace("系统", "")}中的标准化应用，确保品牌形象在所有物料中保持一致性。`, 10, 400, "#666", 1, 40, 1.6);
    yCur += 30;

    // 规范列表
    specItems.forEach((item) => {
      svg += `<circle cx="${contentX + 4}" cy="${yCur - 3}" r="2.5" fill="${pri.hex}"/>`;
      svg += `<text x="${contentX + 14}" y="${yCur}" font-size="10" font-weight="600" fill="#333">${esc(item.label)}</text>`;
      svg += renderTextBlock(contentX + 14, yCur + 14, contentW - 14, item.desc, 9, 400, "#666", 1, 30, 1.5);
      const lines = wrapText(item.desc, 30).length;
      yCur += 16 + lines * 9 * 1.5 + 10;
    });

    // SVG简笔画占位
    svg += `<rect x="${contentX}" y="${yCur + 10}" width="${contentW}" height="180" rx="6" fill="#FAFAFA" stroke="#EEE" stroke-width="0.5"/>`;
    svg += `<text x="${contentX + contentW / 2}" y="${yCur + 100}" text-anchor="middle" font-size="12" fill="#CCC">${esc(fallbackContent)}</text>`;
  }

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

// ===== 9. 办公应用系统 =====
function renderStationery(ctx: RenderContext): string {
  return renderApplicationPage(ctx, 7, "办公应用系统", "STATIONERY SYSTEM", [
    { label: "名片设计", desc: "标准名片尺寸90×54mm，品牌色贯穿底部色条，Logo位于左上角，姓名+职位+联系方式居中排列" },
    { label: "信封设计", desc: "C5信封（229×162mm），Logo位于左上角，品牌色右侧色条装饰，收件信息区域留白" },
    { label: "信纸设计", desc: "A4信纸，顶部品牌色细线+Logo水印，底部品牌色色条，正文区域宽裕" },
    { label: "文件夹", desc: "A4文件夹，外封面品牌色+Logo居中，内页品牌色色条装饰" },
    { label: "工牌设计", desc: "竖版工牌85×54mm，品牌色顶部+Logo+姓名+部门+照片区域" },
  ], "办公应用示意");
}

// ===== 10. 产品包装系统 =====
function renderPackaging(ctx: RenderContext): string {
  return renderApplicationPage(ctx, 8, "产品包装系统", "PACKAGING SYSTEM", [
    { label: "手提袋", desc: "250g白卡纸+品牌色满版印刷+Logo居中，提手使用品牌色丝带或棉绳" },
    { label: "礼盒包装", desc: "灰板+特种纸裱糊+烫金Logo，内衬海绵或EVA，品牌色内衬底" },
    { label: "瓶贴/标签", desc: "防水PP合成纸+品牌色印刷，Logo+品名+净含量+配料表，遵循法规排版" },
    { label: "封箱胶带", desc: "品牌色底+Logo重复排列，宽度48mm/60mm，提升快递开箱品牌体验" },
    { label: "产品内页卡", desc: "品牌色双面铜版纸+品牌故事+使用指南，增强产品仪式感" },
  ], "产品包装示意");
}

// ===== 11. 营销展示系统 =====
function renderMarketing(ctx: RenderContext): string {
  return renderApplicationPage(ctx, 9, "营销展示系统", "MARKETING MATERIALS", [
    { label: "宣传海报", desc: "A3/A4竖版，品牌色主视觉+Logo左上角+核心文案居中，留白≥30%" },
    { label: "X展架/易拉宝", desc: "80×200cm，品牌色背景+Logo+核心卖点+二维码，顶部30%为视觉吸引区" },
    { label: "门店招牌", desc: "品牌色底+发光Logo+品牌名，字高≥30cm，夜间可视距离≥50米" },
    { label: "围挡设计", desc: "施工围挡品牌色+Logo+品牌Slogan重复排列，提升街区视觉形象" },
    { label: "促销物料", desc: "吊旗/桌牌/价签统一品牌色系，Logo占比≤15%，信息层级清晰" },
  ], "营销展示示意");
}

// ===== 12. 数字应用规范（V4新增） =====
function renderDigital(ctx: RenderContext): string {
  const { companyName, primaryColor: pri, accentColor: acc, secondaryColor: sec, logoDataUri } = ctx;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("数字应用规范", "DIGITAL APPLICATION", pri.hex, acc.hex);
  svg += chapterNumber(10, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 28;
  const contentW = panelW - 56;
  let yCur = panelY + 30;

  // 左右两栏
  const halfW = (contentW - 20) / 2;

  // 左栏：社交媒体
  svg += `<text x="${contentX}" y="${yCur}" font-size="12" font-weight="700" fill="${pri.hex}">社交媒体</text>`;
  yCur += 18;

  // 头像示意
  svg += `<rect x="${contentX}" y="${yCur}" width="80" height="80" rx="40" fill="${pri.hex}"/>`;
  if (logoDataUri) {
    svg += `<image x="${contentX + 10}" y="${yCur + 10}" width="60" height="60" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  svg += `<text x="${contentX + 95}" y="${yCur + 16}" font-size="10" font-weight="600" fill="#333">社交头像</text>`;
  svg += `<text x="${contentX + 95}" y="${yCur + 30}" font-size="8" fill="#888">圆形裁切，Logo居中</text>`;
  svg += `<text x="${contentX + 95}" y="${yCur + 42}" font-size="8" fill="#888">安全区域：半径80%</text>`;
  yCur += 90;

  // 微信公众号头图
  svg += `<rect x="${contentX}" y="${yCur}" width="${halfW}" height="80" rx="4" fill="${pri.hex}"/>`;
  if (logoDataUri) {
    svg += `<image x="${contentX + 10}" y="${yCur + 10}" width="50" height="25" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  svg += `<text x="${contentX + halfW / 2}" y="${yCur + 55}" text-anchor="middle" font-size="10" font-weight="600" fill="#FFF">${esc(companyName)}</text>`;
  svg += `<text x="${contentX + halfW / 2}" y="${yCur + 70}" text-anchor="middle" font-size="7" fill="#FFF" opacity="0.7">微信公众号头图 900×383</text>`;
  yCur += 95;

  // 朋友圈海报
  svg += `<rect x="${contentX}" y="${yCur}" width="100" height="133" rx="4" fill="#FFF" stroke="#E0E0E0" stroke-width="0.5"/>`;
  svg += `<rect x="${contentX}" y="${yCur}" width="100" height="25" rx="4" fill="${pri.hex}"/>`;
  if (logoDataUri) {
    svg += `<image x="${contentX + 4}" y="${yCur + 4}" width="20" height="17" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  svg += `<text x="${contentX + 50}" y="${yCur + 80}" text-anchor="middle" font-size="8" font-weight="600" fill="#333">${esc(companyName)}</text>`;
  svg += `<text x="${contentX + 50}" y="${yCur + 95}" text-anchor="middle" font-size="6" fill="#888">朋友圈海报</text>`;
  svg += `<text x="${contentX + 50}" y="${yCur + 108}" text-anchor="middle" font-size="5" fill="#AAA">1080×1440</text>`;

  // 右栏：网页/小程序
  const rightX = contentX + halfW + 20;
  let ryCur = panelY + 30;

  svg += `<text x="${rightX}" y="${ryCur}" font-size="12" font-weight="700" fill="${pri.hex}">网页与小程序</text>`;
  ryCur += 18;

  // 网页Banner示意
  svg += `<rect x="${rightX}" y="${ryCur}" width="${halfW}" height="60" rx="4" fill="${pri.hex}"/>`;
  if (logoDataUri) {
    svg += `<image x="${rightX + 10}" y="${ryCur + 10}" width="60" height="30" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  svg += `<text x="${rightX + halfW / 2}" y="${ryCur + 48}" text-anchor="middle" font-size="8" fill="#FFF" opacity="0.8">网页Banner 1920×600</text>`;
  ryCur += 75;

  // 响应式断点
  svg += `<text x="${rightX}" y="${ryCur}" font-size="10" font-weight="600" fill="${pri.hex}">响应式断点</text>`;
  ryCur += 16;
  const breakpoints = [
    ["移动端", "< 768px"],
    ["平板", "768 - 1024px"],
    ["桌面", "> 1024px"],
  ];
  breakpoints.forEach(([device, size], i) => {
    svg += `<rect x="${rightX}" y="${ryCur + i * 20}" width="${halfW}" height="18" fill="${i % 2 === 0 ? "#FAFAFA" : "#FFF"}"/>`;
    svg += `<text x="${rightX + 8}" y="${ryCur + i * 20 + 13}" font-size="9" fill="#555">${esc(device)}</text>`;
    svg += `<text x="${rightX + halfW - 8}" y="${ryCur + i * 20 + 13}" text-anchor="end" font-size="9" fill="#888" font-family="monospace">${esc(size)}</text>`;
  });
  ryCur += 70;

  // 小程序界面
  svg += `<text x="${rightX}" y="${ryCur}" font-size="10" font-weight="600" fill="${pri.hex}">小程序界面规范</text>`;
  ryCur += 16;
  svg += `<rect x="${rightX}" y="${ryCur}" width="60" height="100" rx="8" fill="#FFF" stroke="#E0E0E0" stroke-width="0.5"/>`;
  svg += `<rect x="${rightX}" y="${ryCur}" width="60" height="20" rx="8" fill="${pri.hex}"/>`;
  svg += `<text x="${rightX + 30}" y="${ryCur + 13}" text-anchor="middle" font-size="6" fill="#FFF">导航栏</text>`;
  svg += `<rect x="${rightX + 4}" y="${ryCur + 26}" width="52" height="16" rx="2" fill="#F5F5F5"/>`;
  svg += `<text x="${rightX + 30}" y="${ryCur + 36}" text-anchor="middle" font-size="5" fill="#999">Banner</text>`;
  svg += `<rect x="${rightX + 4}" y="${ryCur + 46}" width="24" height="24" rx="2" fill="${sec.hex}" opacity="0.2"/>`;
  svg += `<rect x="${rightX + 32}" y="${ryCur + 46}" width="24" height="24" rx="2" fill="${acc.hex}" opacity="0.2"/>`;
  svg += `<rect x="${rightX}" y="${ryCur + 76}" width="60" height="24" rx="0" fill="#FFF" stroke="#EEE" stroke-width="0.5"/>`;
  svg += `<text x="${rightX + 30}" y="${ryCur + 90}" text-anchor="middle" font-size="5" fill="#BBB">TabBar</text>`;

  svg += `<text x="${rightX + 70}" y="${ryCur + 14}" font-size="8" fill="#666">导航栏品牌色</text>`;
  svg += `<text x="${rightX + 70}" y="${ryCur + 28}" font-size="8" fill="#666">按钮品牌主色</text>`;
  svg += `<text x="${rightX + 70}" y="${ryCur + 42}" font-size="8" fill="#666">TabBar品牌色图标</text>`;
  svg += `<text x="${rightX + 70}" y="${ryCur + 56}" font-size="8" fill="#666">字号≥14px可读性</text>`;

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

// ===== 13. 总结 =====
function renderSummary(ctx: RenderContext): string {
  const { companyName, brandVision, coreValues, primaryColor: pri, accentColor: acc, secondaryColor: sec } = ctx;
  let svg = "";

  svg += pageBackground();
  svg += topBar(pri.hex);
  svg += pageTitle("总结", "SUMMARY", pri.hex, acc.hex);
  svg += chapterNumber(11, pri.hex);

  const panelX = M.left;
  const panelY = M.top + 66;
  const panelW = M.content.w;
  const panelH = PH - panelY - M.bottom - 10;
  svg += contentPanel(panelX, panelY, panelW, panelH);

  const contentX = panelX + 28;
  const contentW = panelW - 56;

  svg += `<text x="${PW / 2}" y="${panelY + 44}" text-anchor="middle" font-size="14" font-weight="500" fill="#555" font-style="italic">"${esc(brandVision || '构建统一的品牌视觉资产')}"</text>`;
  svg += `<line x1="${PW / 2 - 50}" y1="${panelY + 58}" x2="${PW / 2 + 50}" y2="${panelY + 58}" stroke="${pri.hex}" stroke-width="1.5" opacity="0.3"/>`;

  const principles = [
    { label: "一致性", desc: "所有媒介输出必须严格遵守本手册规范，确保品牌在任何触点下都能被精准识别", color: pri.hex },
    { label: "专业性", desc: "通过标准化的视觉语言建立客户信任，展现品牌作为行业专家的专业形象", color: sec.hex },
    { label: "持续性", desc: "VI系统是品牌长期发展的核心无形资产，是品牌价值持续积累的视觉载体", color: acc.hex },
  ];

  principles.forEach((p, i) => {
    const yBase = panelY + 86 + i * 100;
    svg += `<circle cx="${contentX + 16}" cy="${yBase + 14}" r="14" fill="${p.color}" opacity="0.15"/>`;
    svg += `<text x="${contentX + 16}" y="${yBase + 19}" text-anchor="middle" font-size="11" font-weight="700" fill="${p.color}">${i + 1}</text>`;
    svg += `<text x="${contentX + 40}" y="${yBase + 18}" font-size="14" font-weight="700" fill="${p.color}">${esc(p.label)}</text>`;
    svg += renderTextBlock(contentX + 40, yBase + 34, contentW - 40, p.desc, 10, 400, "#666", 1, 30, 1.6);
  });

  if (coreValues) {
    const values = coreValues.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    svg += `<text x="${contentX}" y="${panelY + 400}" font-size="10" font-weight="600" fill="#888">核心价值：${esc(values.join(" · "))}</text>`;
  }

  svg += pageFooter(companyName, ctx.pageIndex + 1, ctx.totalPages);
  return svg;
}

// ===== 14. 封底 =====
function renderClosing(ctx: RenderContext): string {
  const { companyName, primaryColor: pri, accentColor: acc, mascotDataUri } = ctx;
  let svg = "";

  svg += `<rect width="${PW}" height="${PH}" fill="#FFFFFF"/>`;

  // V4: 加粗色条（与封面反色，30px）
  svg += `<rect x="0" y="0" width="${PW}" height="30" fill="${acc.hex}"/>`;
  svg += `<rect x="0" y="${PH - 30}" width="${PW}" height="30" fill="${pri.hex}"/>`;

  // 左侧竖线装饰
  svg += `<rect x="${M.left}" y="340" width="3" height="160" fill="${acc.hex}" opacity="0.3" rx="1.5"/>`;

  // IP公仔居中（封底彩蛋）
  if (mascotDataUri) {
    const mSize = 180;
    svg += `<image x="${(PW - mSize) / 2}" y="${PH / 2 - 200}" width="${mSize}" height="${mSize}" href="${mascotDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  const textY = mascotDataUri ? PH / 2 + 20 : PH / 2 - 30;
  svg += `<text x="${PW / 2}" y="${textY}" text-anchor="middle" font-size="28" font-weight="700" fill="${pri.hex}">感谢观看</text>`;
  svg += `<text x="${PW / 2}" y="${textY + 30}" text-anchor="middle" font-size="12" fill="#888">${esc(companyName)} · 品牌视觉识别系统 (VI) 规范手册</text>`;
  svg += `<text x="${PW / 2}" y="${PH - 56}" text-anchor="middle" font-size="10" fill="#BBBBBB">如有疑问，请咨询品牌管理部</text>`;

  return svg;
}

// ========== 主入口（V4签名） ==========

export function renderProfessionalPage(
  pageId: string,
  clientInfo: any,
  brandColors: any,
  logoDataUri: string | null,
  mascotDataUri: string | null,
  pageIndex: number,
  totalPages: number,
  designDecision?: any,
  realPhotoBase64?: string | null,
): string {
  const ctx: RenderContext = {
    companyName: clientInfo?.companyName || "品牌名称",
    brandVision: clientInfo?.brandVision || "",
    coreValues: clientInfo?.coreValues || "",
    targetMarket: clientInfo?.targetMarket || "",
    brandPositioning: clientInfo?.brandPositioning || "",
    brandArchetype: clientInfo?.brandArchetype || "",
    brandPersona: clientInfo?.brandPersona || "",
    logoPhilosophy: clientInfo?.logoPhilosophy || "",
    mascotPhilosophy: clientInfo?.mascotPhilosophy || "",
    industry: clientInfo?.industry || "",
    primaryColor: brandColors?.primary || { hex: "#1A73E8" },
    secondaryColor: brandColors?.secondary || { hex: "#34A853" },
    accentColor: brandColors?.accent || { hex: "#FBBC04" },
    logoDataUri,
    mascotDataUri,
    pageIndex,
    totalPages,
    designDecision: designDecision || {
      colorScheme: {
        primary:   { hex: brandColors?.primary?.hex || "#1A73E8", oklch: "", name: "主色", nameEn: "Primary", meaning: "" },
        secondary: { hex: brandColors?.secondary?.hex || "#34A853", oklch: "", name: "辅色", nameEn: "Secondary", meaning: "" },
        accent:    { hex: brandColors?.accent?.hex || "#FBBC04", oklch: "", name: "强调色", nameEn: "Accent", meaning: "" },
        reasoning: "",
      },
      pageLayouts: [],
      photoPrompts: [],
      typography: { heading: { family: "Noto Sans SC", weights: [700, 800] }, body: { family: "Noto Sans SC", weights: [400, 500] }, modularScale: 1.25 },
      logoIntegrationStrategy: "wanxiang-ref",
    },
    realPhotoBase64: realPhotoBase64 || null,
  };

  const isCoverOrClosing = pageId === "cover" || pageId === "closing";
  const pageNum = isCoverOrClosing ? null : pageIndex + 1;
  const origPageIndex = ctx.pageIndex;
  ctx.pageIndex = pageNum === null ? -1 : pageNum - 1;

  let pageContent = "";

  const svg = `<svg width="${PW}" height="${PH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
    `<defs><filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.1"/></filter></defs>`;

  switch (pageId) {
    case "cover": pageContent = renderCover(ctx); break;
    case "toc": pageContent = renderToc(ctx); break;
    case "brand-philosophy": pageContent = renderBrandPhilosophy(ctx); break;
    case "logo-interpretation": pageContent = renderLogoInterpretation(ctx); break;
    case "brand-colors": pageContent = renderBrandColors(ctx); break;
    case "typography": pageContent = renderTypography(ctx); break;
    case "basic-spec": pageContent = renderBasicSpec(ctx); break;
    case "mascot-spec": pageContent = renderMascotSpec(ctx); break;
    case "stationery": pageContent = renderStationery(ctx); break;
    case "packaging": pageContent = renderPackaging(ctx); break;
    case "marketing": pageContent = renderMarketing(ctx); break;
    case "digital": pageContent = renderDigital(ctx); break;
    case "summary": pageContent = renderSummary(ctx); break;
    case "closing": pageContent = renderClosing(ctx); break;
    default:
      pageContent = pageBackground();
      pageContent += topBar(ctx.primaryColor.hex);
      pageContent += pageTitle(pageId, "", ctx.primaryColor.hex, ctx.accentColor.hex);
      pageContent += pageFooter(ctx.companyName, pageNum, totalPages);
  }

  ctx.pageIndex = origPageIndex;
  return svg + pageContent + `</svg>`;
}

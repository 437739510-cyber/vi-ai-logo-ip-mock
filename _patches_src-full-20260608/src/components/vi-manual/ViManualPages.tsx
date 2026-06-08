"use client";

/** ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  VI Manual Page Components — Magazine/Presentation Style
 *
 *  Design principles:
 *  1. One clear focal point per page (large visual + dramatic title)
 *  2. Strong typographic contrast (huge titles vs tiny body)
 *  3. Asymmetrical layouts (not centered, not symmetrical)
 *  4. Full-bleed color blocks, minimal rounded corners (less "web")
 *  5. White space is a design element
 *  6. Background images used as full-bleed anchors with overlays
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface PageProps {
  brandColors: BrandColors;
  companyName: string;
  projectId: string;
  logoUrl?: string | null;
  mascotUrl?: string | null;
  aiContent?: any;
  backgroundUrl?: string | null;
  pageNumber?: number;
  totalPages?: number;
  productImageUrl?: string;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

function adjustColor(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

/** Paper texture overlay */
function PaperOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E")`,
        opacity: 0.25,
        mixBlendMode: "multiply" as any,
      }}
    />
  );
}

/** Full-bleed background image with softening overlay for readability */
function BgImage({ url, color }: { url?: string | null; color: string }) {
  if (!url) return null;
  return (
    <>
      <div className="absolute inset-0"><img src={url} alt="" className="w-full h-full object-cover" /></div>
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}50, rgba(255,255,255,0.4) 50%, ${color}30)`, mixBlendMode: "overlay" as any }} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.97) 60%, transparent 100%)` }} />
    </>
  );
}

/** Section label — thin, small, uppercase, placed above large title */
function SectionMarker({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="w-6 h-[1.5px]" style={{ background: color }} />
      <span className="text-[7px] font-semibold tracking-[0.3em] uppercase" style={{ color }}>{label}</span>
    </div>
  );
}

/** Decorative corner bracket — gives a framed/magazine feel */
function CornerBracket({ color, className }: { color: string; className?: string }) {
  return <div className={`absolute w-6 h-6 ${className || ''}`} style={{ borderColor: color, borderStyle: 'solid', borderWidth: 0 }} />;
}

/** Page wrapper: full-bleed with optional background image */
function PageShell({ children, color, backgroundUrl }: { children: React.ReactNode; color: string; backgroundUrl?: string | null }) {
  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${color}04, #ffffff 50%)` }}>
      <BgImage url={backgroundUrl} color={color} />
      <PaperOverlay />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}

/** ─── SMALL NUMBER BADGE ─── */
function PageNumberBadge({ num, total, color }: { num: number; total: number; color: string }) {
  return (
    <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
      <span className="text-[7px] font-mono" style={{ color: `${color}60` }}>{String(num).padStart(2, '0')}</span>
      <span className="text-[5px] font-mono" style={{ color: `${color}30` }}>/ {String(total).padStart(2, '0')}</span>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════
//  1. COVER — dramatic, full-bleed, magazine-style
// ════════════════════════════════════════════════════════════════════
export function CoverPage({ brandColors: c, companyName, projectId, logoUrl, mascotUrl, backgroundUrl }: PageProps) {
  const name = companyName || "品牌名称";
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      {/* Large decorative circle — top right */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.05]" style={{ background: `radial-gradient(circle, ${c.primary}, transparent 70%)` }} />

      {/* Left accent stripe — full height */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: `linear-gradient(180deg, ${c.primary}, ${c.secondary})` }} />

      <div className="flex flex-col h-full px-8 py-8">
        {/* Top section: decorative bar */}
        <div className="flex gap-1.5 w-24">
          <div className="h-[2px] flex-1" style={{ background: c.primary }} />
          <div className="h-[2px] flex-1" style={{ background: c.secondary }} />
          <div className="h-[2px] flex-1" style={{ background: c.accent }} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom section: main content anchored at bottom third */}
        <div className="max-w-xs">
          {/* Logo mark */}
          <div className="w-16 h-16 mb-4 flex items-center justify-center overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${c.primary}08, ${c.primary}03)`, border: `1px solid ${c.primary}15` }}>
            {logoUrl ? <img src={logoUrl} alt="" className="max-w-[60%] max-h-[60%] object-contain" /> :
              <span className="text-[9px]" style={{ color: `${c.primary}50` }}>LOGO</span>}
          </div>

          {/* Brand name — large, bold, serif */}
          <h1 className="text-2xl font-bold mb-1 leading-tight" style={{ color: c.primary, fontFamily: "'Noto Serif SC','SimSun','STSong',serif", letterSpacing: "0.05em" }}>
            {name}
          </h1>

          {/* Subtitle */}
          <p className="text-[10px] tracking-[0.3em] text-neutral-500 mb-3">品牌视觉识别手册</p>
          <p className="text-[7px] tracking-[0.25em] text-neutral-400 mb-4">VISUAL IDENTITY GUIDELINES</p>

          {/* Divider */}
          <div className="w-10 h-[1px] mb-3" style={{ background: c.primary }} />

          {/* Meta */}
          <div className="text-[7px] text-neutral-400 space-y-0.5">
            <p>v1.0 / 2026</p>
            <p className="font-mono">{projectId}</p>
          </div>
        </div>

        {/* Mascot — floating bottom right */}
        {mascotUrl && (
          <div className="absolute bottom-6 right-6 w-14 h-14 rounded-full overflow-hidden shadow-md border-2" style={{ borderColor: `${c.secondary}30` }}>
            <img src={mascotUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <PageNumberBadge num={1} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  2. BRAND PHILOSOPHY — magazine spread, asymmetrical layout
// ════════════════════════════════════════════════════════════════════
export function BrandPhilosophyPage({ brandColors: c, companyName, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="BRAND PHILOSOPHY" />

        {/* Hero quote — large, prominent */}
        <p className="text-xl font-bold leading-tight mt-1 mb-3" style={{ color: c.primary, fontFamily: "'Noto Serif SC','STSong',serif" }}>
          {aiContent?.tagline || "自然能量，纯粹生活"}
        </p>

        <div className="w-12 h-[1.5px] mb-4" style={{ background: `linear-gradient(90deg, ${c.primary}, ${c.secondary})` }} />

        {/* Two-column layout — magazine-style */}
        <div className="grid grid-cols-2 gap-6 flex-1">
          <div className="space-y-3">
            <p className="text-[8px] font-semibold tracking-[0.2em] text-neutral-600 uppercase">品牌愿景</p>
            <p className="text-[9px] text-neutral-600 leading-relaxed">
              打造行业领先的品牌视觉体系，将最专业的品牌形象带给每一位客户。
            </p>
            <p className="text-[8px] font-semibold tracking-[0.2em] text-neutral-600 uppercase mt-4">核心价值</p>
            <p className="text-[9px] text-neutral-600 leading-relaxed">
              专业定制、品质保证、创新驱动。通过精细化的品牌管理，满足不同客户的个性化需求。
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-[8px] font-semibold tracking-[0.2em] text-neutral-600 uppercase">目标市场</p>
            <p className="text-[9px] text-neutral-600 leading-relaxed">
              精准覆盖高端企业与品牌客户，建立专业、高端、充满活力的品牌联想。
            </p>
            <p className="text-[8px] font-semibold tracking-[0.2em] text-neutral-600 uppercase mt-4">品牌承诺</p>
            <p className="text-[9px] text-neutral-600 leading-relaxed">
              每一个触点都传递品牌温度，每一次沟通都强化品牌价值。
            </p>
          </div>
        </div>

        <PageNumberBadge num={2} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  3. LOGO 诠释 — visual symbol breakdown
// ════════════════════════════════════════════════════════════════════
export function LogoInterpretationPage({ brandColors: c, companyName, logoUrl, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="LOGO INTERPRETATION" />

        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary }}>标识诠释</h2>
        <p className="text-[8px] text-neutral-500 mb-4">视觉符号的深度融合</p>

        <div className="grid grid-cols-2 gap-4 flex-1">
          {/* Left: Large logo display */}
          <div className="flex items-center justify-center bg-white/70 rounded-sm p-4" style={{ border: `1px solid ${c.primary}10` }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="max-w-[80%] max-h-[80%] object-contain" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: `${c.primary}30` }}>LOGO</span>
            )}
          </div>

          {/* Right: Design elements breakdown */}
          <div className="space-y-2.5">
            {[
              { label: "品牌符号", desc: "直观呼应品牌名称与行业属性" },
              { label: "视觉记忆", desc: "简洁有力的图形语言，易于识别" },
              { label: "行业背书", desc: "传递专业、可信赖的品牌形象" },
              { label: "匠心笔触", desc: "细节体现品牌定制感与独特性" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 shrink-0 rounded-sm" style={{ background: c.secondary }} />
                <div>
                  <p className="text-[9px] font-semibold text-neutral-700">{item.label}</p>
                  <p className="text-[8px] text-neutral-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <PageNumberBadge num={3} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  4. BRAND COLORS — swatch showcase with printing specs
// ════════════════════════════════════════════════════════════════════
export function BrandColorsPage({ brandColors: c, aiContent, backgroundUrl }: PageProps) {
  const colors = [
    { name: "品牌主色", hex: c.primary, usage: "标题/按钮/链接/重要元素" },
    { name: "辅助色", hex: c.secondary, usage: "强调内容/装饰/辅助背景" },
    { name: "强调色", hex: c.accent, usage: "特殊标记/促销/CTA" },
  ];
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="BRAND COLOR SYSTEM" />
        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary }}>标准色彩规范</h2>
        <p className="text-[8px] text-neutral-500 mb-4">传递品牌情感 · 建立视觉识别</p>

        {/* Full-bleed color swatches — no rounded corners, magazine feel */}
        <div className="grid grid-cols-3 gap-0 flex-1" style={{ border: `1px solid ${c.primary}10` }}>
          {colors.map((clr, i) => (
            <div key={i} className="flex flex-col relative">
              <div className="flex-1 relative flex items-center justify-center min-h-[100px]"
                style={{ background: `linear-gradient(145deg, ${clr.hex}, ${adjustColor(clr.hex, -20)})` }}>
                <div className="absolute -right-4 -top-4 w-12 h-12 rounded-full bg-white/5" />
                <span className="text-[9px] font-bold tracking-wider drop-shadow-sm"
                  style={{ color: isLight(clr.hex) ? "#333" : "rgba(255,255,255,0.9)" }}>
                  {clr.name}
                </span>
              </div>
              <div className="p-3 bg-white" style={{ borderTop: `1px solid ${c.primary}08` }}>
                <p className="text-[10px] font-bold text-neutral-800 mb-0.5">{clr.name}</p>
                <p className="text-[10px] font-mono font-bold" style={{ color: clr.hex }}>{clr.hex.toUpperCase()}</p>
                <p className="text-[7px] font-mono text-neutral-400">RGB({hexToRgb(clr.hex)})</p>
                <p className="text-[6px] text-neutral-400 mt-0.5">CMYK: 待校准</p>
                <p className="text-[7px] text-neutral-500 mt-1 leading-relaxed">{clr.usage}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Psychology note — bottom strip */}
        {aiContent?.colorPsychology && (
          <div className="mt-3 p-2.5" style={{ background: `${c.primary}04` }}>
            <p className="text-[7px] text-neutral-600 leading-relaxed">{aiContent.colorPsychology}</p>
          </div>
        )}

        <PageNumberBadge num={4} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  5. TYPOGRAPHY — type specimen / magazine spread
// ════════════════════════════════════════════════════════════════════
export function TypographyPage({ brandColors: c, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="TYPOGRAPHY" />
        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary }}>字体系统</h2>
        <p className="text-[8px] text-neutral-500 mb-4">兼顾辨识度与专业感</p>

        <div className="grid grid-cols-2 gap-4 flex-1">
          {/* Chinese font specimen */}
          <div className="p-4 bg-white" style={{ border: `1px solid ${c.primary}10` }}>
            <p className="text-[7px] font-semibold tracking-[0.25em] text-neutral-500 uppercase mb-3">中文</p>
            <p className="text-2xl font-bold mb-1 leading-tight" style={{ color: c.primary, fontFamily: "'Noto Serif SC','STSong',serif" }}>
              品牌字体
            </p>
            <p className="text-xs text-neutral-600 mb-2">品牌字体正文设计范例展示</p>
            <div className="w-full h-[1px] my-2" style={{ background: `${c.primary}10` }} />
            <p className="text-[9px] font-medium text-neutral-500">{aiContent?.chineseFont || "思源黑体"}</p>
            <p className="text-[7px] text-neutral-400">{aiContent?.chineseDescription || "现代简洁，辨识度高"}</p>
          </div>

          {/* English font specimen */}
          <div className="p-4 bg-white" style={{ border: `1px solid ${c.primary}10` }}>
            <p className="text-[7px] font-semibold tracking-[0.25em] text-neutral-500 uppercase mb-3">English</p>
            <p className="text-2xl font-bold italic mb-1 leading-tight" style={{ color: c.primary }}>
              Aa Bb
            </p>
            <p className="text-xs text-neutral-600 mb-2">The quick brown fox jumps over the lazy dog</p>
            <div className="w-full h-[1px] my-2" style={{ background: `${c.primary}10` }} />
            <p className="text-[9px] font-medium text-neutral-500">{aiContent?.englishFont || "Inter"}</p>
            <p className="text-[7px] text-neutral-400">{aiContent?.englishDescription || "Clean, modern, highly legible"}</p>
          </div>
        </div>

        <PageNumberBadge num={5} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  6. LOGO USAGE RULES — clear space, min sizes, prohibited
// ════════════════════════════════════════════════════════════════════
export function LogoUsagePage({ brandColors: c, companyName, logoUrl, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="LOGO GUIDELINES" />
        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary }}>基础规范</h2>
        <p className="text-[8px] text-neutral-500 mb-4">保护空间与最小尺寸</p>

        <div className="grid grid-cols-3 gap-4 flex-1">
          {/* Left: Clear space — 2 cols */}
          <div className="col-span-2 flex items-center justify-center bg-white" style={{ border: `1px solid ${c.primary}10` }}>
            <div className="text-center p-4">
              <p className="text-[7px] font-semibold tracking-[0.25em] text-neutral-500 uppercase mb-3">保护空间</p>
              <div className="border-2 border-dashed p-4 inline-block" style={{ borderColor: `${c.primary}30` }}>
                <div className="w-36 h-14 flex items-center justify-center" style={{ background: `${c.primary}04` }}>
                  {logoUrl ? <img src={logoUrl} alt="" className="max-h-7 object-contain" /> :
                    <span className="text-[9px] text-neutral-500">{companyName || "LOGO"}</span>}
                </div>
              </div>
              <p className="text-[7px] text-neutral-500 mt-2">{aiContent?.clearSpaceRule || "标识四周需留出至少 0.5X 的空白区域"}</p>
            </div>
          </div>

          {/* Right: Min sizes */}
          <div className="space-y-2">
            <p className="text-[7px] font-semibold tracking-[0.2em] text-neutral-500 uppercase">最小尺寸</p>
            {[
              { label: "印刷应用", size: aiContent?.minimumPrintSize || "15mm" },
              { label: "数码应用", size: aiContent?.minimumScreenSize || "60px" },
              { label: "小型物品", size: aiContent?.smallObjectSize || "10mm" },
            ].map((item, i) => (
              <div key={i} className="p-2.5 bg-white" style={{ border: `1px solid ${c.primary}08` }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-4" style={{ background: c.primary }} />
                  <span className="text-[8px] text-neutral-600">{item.label}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: c.primary }}>{item.size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Prohibited — bottom strip */}
        <div className="mt-3">
          <p className="text-[7px] font-semibold tracking-[0.2em] text-neutral-500 uppercase mb-1.5">严禁行为</p>
          <div className="grid grid-cols-3 gap-2">
            {(aiContent?.incorrectExamples || [
              { title: "变形拉伸", description: "改变原始比例" },
              { title: "改变颜色", description: "替换品牌色" },
              { title: "添加效果", description: "阴影/渐变" },
            ]).map((err: any, i: number) => (
              <div key={i} className="p-2 flex items-start gap-1.5" style={{ background: "#FEF2F2", border: `1px solid #FECACA` }}>
                <span className="text-red-400 text-[9px] font-bold">✕</span>
                <div>
                  <p className="text-[8px] font-semibold text-red-700">{err.title}</p>
                  <p className="text-[6px] text-red-500">{err.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <PageNumberBadge num={6} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  7. LOGO VARIANTS
// ════════════════════════════════════════════════════════════════════
export function LogoVariantsPage({ brandColors: c, companyName, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="LOGO VARIANTS" />
        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary }}>Logo 变体</h2>
        <p className="text-[8px] text-neutral-500 mb-4">适应不同应用场景</p>

        <div className="grid grid-cols-2 gap-3 flex-1">
          {[
            { label: "横版组合", desc: aiContent?.horizontalUsage || "标准横向排列", dark: false },
            { label: "竖版组合", desc: aiContent?.verticalUsage || "纵向排列，适合窄空间", dark: false },
            { label: "图标版", desc: aiContent?.iconUsage || "简化图标，应用于小尺寸", dark: false },
            { label: "反白版", desc: aiContent?.reverseUsage || "深色背景使用时反转", dark: true },
          ].map((v, i) => (
            <div key={i} className="flex items-center justify-center p-4 min-h-[70px]"
              style={{
                background: v.dark ? `linear-gradient(145deg, ${adjustColor(c.primary, -20)}, ${adjustColor(c.primary, -40)})` : 'white',
                border: v.dark ? 'none' : `1px solid ${c.primary}10`,
              }}>
              <div className="text-center">
                <p className={`text-sm font-bold ${v.dark ? 'text-white' : ''}`}
                  style={v.dark ? {} : { color: c.primary }}>
                  {companyName || "品牌名称"}
                </p>
                <p className={`text-[7px] mt-0.5 ${v.dark ? 'text-white/50' : 'text-neutral-400'}`}>{v.desc}</p>
                <p className={`text-[6px] mt-1 ${v.dark ? 'text-white/25' : 'text-neutral-300'}`}>{v.label}</p>
              </div>
            </div>
          ))}
        </div>

        <PageNumberBadge num={7} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  8. AUXILIARY GRAPHICS
// ════════════════════════════════════════════════════════════════════
export function AuxiliaryGraphicsPage({ brandColors: c, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="AUXILIARY GRAPHICS" />
        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary }}>辅助图形</h2>
        <p className="text-[8px] text-neutral-500 mb-4">丰富品牌视觉层次</p>

        {/* Full-width pattern bar */}
        <div className="flex-1 flex flex-col" style={{ border: `1px solid ${c.primary}10` }}>
          <div className="flex-1 relative" style={{ background: `linear-gradient(135deg, ${c.primary}06, ${c.secondary}04, ${c.primary}08)` }}>
            <svg className="w-full h-full opacity-25">
              <defs>
                <pattern id="aux-pattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                  <circle cx="8" cy="8" r="1.2" fill={c.primary} />
                  <circle cx="0" cy="0" r="0.8" fill={c.secondary} />
                  <circle cx="16" cy="16" r="0.8" fill={c.accent} />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#aux-pattern)" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[8px] text-neutral-500 bg-white/80 px-2 py-0.5">品牌底纹</span>
            </div>
          </div>

          {/* Pattern descriptions */}
          <div className="grid grid-cols-3 gap-0">
            {[
              { title: "装饰圆点", desc: "渐变排布，营造层次感" },
              { title: "色块组合", desc: "品牌色交替，形成节奏" },
              { title: "几何线条", desc: "简约现代，辅助排版" },
            ].map((item, i) => (
              <div key={i} className="p-2.5 text-center bg-white" style={{ borderTop: `1px solid ${c.primary}08` }}>
                <p className="text-[8px] font-semibold text-neutral-700">{item.title}</p>
                <p className="text-[6px] text-neutral-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <PageNumberBadge num={8} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  9. BUSINESS STATIONERY — business card + letterhead
// ════════════════════════════════════════════════════════════════════
export function BusinessCardPage({ brandColors: c, companyName, logoUrl, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="BUSINESS STATIONERY" />
        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary }}>办公应用系统</h2>
        <p className="text-[8px] text-neutral-500 mb-4">商务专业形象</p>

        <div className="grid grid-cols-2 gap-4 flex-1">
          {/* Business card — 3D perspective */}
          <div className="flex flex-col">
            <p className="text-[7px] font-semibold tracking-[0.2em] text-neutral-500 uppercase mb-2">名片</p>
            <div className="flex-1 flex items-center justify-center bg-white"
              style={{ border: `1px solid ${c.primary}10`, transform: 'perspective(800px) rotateY(-2deg)' }}>
              <div className="p-3 w-full">
                <div className="flex items-center gap-1.5 mb-1">
                  {logoUrl && <img src={logoUrl} alt="" className="h-4 object-contain" />}
                  <span className="text-[9px] font-bold" style={{ color: c.primary }}>{companyName}</span>
                </div>
                <div className="space-y-0.5 text-[7px] text-neutral-500">
                  <p>{aiContent?.contactPerson || "联系人"} {aiContent?.title || ""}</p>
                  <p>T: {aiContent?.phone || "+86-000-0000"}</p>
                  <p>E: {aiContent?.email || "contact@brand.com"}</p>
                </div>
              </div>
            </div>
            <p className="text-[7px] text-neutral-400 mt-1">{aiContent?.material || "300g 特种纸"} · {aiContent?.printing || "双面彩色"}</p>
          </div>

          {/* Letterhead */}
          <div className="flex flex-col">
            <p className="text-[7px] font-semibold tracking-[0.2em] text-neutral-500 uppercase mb-2">信纸</p>
            <div className="flex-1 bg-white p-3" style={{ border: `1px solid ${c.primary}10` }}>
              <div style={{ borderBottom: `1.5px solid ${c.primary}` }}>
                <p className="text-[9px] font-bold" style={{ color: c.primary }}>{companyName}</p>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-[8px] font-semibold text-neutral-700">{aiContent?.documentTitle || "品牌视觉识别系统规范"}</p>
                <p className="text-[7px] text-neutral-500 leading-relaxed">{aiContent?.bodyParagraphs?.[0] || "为推动品牌形象统一规范，本公司已制定完整的视觉识别系统手册。"}</p>
              </div>
            </div>
            <p className="text-[7px] text-neutral-400 mt-1">A4 · {aiContent?.paperWeight || "100g 高级纸"}</p>
          </div>
        </div>

        <PageNumberBadge num={9} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  10. PRODUCT & MARKETING — packaging, signage, ppt
// ════════════════════════════════════════════════════════════════════
export function PptTemplatePage({ brandColors: c, companyName, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full px-8 py-8">
        <SectionMarker color={c.primary} label="APPLICATION SYSTEM" />
        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary }}>应用展示系统</h2>
        <p className="text-[8px] text-neutral-500 mb-4">场景化品牌触达</p>

        <div className="grid grid-cols-2 gap-4 flex-1">
          {/* PPT slide */}
          <div className="flex flex-col">
            <p className="text-[7px] font-semibold tracking-[0.2em] text-neutral-500 uppercase mb-2">演示模板</p>
            <div className="flex-1 flex items-center justify-center p-3"
              style={{ background: `linear-gradient(145deg, ${c.primary}, ${adjustColor(c.primary, -30)})` }}>
              <div className="text-center">
                <p className="text-sm font-bold text-white drop-shadow-sm">{companyName}</p>
                <p className="text-[8px] text-white/60 mt-0.5">{aiContent?.titleSlideSubtitle || "品牌视觉识别手册"}</p>
              </div>
            </div>
          </div>

          {/* Signage */}
          <div className="flex flex-col">
            <p className="text-[7px] font-semibold tracking-[0.2em] text-neutral-500 uppercase mb-2">招牌系统</p>
            <div className="flex-1 flex items-center justify-center p-3"
              style={{ background: `linear-gradient(145deg, ${adjustColor(c.primary, -10)}, ${adjustColor(c.primary, -30)})` }}>
              <div className="text-center">
                <p className="text-sm font-bold text-white drop-shadow-sm">{companyName}</p>
                <p className="text-[7px] text-white/50 mt-0.5">门头招牌 · 品牌标识</p>
              </div>
            </div>
            <p className="text-[7px] text-neutral-400 mt-1">{aiContent?.mainSignSpec || "亚克力发光字"}</p>
          </div>
        </div>

        <PageNumberBadge num={10} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}

// ════════════════════════════════════════════════════════════════════
//  11. CLOSING
// ════════════════════════════════════════════════════════════════════
export function ClosingPage({ brandColors: c, companyName, projectId, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        {/* Decorative circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full opacity-[0.03]" style={{ background: `radial-gradient(circle, ${c.primary}, transparent)` }} />

        <div className="relative">
          <div className="relative w-12 h-12 mx-auto mb-4">
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className="absolute inset-0 rounded-full" style={{ background: `${c.primary}${(6 + r * 4).toString(16).padStart(2, '0')}`, margin: r * 2 }} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[5px] font-bold text-center leading-tight px-1" style={{ color: c.primary }}>{companyName}</span>
            </div>
          </div>

          <p className="text-sm font-bold mb-0.5" style={{ color: c.primary }}>{companyName}</p>
          <p className="text-[8px] text-neutral-500 mb-3 tracking-wider">品牌视觉识别手册</p>
          <div className="w-8 h-px mx-auto mb-3" style={{ background: `linear-gradient(90deg, transparent, ${c.secondary}, transparent)` }} />

          <div className="text-[7px] text-neutral-400 space-y-0.5">
            <p>{aiContent?.website || "www.brand.com"}  |  {aiContent?.email || "contact@brand.com"}</p>
            <p className="text-[6px] text-neutral-300 mt-1">{aiContent?.copyright || `© ${aiContent?.year || "2026"} All Rights Reserved`}</p>
            <p className="text-[6px] text-neutral-300 font-mono">{projectId}</p>
          </div>

          {aiContent?.closingMessage && (
            <p className="text-[7px] text-neutral-500 mt-3 italic leading-relaxed">"{aiContent.closingMessage}"</p>
          )}
        </div>

        <PageNumberBadge num={11} total={11} color={c.primary} />
      </div>
    </PageShell>
  );
}


// ════════════════════════════════════════════════════════════════════
//  REGISTRY — 11 pages in new magazine-style order
// ════════════════════════════════════════════════════════════════════

// 7. OFFICE STATIONERY — business card, envelope, letterhead in one page
export function StationeryPage({ brandColors: c, companyName, logoUrl, mascotUrl, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-[2px] flex-1" style={{ background: c.primary }} />
          <span className="text-[8px] tracking-[0.3em] font-medium" style={{ color: c.primary }}>OFFICE STATIONERY</span>
          <div className="h-[2px] flex-1" style={{ background: c.primary }} />
        </div>

        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary, fontFamily: "'Noto Serif SC','SimSun',serif", letterSpacing: "0.05em" }}>办公应用系统</h2>
        <p className="text-[8px] text-neutral-500 mb-4 tracking-wider">OFFICE APPLICATION SYSTEM</p>

        {/* Three items side by side */}
        <div className="flex-1 grid grid-cols-3 gap-3">
          {/* Business Card */}
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: `${c.primary}20` }}>
            <div className="aspect-[1.6] bg-white p-3 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: c.primary }} />
              {logoUrl && <img src={logoUrl} alt="" className="h-6 mb-1 object-contain" />}
              <p className="text-[6px] font-bold text-center" style={{ color: c.primary }}>{companyName}</p>
              <p className="text-[4px] text-neutral-400 mt-1">总经理 · 134****9752</p>
            </div>
            <div className="p-2 bg-neutral-50">
              <p className="text-[6px] font-bold text-neutral-700">名片设计规范</p>
              <p className="text-[5px] text-neutral-500 mt-0.5">采用 300g 特种纸，正面居中放置 Logo，背面使用辅助图形底纹</p>
            </div>
          </div>

          {/* Envelope */}
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: `${c.primary}20` }}>
            <div className="aspect-[1.6] bg-white p-3 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${c.primary}, ${c.secondary})` }} />
              {logoUrl && <img src={logoUrl} alt="" className="h-5 mb-1 object-contain" />}
              <p className="text-[5px] text-neutral-400 mt-2 text-center leading-tight">{companyName}<br/>地址·联系方式</p>
            </div>
            <div className="p-2 bg-neutral-50">
              <p className="text-[6px] font-bold text-neutral-700">信封规范</p>
              <p className="text-[5px] text-neutral-500 mt-0.5">页眉统一放置标准 Logo，页脚标注公司地址与联系方式</p>
            </div>
          </div>

          {/* Letterhead */}
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: `${c.primary}20` }}>
            <div className="aspect-[1.6] bg-white p-3 flex flex-col relative overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                {logoUrl && <img src={logoUrl} alt="" className="h-4 object-contain" />}
                <span className="text-[5px] font-bold" style={{ color: c.primary }}>{companyName}</span>
              </div>
              <div className="h-[1px] w-full mb-1" style={{ background: `${c.primary}30` }} />
              <p className="text-[4px] text-neutral-300 flex-1 leading-relaxed">致：尊敬的客户<br/><br/>感谢您对我们的支持...</p>
              <p className="text-[4px] text-neutral-300 mt-auto">公司地址 · 联系电话</p>
            </div>
            <div className="p-2 bg-neutral-50">
              <p className="text-[6px] font-bold text-neutral-700">信纸规范</p>
              <p className="text-[5px] text-neutral-500 mt-0.5">A4 100g 高级纯质纸，保持商务沟通的专业度与一致性</p>
            </div>
          </div>
        </div>

        <p className="text-[6px] text-neutral-400 text-center mt-3 tracking-wider">整体风格简洁、专业，通过高品质材质与规范化排版建立客户信任感</p>
      </div>
    </PageShell>
  );
}

// 8. PRODUCT PACKAGING — product packaging with brand logo and product imagery
export function PackagingPage({ brandColors: c, companyName, logoUrl, mascotUrl, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.secondary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-[2px] flex-1" style={{ background: c.secondary }} />
          <span className="text-[8px] tracking-[0.3em] font-medium" style={{ color: c.secondary }}>PRODUCT PACKAGING</span>
          <div className="h-[2px] flex-1" style={{ background: c.secondary }} />
        </div>

        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary, fontFamily: "'Noto Serif SC','SimSun',serif", letterSpacing: "0.05em" }}>产品包装系统</h2>
        <p className="text-[8px] text-neutral-500 mb-4 tracking-wider">PRODUCT PACKAGING SYSTEM</p>

        <div className="flex-1 grid grid-cols-2 gap-4">
          {/* Product display area */}
          <div className="rounded-xl overflow-hidden relative flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${c.primary}10, ${c.primary}05)` }}>
            <div className="text-center p-4">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-16 mx-auto mb-3 object-contain" />
              ) : null}
              <div className="w-24 h-24 mx-auto rounded-xl flex items-center justify-center border-2 border-dashed mb-2" style={{ borderColor: `${c.primary}30` }}>
                <span className="text-[8px]" style={{ color: `${c.primary}40` }}>产品图</span>
              </div>
              <p className="text-[7px] font-bold" style={{ color: c.primary }}>{companyName}</p>
              <p className="text-[5px] text-neutral-400 mt-0.5">产品包装展示</p>
            </div>
          </div>

          {/* Packaging specs */}
          <div className="flex flex-col justify-center space-y-3">
            <div className="p-2 rounded-lg" style={{ background: `${c.primary}08` }}>
              <p className="text-[7px] font-bold text-neutral-700">包装材质</p>
              <p className="text-[6px] text-neutral-500 mt-0.5">采用环保食品级材料，维持品牌自然健康形象</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: `${c.secondary}08` }}>
              <p className="text-[7px] font-bold text-neutral-700">色彩规范</p>
              <p className="text-[6px] text-neutral-500 mt-0.5">严格遵守品牌标准色，保证线上线下一致性</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: `${c.accent}15` }}>
              <p className="text-[7px] font-bold text-neutral-700">Logo 应用</p>
              <p className="text-[6px] text-neutral-500 mt-0.5">Logo 统一放置于包装正面上方，与产品图形成视觉对比</p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// 9. MARKETING DISPLAY — promotional/application scenarios with AI-generated posters
export function MarketingPage({ brandColors: c, companyName, logoUrl, mascotUrl, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-[2px] flex-1" style={{ background: c.accent }} />
          <span className="text-[8px] tracking-[0.3em] font-medium" style={{ color: c.accent }}>MARKETING DISPLAY</span>
          <div className="h-[2px] flex-1" style={{ background: c.accent }} />
        </div>

        <h2 className="text-lg font-bold mb-1" style={{ color: c.primary, fontFamily: "'Noto Serif SC','SimSun',serif", letterSpacing: "0.05em" }}>营销展示系统</h2>
        <p className="text-[8px] text-neutral-500 mb-4 tracking-wider">MARKETING DISPLAY SYSTEM</p>

        <div className="flex-1 grid grid-cols-2 gap-3">
          {/* Poster 1 */}
          <div className="rounded-xl overflow-hidden relative" style={{ background: `linear-gradient(180deg, ${c.primary}15, ${c.primary}05)` }}>
            <div className="p-4 flex flex-col items-center text-center">
              {logoUrl && <img src={logoUrl} alt="" className="h-10 mb-2 object-contain" />}
              <p className="text-[9px] font-bold" style={{ color: c.primary }}>新品上市</p>
              <p className="text-[6px] text-neutral-500 mt-1 leading-relaxed">{companyName}旗下产品<br/>自然健康的选择</p>
              <div className="mt-2 px-3 py-1 rounded-full text-[6px] text-white" style={{ background: c.primary }}>了解更多</div>
            </div>
          </div>

          {/* Poster 2 */}
          <div className="rounded-xl overflow-hidden relative" style={{ background: `linear-gradient(180deg, ${c.secondary}15, ${c.secondary}05)` }}>
            <div className="p-4 flex flex-col items-center text-center">
              {mascotUrl && <img src={mascotUrl} alt="" className="h-12 mb-2 object-contain" />}
              <p className="text-[9px] font-bold" style={{ color: c.secondary }}>品牌故事</p>
              <p className="text-[6px] text-neutral-500 mt-1 leading-relaxed">{companyName}的自然使命<br/>纯粹生活的取舍</p>
              <div className="mt-2 px-3 py-1 rounded-full text-[6px] text-white" style={{ background: c.secondary }}>探索更多</div>
            </div>
          </div>

          {/* Description */}
          <div className="col-span-2 p-3 rounded-lg" style={{ background: `${c.primary}05` }}>
            <p className="text-[7px] font-bold text-neutral-700 mb-1">场景化品牌触达</p>
            <p className="text-[6px] text-neutral-500 leading-relaxed">
              通过结合品牌 LOGO 与产品形象的海报设计，在多种营销场景中统一品牌视觉输出。
              各类广告海报、社交媒体图片、门店展示均可基于此规范进行设计延伸。
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// 10. SUMMARY — brand visual asset summary
export function SummaryPage({ brandColors: c, companyName, projectId, aiContent, backgroundUrl }: PageProps) {
  return (
    <PageShell color={c.primary} backgroundUrl={backgroundUrl}>
      <div className="flex flex-col h-full p-8">
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: `${c.primary}10`, border: `1px solid ${c.primary}20` }}>
            <svg className="w-8 h-8" style={{ color: c.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold mb-3" style={{ color: c.primary, fontFamily: "'Noto Serif SC','SimSun',serif", letterSpacing: "0.05em" }}>构建统一的品牌视觉资产</h2>

          <div className="space-y-3 text-left w-full">
            <div className="p-3 rounded-lg" style={{ background: `${c.primary}05` }}>
              <p className="text-[8px] font-bold text-neutral-700">一致性</p>
              <p className="text-[7px] text-neutral-500 mt-1 leading-relaxed">所有媒介输出必须严格遵守本手册规范，确保品牌在任何触点下都能被精准识别。</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: `${c.secondary}08` }}>
              <p className="text-[8px] font-bold text-neutral-700">专业性</p>
              <p className="text-[7px] text-neutral-500 mt-1 leading-relaxed">通过标准化的视觉语言建立客户信任，展现品牌作为行业专家的专业形象。</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: `${c.accent}12` }}>
              <p className="text-[8px] font-bold text-neutral-700">持续性</p>
              <p className="text-[7px] text-neutral-500 mt-1 leading-relaxed">VI 系统是品牌长期发展的核心无形资产，是品牌价值持续积累的视觉载体。</p>
            </div>
          </div>

          <p className="text-[7px] text-neutral-400 mt-4 italic">{companyName}：自然能量，纯粹生活</p>
        </div>
      </div>
    </PageShell>
  );
}

export const VI_PAGES = [
  { id: "cover",              label: "品牌视觉识别系统 (VI) 规范手册",  Component: CoverPage },
  { id: "brand-philosophy",   label: "品牌核心理念",    Component: BrandPhilosophyPage },
  { id: "logo-interpretation",label: "标识诠释",               Component: LogoInterpretationPage },
  { id: "brand-colors",       label: "标准色彩规范",   Component: BrandColorsPage },
  { id: "typography",         label: "字体系统",               Component: TypographyPage },
  { id: "basic-spec",         label: "基础规范",               Component: LogoUsagePage },
  { id: "stationery",         label: "办公应用系统",   Component: StationeryPage },
  { id: "packaging",          label: "产品包装系统",   Component: PackagingPage },
  { id: "marketing",          label: "营销展示系统",   Component: MarketingPage },
  { id: "summary",            label: "总结",                           Component: SummaryPage },
  { id: "closing",            label: "感谢观看",               Component: ClosingPage },
] as const;

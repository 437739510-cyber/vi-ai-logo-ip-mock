// Universal Parameter Extraction from Round 1 Markdown
// Extracts brand colors, fonts, logo rules, and graphics for Round 2 injection

export interface ColorEntry {
  name: string;
  hex: string;
  role: string; // "primary" | "secondary" | "accent" | "neutral"
}

export interface FontEntry {
  name: string;
  weight: string;
  usage: string; // "title_cn" | "body_cn" | "title_en" | "body_en"
}

export interface LogoRuleEntry {
  safeArea: string;
  minPrint: string;
  minDigital: string;
  minOutdoor: string;
}

export interface GraphicEntry {
  name: string;
  type: "primary" | "secondary";
}

export interface ParamPackage {
  brandName: string;
  brandSlogan: string;
  mainCategory: string;
  colors: ColorEntry[];
  fonts: FontEntry[];
  logoRules: LogoRuleEntry | null;
  graphics: GraphicEntry[];
}

// ---- Chapter Locator ----
const CHAPTER_RE = /^##\s*(\d+)\s+([\u4e00-\u9fa5A-Za-z]+)/gm;

// ---- Brand Info ----
const BRAND_NAME_RE = /^[#\s]*([\u4e00-\u9fa5A-Za-z0-9]{2,15})\s*.*品牌视觉识别系统/im;
const SLOGAN_RE = /(?:独特价值主张|品牌slogan|核心理念)[：:]\s*([^。\n]+)/i;

// ---- Color System (Chapter 06) ----
const COLOR_TABLE_RE = /\|.*色.*\|.*HEX.*\|/i;
const COLOR_ROW_RE = /\|\s*([\u4e00-\u9fa5A-Za-z]+)\s*\|\s*`?#?([A-Fa-f0-9]{5,7})`?\s*\|/g;
const PRIMARY_COLOR_RE = /(?:主色|标准色|核心色|品牌主色)[：:\s]*([\u4e00-\u9fa5A-Za-z]+)/i;
const SECONDARY_COLOR_RE = /(?:辅助色|次要色)[：:\s]*([\u4e00-\u9fa5A-Za-z]+)/i;
const ACCENT_COLOR_RE = /(?:强调色|点缀色|提亮色)[：:\s]*([\u4e00-\u9fa5A-Za-z]+)/i;

// ---- Font System (Chapter 08) ----
const FONT_TABLE_RE = /\|.*层级\|.*字体\|.*字重\|/i;
const FONT_ROW_RE = /\|\s*([\u4e00-\u9fa5A-Za-z()（）]+)\s*\|\s*([\u4e00-\u9fa5A-Za-z\s]+)\s*\|\s*([\u4e00-\u9fa5A-Za-z]+)\s*\|/g;
const TITLE_CN_RE = /一级标题|大标题|中文标题/;
const BODY_CN_RE = /正文内容|正文|内文|中文正文/;
const TITLE_EN_RE = /英文标题|一级标题.*英文/;
const BODY_EN_RE = /英文正文/;

// ---- Logo Rules (Chapter 04) ----
const SAFE_AREA_RE = /四周[\s\S]*?保留至少\s*(\d+)%\s*的空白[\s\S]*?以([\s\S]*?)为基准/;
const MIN_PRINT_RE = /印刷[品类]*\s*\|?\s*(\d+)\s*(mm|px)/i;
const MIN_DIGITAL_RE = /数字[媒体屏]*\s*\|?\s*(\d+)\s*(mm|px)/i;
const MIN_OUTDOOR_RE = /户外[广告牌]*\s*\|?\s*(\d+)\s*(mm|px)/i;

// ---- Graphic Elements (Chapter 07) ----
const GRAPHIC_PRIMARY_RE = /主辅助图形[：:]\s*([\u4e00-\u9fa5A-Za-z0-9]{2,12})/;
const GRAPHIC_SECONDARY_RE = /次辅助图形[：:]\s*([\u4e00-\u9fa5A-Za-z0-9]{2,12})/;

// Strip backtick-wrapped HEX values in markdown tables (e.g. `#E8576C` → #E8576C)
function stripBacktickHex(md: string): string {
  return md.replace(/`#([A-Fa-f0-9]{6})`/g, "#$1");
}

//
// Main extraction function
//
export function extractParameters(markdown: string, clientInput: any): ParamPackage {
  const md = stripBacktickHex(markdown);

  // --- Brand info ---
  let brandName = "";
  const bnMatch = md.match(BRAND_NAME_RE);
  if (bnMatch) brandName = bnMatch[1].trim();

  let brandSlogan = "";
  const slMatch = md.match(SLOGAN_RE);
  if (slMatch) brandSlogan = slMatch[2].trim();

  const mainCategory = clientInput?.mainProduct || clientInput?.industry || "";

  // --- Colors ---
  const colors: ColorEntry[] = [];
  const colorTableMatch = md.match(COLOR_TABLE_RE);
  if (colorTableMatch) {
    const tableStart = colorTableMatch.index!;
    const tableChunk = md.slice(tableStart, tableStart + 2000);
    let row: RegExpExecArray | null;
    const colorRowRe = new RegExp(COLOR_ROW_RE.source, "g");
    while ((row = colorRowRe.exec(tableChunk)) !== null) {
      const colorName = row[1].trim();
      const hex = row[2].toUpperCase();
      // Validate hex length: 6 digits = ok, 5/7 digits = warn but continue
      if (hex.length === 6 && !/^[0-9A-F]{6}$/.test(hex)) continue;
      if (hex.length !== 6) {
        console.warn(
          `[parameter-extract] Non-standard HEX length (${hex.length}): #${hex} "${colorName}"`
        );
      }

      let role: ColorEntry["role"] = "neutral";
      if (PRIMARY_COLOR_RE.test(colorName) || /主色|标准色|核心色/.test(colorName)) role = "primary";
      else if (SECONDARY_COLOR_RE.test(colorName) || /辅助|次要/.test(colorName)) role = "secondary";
      else if (ACCENT_COLOR_RE.test(colorName) || /强调|点缀|提亮/.test(colorName)) role = "accent";

      colors.push({ name: colorName, hex, role });
    }
  }

  // --- Fonts ---
  const fonts: FontEntry[] = [];
  const fontTableMatch = md.match(FONT_TABLE_RE);
  if (fontTableMatch) {
    const tableStart = fontTableMatch.index!;
    const tableChunk = md.slice(tableStart, tableStart + 2000);
    let row: RegExpExecArray | null;
    const fontRowRe = new RegExp(FONT_ROW_RE.source, "g");
    while ((row = fontRowRe.exec(tableChunk)) !== null) {
      const level = row[1].trim();
      const fontName = row[2].trim();
      const weight = row[3].trim();

      let usage: FontEntry["usage"] = "body_cn";
      if (TITLE_CN_RE.test(level)) usage = "title_cn";
      else if (TITLE_EN_RE.test(level)) usage = "title_en";
      else if (BODY_EN_RE.test(level)) usage = "body_en";

      fonts.push({ name: fontName, weight, usage });
    }
  }

  // --- Logo rules ---
  let logoRules: LogoRuleEntry | null = null;
  const safeMatch = md.match(SAFE_AREA_RE);
  const printMatch = md.match(MIN_PRINT_RE);
  const digiMatch = md.match(MIN_DIGITAL_RE);
  const outdoorMatch = md.match(MIN_OUTDOOR_RE);
  if (safeMatch || printMatch || digiMatch || outdoorMatch) {
    logoRules = {
      safeArea: safeMatch ? `${safeMatch[1]}% (${safeMatch[2]})` : "",
      minPrint: printMatch ? `${printMatch[1]}${printMatch[2]}` : "",
      minDigital: digiMatch ? `${digiMatch[1]}${digiMatch[2]}` : "",
      minOutdoor: outdoorMatch ? `${outdoorMatch[1]}${outdoorMatch[2]}` : "",
    };
  }

  // --- Graphics ---
  const graphics: GraphicEntry[] = [];
  const gPrimMatch = md.match(GRAPHIC_PRIMARY_RE);
  if (gPrimMatch) graphics.push({ name: gPrimMatch[1].trim(), type: "primary" });
  const gSecMatch = md.match(GRAPHIC_SECONDARY_RE);
  if (gSecMatch) graphics.push({ name: gSecMatch[1].trim(), type: "secondary" });

  // --- Fallback: use clientInput when extraction is empty ---
  if (!brandName && clientInput?.brandName) brandName = clientInput.brandName;
  if (!brandSlogan && clientInput?.brandSlogan) brandSlogan = clientInput.brandSlogan;
  if (colors.length === 0 && clientInput?.brandProfile?.colors) {
    // Try to extract from client input as last resort
  }

  return { brandName, brandSlogan, mainCategory, colors, fonts, logoRules, graphics };
}

// @ts-nocheck
/**
 * Markdown -> PageBlueprint Converter
 *
 * Converts DeepSeek two-round merged VI manual Markdown output
 * into PageBlueprint[] for PPTX rendering.
 *
 * Flow:
 *   mergeManualRound() output (Markdown string)
 *   -> parseChapters() -> ParsedChapter[]
 *   -> mapChapterToPageId() -> pageId
 *   -> chapterToElements() -> PageElement[]
 *   -> buildBackground() -> PageBackground
 *   -> PageBlueprint
 *
 * Special pages (cover, closing) stay hardcoded from page-planner.
 * Scene pages (stationery/packaging/marketing) keep image placeholders.
 */
import {
  planPages,
  buildBackground,
  type PageBlueprint,
  type PageElement,
  type PagePlannerInput,
} from "./page-planner";

// ========== Types ==========

interface ParsedChapter {
  number: string;
  title: string;
  content: string;
}

// ========== Chapter Parsing ==========

const CHAPTER_RE = /^##\s+(\d+)\s+(.+)$/;

function parseChapters(md: string): ParsedChapter[] {
  const lines = md.split("\n");
  const chapters: ParsedChapter[] = [];
  let current: ParsedChapter | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    const m = line.match(CHAPTER_RE);
    if (m) {
      if (current) {
        current.content = contentLines.join("\n").trim();
        chapters.push(current);
      }
      current = { number: m[1], title: m[2].trim(), content: "" };
      contentLines = [];
    } else if (current) {
      contentLines.push(line);
    }
  }
  if (current) {
    current.content = contentLines.join("\n").trim();
    chapters.push(current);
  }

  return chapters;
}

// ========== Chapter -> PageId Mapping ==========
// Fixed mapping by chapter number (not keyword matching) to ensure stable page order

const CHAPTER_NUMBER_MAP: Record<string, string> = {
  "01": "brand-philosophy",
  "02": "logo-interpretation",
  "03": "logo-variations",
  "04": "basic-spec",
  "05": "logo-misuse",
  "06": "brand-colors",
  "07": "auxiliary-graphics",
  "08": "typography",
  "09": "stationery",
  "10": "marketing",
  "11": "material-priority",
  "12": "logo-output",
};

function mapChapterToPageId(chapter: ParsedChapter): string {
  return CHAPTER_NUMBER_MAP[chapter.number] || "summary";
}

// ========== Markdown Table Parsing ==========

function parseMarkdownTable(
  tableLines: string[]
): { headers: string[]; rows: string[][] } | null {
  if (tableLines.length < 2) return null;

  const cleanLine = (l: string) =>
    l
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  // Find separator line
  let headerIdx = -1;
  let sepIdx = -1;
  for (let i = 0; i < tableLines.length - 1; i++) {
    // Skip empty lines before separator
    if (!tableLines[i].trim()) continue;
    // Match alignment separators: |---|, |:---|, |:---:|, |---|---|
    if (/^\|?[\s:-]+\|/.test(tableLines[i + 1])) {
      headerIdx = i;
      sepIdx = i + 1;
      break;
    }
  }
  if (headerIdx < 0) return null;

  const headers = cleanLine(tableLines[headerIdx]);
  const rows: string[][] = [];
  for (let i = sepIdx + 1; i < tableLines.length; i++) {
    // Skip empty lines within table, stop at non-table lines
    if (!tableLines[i].trim()) continue;
    if (!tableLines[i].trim().startsWith("|")) break;
    rows.push(cleanLine(tableLines[i]));
  }

  console.log(
    `[parseMarkdownTable] headers: [${headers.join(", ")}], rows: ${rows.length}`
  );
  return { headers, rows };
}

// ========== Chapter Content -> PageElements ==========

interface ElemCtx {
  pri: { hex: string };
  sec: { hex: string };
  acc: { hex: string };
}

/**
 * Build brand-philosophy as three stacked full-width sections.
 */
function chapterToElements(
  chapter: ParsedChapter,
  pageId: string,
  ctx: ElemCtx,
  sceneImages?: Record<string, string>
): PageElement[] {
  const elements: PageElement[] = [];
  let elemIdx = 0;

  // 1. Title
  elements.push({
    type: "text",
    id: `md-title-${pageId}`,
    content: chapter.title,
    position: "top-center",
    fontSize: 24,
    fontWeight: 700,
    color: ctx.pri.hex,
    marginTop: 30,
  });

  // 2. Divider
  elements.push({
    type: "divider",
    id: `md-divider-${pageId}`,
    position: "center",
    widthPct: 30,
    color: ctx.acc.hex,
    opacity: 0.6,
    marginTop: 15,
  });

  // 3. Content blocks
  const content = chapter.content;
  if (!content) return elements;

  

  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Subheading (### or **bold** line)
    if (trimmed.startsWith("###") || trimmed.startsWith("**")) {
      const heading = trimmed
        .replace(/^###\s*/, "")
        .replace(/^\*\*/, "")
        .replace(/\*\*$/, "");
      elements.push({
        type: "text",
        id: `md-h3-${pageId}-${elemIdx++}`,
        content: heading,
        position: "top-center",
        fontSize: 16,
        fontWeight: 600,
        color: ctx.sec.hex,
        marginTop: 20,
        marginLeft: 20,
        marginRight: 20,
        params: { align: "left" },
      });
      i++;
      continue;
    }

    // Table (starts with |)
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const tline = lines[i].trim();
        if (!tline) { i++; continue; } // skip empty lines within table
        if (!tline.startsWith("|")) break;
        tableLines.push(lines[i]);
        i++;
      }
      const table = parseMarkdownTable(tableLines);
      if (table) {
        elements.push({
          type: "table",
          id: `md-table-${pageId}-${elemIdx++}`,
          position: "center",
          widthPct: 75,
          marginTop: 15,
          params: { headers: table.headers, rows: table.rows },
        });
      }
      continue;
    }

    // Regular paragraph
    elements.push({
      type: "text",
      id: `md-text-${pageId}-${elemIdx++}`,
      content: trimmed,
      position: "top-center",
      fontSize: 12,
      color: "#444",
      marginTop: 10,
      marginLeft: 20,
      marginRight: 20,
      params: { align: "left", lineHeight: 1.6 },
    });
    i++;
  }

  // Scene pages: add image placeholder
  if (["stationery", "packaging", "marketing"].includes(pageId)) {
    elements.push({
      type: "image",
      id: `md-scene-${pageId}`,
      position: "center",
      widthPct: 65,
      heightPct: 35,
      marginTop: 20,
      params: { sceneType: pageId },
    });
  }

  return elements;
}

// ========== TOC Page Builder ==========

function buildTocBlueprint(
  md: string,
  ctx: ElemCtx
): PageBlueprint {
  const elements: PageElement[] = [];

  elements.push({
    type: "text",
    id: "toc-title",
    content: "目录",
    position: "top-center",
    fontSize: 28,
    fontWeight: 700,
    color: ctx.pri.hex,
    marginTop: 40,
  });

  elements.push({
    type: "divider",
    id: "toc-divider",
    position: "center",
    widthPct: 40,
    color: ctx.acc.hex,
    opacity: 0.6,
    marginTop: 15,
  });

  const chapters = parseChapters(md);
  chapters.forEach((ch, i) => {
    elements.push({
      type: "text",
      id: `toc-item-${i}`,
      content: `${ch.number}  ${ch.title}`,
      position: "top-center",
      fontSize: 14,
      fontWeight: 500,
      color: "#333",
      marginTop: 8,
      marginLeft: 100,
      marginRight: 100,
      params: { align: "left", lineHeight: 1.4 },
    });
  });

  return {
    pageId: "toc",
    label: "目录",
    background: {
      type: "solid",
      primaryColor: "#FFFFFF",
      secondaryColor: ctx.sec.hex,
    },
    elements,
    appliedRules: [],
    qualityThreshold: 70,
  };
}

// ========== Main Export ==========

/** Minimal context for buildBackground() */
interface MinimalBgCtx {
  pri: { hex: string; name?: string };
  sec: { hex: string; name?: string };
  acc: { hex: string; name?: string };
  companyName: string;
}

/**
 * Convert DeepSeek two-round merged Markdown to PageBlueprint[].
 *
 * @param fullManualMd - merged markdown from mergeManualRound()
 * @param input - same PagePlannerInput used for planPages() fallback
 * @param sceneImages - optional scene images from ComfyUI generation
 */
export async function markdownToBlueprint(
  fullManualMd: string,
  input: PagePlannerInput,
  sceneImages?: Record<string, string>
): Promise<PageBlueprint[]> {
  const companyName = input.clientInfo.companyName || "品牌名称";
  const pri = input.brandColors.primary;
  const sec = input.brandColors.secondary;
  const acc = input.brandColors.accent;

  // 1. Get hardcoded blueprints for cover and closing from page-planner
  const hardcoded = await planPages({
    ...input,
    pageIds: ["cover", "closing"],
  });
  const coverBp = hardcoded.find((b) => b.pageId === "cover");
  const closingBp = hardcoded.find((b) => b.pageId === "closing");

  // 2. Build TOC from markdown chapter headings
  const tocBp = buildTocBlueprint(fullManualMd, { pri, sec, acc });

  // 3. Parse markdown chapters
  const chapters = parseChapters(fullManualMd);
  console.log(
    `[markdown-to-blueprint] Parsed ${chapters.length} chapters from markdown (${
      fullManualMd.length
    } chars)`
  );

  // 4. Build chapter blueprints
  const bgCtx: MinimalBgCtx = { pri, sec, acc, companyName };
  const elemCtx: ElemCtx = { pri, sec, acc };

  const chapterBlueprints: PageBlueprint[] = chapters.map((chapter) => {
    const pageId = mapChapterToPageId(chapter);
    const label = chapter.title;
    const background = buildBackground(pageId, bgCtx as any);
    const elements = chapterToElements(chapter, pageId, elemCtx, sceneImages);

    console.log(`[markdown-to-blueprint] Ch${chapter.number} -> ${pageId} (${elements.length} elements)`);

    return {
      pageId,
      label,
      background,
      elements,
      appliedRules: [],
      qualityThreshold: 70,
    };
  });

  // 5. Merge: cover -> toc -> chapters -> closing
  const result: PageBlueprint[] = [];
  if (coverBp) result.push(coverBp);
  result.push(tocBp);
  result.push(...chapterBlueprints);
  if (closingBp) result.push(closingBp);

  console.log(`[markdown-to-blueprint] Total: ${result.length} PageBlueprints`);
  return result;
}

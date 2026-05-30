// API Route: POST /api/ai/analyze-reference-pdf
// Upload a reference VI manual PDF, extract per-page text, analyze each page with DeepSeek,
// and map reference pages to our 11 VI manual page types.
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { analysisToDesignSystem, createTemplate, findBestMatchingTemplates } from "@/lib/template-library";
import fs from "fs";

const execAsync = promisify(exec);

export const maxDuration = 180;
export const dynamic = "force-dynamic";

// The 11 page types in our VI manual
const OUR_PAGE_TYPES = [
  { id: "cover",              label: "品牌视觉识别系统 (VI) 规范手册" },
  { id: "brand-philosophy",   label: "品牌核心理念" },
  { id: "logo-interpretation",label: "标识诠释" },
  { id: "brand-colors",       label: "标准色彩规范" },
  { id: "typography",         label: "字体系统" },
  { id: "basic-spec",         label: "基础规范" },
  { id: "stationery",         label: "办公应用系统" },
  { id: "packaging",          label: "产品包装系统" },
  { id: "marketing",          label: "营销展示系统" },
  { id: "summary",            label: "总结" },
  { id: "closing",            label: "感谢观看" },
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "file and projectId required" }, { status: 400 });
    }

    // 1. Save the uploaded PDF
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name);
    const safeName = `ref-${projectId}${ext}`;
    const filePath = path.join(uploadDir, safeName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // 2. Call Python script to extract per-page text
    const scriptPath = path.join(process.cwd(), "_extract_pdf_text.py");
    const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${filePath}"`);

    if (stderr) {
      console.error("[analyze-ref] Python stderr:", stderr);
    }

    // Parse per-page JSON output from Python
    let pages: { pageNumber: number; text: string }[] = [];
    try {
      pages = JSON.parse(stdout?.trim() || "[]");
    } catch {
      // Fallback: treat whole output as one page
      pages = [{ pageNumber: 1, text: stdout?.trim() || "(No extractable text)" }];
    }

    if (pages.length === 0) {
      pages = [{ pageNumber: 1, text: "(PDF has no extractable text, will infer from filename and context)" }];
    }

    // 3. Send all pages to DeepSeek for per-page analysis + mapping
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    let pageMapping: Record<string, any> = {};
    let overallStyle = "";
    let rawDeepseekResponse = "";

    if (deepseekKey) {
      // Build a per-page text summary for the prompt (truncate each page to 800 chars to fit context)
      const perPageSummary = pages.map(p =>
        `[Page ${p.pageNumber}]\n${p.text.slice(0, 800)}`
      ).join("\n\n");

      const ourPagesJSON = JSON.stringify(OUR_PAGE_TYPES);
      const prompt = `You are a professional VI manual designer and brand analyst with expert-level design knowledge.

Below is the extracted text from each page of a reference VI manual PDF.

${perPageSummary}

Now, I need you to:
1. Analyze EACH reference page individually in extreme detail (layout grid, exact color hex values, fonts, spacing, imagery, texture, mood).
2. Map each reference page to one or more of our 11 VI manual page types (listed below).
3. For EACH of our 11 page types, provide a comprehensive analysis. Even if there is no exact match, infer the best design patterns from the reference.

Our 11 page types: ${ourPagesJSON}

Return ONLY valid JSON with this structure:
{
  "overallStyle": "A brief 1-sentence summary of the overall style of the reference manual",
  "pageMapping": {
    // Key = one of our page IDs above, only include page types that have a matching reference page
    "cover": {
      "referencePages": [1],
      "pageText": "The actual text from reference page 1",
      "analysis": {
        "layout": "Detailed layout description: grid system, margins, alignment, white space distribution, element positioning, section proportions",
        "colors": ["Specific colors used: color name and hex value when visible (e.g., Forest Green #227338) - primary", "Color 2 with hex - purpose"],
        "typography": "Detailed typography: font names, weights, sizes hierarchy, line spacing, contrast between heading and body fonts, font mood",
        "visualHierarchy": "Step-by-step how the eye flows: what draws attention first, second, third; size/color/position relationships",
        "colorPalette": "Specific color description: dominant colors, accent colors, gradients if any, color relationships and emotional impact",
        "visualMood": "Describe the visual mood: elegant, energetic, minimalist, luxurious, natural, modern, traditional, playful, serious, etc.",
        "keyElements": ["Key design elements on this page"],
        "contentStructure": "What content appears and in what order",
        "designNotes": "Specific actionable notes: what patterns to borrow, what proportions to use, what design decisions make this page effective"
      }
    },
    "brand-colors": {
      "referencePages": [4],
      "pageText": "...",
      "analysis": { ... }
    },
    // ... only include pages that have reference matches
  }
}

IMPORTANT: 
- You MUST include ALL 11 page types in pageMapping, even if you have to infer from overall style.
- Extract exact hex color codes whenever possible (look for #RGB or #RRGGBB patterns). For colors field, provide actual hex values like 'Forest Green (#227338)'. Be extremely specific and detailed in every field - at least 2-3 sentences for layout, typography, visualHierarchy fields.  
- Return ONLY valid JSON, no markdown.`;

      const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + deepseekKey,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "You are a senior brand identity designer and VI manual analyst. You excel at analyzing reference materials page-by-page and extracting actionable design insights.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (resp.ok) {
        const data = await resp.json();
        try {
          const parsed = JSON.parse(data.choices[0].message.content);
          pageMapping = parsed.pageMapping || {};
          overallStyle = parsed.overallStyle || "";
          rawDeepseekResponse = data.choices[0].message.content;
        } catch {
          // Fallback: store raw response
          pageMapping = { _raw: data.choices[0].message.content };
          rawDeepseekResponse = data.choices[0].message.content;
        }
      }
    }

    // 4. Save per-page analysis to JSON (multi-version support)
    const timestamp = Date.now();
    const refDir = path.join(process.cwd(), "public", "mock", "reference");
    await mkdir(refDir, { recursive: true });
    const refId = `${projectId}-${timestamp}`;
    const analysisPath = path.join(refDir, `ref-${refId}.json`);

    const perPageText: Record<number, string> = {};
    for (const p of pages) {
      perPageText[p.pageNumber] = p.text;
    }

    const result = {
      refId,
      url: `/uploads/${safeName}`,
      fileName: file.name,
      pageCount: pages.length,
      analyzedAt: new Date().toISOString(),
      overallStyle,
      pageMapping,
      perPageText,
    };
    await writeFile(analysisPath, JSON.stringify(result, null, 2));

    // 5. Update index file (list all references for this project, mark new one as active)
    const indexPath = path.join(refDir, `ref-${projectId}-index.json`);
    let existingRefs: any[] = [];
    try {
      existingRefs = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    } catch {}
    // Deactivate all existing, activate the new one
    existingRefs = existingRefs.map((r: any) => ({ ...r, active: false }));
    existingRefs.push({
      refId,
      fileName: file.name,
      analyzedAt: new Date().toISOString(),
      overallStyle: overallStyle.slice(0, 200),
      pageCount: pages.length,
      active: true,
    });
    await writeFile(indexPath, JSON.stringify(existingRefs, null, 2));

    // 6. Convert analysis to structured design system and save as template
    let templateInfo = null;
    try {
      const industry = formData.get("industry") as string || "其他";
      const styleTagsRaw = formData.get("styleTags") as string || "";
      const customStyleTags = styleTagsRaw ? styleTagsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

      const designSystem = analysisToDesignSystem(overallStyle, pageMapping, perPageText);

      if (overallStyle && !designSystem.moodKeywords.includes(overallStyle.slice(0, 20))) {
        const moodWords = overallStyle.split(/[,，、\s]+/).slice(0, 3).map(s => s.trim()).filter(Boolean);
        designSystem.moodKeywords = [...new Set([...moodWords, ...designSystem.moodKeywords])].slice(0, 10);
      }

      const allStyleTags = [...new Set([...designSystem.moodKeywords.slice(0, 5), ...customStyleTags])];

      const template = await createTemplate(
        file.name,
        industry,
        allStyleTags,
        designSystem,
        projectId
      );

      const matches = await findBestMatchingTemplates(industry, allStyleTags, 3);

      templateInfo = {
        templateId: template.templateId,
        qualityScore: template.qualityScore,
        matchedTemplates: matches.map(m => ({
          templateId: m.template.templateId,
          sourceFile: m.template.sourceFile,
          matchScore: m.matchScore,
          moodSummary: m.template.moodSummary,
        })),
      };
    } catch (templateErr) {
      console.error("[analyze-ref] Template creation error:", templateErr);
    }

    // 6. Return simplified result with refId and all refs for this project
    const simplifiedMapping: Record<string, any> = {};
    for (const [pageId, info] of Object.entries(pageMapping)) {
      const typedInfo = info as any;
      simplifiedMapping[pageId] = {
        referencePages: typedInfo.referencePages || [],
        analysis: typedInfo.analysis || {},
      };
    }

    return NextResponse.json({
      success: true,
      refId,
      url: `/uploads/${safeName}`,
      fileName: file.name,
      pageCount: pages.length,
      overallStyle,
      pageMapping: simplifiedMapping,
      allRefs: existingRefs,
      template: templateInfo,
    });
  } catch (error) {
    console.error("[analyze-ref] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis failed" }, { status: 500 });
  }
}

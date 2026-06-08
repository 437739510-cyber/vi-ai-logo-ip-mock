// API Route: POST /api/ai/analyze-asset
// Analyze an uploaded image (LOGO or mascot) using DeepSeek.
// Returns structured semantic data: elements, style, colors, meaning, character info.
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, assetType } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // No API key: return basic fallback
      return NextResponse.json({
        analysisStatus: "failed",
        logoElements: [],
        logoMeaning: "",
        mascotName: "",
        mascotStyle: "",
        mascotPersonality: "",
        extractedColors: [],
      });
    }

    // Read the image file and convert to base64 for multimodal analysis
    const fullPath = path.join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
    let imageBase64 = "";
    try {
      const imageBuf = await readFile(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";
      imageBase64 = `data:${mime};base64,${imageBuf.toString("base64")}`;
    } catch {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const isLogo = assetType === "logo";

    const systemPrompt = isLogo
      ? "你是一个专业品牌设计分析师。分析LOGO图片，提取设计元素、风格标签、品牌色、设计含义。返回严格JSON。"
      : "你是一个专业IP角色分析师。分析IP公仔图片，提取角色名称、风格、性格、颜色、图片上的文字标签。返回严格JSON。";

    const prompt = isLogo
      ? `分析这张品牌LOGO图片。请返回JSON（不要markdown）：\n{\n  "logoElements": ["设计元素1", "设计元素2"],\n  "logoSyleTags": ["风格标签1", "风格标签2"],\n  "logoMeaning": "设计含义描述",\n  "extractedColors": [{"hex": "#HEX", "name": "颜色名", "usage": "主色/辅助色/强调色"}]\n}`
      : `分析这张IP公仔/吉祥物图片。请返回JSON（不要markdown）：\n{\n  "mascotName": "角色名",\n  "mascotStyle": "风格（3D/扁平/Q版/手绘）",\n  "mascotPersonality": "性格描述",\n  "mascotDescription": "整体描述",\n  "mascotLabels": ["图片上的文字标签，如正面"],\n  "extractedColors": [{"hex": "#HEX", "name": "颜色名", "usage": "主色/辅助色"}]\n}`;

    const resp = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      throw new Error("DeepSeek error: " + resp.status);
    }

    const data = await resp.json();
    let analysis: any = {};
    try {
      analysis = JSON.parse(data.choices[0].message.content);
    } catch {
      analysis = { analysisStatus: "failed" };
    }

    analysis.analysisStatus = "completed";

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[analyze-asset] Error:", error);
    return NextResponse.json({
      analysisStatus: "failed",
      error: error instanceof Error ? error.message : "Analysis failed",
    });
  }
}

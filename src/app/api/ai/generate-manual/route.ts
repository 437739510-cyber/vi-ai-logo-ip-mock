// API Route: POST /api/ai/generate-manual
// 基于客户素材 + 参考手册分析 → 自动生成完整 VI 手册
import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

// 默认手册（当 API 调用失败时的 fallback）
function getDefaultManual(projectId: string): any {
  return {
    id: `MANUAL-${Date.now()}`,
    projectId,
    cover: {
      title: "品牌视觉识别手册",
      subtitle: "Visual Identity Guidelines",
      version: "v1.0",
      date: new Date().toISOString().slice(0, 7),
      companyName: "品牌名称",
    },
    brandColors: {
      primary: { name: "品牌蓝", hex: "#1A73E8", cmyk: "C87 M53 Y0 K0", rgb: "26,115,232" },
      secondary: { name: "生长绿", hex: "#34A853", cmyk: "C75 M0 Y100 K0", rgb: "52,168,83" },
      accent: { name: "活力黄", hex: "#FBBC04", cmyk: "C0 M18 Y100 K0", rgb: "251,188,4" },
      neutrals: [
        { name: "背景白", hex: "#F8F9FA" },
        { name: "文字黑", hex: "#202124" },
      ],
    },
    typography: {
      chinese: {
        heading: { font: "思源黑体", weights: [700, 500] },
        body: { font: "思源黑体", weights: [400, 300] },
      },
      english: {
        heading: { font: "Inter", weights: [700, 600] },
        body: { font: "Inter", weights: [400] },
      },
    },
    logoVariants: [
      { name: "横版组合", src: "/mock/manual/logo-horizontal.png" },
      { name: "竖版组合", src: "/mock/manual/logo-vertical.png" },
      { name: "图标版", src: "/mock/manual/logo-icon.png" },
      { name: "反白版", src: "/mock/manual/logo-monochrome.png" },
    ],
    auxiliaryGraphics: [
      { name: "辅助图形-基础", src: "/mock/manual/pattern-base.svg" },
      { name: "辅助图形-应用", src: "/mock/manual/pattern-applied.svg" },
    ],
    applications: [
      { type: "business_card", label: "名片", mockupUrl: "/mock/mockups/business-card.jpg", specs: "90×54mm, 300DPI" },
      { type: "letterhead", label: "信纸", mockupUrl: "/mock/mockups/letterhead.jpg", specs: "A4, 210×297mm" },
      { type: "ppt", label: "PPT 模板", mockupUrl: "/mock/mockups/ppt-template.jpg", specs: "16:9" },
    ],
    referenceAnalysis: { used: false, extractedColors: [], extractedFonts: [], styleSummary: "", analysisConfidence: 0 },
  };
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, clientInfo, referenceAnalysis } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    // 构建提交给 AI 的素材描述
    const hasLogo = clientInfo?.logoAssets?.length > 0;
    const hasMascot = clientInfo?.mascotAssets?.length > 0;
    const hasReference = referenceAnalysis?.used;

    const referenceContext = hasReference
      ? `\n【参考手册风格】\n- 提取色板：${referenceAnalysis.extractedColors?.join(", ") || "无"}\n- 提取字体：${referenceAnalysis.extractedFonts?.join(", ") || "无"}\n- 风格描述：${referenceAnalysis.styleSummary || "无"}`
      : "\n【没有参考手册】请根据客户行业自主设计品牌风格。";

    const prompt = `你是一位专业的品牌 VI 设计师。请根据以下客户信息，生成一套完整的 VI 手册设计规范。

【客户信息】
- 公司名称：${clientInfo?.companyName || "品牌名称"}
- 行业：${clientInfo?.industry || "未指定"}
- 品牌描述：${clientInfo?.description || "无"}
- 是否有 LOGO 素材：${hasLogo ? "是" : "否"}
- 是否有 IP 公仔素材：${hasMascot ? "是" : "否"}
${referenceContext}

请以 JSON 格式返回完整的 VI 手册数据，严格遵循以下结构：

{
  "cover": {
    "title": "品牌视觉识别手册",
    "subtitle": "Visual Identity Guidelines",
    "version": "v1.0",
    "date": "${new Date().toISOString().slice(0, 7)}",
    "companyName": "公司名称"
  },
  "brandColors": {
    "primary": { "name": "品牌色名称", "hex": "#HEX", "cmyk": "C M Y K", "rgb": "R,G,B" },
    "secondary": { "name": "辅助色名称", "hex": "#HEX", "cmyk": "C M Y K", "rgb": "R,G,B" },
    "accent": { "name": "强调色名称", "hex": "#HEX", "cmyk": "C M Y K", "rgb": "R,G,B" },
    "neutrals": [
      { "name": "中性色1", "hex": "#HEX" },
      { "name": "中性色2", "hex": "#HEX" }
    ]
  },
  "typography": {
    "chinese": {
      "heading": { "font": "中文字体名", "weights": [700, 500] },
      "body": { "font": "中文字体名", "weights": [400] }
    },
    "english": {
      "heading": { "font": "英文字体名", "weights": [700, 600] },
      "body": { "font": "英文字体名", "weights": [400] }
    }
  }
}

注意：只输出 JSON，不要附带任何其他文字。字体名称请使用真实可用的字体名。
`;

    if (!apiKey) {
      // 无 API 密钥时返回默认手册
      const manual = getDefaultManual(projectId);
      manual.cover.companyName = clientInfo?.companyName || "品牌名称";
      return NextResponse.json(manual);
    }

    const deepseekRes = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是品牌 VI 设计专家。严格按照用户要求的 JSON 格式输出，只输出 JSON，不要任何附加文字。",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!deepseekRes.ok) {
      throw new Error(`DeepSeek API error: ${deepseekRes.status}`);
    }

    const data = await deepseekRes.json();
    const manualData = JSON.parse(data.choices[0].message.content);

    // 组装完整的 manual 对象
    const manual = {
      id: `MANUAL-${Date.now()}`,
      projectId,
      ...manualData,
      // 添加参考分析信息
      referenceAnalysis: referenceAnalysis || {
        used: false,
        extractedColors: [],
        extractedFonts: [],
        styleSummary: "",
        analysisConfidence: 0,
      },
      // 添加默认的 logo、辅助图形、应用场景（这些需要后续从上传素材生成）
      logoVariants: [
        { name: "横版组合", src: "/mock/manual/logo-horizontal.png" },
        { name: "竖版组合", src: "/mock/manual/logo-vertical.png" },
      ],
      auxiliaryGraphics: [
        { name: "辅助图形-基础", src: "/mock/manual/pattern-base.svg" },
      ],
      applications: [
        { type: "business_card", label: "名片", mockupUrl: "/mock/mockups/business-card.jpg", specs: "90×54mm, 300DPI" },
        { type: "letterhead", label: "信纸", mockupUrl: "/mock/mockups/letterhead.jpg", specs: "A4, 210×297mm" },
      ],
    };

    return NextResponse.json(manual);
  } catch (error) {
    console.error("[API/generate-manual] Error:", error);
    return NextResponse.json(getDefaultManual(extractProjectIdFromReq(req)));
  }
}

function extractProjectIdFromReq(req: NextRequest): string {
  try {
    const url = new URL(req.url);
    return url.searchParams.get("projectId") || "unknown";
  } catch {
    return "unknown";
  }
}

// API Route: POST /api/ai/generate-manual
// 基于客户素材 + 参考手册分析 → 生成真正可用的完整 VI 手册规范数据
import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

function getDefaultManual(projectId: string): any {
  const now = new Date().toISOString().slice(0, 7);
  return {
    id: `MANUAL-${Date.now()}`,
    projectId,
    cover: { title: "品牌视觉识别手册", subtitle: "Visual Identity Guidelines", version: "v1.0", date: now, companyName: "品牌名称" },
    brandColors: {
      primary: { name: "品牌色", hex: "#1A73E8", cmyk: "C87 M53 Y0 K0", rgb: "26,115,232", pantone: "PMS 285 C" },
      secondary: { name: "辅助色", hex: "#34A853", cmyk: "C75 M0 Y100 K0", rgb: "52,168,83", pantone: "PMS 7481 C" },
      accent: { name: "强调色", hex: "#FBBC04", cmyk: "C0 M18 Y100 K0", rgb: "251,188,4", pantone: "PMS 123 C" },
      neutrals: [{ name: "背景色", hex: "#F8F9FA" }, { name: "文字色", hex: "#202124" }],
      usageGuidelines: "主色用于品牌核心视觉元素，辅助色用于次级信息呈现，强调色仅用于行动号召和高亮元素。",
    },
    typography: {
      chinese: { heading: { font: "思源黑体", weights: [700, 500], sizes: [{ context: "大标题", size: "28px" }, { context: "中标题", size: "20px" }, { context: "小标题", size: "16px" }] }, body: { font: "思源黑体", weights: [400, 300], sizes: [{ context: "正文", size: "14px" }, { context: "辅助文字", size: "12px" }] } },
      english: { heading: { font: "Inter", weights: [700, 600], sizes: [{ context: "大标题", size: "28px" }, { context: "中标题", size: "20px" }, { context: "小标题", size: "16px" }] }, body: { font: "Inter", weights: [400], sizes: [{ context: "正文", size: "14px" }, { context: "辅助文字", size: "12px" }] } },
      usageGuidelines: "标题使用粗体字重，正文使用常规字重。",
    },
    logoUsage: { clearSpace: "Logo 四周至少保留 1 倍高度的空白", minimumSize: "印刷 20mm / 数字 60px", prohibitedUses: ["变形拉伸", "添加特效", "改变颜色", "杂色背景", "重叠放置"] },
    logoVariants: [{ name: "横版组合", src: "/mock/manual/logo-horizontal.png", usage: "默认版本" }, { name: "竖版组合", src: "/mock/manual/logo-vertical.png", usage: "空间受限" }, { name: "图标版", src: "/mock/manual/logo-icon.png", usage: "App图标" }, { name: "反白版", src: "/mock/manual/logo-monochrome.png", usage: "深色背景" }],
    mascotGuidelines: { usageGuide: "未上传 IP 公仔素材", proportions: "无", colorSpec: "无", prohibitedUses: [] },
    auxiliaryGraphics: [{ name: "基础辅助图形", src: "/mock/manual/pattern-base.svg", usage: "背景装饰" }, { name: "应用辅助图形", src: "/mock/manual/pattern-applied.svg", usage: "名片背景" }],
    applications: [
      { type: "business_card", label: "名片", mockupUrl: "/mock/mockups/business-card.jpg", specs: "90×54mm, 300DPI", layout: "正面：Logo 左上，姓名居中，联系方式下方" },
      { type: "letterhead", label: "信纸", mockupUrl: "/mock/mockups/letterhead.jpg", specs: "A4, 210×297mm", layout: "页眉 Logo，页脚联系方式" },
      { type: "ppt", label: "PPT 模板", mockupUrl: "/mock/mockups/ppt-template.jpg", specs: "16:9", layout: "封面 Logo + 标题居中" },
    ],
    referenceAnalysis: { used: false, extractedColors: [], extractedFonts: [], styleSummary: "" },
  };
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, clientInfo, referenceAnalysis } = await req.json();
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const hasLogo = clientInfo?.logoAssets?.length > 0;
    const hasMascot = clientInfo?.mascotAssets?.length > 0;
    const hasReference = referenceAnalysis?.used;
    const mascotNames = clientInfo?.mascotAssets?.map((m: any) => m.name).join("、") || "";

    const referenceContext = hasReference
      ? `\n【参考手册分析】\n色板：${referenceAnalysis.extractedColors?.join(", ") || "无"}\n字体：${referenceAnalysis.extractedFonts?.join(", ") || "无"}\n风格：${referenceAnalysis.styleSummary || "无"}`
      : "";

    const prompt = `你是一位专业的品牌 VI 设计规范编写专家。根据以下客户信息输出一套可直接使用的完整 VI 手册规范。

【客户】\n公司：${clientInfo?.companyName || "品牌名称"}\n行业：${clientInfo?.industry || "未指定"}\n描述：${clientInfo?.description || "无"}\n有LOGO：${hasLogo}\n有IP公仔：${hasMascot ? "是（${mascotNames}）" : "否"}${referenceContext}

严格按照以下 JSON 结构输出真实可用的设计规范：
{
  "cover": { "title": "公司名+视觉识别手册", "subtitle": "Visual Identity Guidelines", "version": "v1.0", "date": "${new Date().toISOString().slice(0, 7)}", "companyName": "公司全称" },
  "brandColors": {
    "primary": { "name": "色名", "hex": "#HEX", "cmyk": "C M Y K", "rgb": "R,G,B", "pantone": "PMS" },
    "secondary": { "name": "色名", "hex": "#HEX", "cmyk": "C M Y K", "rgb": "R,G,B", "pantone": "PMS" },
    "accent": { "name": "色名", "hex": "#HEX", "cmyk": "C M Y K", "rgb": "R,G,B", "pantone": "PMS" },
    "neutrals": [{ "name": "色名", "hex": "#HEX" }, { "name": "色名", "hex": "#HEX" }],
    "usageGuidelines": "颜色使用说明（50字左右）"
  },
  "typography": {
    "chinese": { "heading": { "font": "中文字体", "weights": [700,500], "sizes": [{ "context": "大标题", "size": "28px" },{ "context": "中标题", "size": "20px" },{ "context": "小标题", "size": "16px" }] }, "body": { "font": "中文字体", "weights": [400], "sizes": [{ "context": "正文", "size": "14px" },{ "context": "辅助", "size": "12px" }] } },
    "english": { "heading": { "font": "英文字体", "weights": [700,600], "sizes": [{ "context": "大标题", "size": "28px" },{ "context": "中标题", "size": "20px" },{ "context": "小标题", "size": "16px" }] }, "body": { "font": "英文字体", "weights": [400], "sizes": [{ "context": "正文", "size": "14px" },{ "context": "辅助", "size": "12px" }] } },
    "usageGuidelines": "字体使用规范（30字）"
  },
  "logoUsage": { "clearSpace": "预留空间", "minimumSize": "最小尺寸", "prohibitedUses": ["禁止1","禁止2","禁止3"] },
  "logoVariants": [{ "name": "横版", "src": "/mock/manual/logo-horizontal.png", "usage": "说明" },{ "name": "竖版", "src": "/mock/manual/logo-vertical.png", "usage": "说明" },{ "name": "图标", "src": "/mock/manual/logo-icon.png", "usage": "说明" },{ "name": "反白", "src": "/mock/manual/logo-monochrome.png", "usage": "说明" }],
  "mascotGuidelines": { "usageGuide": "IP使用规范", "proportions": "比例", "colorSpec": "颜色", "prohibitedUses": ["禁止1","禁止2"] },
  "auxiliaryGraphics": [{ "name": "图形名", "src": "/mock/manual/pattern-base.svg", "usage": "说明" },{ "name": "图形名", "src": "/mock/manual/pattern-applied.svg", "usage": "说明" }],
  "applications": [
    { "type": "business_card", "label": "名片", "mockupUrl": "/mock/mockups/business-card.jpg", "specs": "90×54mm", "layout": "布局说明" },
    { "type": "letterhead", "label": "信纸", "mockupUrl": "/mock/mockups/letterhead.jpg", "specs": "A4", "layout": "布局说明" },
    { "type": "ppt", "label": "PPT", "mockupUrl": "/mock/mockups/ppt-template.jpg", "specs": "16:9", "layout": "布局说明" },
    { "type": "envelope", "label": "信封", "mockupUrl": "/mock/mockups/envelope.jpg", "specs": "DL 110×220mm", "layout": "布局说明" },
    { "type": "signage", "label": "招牌", "mockupUrl": "/mock/mockups/signage.jpg", "specs": "尺寸", "layout": "布局说明" }
  ]
}

注意：只输出 JSON。字体用真实名称（思源黑体/Noto Sans SC/Inter/Poppins等）。颜色根据行业合理设计。如有IP公仔素材请详细编写公仔规范。`;

    if (!apiKey) {
      const manual = getDefaultManual(projectId);
      manual.cover.companyName = clientInfo?.companyName || "品牌名称";
      return NextResponse.json(manual);
    }

    const deepseekRes = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是品牌 VI 规范编写专家。严格按用户要求的 JSON 格式输出真实可用的设计规范数据，只输出 JSON。" },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!deepseekRes.ok) throw new Error(`DeepSeek error: ${deepseekRes.status}`);
    const data = await deepseekRes.json();
    const manualData = JSON.parse(data.choices[0].message.content);

    const manual = {
      id: `MANUAL-${Date.now()}`,
      projectId,
      ...manualData,
      referenceAnalysis: referenceAnalysis || { used: false, extractedColors: [], extractedFonts: [], styleSummary: "" },
    };

    return NextResponse.json(manual);
  } catch (error) {
    console.error("[API/generate-manual] Error:", error);
    return NextResponse.json({ error: "生成失败" }, { status: 500 });
  }
}

// API Route: POST /api/ai/generate-manual-pages - batch (legacy, use stream endpoint instead)
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const PAGE_DEFS = [
  { id: "cover", label: "封面", desc: "VI manual cover page" },
  { id: "brand-colors", label: "品牌色板", desc: "Brand color palette" },
  { id: "typography", label: "字体规范", desc: "Font usage guide" },
  { id: "logo-usage", label: "Logo 规范", desc: "Logo usage" },
  { id: "logo-variants", label: "Logo 变体", desc: "Logo variants" },
  { id: "auxiliary", label: "辅助图形", desc: "Auxiliary graphics" },
  { id: "business-card", label: "名片", desc: "Business card" },
  { id: "letterhead", label: "信纸", desc: "Letterhead" },
  { id: "ppt-template", label: "PPT 模板", desc: "PPT template" },
  { id: "signage", label: "招牌", desc: "Signage" },
  { id: "closing", label: "封底", desc: "Back cover" },
];

export async function POST(req: NextRequest) {
  try {
    const { projectId, clientInfo, brandColors } = await req.json();
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    return NextResponse.json({ message: "Use /api/ai/generate-manual-pages-stream instead for progressive generation" });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
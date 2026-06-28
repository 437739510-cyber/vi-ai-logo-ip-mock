import { NextRequest, NextResponse } from "next/server";
import { planPages } from "@/lib/vi-manual/page-planner";
import { renderPptxToBuffer } from "@/lib/pptx/render-pptx";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientInfo, brandColors, format } = body;
    const companyName = clientInfo?.companyName || "Brand";
    const industry = clientInfo?.industry || "general";
    const blueprints = await planPages({
      clientInfo: { companyName, brandVision: clientInfo?.brandVision || "", coreValues: clientInfo?.coreValues || "", targetMarket: clientInfo?.targetMarket || "", logoPhilosophy: clientInfo?.logoPhilosophy || "", industry },
      brandColors: { primary: { hex: brandColors?.primary || "#E8576C", name: "Primary" }, secondary: { hex: brandColors?.secondary || "#9B72CF", name: "Secondary" }, accent: { hex: brandColors?.accent || "#F0D5A8", name: "Accent" } },
      assetAnalysis: { logo: { hasLogo: false, meaning: clientInfo?.logoPhilosophy || "" }, mascot: { hasMascot: false } },
    });
    const buffer = await renderPptxToBuffer(blueprints, {
      projectName: body.projectId || "manual", companyName, industry,
      brandColors: { primary: brandColors?.primary || "#E8576C", secondary: brandColors?.secondary || "#9B72CF", accent: brandColors?.accent || "#F0D5A8" },
      brandVision: clientInfo?.brandVision || "", coreValues: clientInfo?.coreValues || "", targetMarket: clientInfo?.targetMarket || "", logoPhilosophy: clientInfo?.logoPhilosophy || "",
      sceneImages: {}, sceneLabels: {}, compressImages: true,
    });
    const outputDir = path.join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });
    const fileName = "vi-manual-" + Date.now() + "." + (format || "pptx");
    const fpath = path.join(outputDir, fileName);
    await writeFile(fpath, buffer);
    return NextResponse.json({ success: true, fileName, size: buffer.length, pages: blueprints.length, url: "/generated/" + fileName });
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
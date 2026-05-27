// API Route: POST /api/ai/export-pdf
// 调用 Python 脚本将生成的 VI 手册页面图片合并为 PDF
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { existsSync } from "fs";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), "_gen_pdf.py");
    if (!existsSync(scriptPath)) {
      return NextResponse.json({ error: "PDF generator script not found" }, { status: 500 });
    }

    const { stdout, stderr } = await execAsync(`python "${scriptPath}" ${projectId}`);

    if (stderr) {
      console.error("[export-pdf] stderr:", stderr);
    }

    const pdfPath = `/generated/manual-${projectId}.pdf`;
    const fullPath = path.join(process.cwd(), "public", "generated", `manual-${projectId}.pdf`);

    if (existsSync(fullPath)) {
      return NextResponse.json({
        success: true,
        url: pdfPath,
        message: stdout.trim(),
      });
    } else {
      return NextResponse.json({ error: "PDF generation failed", detail: stdout + stderr }, { status: 500 });
    }
  } catch (error) {
    console.error("[export-pdf] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

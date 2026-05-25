// API Route: POST /api/upload
// Save uploaded files to server filesystem
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    await mkdir(uploadDir, { recursive: true });

    const savedFiles: { fileName: string; url: string; size: number }[] = [];

    for (const file of files) {
      const ext = path.extname(file.name);
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 6);
      const safeName = `${timestamp}-${rand}${ext}`;
      const filePath = path.join(uploadDir, safeName);

      const bytes = await file.arrayBuffer();
      await writeFile(filePath, Buffer.from(bytes));

      savedFiles.push({
        fileName: file.name,
        url: `/uploads/${safeName}`,
        size: bytes.byteLength,
      });
    }

    return NextResponse.json({ success: true, files: savedFiles });
  } catch (error) {
    console.error("[UPLOAD] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// API Route: POST /api/upload
// Save uploaded files to Supabase Storage (Vercel-compatible).
// Local filesystem fallback for development only.
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BUCKET = "brand-brain-generated";
const STORAGE_PREFIX = "uploads/form-assets";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const isVercel = process.env.VERCEL === "1";

    const savedFiles: { fileName: string; url: string; size: number }[] = [];

    for (const file of files) {
      const ext = path.extname(file.name);
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 6);
      const safeName = `${timestamp}-${rand}${ext}`;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (isVercel) {
        // Production: upload to Supabase Storage
        const storagePath = `${STORAGE_PREFIX}/${safeName}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Supabase upload failed: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);

        savedFiles.push({
          fileName: file.name,
          url: publicUrlData.publicUrl,
          size: bytes.byteLength,
        });
      } else {
        // Development: local filesystem fallback
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, safeName);
        await writeFile(filePath, buffer);

        savedFiles.push({
          fileName: file.name,
          url: `/uploads/${safeName}`,
          size: bytes.byteLength,
        });
      }
    }

    return NextResponse.json({ success: true, files: savedFiles });
  } catch (error) {
    console.error("[UPLOAD] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

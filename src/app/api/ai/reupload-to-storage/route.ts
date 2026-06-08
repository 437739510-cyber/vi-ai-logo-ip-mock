import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, statSync, readdirSync } from "fs";
import path from "path";

// Lazy init: avoid top-level crash when env vars are missing during build
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Supabase env vars not configured" }, { status: 500 });
    }

    const { projectId, adminPassword } = await req.json();
    
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Find the PPTX file in public/generated/
    const outputDir = path.join(process.cwd(), "public", "generated");
    const files = readdirSync(outputDir).filter((f: string) => f.startsWith(`vi-manual-${projectId}`));
    
    if (files.length === 0) {
      return NextResponse.json({ error: "No PPTX found", dir: outputDir }, { status: 404 });
    }

    const fileName = files.sort().reverse()[0]; // Latest file
    const filePath = path.join(outputDir, fileName);
    const fileBuffer = readFileSync(filePath);
    const fileSize = statSync(filePath).size;
    
    console.log(`[reupload] Found ${fileName} (${(fileSize/1024/1024).toFixed(1)}MB)`);

    const supabaseAdmin = getSupabaseAdmin();

    // Upload to Supabase Storage
    const storagePath = `${projectId}/${fileName}`;
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from("manuals")
      .upload(storagePath, fileBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[reupload] Storage upload error:", uploadErr);
      return NextResponse.json({ error: uploadErr.message, details: uploadErr }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from("manuals").getPublicUrl(storagePath);
    const storageUrl = urlData?.publicUrl || null;

    // Update project client_info
    const { data: existingInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId).single();
    const prev = (existingInfo?.client_info as Record<string, any>) || {};
    const prevPptx = prev.pptxResult || {};
    
    await supabaseAdmin.from("projects").update({
      client_info: {
        ...prev,
        pptxResult: { ...prevPptx, storageUrl, downloadUrl: storageUrl || prevPptx.url },
        generationStatus: "completed",
      },
    }).eq("id", projectId);

    return NextResponse.json({ 
      success: true, 
      storageUrl, 
      fileName, 
      fileSize,
    });
  } catch (err: any) {
    console.error("[reupload] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

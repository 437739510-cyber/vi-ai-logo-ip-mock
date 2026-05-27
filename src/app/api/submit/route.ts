// API Route: POST /api/submit
// Save to Supabase + local JSON fallback
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";

const MOCK_DIR = path.join(process.cwd(), "public", "mock");

async function loadJson<T>(filePath: string): Promise<T> {
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch { return [] as unknown as T; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const projectId = `VI-${dateStr}-${rand}`;
    const submissionId = `SBM-${dateStr}-${String(Date.now()).slice(-4)}`;

    const submission = {
      id: submissionId,
      client_name: body.clientName || "",
      company_name: body.companyName || "",
      phone: body.phone || "",
      wechat: body.wechat || "",
      email: body.email || "",
      industry: body.industry || "",
      budget_range: body.budgetRange || "",
      description: body.description || "",
      logo_assets: body.logoFiles || [],
      mascot_assets: body.mascotItems || [],
      reference_manual: body.referenceFile
        ? { fileName: body.referenceFile.fileName, url: body.referenceFile.url, pageCount: 0, referenceMode: body.referenceEnabled ? "weak" : "none" }
        : null,
      submitted_at: now.toISOString(),
    };

    const project = {
      id: projectId,
      submission_id: submissionId,
      status: "submitted",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      timeline: [{ status: "submitted", timestamp: now.toISOString() }],
    };

    // 写入 Supabase
    const { error: subErr } = await supabaseAdmin.from("submissions").insert(submission);
    if (subErr) throw new Error("Supabase insert submission: " + subErr.message);

    const { error: projErr } = await supabaseAdmin.from("projects").insert(project);
    if (projErr) throw new Error("Supabase insert project: " + projErr.message);

    // 同时写本地 JSON 作为备份
    await mkdir(MOCK_DIR, { recursive: true });
    const subsPath = path.join(MOCK_DIR, "submissions.json");
    const subs = await loadJson<any[]>(subsPath);
    subs.unshift({ ...submission, clientName: submission.client_name, companyName: submission.company_name });
    await writeFile(subsPath, JSON.stringify(subs, null, 2));

    const projsPath = path.join(MOCK_DIR, "projects.json");
    const projs = await loadJson<any[]>(projsPath);
    projs.unshift(project);
    await writeFile(projsPath, JSON.stringify(projs, null, 2));

    return NextResponse.json({ success: true, projectId, submissionId });
  } catch (error) {
    console.error("[SUBMIT] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Submit failed" }, { status: 500 });
  }
}

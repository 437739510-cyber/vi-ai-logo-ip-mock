// API Route: POST /api/submit
// Save client submission + create project (server-side, uses fs/promises)
import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const MOCK_DIR = path.join(process.cwd(), "public", "mock");

async function loadJson<T>(filePath: string): Promise<T> {
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [] as unknown as T;
  }
}

export async function POST(req: NextRequest) {
  try {
    await mkdir(MOCK_DIR, { recursive: true });

    const body = await req.json();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const projectId = `VI-${dateStr}-${rand}`;
    const submissionId = `SBM-${dateStr}-${String(Date.now()).slice(-4)}`;

    const submission = {
      id: submissionId,
      clientName: body.clientName || "",
      companyName: body.companyName || "",
      phone: body.phone || "",
      wechat: body.wechat || "",
      email: body.email || "",
      industry: body.industry || "",
      budgetRange: body.budgetRange || "",
      description: body.description || "",
      logoAssets: body.logoFiles || [],
      mascotAssets: body.mascotItems || [],
      referenceManual: body.referenceFile
        ? { fileName: body.referenceFile.fileName, url: body.referenceFile.url, pageCount: 0, referenceMode: body.referenceEnabled ? "weak" : "none" }
        : undefined,
      submittedAt: now.toISOString(),
    };

    const project = {
      id: projectId,
      submissionId,
      status: "submitted",
      assignedTo: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      timeline: [{ status: "submitted", timestamp: now.toISOString() }],
    };

    // Persist to submissions.json
    const subsPath = path.join(MOCK_DIR, "submissions.json");
    const subs = await loadJson<any[]>(subsPath);
    subs.unshift(submission);
    await writeFile(subsPath, JSON.stringify(subs, null, 2), "utf-8");

    // Persist to projects.json
    const projPath = path.join(MOCK_DIR, "projects.json");
    const projs = await loadJson<any[]>(projPath);
    projs.unshift(project);
    await writeFile(projPath, JSON.stringify(projs, null, 2), "utf-8");

    console.log(`[API] Saved project: ${projectId}`);
    return NextResponse.json({ success: true, projectId });
  } catch (error) {
    console.error("[API/submit] Error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

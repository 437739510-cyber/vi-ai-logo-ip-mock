import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { guardedDeepSeekCall, DEEPSEEK_MODEL } from "@/lib/core/billing/deepseek-guard";
import {
  authorizeProjectCustomer,
  getProjectLogoCandidates,
  hasCompatibleAdminCookies,
  normalizeProjectWriteCredentials,
  resolveProjectLogoCandidate,
  type JsonRecord,
  type ProjectWriteProject,
} from "@/lib/core/project-write-auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface ScoreResult { bestIndex: number; scores: number[]; reasoning: string }

async function aiScoreLogos(logos: ReturnType<typeof getProjectLogoCandidates>, companyName: string, industry: string): Promise<ScoreResult> {
  const prompt = `你是一位品牌设计评审专家。请对以下${logos.length}个Logo方案评分。\n品牌名称：${companyName}\n行业：${industry}\nLogo方案：${logos.map((logo, i) => `\n方案${i + 1}：${logo.prompt || "无提示词"}`).join("")}\n只返回JSON：{"scores":[],"best":1,"reasoning":""}`;
  const response = await guardedDeepSeekCall({
    route: "ai/select-logo",
    body: { model: DEEPSEEK_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 200 },
    timeoutMs: 30000,
  });
  if (!response.ok) throw new Error("Logo scoring failed");
  const payload = await response.json() as JsonRecord;
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? choices[0] as JsonRecord : {};
  const message = first.message && typeof first.message === "object" ? first.message as JsonRecord : {};
  const content = typeof message.content === "string" ? message.content : "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid scoring response");
  const parsed = JSON.parse(match[0]) as JsonRecord;
  return {
    bestIndex: typeof parsed.best === "number" ? parsed.best - 1 : 0,
    scores: Array.isArray(parsed.scores) ? parsed.scores.filter((score): score is number => typeof score === "number") : [],
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody: unknown = await req.json();
    const body = rawBody && typeof rawBody === "object" ? rawBody as JsonRecord : {};
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const autoSelect = body.autoSelect === true;
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const { data, error } = await supabaseAdmin.from("projects")
      .select("id, submission_id, status, client_info").eq("id", projectId).single();
    if (error || !data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const project = data as ProjectWriteProject;
    const clientInfo = project.client_info || {};
    const isAdmin = await hasCompatibleAdminCookies(req);
    const credentials = normalizeProjectWriteCredentials(body);
    let submissionPhone: unknown = null;
    if (!isAdmin) {
      if (!credentials.phone || !credentials.viewPassword) {
        return NextResponse.json({ error: "Customer credentials required" }, { status: 401 });
      }
      if (!project.submission_id) return NextResponse.json({ error: "Project access denied" }, { status: 403 });
      const { data: submission } = await supabaseAdmin.from("submissions")
        .select("id, phone").eq("id", project.submission_id).single();
      submissionPhone = submission?.phone;
      if (!authorizeProjectCustomer(project, submissionPhone, credentials)) {
        return NextResponse.json({ error: "Project access denied" }, { status: 403 });
      }
    }
    if (autoSelect && !isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    if (project.status !== "logo_generated" || clientInfo.generationStatus !== "logo_generated") {
      return NextResponse.json({ error: "Logo is not ready for selection" }, { status: 409 });
    }

    let candidate = resolveProjectLogoCandidate(clientInfo, body.logoIndex, body.logoImageUrl);
    let selectionMethod = "manual";
    let scores: number[] = [];
    let reasoning = "";
    if (autoSelect) {
      const candidates = getProjectLogoCandidates(clientInfo);
      if (!candidates.length) return NextResponse.json({ error: "No deliverable logo candidates" }, { status: 400 });
      const result = candidates.length > 1
        ? await aiScoreLogos(candidates, typeof body.companyName === "string" ? body.companyName : "品牌", typeof body.industry === "string" ? body.industry : "通用")
        : { bestIndex: 0, scores: [], reasoning: "" };
      candidate = candidates[result.bestIndex] || null;
      selectionMethod = candidates.length > 1 ? "ai-scored" : "ai-single";
      scores = result.scores;
      reasoning = result.reasoning;
    }
    if (!candidate) return NextResponse.json({ error: "Logo candidate does not belong to this project" }, { status: 400 });

    const brandProfile = clientInfo.brandProfile && typeof clientInfo.brandProfile === "object"
      ? clientInfo.brandProfile as JsonRecord : {};
    const updatedInfo = {
      ...clientInfo,
      brandProfile: {
        ...brandProfile,
        selectedLogo: {
          imageUrl: candidate.imageUrl,
          index: candidate.index,
          selectedAt: new Date().toISOString(),
          selectionMethod,
          ...(scores.length ? { aiScores: scores, aiReasoning: reasoning } : {}),
        },
      },
      generationStatus: "pending_manual",
    };
    const { data: updated, error: updateError } = await supabaseAdmin.from("projects")
      .update({ client_info: updatedInfo, status: "manual_pending", updated_at: new Date().toISOString() })
      .eq("id", project.id)
      .eq("status", project.status)
      .eq("client_info->>generationStatus", "logo_generated")
      .select("id");
    if (updateError) return NextResponse.json({ error: "Failed to save logo selection" }, { status: 500 });
    if (!updated?.length) return NextResponse.json({ error: "Project changed; refresh and retry" }, { status: 409 });

    return NextResponse.json({ success: true, projectId, selectedIndex: candidate.index, selectedImageUrl: candidate.imageUrl, selectionMethod });
  } catch (error: unknown) {
    console.error("[select-logo] Request failed");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Logo selection failed" }, { status: 500 });
  }
}

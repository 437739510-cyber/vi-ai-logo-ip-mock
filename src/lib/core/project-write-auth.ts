import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";

export type JsonRecord = Record<string, unknown>;

export interface ProjectWriteProject {
  id: string;
  submission_id: string | null;
  status: string;
  client_info: JsonRecord | null;
}

export interface ProjectWriteCredentials {
  phone: string;
  viewPassword: string;
}

export type ProjectWriteIdentity = "admin" | "customer";

export function normalizeProjectWriteCredentials(body: JsonRecord): ProjectWriteCredentials {
  return {
    phone: typeof body.phone === "string" ? body.phone.trim() : "",
    viewPassword: typeof body.viewPassword === "string" ? body.viewPassword.trim() : "",
  };
}

export async function hasCompatibleAdminCookies(req: NextRequest): Promise<boolean> {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  return session?.role === "admin";
}

export function authorizeProjectCustomer(
  project: ProjectWriteProject,
  submissionPhone: unknown,
  credentials: ProjectWriteCredentials,
): boolean {
  const clientInfo = project.client_info || {};
  const storedPassword = typeof clientInfo.viewPassword === "string" ? clientInfo.viewPassword : "";
  return Boolean(
    project.submission_id
      && credentials.phone
      && credentials.viewPassword
      && typeof submissionPhone === "string"
      && submissionPhone.trim() === credentials.phone
      && storedPassword
      && storedPassword === credentials.viewPassword,
  );
}

export function isSafeProjectAssetUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;
    if (!hostname.endsWith(".supabase.co")) return false;
    return url.pathname.startsWith("/storage/v1/object/");
  } catch {
    return false;
  }
}

interface LogoCandidate {
  index: number;
  imageUrl: string;
  prompt?: string;
}

function readLogoCandidates(value: unknown): LogoCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as JsonRecord;
    if (typeof item.index !== "number" || !isSafeProjectAssetUrl(item.imageUrl)) return [];
    return [{
      index: item.index,
      imageUrl: item.imageUrl,
      ...(typeof item.prompt === "string" ? { prompt: item.prompt } : {}),
    }];
  });
}

export function getProjectLogoCandidates(clientInfo: JsonRecord): LogoCandidate[] {
  const brandProfile = clientInfo.brandProfile && typeof clientInfo.brandProfile === "object"
    ? clientInfo.brandProfile as JsonRecord
    : {};
  const fallback = clientInfo.logoGenerationStatus && typeof clientInfo.logoGenerationStatus === "object"
    ? clientInfo.logoGenerationStatus as JsonRecord
    : {};
  const history = Array.isArray(clientInfo.logoHistory) ? clientInfo.logoHistory : [];
  const all = [
    ...readLogoCandidates(brandProfile.logoGenerationResults),
    ...readLogoCandidates(fallback.results),
    ...history.flatMap((round) => {
      if (!round || typeof round !== "object") return [];
      return readLogoCandidates((round as JsonRecord).logos);
    }),
  ];
  return all.filter((candidate, position) =>
    all.findIndex((other) => other.index === candidate.index && other.imageUrl === candidate.imageUrl) === position,
  );
}

export function resolveProjectLogoCandidate(
  clientInfo: JsonRecord,
  logoIndex: unknown,
  assertedUrl?: unknown,
): LogoCandidate | null {
  if (typeof logoIndex !== "number" || !Number.isInteger(logoIndex) || logoIndex < 0) return null;
  const candidates = getProjectLogoCandidates(clientInfo).filter((candidate) => candidate.index === logoIndex);
  if (typeof assertedUrl === "string" && assertedUrl.trim()) {
    return candidates.find((candidate) => candidate.imageUrl === assertedUrl.trim()) || null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

export function resolveDeliverableMascotSample(clientInfo: JsonRecord, selectedSampleId: unknown): JsonRecord | null {
  if (typeof selectedSampleId !== "string" || !selectedSampleId.trim()) return null;
  const samples = Array.isArray(clientInfo.mascotSamples) ? clientInfo.mascotSamples : [];
  for (const sample of samples) {
    if (!sample || typeof sample !== "object") continue;
    const item = sample as JsonRecord;
    const vision = item.vision && typeof item.vision === "object" ? item.vision as JsonRecord : {};
    const status = typeof item.status === "string" ? item.status : "";
    const visionStatus = typeof vision.status === "string" ? vision.status : "";
    if (
      item.id === selectedSampleId.trim()
      && isSafeProjectAssetUrl(item.imageUrl)
      && ["passed", "skipped"].includes(status)
      && (!visionStatus || ["passed", "skipped"].includes(visionStatus))
    ) return item;
  }
  return null;
}

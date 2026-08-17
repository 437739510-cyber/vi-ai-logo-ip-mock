import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
  type AdminSession,
} from "@/lib/core/admin-session";

export const LEGACY_WEB_GENERATION_CLOSED_MESSAGE = "旧网页生成入口已关闭，请使用本地 Worker 队列";

interface GateRequest {
  cookies: { get(name: string): { value: string } | undefined };
}

interface GateOptions {
  legacyEnabled?: string;
  emergencyLocalGeneration?: string;
  sessionSecret?: string;
  nowSeconds?: number;
}

export type LegacyWebGenerationGateResult =
  | { allowed: true; session: AdminSession }
  | { allowed: false; status: 403; code: "LEGACY_WEB_GENERATION_DISABLED"; message: string };

export async function checkLegacyWebGenerationGate(
  request: GateRequest,
  options: GateOptions = {},
): Promise<LegacyWebGenerationGateResult> {
  const legacyEnabled = options.legacyEnabled ?? process.env.BB_LEGACY_WEB_GENERATION_ENABLED;
  const emergencyLocalGeneration = options.emergencyLocalGeneration ?? process.env.BB_EMERGENCY_LOCAL_GENERATION;
  if (legacyEnabled !== "1" || emergencyLocalGeneration !== "1") {
    return { allowed: false, status: 403, code: "LEGACY_WEB_GENERATION_DISABLED", message: LEGACY_WEB_GENERATION_CLOSED_MESSAGE };
  }
  const session = await verifyAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    { secret: options.sessionSecret, nowSeconds: options.nowSeconds },
  );
  if (session?.role !== "admin") {
    return { allowed: false, status: 403, code: "LEGACY_WEB_GENERATION_DISABLED", message: LEGACY_WEB_GENERATION_CLOSED_MESSAGE };
  }
  return { allowed: true, session };
}

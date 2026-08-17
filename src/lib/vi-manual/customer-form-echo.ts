/**
 * TICKET-087：客户查看页「我的填写资料」只读回显契约。
 *
 * 只从 projects.client_info 提取客户提交时填写的 LOGO / IP 公仔相关字段；
 * 手机号 / viewPassword / 付款状态 / 内部生成字段一律不进回显。
 */

export interface CustomerFormEcho {
  logoStyle?: string;
  logoUsage?: string;
  brandColors?: { primary?: string | null; secondary?: string | null; accent?: string | null } | null;
  logoTextLanguage?: string;
  logoFileNames: string[];
  wantMascot?: string;
  mascotTypePref?: string[];
  mascotStylePref?: string[];
  mascotPersonalityPref?: string[];
  mascotColorHint?: string;
  mascotUsageScenes?: string[];
  mascotRefIdea?: string;
  submittedAt?: string;
}

const SENSITIVE_KEYS = [
  "phone",
  "viewPassword",
  "paymentConfirmed",
  "paymentStatus",
  "generationStatus",
  "sceneMissing",
  "mascotAssets",
  "brandProfile",
  "logoGenerationResults",
  "selectedLogo",
  "viGenerationHistory",
  "pptxResult",
  "pdfResult",
  "logoHistory",
  "logoSceneExecution",
  "mascotSamples",
];

function itemFileName(item: unknown): string {
  if (!item) return "";
  if (typeof item !== "object") return String(item);
  const rec = item as Record<string, unknown>;
  const name = rec.fileName || rec.name;
  if (name) return String(name);
  const url = rec.url ? String(rec.url) : "";
  if (url) return url.split("/").pop() || "";
  return "";
}

/** 从 client_info 构建只读回显对象（仅白名单字段；无值字段不出现）。 */
export function buildCustomerFormEcho(
  clientInfo: Record<string, unknown> | null | undefined,
  submittedAt?: string | null,
): CustomerFormEcho {
  const ci = clientInfo || {};
  const logoAssets = Array.isArray(ci.logoAssets) ? ci.logoAssets : [];
  const logoFileNames = logoAssets.map(itemFileName).filter(Boolean);
  const echo: CustomerFormEcho = {
    logoFileNames,
  };
  if (ci.logoStyle) echo.logoStyle = String(ci.logoStyle);
  if (ci.logoUsage) echo.logoUsage = String(ci.logoUsage);
  if (ci.brandColors && typeof ci.brandColors === "object") {
    const bc = ci.brandColors as Record<string, unknown>;
    echo.brandColors = {
      primary: bc.primary ? String(bc.primary) : null,
      secondary: bc.secondary ? String(bc.secondary) : null,
      accent: bc.accent ? String(bc.accent) : null,
    };
  }
  if (ci.logoTextLanguage) echo.logoTextLanguage = String(ci.logoTextLanguage);
  if (ci.wantMascot) echo.wantMascot = String(ci.wantMascot);
  if (Array.isArray(ci.mascotTypePref) && ci.mascotTypePref.length) {
    echo.mascotTypePref = ci.mascotTypePref.map(String);
  }
  if (Array.isArray(ci.mascotStylePref) && ci.mascotStylePref.length) {
    echo.mascotStylePref = ci.mascotStylePref.map(String);
  }
  if (Array.isArray(ci.mascotPersonalityPref) && ci.mascotPersonalityPref.length) {
    echo.mascotPersonalityPref = ci.mascotPersonalityPref.map(String);
  }
  if (ci.mascotColorHint) echo.mascotColorHint = String(ci.mascotColorHint);
  if (Array.isArray(ci.mascotUsageScenes) && ci.mascotUsageScenes.length) {
    echo.mascotUsageScenes = ci.mascotUsageScenes.map(String);
  }
  if (ci.mascotRefIdea) echo.mascotRefIdea = String(ci.mascotRefIdea);
  const submitted = submittedAt || ci.submittedAt;
  if (submitted) echo.submittedAt = String(submitted);
  return echo;
}

/** 敏感/内部字段白名单（用于回归断言：回显绝不能包含这些键）。 */
export function isSensitiveEchoKey(key: string): boolean {
  return SENSITIVE_KEYS.includes(key);
}

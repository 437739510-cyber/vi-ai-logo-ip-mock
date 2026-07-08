import { NextRequest, NextResponse } from "next/server";

const KEYS_TO_CHECK = [
  "DEEPSEEK_API_KEY",
  "ARK_API_KEY",
  "IMAGE_PROVIDER",
  "COMFYUI_BASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NODE_ENV",
  "CRON_SECRET",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_DAILY_BUDGET",
  "ZEABUR_PROJECT_ID",
  "ZEABUR_SERVICE_ID",
];

export async function GET(req: NextRequest) {
  const auth = req.cookies.get("admin_auth")?.value;
  if (auth !== "true") {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const envStatus: Record<string, { set: boolean; prefix: string }> = {};
  for (const key of KEYS_TO_CHECK) {
    const val = process.env[key];
    envStatus[key] = {
      set: val !== undefined && val !== "",
      prefix: val ? val.substring(0, 12) + "..." : "",
    };
  }

  return NextResponse.json({ success: true, envStatus });
}
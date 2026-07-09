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

  // Test DeepSeek connectivity from Zeabur side
    let deepseekStatus = "not_tested";
    let deepseekError = "";
    const dsKey = process.env.DEEPSEEK_API_KEY;
    if (dsKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const dsRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${dsKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }], max_tokens: 5 }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        deepseekStatus = dsRes.ok ? "ok_" + dsRes.status : "fail_" + dsRes.status;
      } catch (e: any) {
        deepseekStatus = "error";
        deepseekError = e.message || String(e);
      }
    }

    return NextResponse.json({ success: true, envStatus, deepseekConnectivity: { status: deepseekStatus, error: deepseekError } });
}
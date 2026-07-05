/**
 * ARK Seedream usage logger — records image generation calls to api_usage_log
 */
import { supabaseAdmin } from "@/lib/core/supabase";

export async function logArkUsage(params: {
  route: string;
  model: string;
  imageCount: number;
  projectId?: string;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    // ARK Seedream pricing: ~¥0.20/image
    const costPerImage = 0.20;
    const cost = params.success ? costPerImage * params.imageCount : 0;

    await supabaseAdmin.from("api_usage_log").insert({
      route: params.route,
      method: "POST",
      model: params.model,
      input_tokens: 0,
      output_tokens: params.imageCount,
      cost_cny: cost,
      project_id: params.projectId || null,
      request_summary: `ARK: ${params.imageCount} images, ${params.durationMs}ms`,
      response_status: params.success ? 200 : 500,
      error_message: params.errorMessage || null,
    });
  } catch (e: any) {
    console.warn("[logArkUsage] Failed to log:", e.message);
  }
}

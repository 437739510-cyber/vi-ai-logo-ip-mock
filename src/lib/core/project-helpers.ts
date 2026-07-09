import { supabaseAdmin } from "@/lib/core/supabase";

/** Standardized project fetch — replaces repeated .from("projects").select("id, client_info").eq("id", projectId).single() */
export async function getProjectById(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, client_info")
    .eq("id", projectId)
    .single();
  return { data, error };
}

/** Extract typed client_info from project row */
export function getClientInfo(data: any): Record<string, any> {
  return (data?.client_info as Record<string, any>) || {};
}
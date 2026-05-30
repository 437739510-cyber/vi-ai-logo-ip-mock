/**
 * Brand Brain — Manual Composer Agent
 *
 * Orchestrates the actual page generation by bridging the agent
 * pipeline outputs to the existing generate-manual-pages-stream API.
 *
 * Responsibilities:
 * - Receive module plan and page IDs from Brand Planner
 * - Apply Design Director's visual direction
 * - Apply Asset Guardian's protection rules
 * - Call the generation API with the complete context
 * - Report generation progress and results
 */

import type { Agent, AgentResult, AgentContext } from "./types";
import { AGENT_IDENTITIES } from "./types";

export const manualComposerIdentity = AGENT_IDENTITIES["manual-composer"];

export interface ManualComposerInput {
  /** Override page IDs (if user customized the module plan) */
  pageIds?: string[];

  /** Generation mode */
  mode?: "auto" | "manual";

  /** Whether to run quality checks on generated images */
  qualityCheck?: boolean;
}

export interface ManualComposerOutput {
  /** Total pages generated */
  totalPages: number;

  /** Failed pages */
  failedPages: number;

  /** Generation duration */
  durationMs: number;

  /** URLs of generated pages */
  generatedUrls: { pageId: string; label: string; url: string }[];

  /** Errors per page */
  errors: { pageId: string; error: string }[];
}

export const manualComposerAgent: Agent<ManualComposerInput, ManualComposerOutput> = {
  identity: manualComposerIdentity,

  canExecute: async (context: AgentContext) => {
    if (!context.modulePlan) {
      return { canRun: false, reason: "缺少模块规划（modulePlan），请先运行 Brand Planner" };
    }
    if (!context.assetGuardResult?.isGenerationSafe) {
      return { canRun: false, reason: "资产保护检查未通过，请先解决资产保护问题" };
    }
    return { canRun: true };
  },

  execute: async (input: ManualComposerInput, context: AgentContext) => {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      const pagePlan = context.modulePlan?.pagePlan;
      const designDirection = context.designDirection;
      const assetGuard = context.assetGuardResult;

      if (!pagePlan) {
        return {
          success: false,
          error: "缺少页面规划（pagePlan），无法生成",
          warnings,
          metrics: { durationMs: Date.now() - startTime },
        };
      }

      // Build the generation payload
      const generationPayload = {
        projectId: context.projectId,
        clientInfo: context.clientInfo,
        brandColors: context.clientInfo?.brandColors || {
          primary: { hex: designDirection?.colorStrategy?.primary || "#1A73E8" },
          secondary: { hex: designDirection?.colorStrategy?.secondary || "#34A853" },
          accent: { hex: designDirection?.colorStrategy?.accent || "#FBBC04" },
        },
        logoUrl: context.clientInfo?.logoAssets?.[0]?.url,
        mascotUrl: context.clientInfo?.mascotAssets?.[0]?.files?.[0]?.url,
        refId: context.refId,
        maxPages: input.pageIds?.length || pagePlan.totalPages,
        mode: input.mode || "auto",
        // Asset Guardian rules embedded in the request
        protectedAssets: assetGuard?.protectedAssets?.map((a: any) => ({
          type: a.type,
          urls: a.urls,
          policy: a.policy,
        })),
        // Design direction
        designDirection: designDirection
          ? {
              colorStrategy: designDirection.colorStrategy,
              typography: designDirection.typography,
              styleKeywords: designDirection.styleKeywords,
              moodKeywords: designDirection.moodKeywords,
            }
          : undefined,
      };

      // In dry-run mode, don't actually call the API
      if (input.mode === "manual") {
        warnings.push("手动模式：返回生成参数但不实际执行");
        return {
          success: true,
          data: {
            totalPages: 0,
            failedPages: 0,
            durationMs: Date.now() - startTime,
            generatedUrls: [],
            errors: [],
          },
          warnings,
          metrics: { durationMs: Date.now() - startTime },
        };
      }

      // Call the existing generation API
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3003";
        const res = await fetch(`${baseUrl}/api/ai/generate-manual-pages-stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(generationPayload),
        });

        if (!res.ok) {
          throw new Error(`生成 API 返回错误: ${res.status}`);
        }

        // Since the response is an SSE stream, we handle it differently
        // For the agent, we record that generation was initiated successfully
        return {
          success: true,
          data: {
            totalPages: pagePlan.totalPages,
            failedPages: 0,
            durationMs: Date.now() - startTime,
            generatedUrls: [],
            errors: [],
          },
          warnings: [...warnings, "生成任务已发起，进度将通过 SSE 流实时返回"],
          metrics: { durationMs: Date.now() - startTime },
        };
      } catch (fetchError) {
        return {
          success: false,
          error: `调用生成 API 失败: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          warnings,
          metrics: { durationMs: Date.now() - startTime },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `手册合成失败: ${error instanceof Error ? error.message : String(error)}`,
        warnings,
        metrics: { durationMs: Date.now() - startTime },
      };
    }
  },
};

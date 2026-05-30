/**
 * Brand Brain — Brand Analyst Agent
 *
 * Wraps the existing brand-analyzer.ts and brand-dictionary.ts into
 * a standardized agent interface.
 *
 * Responsibilities:
 * - Analyze client submission data
 * - Produce structured BrandProfile (type, persona, positioning, voice, archetype)
 * - Identify brand keywords and differentiators
 * - Determine visual direction
 */

import type { Agent, AgentResult, AgentContext } from "./types";
import { AGENT_IDENTITIES } from "./types";
import { analyzeBrand } from "@/lib/brand-analyzer";

export const brandAnalystIdentity = AGENT_IDENTITIES["brand-analyst"];

export const brandAnalystAgent: Agent<any, any> = {
  identity: brandAnalystIdentity,

  canExecute: async (context: AgentContext) => {
    if (!context.clientInfo) {
      return { canRun: false, reason: "缺少客户资料（clientInfo）" };
    }
    if (!context.clientInfo.companyName && !context.clientInfo.brandVision) {
      return { canRun: false, reason: "客户资料缺少品牌名称或品牌愿景" };
    }
    return { canRun: true };
  },

  execute: async (_input: any, context: AgentContext) => {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      const profile = analyzeBrand(context.clientInfo);

      // If confidence is low, add a warning
      if (profile.confidence < 0.5) {
        warnings.push("品牌分析置信度较低，建议补充品牌信息后重新分析");
      }

      // Check if brand has logo but no logo philosophy
      if (profile.hasLogo && !context.clientInfo.logoPhilosophy) {
        warnings.push("已有 Logo 但缺少 Logo 设计理念描述，建议补充以提升分析质量");
      }

      // Check if brand has mascot but no mascot philosophy
      if (profile.hasMascot && !context.clientInfo.mascotPhilosophy) {
        warnings.push("已有 IP 公仔但缺少 IP 设计理念描述，建议补充以提升分析质量");
      }

      return {
        success: true,
        data: {
          profile,
          summary: {
            brandType: profile.brandType,
            brandPersona: profile.brandPersona,
            brandPositioning: profile.brandPositioning,
            brandArchetype: profile.brandArchetype,
            brandVoice: profile.brandVoice,
            visualDirection: profile.visualDirection,
            keywordCount: profile.analysis.brandVisionKeywords.length + profile.analysis.coreValueKeywords.length,
          },
        },
        warnings,
        metrics: {
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `品牌分析失败: ${error instanceof Error ? error.message : String(error)}`,
        warnings,
        metrics: { durationMs: Date.now() - startTime },
      };
    }
  },
};

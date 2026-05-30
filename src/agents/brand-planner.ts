/**
 * Brand Brain — Brand Planner Agent
 *
 * Wraps the existing module-planner.ts and module-to-page.ts into
 * a standardized agent interface.
 *
 * Responsibilities:
 * - Take BrandProfile from Brand Analyst
 * - Generate recommended modules with scores
 * - Convert modules to page generation plan
 * - Estimate total pages and resource consumption
 */

import type { Agent, AgentResult, AgentContext } from "./types";
import { AGENT_IDENTITIES } from "./types";
import { planModules } from "@/lib/module-planner";
import { modulePlanToPages } from "@/lib/module-to-page";

export const brandPlannerIdentity = AGENT_IDENTITIES["brand-planner"];

export const brandPlannerAgent: Agent<any, any> = {
  identity: brandPlannerIdentity,

  canExecute: async (context: AgentContext) => {
    if (!context.brandProfile) {
      return { canRun: false, reason: "缺少品牌画像（brandProfile），请先运行 Brand Analyst" };
    }
    return { canRun: true };
  },

  execute: async (_input: any, context: AgentContext) => {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      const profile = context.brandProfile;
      const modulePlan = planModules(profile);
      const pagePlan = modulePlanToPages(modulePlan);

      // Calculate resource estimates
      const essentialCount = modulePlan.modules.filter((m) => m.priority === "essential").length;
      const recommendedCount = modulePlan.modules.filter((m) => m.priority === "recommended").length;

      if (pagePlan.totalPages < 8) {
        warnings.push("预估页数偏少（< 8页），建议增加模块以完善手册内容");
      }
      if (pagePlan.totalPages > 30) {
        warnings.push("预估页数偏多（> 30页），建议减少模块以控制生成成本");
      }

      return {
        success: true,
        data: {
          modulePlan,
          pagePlan,
          summary: {
            essentialModules: essentialCount,
            recommendedModules: recommendedCount,
            totalPages: pagePlan.totalPages,
            pageIds: pagePlan.pageIds,
            pageLabels: pagePlan.pageLabels,
          },
          resourceEstimate: {
            estimatedApiCalls: pagePlan.totalPages,
            estimatedTimeMinutes: Math.ceil(pagePlan.totalPages * 0.8),
            estimatedCost: "待计算",
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
        error: `品牌规划失败: ${error instanceof Error ? error.message : String(error)}`,
        warnings,
        metrics: { durationMs: Date.now() - startTime },
      };
    }
  },
};

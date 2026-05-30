/**
 * Brand Brain — Asset Guardian Agent
 *
 * Wraps the existing asset-guardian.ts into a standardized agent interface.
 *
 * Responsibilities:
 * - Extract protected assets (Logo, IP) from client info
 * - Scan AI prompts for prohibited references to protected assets
 * - Generate negative prompts to prevent AI from mimicking brand assets
 * - Enforce the ProtectedAssetPolicy for each asset
 * - Block generation requests that violate protection rules
 */

import type { Agent, AgentResult, AgentContext } from "./types";
import { AGENT_IDENTITIES } from "./types";
import {
  extractProtectedAssets,
  scanPromptForProtectedAssets,
  generateAssetProtectionNegativePrompt,
  type ProtectedAsset,
  type ProtectedAssetPolicy,
  DEFAULT_LOGO_POLICY,
  DEFAULT_MASCOT_POLICY,
} from "@/lib/asset-guardian";

export const assetGuardianIdentity = AGENT_IDENTITIES["asset-guardian"];

export interface AssetGuardianOutput {
  /** All protected assets found */
  protectedAssets: ProtectedAsset[];

  /** Whether the generation request passes all protection checks */
  isGenerationSafe: boolean;

  /** Negative prompt to append to AI image generation calls */
  negativePrompt: string;

  /** SVG safety markers to embed in generated pages */
  svgSafetyMarkers: string;

  /** Policy violations found (if any) */
  violations: string[];

  /** Suggestions for safe generation */
  safeGenerationGuidelines: string[];
}

export const assetGuardianAgent: Agent<any, AssetGuardianOutput> = {
  identity: assetGuardianIdentity,

  canExecute: async (context: AgentContext) => {
    if (!context.clientInfo) {
      return { canRun: false, reason: "缺少客户资料" };
    }
    return { canRun: true };
  },

  execute: async (input: any, context: AgentContext) => {
    const startTime = Date.now();
    const warnings: string[] = [];
    const violations: string[] = [];

    try {
      // Step 1: Extract all protected assets
      const protectedAssets = extractProtectedAssets(context.clientInfo);

      // Step 2: Check if any prompts are being passed in (from Design Director or elsewhere)
      const promptToCheck = input?.backgroundPrompt || input?.generationPrompt || "";

      if (promptToCheck) {
        const promptCheck = scanPromptForProtectedAssets(promptToCheck, protectedAssets);
        if (promptCheck.hasProhibitedContent) {
          violations.push(...promptCheck.modifications);
          warnings.push("⚠️ 检测到生成提示词中包含了受保护品牌资产的引用");
        }
      }

      // Step 3: Generate negative prompt for AI image generation
      const negativePrompt = generateAssetProtectionNegativePrompt(protectedAssets);

      // Step 4: Build SVG safety markers
      const svgSafetyMarkers = protectedAssets
        .map((asset) => {
          if (asset.type === "logo") {
            return `<!-- PROTECTED: ${asset.label} — 仅允许缩放/移动/排版，禁止AI重绘/改色/重新设计 -->`;
          }
          if (asset.type === "mascot") {
            return `<!-- PROTECTED: ${asset.label} — 仅允许缩放/移动/透明度调整，禁止AI重绘/改表情/改材质 -->`;
          }
          return "";
        })
        .join("\n");

      // Step 5: Generate safe generation guidelines
      const safeGenerationGuidelines = protectedAssets.map((asset) => {
        const allowed: string[] = [];
        const denied: string[] = [];
        if (asset.policy.allowScale) allowed.push("缩放");
        if (asset.policy.allowMove) allowed.push("移动位置");
        if (asset.policy.allowOpacity) allowed.push("透明度调整");
        if (!asset.policy.allowRedraw) denied.push("AI重绘");
        if (!asset.policy.allowColorChange) denied.push("改色");
        if (!asset.policy.allowMaterialChange) denied.push("改材质");
        return `${asset.label}：允许${allowed.join("、")}，禁止${denied.join("、")}`;
      });

      // Add warnings if no protected assets found
      if (protectedAssets.length === 0) {
        warnings.push("未检测到受保护品牌资产（Logo 或 IP）");
      } else {
        warnings.push(`已保护 ${protectedAssets.length} 个品牌资产`);
      }

      // If no logo but the brand has one, check if it was provided
      if ((context.clientInfo?.logoAssets?.length || 0) > 0 && !protectedAssets.some((a) => a.type === "logo")) {
        warnings.push("检测到 Logo 文件但未能正确提取，请检查文件路径");
      }

      const result: AssetGuardianOutput = {
        protectedAssets,
        isGenerationSafe: violations.length === 0,
        negativePrompt,
        svgSafetyMarkers,
        violations,
        safeGenerationGuidelines,
      };

      return {
        success: true,
        data: result,
        warnings,
        metrics: { durationMs: Date.now() - startTime },
      };
    } catch (error) {
      return {
        success: false,
        error: `资产保护检查失败: ${error instanceof Error ? error.message : String(error)}`,
        warnings,
        metrics: { durationMs: Date.now() - startTime },
      };
    }
  },
};

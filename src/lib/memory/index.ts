/**
 * Brand Brain — Memory System Index
 *
 * Convenience exports + initialization helper.
 * Adapter selection controlled by NEXT_PUBLIC_MEMORY_ADAPTER.
 *
 * Valid values:
 *   "json"     → JsonMemoryAdapter (default, for local development)
 *   "supabase" → SupabaseMemoryAdapter (for production)
 *
 * No auto mode. Explicit selection required for production.
 */

export { JsonMemoryAdapter } from "./json-adapter";
export { SupabaseMemoryAdapter } from "./supabase-adapter";
export { generateClientId } from "./client-id";
export type { MemoryAdapter, ClientMemory, IndustryMemory, ProjectMemory, BrainResultSnapshot, MemoryIndex } from "./types";

import { JsonMemoryAdapter } from "./json-adapter";
import { SupabaseMemoryAdapter } from "./supabase-adapter";
import { getAllIndustryProfiles, getSubCategories } from "../industry-knowledge";
import type { IndustryMemory, MemoryAdapter } from "./types";

let _instance: MemoryAdapter | null = null;

/**
 * Get the memory adapter based on NEXT_PUBLIC_MEMORY_ADAPTER.
 *
 * "json"     → JsonMemoryAdapter (default)
 * "supabase" → SupabaseMemoryAdapter
 *
 * @throws Error if NEXT_PUBLIC_MEMORY_ADAPTER is set to an unrecognized value
 */
export function getMemoryAdapter(): MemoryAdapter {
  if (_instance) return _instance;

  const adapterType = process.env.NEXT_PUBLIC_MEMORY_ADAPTER || "json";

  switch (adapterType) {
    case "json":
      _instance = new JsonMemoryAdapter();
      break;
    case "supabase":
      _instance = new SupabaseMemoryAdapter();
      break;
    default:
      throw new Error(
        `Unknown NEXT_PUBLIC_MEMORY_ADAPTER value: "${adapterType}". ` +
        `Valid values: "json" (local dev), "supabase" (production).`
      );
  }

  return _instance;
}

/**
 * Initialize the memory system with pre-loaded industry knowledge.
 * Call once on server startup.
 */
export async function initializeMemorySystem(): Promise<void> {
  const adapter = getMemoryAdapter();
  await adapter.initialize();

  // Pre-load industry knowledge from existing industry-knowledge.ts
  const existingIndustries = await adapter.getAllIndustries();
  if (existingIndustries.length === 0) {
    const profiles = getAllIndustryProfiles();
    for (const profile of profiles) {
      const subCats = getSubCategories(profile.category);
      const industry: IndustryMemory = {
        industryKey: profile.category,
        category: profile.category,
        designStyle: profile.designStyle,
        colorTendency: profile.colorTendency,
        typographyStyle: profile.typographyStyle,
        commonModules: profile.typicalModules,
        typicalPageRange: profile.recommendedPageRange,
        typicalScenes: [],
        sampleBrands: profile.sampleBrands,
        visualKeywords: profile.visualKeywords,
        source: "initial_knowledge",
        confidence: 0.8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectCount: 0,
      };
      await adapter.saveIndustry(industry);

      // Also save sub-categories
      for (const sub of subCats) {
        const subIndustry: IndustryMemory = {
          ...industry,
          industryKey: `${profile.category}/${sub}`,
          subCategory: sub,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await adapter.saveIndustry(subIndustry);
      }
    }
  }
}

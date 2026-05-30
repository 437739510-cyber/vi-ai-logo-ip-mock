/**
 * Brand Brain — Memory System Index
 *
 * Convenience exports + initialization helper.
 */

export { JsonMemoryAdapter, getMemoryAdapter } from "./json-adapter";
export type { MemoryAdapter, ClientMemory, IndustryMemory, ProjectMemory, BrainResultSnapshot, MemoryIndex } from "./types";

import { getMemoryAdapter } from "./json-adapter";
import { getAllIndustryProfiles, getSubCategories } from "../industry-knowledge";
import type { IndustryMemory } from "./types";

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

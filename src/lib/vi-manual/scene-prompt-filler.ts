/**
 * fillScenePrompts — Pure string replacement function.
 *
 * Replaces {{DNA}} placeholder in scene templates with the extracted brand DNA content.
 * No AI calls, no external dependencies. Safe to import anywhere.
 */

export interface SceneAtlasEntry {
  template_en: string;
}

/**
 * Fill scene prompts by replacing {{DNA}} with the extracted DNA content.
 *
 * @param dnaContent - The logo_pure_prompt.positive_en string
 * @param sceneAtlas - The scene_atlas object from extractBrandDNA
 * @param checkedMaterials - List of material keys the customer selected
 * @returns Record mapping material key to final ComfyUI prompt string
 */
export function fillScenePrompts(
  dnaContent: string,
  sceneAtlas: Record<string, SceneAtlasEntry>,
  checkedMaterials: string[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const material of checkedMaterials) {
    const entry = sceneAtlas[material];
    if (!entry) {
      console.warn(`[fillScenePrompts] Material "${material}" not found in scene_atlas, skipping`);
      continue;
    }
    result[material] = entry.template_en.replace("{{DNA}}", dnaContent);
  }

  return result;
}

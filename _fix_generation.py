source = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\components\admin\GenerationPanel.tsx'
with open(source, 'r', encoding='utf-8') as f:
    c = f.read()

old_func = '''  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Call the AI generation API (uses DeepSeek if key is set, or returns mock data)
      const res = await fetch("/api/ai/generate-scheme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, referenceMode }),
      });
      const schemes = await res.json();
      if (Array.isArray(schemes) && schemes.length > 0) {
        // Save generated plans to server-side runtime file
        const plansWithId = schemes.map((s: any, i: number) => ({
          id: `PLAN-${Date.now()}-${i}`,
          projectId,
          styleLabel: s.styleLabel || s.style_label || "Style " + (i + 1),
          thumbnailUrl: "",
          previewUrls: { cover: "", colorPage: "", fontPage: "", appPage: "" },
          referenceUsed: referenceMode !== "none",
          referenceMode,
          isFavorited: false,
          generatedAt: new Date().toISOString(),
        }));
        await fetch("/api/ai/save-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plans: plansWithId }),
        });
        setPlans(plansWithId);
      } else {
        // Fallback: read from mock data
        const result = await getPlansByProject(projectId);
        setPlans(result);
      }
    } catch {
      const result = await getPlansByProject(projectId);
      setPlans(result);
    } finally {
      setHasGenerated(true);
      setIsGenerating(false);
    }
  };'''

new_func = '''  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Step 1: Call the real AI generation API (uses DeepSeek if key is set, or auto-falls back to mock)
      const res = await fetch("/api/ai/generate-scheme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, referenceMode }),
      });
      const schemes = await res.json();

      if (Array.isArray(schemes) && schemes.length > 0) {
        // Step 2: Map API response to AiGenerationPlan format
        const plansWithId = schemes.map((s: any, i: number) => ({
          id: `PLAN-${Date.now()}-${i}`,
          projectId,
          styleLabel: s.styleLabel || "Style " + (i + 1),
          thumbnailUrl: "",
          previewUrls: { cover: "", colorPage: "", fontPage: "", appPage: "" },
          referenceUsed: referenceMode !== "none",
          referenceMode,
          isFavorited: false,
          generatedAt: new Date().toISOString(),
        }));

        // Step 3: Persist plans via save-plans API
        await fetch("/api/ai/save-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plans: plansWithId }),
        });

        setPlans(plansWithId);
      } else {
        // Fallback: read from mock data
        const fallback = await getPlansByProject(projectId);
        setPlans(fallback);
      }
    } catch {
      const fallback = await getPlansByProject(projectId);
      setPlans(fallback);
    } finally {
      setHasGenerated(true);
      setIsGenerating(false);
    }
  };'''

c = c.replace(old_func, new_func)

with open(source, 'w', encoding='utf-8') as f:
    f.write(c)
print('Updated GenerationPanel.tsx')

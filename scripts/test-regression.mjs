import { generateMascotPromptSet, verifyMascotPromptSet } from "../src/lib/ip/mascot-prompt-strategy.js";

const mascotProfile = {
  suggestedName: "Test",
  suggestedType: "animal",
  personality: ["friendly"],
  visualTraits: ["modern"],
  colorDirection: ["green"],
  usageScenarios: ["social"],
};

const brandProfile = {
  industry: "test",
  visualDirection: "warm_friendly",
};

function test(mode, label) {
  const result = generateMascotPromptSet({
    mascotProfile: { ...mascotProfile, mode },
    brandProfile,
  });
  const issues = verifyMascotPromptSet(result);
  const hasImagePrompt = result.imagePrompt !== null && result.imagePrompt !== undefined;
  const ok = issues.length === 0;
  const status = ok ? "PASS" : "FAIL";
  console.log(status + ": " + label);
  console.log("  imagePrompt: " + (hasImagePrompt ? result.imagePrompt.substring(0, 60) + "..." : "null"));
  if (!ok) issues.forEach(i => console.log("  Issue: " + i));
}

test("create_new", "create_new must output imagePrompt");
test("protect_existing", "protect_existing should NOT output imagePrompt");
test("not_needed", "not_needed should NOT output imagePrompt");
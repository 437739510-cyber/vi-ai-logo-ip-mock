/**
 * ARK Seedream fallback — called when Z-Image Turbo fails.
 * Inline implementation to avoid circular dependency.
 * API: https://ark.cn-beijing.volces.com/api/v3/images/generations
 * Cost: ~¥0.20-0.25/image
 */

const ARK_API_KEY = process.env.ARK_API_KEY || "ark-aafd941e-2055-4b37-b5fb-2f759216aec4-04e90";
const ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const ARK_MODEL = "doubao-seedream-4-5-251128";

interface ArkResult { imageUrl: string; cost: number; model: string; }

export async function arkGenerate(prompt: string, negativePrompt: string, width: number, height: number): Promise<ArkResult> {
  const body: any = {
    model: ARK_MODEL,
    prompt,
    size: `${width}x${height}`,
    response_format: "b64_json",
    watermark: false,
  };
  if (negativePrompt) body.negative_prompt = negativePrompt;

  const resp = await fetch(ARK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`ARK API ${resp.status}: ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("ARK returned no image data");

  return {
    imageUrl: "data:image/png;base64," + b64,
    cost: 0.25,
    model: ARK_MODEL,
  };
}

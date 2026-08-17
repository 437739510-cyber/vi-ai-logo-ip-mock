import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

const routePath = "src/app/api/ai/generate-mascot/route.ts";
const source = readFileSync(routePath, "utf8");
let assertions = 0;

function check(value: unknown, message: string): asserts value {
  assert.ok(value, message);
  assertions += 1;
}

function equal<T>(actual: T, expected: T, message: string) {
  assert.equal(actual, expected, message);
  assertions += 1;
}

function present(pattern: RegExp, text: string, message: string) {
  assert.match(text, pattern, message);
  assertions += 1;
}

function absent(pattern: RegExp, text: string, message: string) {
  assert.doesNotMatch(text, pattern, message);
  assertions += 1;
}

async function main() {
  absent(/LiblibAIProvider|generateViaLiblibAI|LIBLIBAI_(?:ACCESS|SECRET|API)_KEY|liblibai-star3/i, source, "LiblibAI dependency and calls removed");
  absent(/estimateArkCost|arkGenerate|ARK_API_(?:KEY|URL)|ARK_MODELS|MASCOT_ARK_PAID|ark-seedream|fallback\s+ark/i, source, "ARK dependency, key, models and paid switch removed");
  absent(/Authorization:\s*["']Bearer|api\/v3\/images\/generations/, source, "direct paid HTTP path removed");
  absent(/free-tier|paid fallback|付费回退|回退到付费/i, source, "misleading fallback comments removed");

  const genStart = source.indexOf("async function genOne");
  const genEnd = source.indexOf("function styleSuffix", genStart);
  check(genStart >= 0 && genEnd > genStart, "genOne source boundary exists");
  const genOneSource = source.slice(genStart, genEnd);
  present(/isLocalAvailable\(\)/, genOneSource, "genOne checks local availability");
  present(/generateLocal\(/, genOneSource, "genOne invokes only injected/default local generator");
  present(/downloadLocalImage\(/, genOneSource, "genOne processes local result");
  present(/uploadLocalAsset\(/, genOneSource, "genOne uploads local result");
  present(/return \{ url: null, cost: 0, model: null \}/, genOneSource, "genOne fails closed with zero cost and null model");
  absent(/Liblib|ARK|Ark|arkGenerate|fetch\s*\(|process\.env/, genOneSource, "genOne has no second provider, network or environment fallback");

  const postStart = source.indexOf("export async function POST");
  const postSource = source.slice(postStart);
  const gateIndex = postSource.indexOf("await checkLegacyWebGenerationGate(req)");
  check(gateIndex >= 0, "B1 gate remains in POST");
  for (const marker of ["req.json()", "supabaseAdmin", "performGeneration("]) {
    check(gateIndex < postSource.indexOf(marker), `B1 gate remains before ${marker}`);
  }
  present(/if \(!gate\.allowed\) return NextResponse\.json/, postSource.slice(0, postSource.indexOf("try")), "B1 rejection remains before route body");

  present(/const EMOTION_NAMES = Object\.keys\(EMOTION_MAP\)/, source, "emotion asset plan remains");
  present(/const SCENE_NAMES = Object\.keys\(SCENE_MAP\)/, source, "scene asset plan remains");
  present(/Number\(prefs\.mascotSceneCount\) \|\| MASCOT_SCENES_MIN/, source, "existing requested scene count remains");
  present(/Math\.min\(Math\.max\(requestedSceneCount, MASCOT_SCENES_MIN\), SCENE_NAMES\.length\)/, source, "existing scene count bounds remain");
  present(/jobs\.push\(\{ fn: "mascot-emotion-"/, source, "emotion jobs remain");
  present(/jobs\.push\(\{ fn: "mascot-scene-"/, source, "scene jobs remain");
  present(/mascotStatus: "mascot_generating"/, source, "existing generating status remains");
  present(/mascotStatus = threeViewsOk \? "mascot_generated" : "mascot_failed"/, source, "existing final status contract remains");
  present(/generateMascotPromptSet/, source, "existing prompt strategy remains");

  const oldWarn = console.warn;
  console.warn = () => undefined;
  try {
    type LocalDeps = {
      isLocalAvailable: () => Promise<boolean>;
      generateLocal: (input: { width: number; height: number }) => Promise<{ imageUrl?: string | null }>;
      downloadLocalImage: (url: string) => Promise<Buffer | null>;
      uploadLocalAsset: (projectId: string, fileName: string, buffer: Buffer) => Promise<string | null>;
    };
    type GenOne = (
      projectId: string,
      fileName: string,
      prompt: string,
      negativePrompt: string,
      size: string,
      deps: LocalDeps,
    ) => Promise<{ url: string | null; cost: number; model: string | null }>;
    const executable = transpileModule(source.slice(source.indexOf("interface MascotLocalDeps"), genEnd), {
      compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.CommonJS },
    }).outputText;
    const genOne = new Function("Buffer", `${executable}\nreturn genOne;`)(Buffer) as GenOne;

    async function runCase(options: {
      available?: boolean;
      generation?: "throw" | "empty" | "success";
      download?: "throw" | "empty" | "success";
      upload?: "throw" | "empty" | "success";
    }) {
      const calls = { available: 0, generate: 0, download: 0, upload: 0 };
      const result = await genOne("offline-project", "mascot.png", "offline prompt", "offline negative", "768x512", {
        isLocalAvailable: async () => { calls.available += 1; return options.available ?? true; },
        generateLocal: async (input: { width: number; height: number }) => {
          calls.generate += 1;
          equal(input.width, 768, "local width is preserved");
          equal(input.height, 512, "local height is preserved");
          if (options.generation === "throw") throw new Error("local generation failed");
          return { imageUrl: options.generation === "empty" ? null : "data:image/png;base64,AQID" };
        },
        downloadLocalImage: async () => {
          calls.download += 1;
          if (options.download === "throw") throw new Error("local download failed");
          return options.download === "empty" ? null : Buffer.from([1, 2, 3]);
        },
        uploadLocalAsset: async () => {
          calls.upload += 1;
          if (options.upload === "throw") throw new Error("local upload failed");
          return options.upload === "empty" ? null : "https://offline.invalid/mascot.png";
        },
      });
      return { result, calls };
    }

    for (const [label, options] of [
      ["unavailable", { available: false }],
      ["generation throws", { generation: "throw" }],
      ["no image", { generation: "empty" }],
      ["download throws", { download: "throw" }],
      ["download empty", { download: "empty" }],
      ["upload throws", { upload: "throw" }],
      ["upload empty", { upload: "empty" }],
    ] as const) {
      const { result, calls } = await runCase(options);
      assert.deepEqual(result, { url: null, cost: 0, model: null }, label);
      assertions += 1;
      equal(calls.available, 1, `${label}: availability checked once`);
      check(calls.generate <= 1 && calls.download <= 1 && calls.upload <= 1, `${label}: no second provider attempt`);
    }

    const success = await runCase({ generation: "success", download: "success", upload: "success" });
    assert.deepEqual(success.result, { url: "https://offline.invalid/mascot.png", cost: 0, model: "comfyui-z-image-turbo" });
    assertions += 1;
    assert.deepEqual(success.calls, { available: 1, generate: 1, download: 1, upload: 1 });
    assertions += 1;
  } finally {
    console.warn = oldWarn;
  }

  absent(/@ts-ignore|@ts-nocheck/, source, "production route has no TypeScript suppression");
  console.log(`TICKET-081-D regression: ${assertions} assertions passed`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "081-D regression failed");
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getDefaultRegistry,
  ProviderRegistry,
  ProviderRegistryError,
  resetDefaultRegistry,
} from "../src/lib/ip/ip-image-provider/provider";
import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "../src/lib/ip/ip-image-provider/types";

const providerPath = "src/lib/ip/ip-image-provider/provider.ts";
const source = readFileSync(providerPath, "utf8");
let assertions = 0;

function check(value: unknown, message: string): asserts value {
  assert.ok(value, message);
  assertions += 1;
}

function equal<T>(actual: T, expected: T, message: string) {
  assert.equal(actual, expected, message);
  assertions += 1;
}

function expectRegistryError(fn: () => unknown, code: ProviderRegistryError["code"], label: string) {
  assert.throws(fn, (error: unknown) => error instanceof ProviderRegistryError && error.code === code, label);
  assertions += 1;
}

function registeredNames(): string[] {
  const registry = getDefaultRegistry();
  return ["comfyui", "ark-seedream", "liblibai", "mock"].filter((name) => registry.get(name));
}

function setConfig(
  imageProvider: string | undefined,
  globalPaid?: string,
  arkPaid?: string,
  liblibPaid?: string,
  nodeEnv = "test",
) {
  resetDefaultRegistry();
  if (imageProvider === undefined) delete process.env.IMAGE_PROVIDER; else process.env.IMAGE_PROVIDER = imageProvider;
  if (globalPaid === undefined) delete process.env.BB_PAID_IMAGE_PROVIDERS_ENABLED; else process.env.BB_PAID_IMAGE_PROVIDERS_ENABLED = globalPaid;
  if (arkPaid === undefined) delete process.env.BB_ARK_IMAGE_PROVIDER_ENABLED; else process.env.BB_ARK_IMAGE_PROVIDER_ENABLED = arkPaid;
  if (liblibPaid === undefined) delete process.env.BB_LIBLIBAI_IMAGE_PROVIDER_ENABLED; else process.env.BB_LIBLIBAI_IMAGE_PROVIDER_ENABLED = liblibPaid;
  Reflect.set(process.env, "NODE_ENV", nodeEnv);
}

class FakeProvider implements ImageProvider {
  calls = 0;

  constructor(public readonly name: string, private readonly available: boolean) {}

  async isAvailable(): Promise<boolean> {
    this.calls += 1;
    return this.available;
  }

  async generateImage(_params: GenerateImageParams): Promise<GenerateImageResult> {
    throw new Error("generation must not run in registry regression");
  }

  async generateVariant(_params: GenerateImageParams): Promise<GenerateImageResult> {
    throw new Error("generation must not run in registry regression");
  }
}

async function main() {
  const trackedEnv = [
    "IMAGE_PROVIDER",
    "BB_PAID_IMAGE_PROVIDERS_ENABLED",
    "BB_ARK_IMAGE_PROVIDER_ENABLED",
    "BB_LIBLIBAI_IMAGE_PROVIDER_ENABLED",
    "NODE_ENV",
  ] as const;
  const originals = Object.fromEntries(trackedEnv.map((name) => [name, process.env[name]]));
  const originalLog = console.log;
  console.log = () => undefined;

  try {
    setConfig(undefined);
    assert.deepEqual(registeredNames(), ["comfyui"]);
    assertions += 1;
    setConfig("comfyui");
    assert.deepEqual(registeredNames(), ["comfyui"]);
    assertions += 1;

    for (const selected of ["ark", "liblibai"] as const) {
      const providerGate = selected === "ark" ? "ark" : "liblib";
      for (const [globalPaid, specificPaid, caseName] of [
        [undefined, undefined, "no switches"],
        ["1", undefined, "global only"],
        [undefined, "1", "specific only"],
        ["0", "1", "global zero"],
        ["true", "1", "global true"],
        ["1", "0", "specific zero"],
        ["1", "true", "specific true"],
        ["", "1", "global empty"],
        ["1", "", "specific empty"],
      ] as const) {
        setConfig(selected, globalPaid, providerGate === "ark" ? specificPaid : undefined, providerGate === "liblib" ? specificPaid : undefined);
        expectRegistryError(() => getDefaultRegistry(), "PAID_IMAGE_PROVIDER_DISABLED", `${selected}: ${caseName}`);
      }
    }

    setConfig("ark", "1", "1");
    assert.deepEqual(registeredNames(), ["ark-seedream"]);
    assertions += 1;
    setConfig("liblibai", "1", undefined, "1");
    assert.deepEqual(registeredNames(), ["liblibai"]);
    assertions += 1;

    setConfig("mock", undefined, undefined, undefined, "development");
    assert.deepEqual(registeredNames(), ["mock"]);
    assertions += 1;
    setConfig("mock", undefined, undefined, undefined, "production");
    expectRegistryError(() => getDefaultRegistry(), "MOCK_IMAGE_PROVIDER_DISABLED", "production Mock is disabled");

    for (const unknown of ["", "ARK", "unknown", " comfyui", "comfyui "]) {
      setConfig(unknown);
      expectRegistryError(() => getDefaultRegistry(), "UNKNOWN_IMAGE_PROVIDER", `unknown provider rejected: ${JSON.stringify(unknown)}`);
    }

    const empty = new ProviderRegistry();
    await assert.rejects(empty.getActive(), (error: unknown) => error instanceof ProviderRegistryError && error.code === "NO_IMAGE_PROVIDER_AVAILABLE");
    assertions += 1;
    equal(empty.get("mock"), undefined, "empty registry does not create Mock");

    const unavailableRegistry = new ProviderRegistry();
    const unavailable = new FakeProvider("offline-local", false);
    unavailableRegistry.register(unavailable, 10);
    await assert.rejects(unavailableRegistry.getActive(), (error: unknown) => error instanceof ProviderRegistryError && error.code === "NO_IMAGE_PROVIDER_AVAILABLE");
    assertions += 1;
    equal(unavailable.calls, 1, "registered unavailable provider is checked once");
    equal(unavailableRegistry.get("mock"), undefined, "unavailable registry does not add Mock");

    const priorityRegistry = new ProviderRegistry();
    const low = new FakeProvider("low", true);
    const high = new FakeProvider("high", true);
    priorityRegistry.register(low, 1);
    priorityRegistry.register(high, 10);
    equal((await priorityRegistry.getActive()).name, "high", "register priority controls active provider order");
    equal(low.calls, 0, "lower priority provider is not probed after higher priority succeeds");
    equal(high.calls, 1, "higher priority provider is probed once");

    const getActiveSource = source.slice(source.indexOf("async getActive()"), source.indexOf("async listAvailable()"));
    check(!/MockProvider|providers\.set\(["']mock/.test(getActiveSource), "getActive has no on-demand Mock fallback");
    check(/NO_IMAGE_PROVIDER_AVAILABLE/.test(source), "explicit no-provider error is present");
    check(/PAID_IMAGE_PROVIDER_DISABLED/.test(source), "explicit paid-provider error is present");
    check(/MOCK_IMAGE_PROVIDER_DISABLED/.test(source), "explicit production Mock error is present");
    check(!/PRIORITY_MAP|\|\| PRIORITY_MAP\.comfyui/.test(source), "unknown provider no longer falls back to default chain");
    check(!/@ts-ignore|@ts-nocheck/.test(source), "no TypeScript suppression added");
  } finally {
    resetDefaultRegistry();
    console.log = originalLog;
    for (const name of trackedEnv) {
      const original = originals[name];
      if (original === undefined) delete process.env[name]; else Reflect.set(process.env, name, original);
    }
  }

  console.log(`TICKET-081-B regression: ${assertions} assertions passed`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "081-B regression failed");
  process.exitCode = 1;
});

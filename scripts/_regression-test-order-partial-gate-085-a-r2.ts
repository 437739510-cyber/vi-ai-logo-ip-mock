/**
 * TICKET-085-A-R2 聚焦回归：A 类营销场景测试单降级通道。
 *
 * 断言：
 * 1) 测试单缺 A 类 → 放行（ready=true），marketing-* 进入 missing 且 reason=pending_074；
 * 2) 正式单（未开启降级选项）缺 A 类 → 仍被安全门拦截（needs_review）；
 * 3) 3 张非 A 类场景齐全 + 测试单 → 全量放行且 missing 只有未就绪的 marketing 槽位；
 * 4) 5 张齐全 → 全量放行（测试单与正式单均无 missing）；
 * 5) 测试单中已就绪的 marketing 槽位不会被误标 pending_074。
 */
import {
  evaluateLogoSceneDeliveryGate,
  type LogoSceneRequestLike,
} from "../src/lib/vi-manual/logo-scene-compositor";

let passCount = 0;
let failCount = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passCount += 1;
    console.log(`PASS ${name}`);
  } else {
    failCount += 1;
    console.log(`FAIL ${name} ${detail}`);
  }
}

const ALL_KEYS = ["stationery-1", "packaging-1", "packaging-2", "marketing-storefront", "marketing-1"];

function buildRequests(overrides: Record<string, Partial<LogoSceneRequestLike>> = {}): LogoSceneRequestLike[] {
  return ALL_KEYS.map((key) => ({
    key,
    routeStatus: key.startsWith("marketing-") ? "candidate_074" : "ready",
    strategy: key.startsWith("marketing-") ? "reference_anchor" : "composite",
    logoPlacement: {
      strategy: key.startsWith("marketing-") ? "reference_anchor" : "composite",
    },
    ...(overrides[key] || {}),
  }));
}

function sceneImagesFor(readyKeys: string[]): Record<string, string> {
  return Object.fromEntries(readyKeys.map((key) => [key, `data:image/png;base64,${key}`]));
}

function sceneVisionFor(readyKeys: string[]): Record<string, string> {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, readyKeys.includes(key) ? "passed" : "failed"]));
}

function main(): void {
  const nonMarketingKeys = ALL_KEYS.filter((key) => !key.startsWith("marketing-"));

  // 1) 测试单缺 A 类 → 放行，missing=pending_074
  const testOrderMissingA = evaluateLogoSceneDeliveryGate(
    {
      requiredKeys: ALL_KEYS,
      sceneImages: sceneImagesFor(nonMarketingKeys),
      sceneVision: sceneVisionFor(nonMarketingKeys),
      requests: buildRequests(),
    },
    { allowMissingMarketingOnlyForTestOrder: true },
  );
  check("测试单缺 A 类 → ready=true", testOrderMissingA.ready === true, `ready=${testOrderMissingA.ready}`);
  check(
    "测试单缺 A 类 → marketing-storefront missing=pending_074",
    testOrderMissingA.missing.some((m) => m.key === "marketing-storefront" && m.reason === "pending_074"),
    JSON.stringify(testOrderMissingA.missing),
  );
  check(
    "测试单缺 A 类 → marketing-1 missing=pending_074",
    testOrderMissingA.missing.some((m) => m.key === "marketing-1" && m.reason === "pending_074"),
    JSON.stringify(testOrderMissingA.missing),
  );
  check(
    "测试单缺 A 类 → 无 blockers（放行）",
    testOrderMissingA.blockers.length === 0,
    JSON.stringify(testOrderMissingA.blockers),
  );
  check(
    "测试单缺 A 类 → message 明示降级通道",
    testOrderMissingA.message.includes("测试单降级通道启用") && testOrderMissingA.message.includes("pending_074"),
    testOrderMissingA.message,
  );

  // 2) 正式单（不传选项）缺 A 类 → 仍拦截
  const normalMissingA = evaluateLogoSceneDeliveryGate({
    requiredKeys: ALL_KEYS,
    sceneImages: sceneImagesFor(nonMarketingKeys),
    sceneVision: sceneVisionFor(nonMarketingKeys),
    requests: buildRequests(),
  });
  check("正式单缺 A 类 → ready=false", normalMissingA.ready === false, `ready=${normalMissingA.ready}`);
  check(
    "正式单缺 A 类 → status=needs_review",
    normalMissingA.status === "needs_review",
    normalMissingA.status,
  );
  check(
    "正式单缺 A 类 → marketing-storefront 仍在 blockers",
    normalMissingA.blockers.some((b) => b.key === "marketing-storefront"),
    JSON.stringify(normalMissingA.blockers),
  );
  check(
    "正式单缺 A 类 → marketing-1 仍在 blockers",
    normalMissingA.blockers.some((b) => b.key === "marketing-1"),
    JSON.stringify(normalMissingA.blockers),
  );
  check("正式单缺 A 类 → missing 为空（不引入降级语义）", normalMissingA.missing.length === 0, JSON.stringify(normalMissingA.missing));

  // 3) 3 张非 A 类齐全 + 测试单 → 放行
  const testThreeReady = evaluateLogoSceneDeliveryGate(
    {
      requiredKeys: ALL_KEYS,
      sceneImages: sceneImagesFor(nonMarketingKeys),
      sceneVision: sceneVisionFor(nonMarketingKeys),
      requests: buildRequests(),
    },
    { allowMissingMarketingOnlyForTestOrder: true },
  );
  check("测试单 3 张齐全 → ready=true（全量放行）", testThreeReady.ready === true, `ready=${testThreeReady.ready}`);
  check(
    "测试单 3 张齐全 → missing 仅含未就绪 marketing 槽位",
    testThreeReady.missing.length === 2 && testThreeReady.missing.every((m) => m.reason === "pending_074"),
    JSON.stringify(testThreeReady.missing),
  );

  // 4) 5 张齐全 → 测试单与正式单均全量放行、无 missing
  for (const [label, options] of [
    ["测试单", { allowMissingMarketingOnlyForTestOrder: true }],
    ["正式单", undefined],
  ] as const) {
    const allReady = evaluateLogoSceneDeliveryGate(
      {
        requiredKeys: ALL_KEYS,
        sceneImages: sceneImagesFor(ALL_KEYS),
        sceneVision: sceneVisionFor(ALL_KEYS),
        requests: buildRequests(
          Object.fromEntries(ALL_KEYS.filter((k) => k.startsWith("marketing-")).map((k) => [k, { routeStatus: "ready" }])),
        ),
      },
      options,
    );
    check(`${label} 5 张齐全 → ready=true`, allReady.ready === true, `ready=${allReady.ready}`);
    check(`${label} 5 张齐全 → missing 为空`, allReady.missing.length === 0, JSON.stringify(allReady.missing));
  }

  // 5) 测试单中 marketing-1 已就绪 → 只把未就绪的 marketing-storefront 标 pending_074
  const marketingOneReady = evaluateLogoSceneDeliveryGate(
    {
      requiredKeys: ALL_KEYS,
      sceneImages: sceneImagesFor([...nonMarketingKeys, "marketing-1"]),
      sceneVision: sceneVisionFor([...nonMarketingKeys, "marketing-1"]),
      requests: buildRequests({ "marketing-1": { routeStatus: "ready" } }),
    },
    { allowMissingMarketingOnlyForTestOrder: true },
  );
  check("测试单 marketing-1 已就绪 → ready=true", marketingOneReady.ready === true, `ready=${marketingOneReady.ready}`);
  check(
    "测试单 marketing-1 已就绪 → 仅 marketing-storefront 标 pending_074",
    marketingOneReady.missing.length === 1 &&
      marketingOneReady.missing[0].key === "marketing-storefront" &&
      marketingOneReady.missing[0].reason === "pending_074",
    JSON.stringify(marketingOneReady.missing),
  );

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();

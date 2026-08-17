/**
 * TICKET-086 聚焦回归：人类女神 IP「萃瑶」契约 + 照片链路 env 接线。
 *
 * 断言：
 * 1) 075 简报：输入「人类/女神/萃瑶/Pixar 3D/玫瑰金/治愈温柔专业」→
 *    roleType=character、identity 含人类成年女性/女神、visualStyle 含 Pixar、
 *    personality 含治愈/温柔/专业、colors 含玫瑰金；
 * 2) 076 资产计划：views=3、emotions=6（086-R4 由 8 改 6）、scenes=4（固定 4 场景）；
 * 3) validateMascotAssets：name=萃瑶 且视图/表情/场景齐全 → ready、
 *    missing=[]；缺场景 → 不 ready 且 missing 列出场景项；
 * 4) 照片链路：worker.mjs 的 runPhotoSceneVisionCheck 调用点把
 *    VISION_COARSE_MODEL / VISION_FINE_MODEL 透传为 coarseModel/fineModel；
 *    runPhotoSceneVisionCheck 默认值不变（qwen2.5vl:3b / my-vl），
 *    传入覆盖值后返回值中 coarseModel/fineModel 同步（无需 Ollama）；
 * 5) 无写死：worker.mjs / logo-scene-compositor.ts / render-pptx.ts 与
 *    本回归都不含品牌名「百疗萃养生馆」或公仔名「萃瑶」字面量。
 */
import { readFileSync } from "node:fs";
import {
  buildMascotDesignBrief,
  buildMascotFullAssetPlan,
} from "../src/lib/vi-manual/mascot-design-brief";
import { validateMascotAssets } from "../src/lib/vi-manual/mascot-assets";
import { runPhotoSceneVisionCheck } from "../src/lib/vision-check";

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

const repoRoot = new URL("../", import.meta.url);
const workerSrc = readFileSync(new URL("scripts/worker.mjs", repoRoot), "utf8");
const compositorSrc = readFileSync(new URL("src/lib/vi-manual/logo-scene-compositor.ts", repoRoot), "utf8");
const renderSrc = readFileSync(new URL("src/lib/pptx/render-pptx.ts", repoRoot), "utf8");

async function main(): Promise<void> {
  // 1) 075 简报契约（萃瑶输入）
  const brief = buildMascotDesignBrief({
    companyName: "百疗萃养生馆",
    industry: "美业",
    brandPersonality: "温暖专业",
    brandProfile: {
      colorPalette: [{ name: "玫瑰金", hex: "#E8C4A0" }],
    },
    mascotTypePref: ["character", "人类女性"],
    mascotRefIdea: "温婉女神「萃瑶」，治愈系人类女神，玫瑰金长袍与饰品",
    mascotStylePref: ["pixar_3d"],
    mascotPersonalityPref: ["治愈", "温柔", "专业"],
    mascotColorHint: "玫瑰金 rose gold（#E8C4A0 #D4AF7A #B76E79）",
    mascotUsageScenes: ["门店迎宾", "会员服务", "产品包装", "社媒传播"],
  });
  check("简报 roleType=character（人类）", brief.roleType === "character", brief.roleType);
  check(
    "简报 identity 为人类女神（含人类成年女性/女神）",
    /人类成年女性/.test(brief.identity) && /女神|goddess/i.test(brief.identity),
    brief.identity,
  );
  check("简报 visualStyle 含 Pixar 3D", /pixar/i.test(brief.visualStyle) && /3d/i.test(brief.visualStyle), brief.visualStyle);
  check(
    "简报 personality 含 治愈/温柔/专业",
    brief.personality.some((p) => p.includes("治愈")) &&
      brief.personality.some((p) => p.includes("温柔")) &&
      brief.personality.some((p) => p.includes("专业")),
    brief.personality.join(","),
  );
  check(
    "简报 colors 含玫瑰金",
    brief.colors.some((c) => /玫瑰金|rose ?gold/i.test(c)),
    brief.colors.join(","),
  );
  check("简报 identityRestrictions 禁止非人/兽角", brief.identityRestrictions.some((r) => /non-human|horn|兽|鹿/i.test(r)), brief.identityRestrictions.join(","));

  // 2) 076 资产计划：3 视图 + 8 表情 + 固定 4 场景
  const plan = buildMascotFullAssetPlan({ brief, styleAnchor: "温婉女神 玫瑰金长袍" });
  check("资产计划 views=3", plan.views.length === 3, String(plan.views.length));
  check("资产计划 emotions=6（086-R4 契约）", plan.emotions.length === 6, String(plan.emotions.length));
  check("资产计划 scenes=4（固定四场景）", plan.scenes.length === 4, String(plan.scenes.length));
  check("资产计划 total=13（086-R4 契约）", plan.counts.total === 13, String(plan.counts.total));
  check(
    "资产计划提示词含女神身份与玫瑰金色系",
    plan.views[0].prompt.includes("human goddess") && /rose gold|玫瑰金/i.test(plan.views[0].prompt),
    plan.views[0].prompt.slice(0, 200),
  );

  // 3) validateMascotAssets：萃瑶完整集 ready / 缺场景不 ready
  const complete = validateMascotAssets({
    assets: {
      name: "萃瑶",
      front: "data:image/png;base64,AAAA",
      side: "data:image/png;base64,AAAA",
      back: "data:image/png;base64,AAAA",
      emotions: Array.from({ length: 8 }, (_, i) => ({ name: `emotion-${i}`, url: `data:image/png;base64,AAAA${i}` })),
      scenes: Array.from({ length: 4 }, (_, i) => ({ name: `scene-${i}`, url: `data:image/png;base64,BBBB${i}` })),
    },
  });
  check("萃瑶完整资产 validateMascotAssets ready", complete.ready === true, JSON.stringify(complete.missing));
  check("萃瑶完整资产 missing=[]", complete.missing.length === 0, JSON.stringify(complete.missing));

  const incomplete = validateMascotAssets({
    assets: {
      name: "萃瑶",
      front: "data:image/png;base64,AAAA",
      side: "data:image/png;base64,AAAA",
      back: "data:image/png;base64,AAAA",
      emotions: Array.from({ length: 8 }, (_, i) => ({ name: `emotion-${i}`, url: `data:image/png;base64,AAAA${i}` })),
      scenes: [{ name: "scene-0", url: "data:image/png;base64,BBBB" }],
    },
  });
  check("缺场景 → 不 ready", incomplete.ready === false, `ready=${incomplete.ready}`);
  check(
    "缺场景 → missing 列出场景项",
    incomplete.missing.some((m) => /scene/i.test(m)),
    JSON.stringify(incomplete.missing),
  );

  // 4) 照片链路 env 接线（静态 + 动态）
  const callSite = workerSrc.match(/runPhotoSceneVisionCheck\(\{[\s\S]{0,220}?\}\)/);
  check("worker 调用点存在", !!callSite, "no call site");
  check(
    "worker 调用点透传 coarseModel: VISION_COARSE_MODEL",
    !!callSite && callSite[0].includes("coarseModel: VISION_COARSE_MODEL"),
    callSite ? callSite[0] : "missing",
  );
  check(
    "worker 调用点透传 fineModel: VISION_FINE_MODEL",
    !!callSite && callSite[0].includes("fineModel: VISION_FINE_MODEL"),
    callSite ? callSite[0] : "missing",
  );

  const defaultBase = await runPhotoSceneVisionCheck({
    imageBase64: "data:image/png;base64,AAAA",
    expectedText: "",
    mode: "chinese",
  });
  check("runPhotoSceneVisionCheck 默认 coarse=qwen2.5vl:3b", defaultBase.coarseModel === "qwen2.5vl:3b", defaultBase.coarseModel);
  check("runPhotoSceneVisionCheck 默认 fine=my-vl", defaultBase.fineModel === "my-vl", defaultBase.fineModel);
  const overrideBase = await runPhotoSceneVisionCheck({
    imageBase64: "data:image/png;base64,AAAA",
    expectedText: "",
    mode: "chinese",
    coarseModel: "qwen2.5vl:latest",
    fineModel: "qwen2.5vl:latest",
  });
  check(
    "runPhotoSceneVisionCheck 覆盖值生效（qwen2.5vl:latest）",
    overrideBase.coarseModel === "qwen2.5vl:latest" && overrideBase.fineModel === "qwen2.5vl:latest",
    `${overrideBase.coarseModel}/${overrideBase.fineModel}`,
  );
  check(
    "expectedText 为空 → skipped（不触发 Ollama）",
    overrideBase.status === "skipped" && overrideBase.reason === "expected_text_unavailable",
    `${overrideBase.status}/${overrideBase.reason}`,
  );

  // 5) 无写死品牌名/公仔名（平台代码与本回归均不含字面量）
  const forbidden = ["百疗萃养生馆", "萃瑶"];
  check(
    "worker.mjs 无写死品牌名/公仔名",
    forbidden.every((value) => !workerSrc.includes(value)),
    forbidden.filter((value) => workerSrc.includes(value)).join(","),
  );
  check(
    "compositor 无写死品牌名/公仔名",
    forbidden.every((value) => !compositorSrc.includes(value)),
    forbidden.filter((value) => compositorSrc.includes(value)).join(","),
  );
  check(
    "render-pptx 无写死品牌名/公仔名",
    forbidden.every((value) => !renderSrc.includes(value)),
    forbidden.filter((value) => renderSrc.includes(value)).join(","),
  );

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL " + (err instanceof Error ? err.message : String(err)));
  process.exit(2);
});

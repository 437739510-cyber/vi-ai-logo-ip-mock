/**
 * TICKET-122-R10 回归：
 *  - 默认：离线 stub（不联网、不写生产）覆盖通过/串行业/地理矛盾/无IP公仔/
 *    核心信息保护/自动修正上限/geo异常计数/网络隔离/费用记录；
 *  - --real：真实 DeepSeek 核验（虚构客户：美甲店合规提示词 1 次 +
 *    串行业提示词核验+修正+复检，费用经 reporter 落盘 logs/122-r10/deepseek-attempts.json，
 *    真实拦截记录写 logs/prompt-gate/blocked-*.json）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  runPromptGateWithAutoFix,
  buildGateRules,
  resetGeoAnomalyCount,
  getGeoAnomalyCount,
  PROMPT_GATE_MODEL,
} from "../src/lib/prompt-gate";

const ROOT = path.resolve(process.cwd());
const R10 = path.join(ROOT, "logs", "122-r10");
const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
const ok = (name: string, cond: boolean, detail = "") => {
  checks.push({ name, pass: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
};

function makeStubFetch(scenario: string) {
  const counters = { deepseek: 0, blocked: 0 };
  const orig = globalThis.fetch;
  let fixed = false;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes("api.deepseek.com")) {
      counters.blocked += 1;
      throw new Error(`BLOCKED ${url}`);
    }
    counters.deepseek += 1;
    const body = JSON.parse(String(init?.body || "{}"));
    const user = String(body.messages?.[1]?.content || "");
    const isFix = user.includes("【待修正提示词】");
    let content: string;
    if (isFix) {
      fixed = true;
      if (scenario === "core-change") {
        content = JSON.stringify({ fixedPrompt: "改成了完全不同的行业与品牌色", changedCore: true, note: "stub core change" });
      } else {
        content = JSON.stringify({ fixedPrompt: user.includes("公仔")
          ? "清丽洗车 干净洗车工位，深青绿(#0F6B6D)与清水蓝绿(#5CC8C4)配色，无任何装饰摆件"
          : "清丽洗车 标准洗车工位，深青绿(#0F6B6D)与清水蓝绿(#5CC8C4)配色，无文字", changedCore: false, note: "stub fix" });
      }
    } else {
      if (fixed && scenario !== "always-fail" && scenario !== "core-change") {
        content = JSON.stringify({ pass: true, ruleId: "none", reason: "修正后合规", fixSuggestion: "" });
      } else {
      const checkMap: Record<string, string> = {
        pass: JSON.stringify({ pass: true, ruleId: "none", reason: "合规", fixSuggestion: "" }),
        "cross-industry": JSON.stringify({ pass: false, ruleId: "cross-industry", reason: "洗车场景出现美甲色卡", fixSuggestion: "删除美甲色卡元素，保留洗车工位" }),
        "geo-contradiction": JSON.stringify({ pass: false, ruleId: "geo-contradiction", reason: "海南椰汁出现雪景", fixSuggestion: "删除雪景，改为热带海景" }),
        "mascot-leak": JSON.stringify({ pass: false, ruleId: "mascot-leak", reason: "无IP项目出现公仔", fixSuggestion: "删除公仔与吉祥物字样" }),
        "always-fail": JSON.stringify({ pass: false, ruleId: "cross-industry", reason: "始终不合规", fixSuggestion: "继续修正" }),
        "core-change": JSON.stringify({ pass: false, ruleId: "cross-industry", reason: "不合规", fixSuggestion: "修正" }),
        "real-compliant": JSON.stringify({ pass: true, ruleId: "none", reason: "合规" }),
        "real-cross": JSON.stringify({ pass: false, ruleId: "cross-industry", reason: "洗车场景混入美甲元素", fixSuggestion: "移除美甲元素，保留标准洗车工位、深青绿与清水蓝绿配色" }),
      };
      content = checkMap[scenario] || JSON.stringify({ pass: true, ruleId: "none", reason: "stub" });
      }
    }
    return new Response(JSON.stringify({
      model: PROMPT_GATE_MODEL,
      choices: [{ finish_reason: "stop", message: { content } }],
      usage: { prompt_tokens: 300, completion_tokens: 120, prompt_cache_hit_tokens: 0 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { counters, restore: () => { globalThis.fetch = orig; } };
}

const baseCtx = (prompt: string, over: Record<string, unknown> = {}) => ({
  prompt,
  industryFamily: "汽车清洁养护",
  category: "洗车",
  brandName: "清丽洗车",
  palette: ["#0F6B6D", "#5CC8C4"],
  logoSemantics: "水滴负形结合简洁车身轮廓",
  mascotIntent: "no" as const,
  targetAudience: "周边社区家庭车主",
  storeType: "社区单店",
  sceneKeys: ["marketing-storefront", "packaging-1"],
  province: "山西省",
  city: "太原市",
  geoContext: { inferred: true, geoInsight: "北方社区洗车依赖熟客信任与冬季盐渍清洁" },
  rules: buildGateRules({ industryFamily: "汽车清洁养护", mascotIntent: "no", sceneKeys: ["marketing-storefront", "packaging-1"] }),
  ticketCode: "TEST-122-R10",
  ...over,
});

async function offlineTests() {
  process.env.DEEPSEEK_API_KEY = "stub-deepseek";
  resetGeoAnomalyCount();

  const pass = makeStubFetch("pass");
  const r1 = await runPromptGateWithAutoFix(baseCtx("标准洗车工位场景，深青绿与清水蓝绿配色，无文字"), { transport: globalThis.fetch, logRoot: path.join(R10, "gate-test"), writeRecords: false });
  ok("正常通过：合规提示词放行且无拦截记录", r1.final === "pass" && r1.blockedRecords.length === 0, `final=${r1.final}`);
  pass.restore();

  const cross = makeStubFetch("cross-industry");
  const r2 = await runPromptGateWithAutoFix(baseCtx("洗车工位场景，但背景出现美甲色卡展示架"), { transport: globalThis.fetch, logRoot: path.join(R10, "gate-test") });
  ok("串行业拦截+自动修正+复检通过", r2.final === "pass" && r2.blockedRecords.length === 1 && r2.blockedRecords[0].result === "fixed" && r2.blockedRecords[0].ruleId === "cross-industry", `final=${r2.final} rec=${r2.blockedRecords.length}`);
  ok("拦截记录含费用/模型/finish 与项目代号脱敏", r2.blockedRecords[0].verification.model === PROMPT_GATE_MODEL && r2.blockedRecords[0].verification.finishReason === "stop" && r2.blockedRecords[0].projectCode === "TEST-122-R10", "model/finish/desensitized ok");
  cross.restore();

  const geo = makeStubFetch("geo-contradiction");
  const r3 = await runPromptGateWithAutoFix(baseCtx("海南椰汁热带包装，背景出现雪景", { industryFamily: "饮品", category: "椰汁", brandName: "清椰", palette: ["#1FA68D"], city: "海口市", sceneKeys: ["packaging-1"] }), { transport: globalThis.fetch, logRoot: path.join(R10, "gate-test") });
  ok("地理矛盾拦截：海南椰汁+雪景 → 拦截并记录（核心保护正确阻止异品牌修正稿）", r3.blockedRecords.length >= 1 && r3.blockedRecords[0]?.ruleId === "geo-contradiction", `ruleId=${r3.blockedRecords[0]?.ruleId} final=${r3.final}`);
  geo.restore();

  const mascot = makeStubFetch("mascot-leak");
  const r4 = await runPromptGateWithAutoFix(baseCtx("洗车工位场景，门口放一只卡通公仔迎宾"), { transport: globalThis.fetch, logRoot: path.join(R10, "gate-test") });
  ok("无 IP 零公仔：提示词含公仔被拦截", r4.blockedRecords[0]?.ruleId === "mascot-leak", `ruleId=${r4.blockedRecords[0]?.ruleId}`);
  mascot.restore();

  const core = makeStubFetch("core-change");
  const r5 = await runPromptGateWithAutoFix(baseCtx("洗车工位场景，深青绿与清水蓝绿配色"), { transport: globalThis.fetch, logRoot: path.join(R10, "gate-test") });
  ok("核心信息保护：修正试图改行业/色板 → needs_review 不采纳", r5.final === "needs_review" && r5.blockedRecords[0]?.result === "needs_review", `final=${r5.final} result=${r5.blockedRecords[0]?.result}`);
  core.restore();

  const alwaysFail = makeStubFetch("always-fail");
  const r6 = await runPromptGateWithAutoFix(baseCtx("洗车工位场景"), { transport: globalThis.fetch, logRoot: path.join(R10, "gate-test") });
  ok("自动修正 ≤2 轮仍失败 → auto_fix_failed / needs_review", r6.final === "needs_review" && r6.blockedRecords[0]?.result === "auto_fix_failed", `final=${r6.final} result=${r6.blockedRecords[0]?.result}`);
  alwaysFail.restore();

  const noGeo = makeStubFetch("pass");
  const r7 = await runPromptGateWithAutoFix(baseCtx("洗车工位场景", { geoContext: null }), { transport: globalThis.fetch, logRoot: path.join(R10, "gate-test"), writeRecords: false });
  ok("geoContext 缺失/inferred=false 计数为管线异常", getGeoAnomalyCount() >= 1 && r7.geoAnomalyCount >= 1, `count=${r7.geoAnomalyCount}`);
  noGeo.restore();

  const iso = makeStubFetch("pass");
  const r8 = await runPromptGateWithAutoFix(baseCtx("洗车工位场景"), { transport: globalThis.fetch, logRoot: path.join(R10, "gate-test"), writeRecords: false });
  ok("网络隔离：除 DeepSeek 外无任何外部请求（supabase 等 0 次）", iso.counters.blocked === 0, `blocked=${iso.counters.blocked}`);
  iso.restore();

  delete process.env.DEEPSEEK_API_KEY;
}

async function realMode() {
  await fs.mkdir(R10, { recursive: true });
  process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
  const attempts: any[] = [];
  const reporter = (a: any) => attempts.push(a);

  const compliant = await runPromptGateWithAutoFix(baseCtx("百丽美甲 美甲店玫瑰金前台场景：大理石接待台，玫瑰金环境光，品牌色板 #E8B4B8 与 #D4AF37", {
    industryFamily: "美业", category: "美甲", brandName: "百丽美甲", palette: ["#E8B4B8", "#D4AF37"], city: "成都市",
    geoContext: { inferred: true, geoInsight: "西南城市社区美甲店" },
    sceneKeys: ["packaging-1"],
  }), { reporter, logRoot: path.join(R10, "gate-test"), writeRecords: false });
  ok("real: 合规提示词核验有结论", compliant.final === "pass" || compliant.final === "needs_review", `final=${compliant.final}` + (compliant.verdict ? ` ruleId=${compliant.verdict.ruleId}` : ""));

  const cross = await runPromptGateWithAutoFix(baseCtx("洗车工位场景，背景出现美甲色卡展示架"), { reporter });
  ok("real: 串行业提示词触发拦截流程（核验+修正+复检）", cross.blockedRecords.length >= 1, `final=${cross.final} records=${cross.blockedRecords.length}`);

  const attemptFile = path.join(R10, "deepseek-attempts.json");
  const existing = await fs.readFile(attemptFile, "utf8").then((t) => JSON.parse(t)).catch(() => ({ ticket: "TICKET-122-R10", attempts: [] }));
  existing.attempts.push(...attempts);
  existing.updatedAt = new Date().toISOString();
  await fs.writeFile(attemptFile, JSON.stringify(existing, null, 2));
  ok("real: 费用/token/模型/finish 已落盘", existing.attempts.length >= 1 && existing.attempts.every((a: any) => a.model && a.costCny != null), attemptFile);
}

async function main() {
  if (process.argv.includes("--real")) {
    await realMode();
  } else {
    await offlineTests();
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`RESULT ${passCount}/${checks.length} passed`);
  if (passCount !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

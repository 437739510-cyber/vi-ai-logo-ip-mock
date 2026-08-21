/**
 * TICKET-122-R14：prompt_gate_blocks 真实表写入冒烟（虚构项目 TEST-122-R14）。
 * 流程：insert 一行（脱敏字段）→ 回读校验（字段完整、无客户原文/密钥）→ delete 清理。
 * 已获 Chris 授权；不写入真实客户数据；失败不阻塞（记录结果）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeBlock } from "../src/lib/prompt-gate/admin-reader";
import { upsertPromptGateBlock, readPromptGateBlocksFromTable } from "../src/lib/prompt-gate/upsert";

const ROOT = path.resolve(process.cwd());
const R14 = path.join(ROOT, "logs", "122-r14");
const PROJECT_CODE = "TEST-122-R14";

async function main() {
  await fs.mkdir(R14, { recursive: true });
  const view = sanitizeBlock({
    ticket: PROJECT_CODE,
    blockedAt: new Date().toISOString(),
    ruleId: "cross-industry",
    industryFamily: "汽车清洁养护",
    projectCode: PROJECT_CODE,
    promptPreview: "洗车工位场景，背景出现美甲色卡展示架（测试）",
    beforePrompt: "客户提示词原文（不应进表）",
    result: "needs_review",
    verification: { costCny: 0.001, tokens: { prompt: 100, completion: 50 }, model: "deepseek-v4-flash", finishReason: "stop" },
    status: "待核验",
    geoInferredFalse: false,
  } as unknown as Record<string, unknown>);

  const result: any = { at: new Date().toISOString(), projectCode: PROJECT_CODE };
  const up = await upsertPromptGateBlock(view);
  result.upsert = up;
  if (!up.ok) {
    await fs.writeFile(path.join(R14, "upsert-real-smoke.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  result.insertedId = up.id;

  const rows = await readPromptGateBlocksFromTable();
  const mine = rows.filter((r) => r.ticketCode === PROJECT_CODE);
  result.readBack = mine.map((r) => ({ ticketCode: r.ticketCode, ruleId: r.ruleId, industryFamily: r.industryFamily, promptPreview: r.promptPreview, result: r.result, status: r.status }));
  result.readBackOk = mine.length >= 1 && mine.every((r) => !r.promptPreview.includes("原文") && r.ruleId === "cross-industry");

  // 清理：删除本次冒烟行（不污染生产表）
  const { supabaseAdmin } = await import("../src/lib/core/supabase");
  const del = await supabaseAdmin.from("prompt_gate_blocks").delete().eq("project_code", PROJECT_CODE);
  result.cleanup = { ok: !del.error, error: del.error?.message || null };

  await fs.writeFile(path.join(R14, "upsert-real-smoke.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.readBackOk || !result.cleanup.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

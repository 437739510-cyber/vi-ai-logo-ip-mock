/**
 * 工单 049 回归：ComfyUI 生成中挂死修复（无进度主动断开 / API 不可达 /
 * 生成中健康探测守卫 / 不死磕 / 样稿 status 写入口径）。
 *
 * 离线运行（不依赖真实 ComfyUI/Ollama/网络）：
 *   node node_modules/tsx/dist/cli.mjs scripts/_regression-vi-midgen-049.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import fs from "node:fs";
import { filterMascotSamples } from "../src/lib/vi-manual/customer-logo-filter";
import { runLogoBatchFlow } from "./_logo-batch.mjs";

// ========== 本地 ComfyUI stub ==========
let mode: "unreachable" | "no_progress" | "success" | "success_obj" = "unreachable";
let historyCalls = 0;
let lastPromptId = "";
const server = http.createServer((req, res) => {
  const url = req.url || "";
  if (req.method === "POST" && url.startsWith("/prompt")) {
    lastPromptId = "p-test";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ prompt_id: lastPromptId }));
    return;
  }
  if (req.method === "POST" && url.startsWith("/interrupt")) {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  if (url.startsWith("/history/")) {
    if (mode === "success" || mode === "success_obj") {
      historyCalls += 1;
      if (historyCalls < 3) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          [lastPromptId]: {
            status: { completed: true, status_str: "success" },
            outputs: { "13": { images: [{ filename: "out.png" }] } },
          },
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
    return;
  }
  if (url.startsWith("/queue")) {
    if (mode === "success") {
      // ComfyUI 0.26+ 真实格式：queue_running 条目是数组 [number, prompt_id, prompt, extra, outputs]
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          queue_running: [[1, lastPromptId, {}, { create_time: Date.now() }, ["13"]]],
          queue_pending: [],
        })
      );
      return;
    }
    if (mode === "success_obj") {
      // 旧版对象格式（向后兼容）
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ queue_running: [{ prompt_id: lastPromptId }], queue_pending: [] }));
      return;
    }
    if (mode === "unreachable") {
      res.writeHead(500);
      res.end("boom");
      return;
    }
    // no_progress：prompt 已不在队列（被丢弃/崩溃）
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ queue_running: [], queue_pending: [] }));
    return;
  }
  if (url.startsWith("/view")) {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]));
    return;
  }
  res.writeHead(200);
  res.end();
});

// ========== 环境与模块加载（先起 stub，再按测试环境加载 provider/lifecycle） ==========
let provider: any;
let lifecycle: any;

before(async () => {
  const baseUrl = await new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(
        typeof addr === "object" && addr ? `http://127.0.0.1:${addr.port}` : "http://127.0.0.1:0"
      );
    });
  });
  process.env.COMFYUI_BASE_URL = baseUrl;
  process.env.COMFYUI_POLL_INTERVAL_MS = "50";
  process.env.COMFYUI_NO_PROGRESS_TIMEOUT_MS = "1500";

  provider = await import("../src/lib/ip/ip-image-provider/comfyui-provider");
  lifecycle = await import("./_comfyui-lifecycle.mjs");
});

after(() => {
  server.close();
});

test("049-1 无进度主动断开：prompt 不在队列且无输出持续 NO_PROGRESS_TIMEOUT_MS → NO_PROGRESS", async () => {
  mode = "no_progress";
  const err = await provider.comfyGenerateFromWorkflow({}).then(
    () => null,
    (e: unknown) => e
  );
  assert.ok(err instanceof provider.ComfyUIError, `expected ComfyUIError, got ${String(err)}`);
  assert.equal((err as { code?: string }).code, "NO_PROGRESS");
});

test("049-2 API 不可达：/queue 连续失败 POLL_UNREACHABLE_LIMIT 次 → COMFYUI_UNREACHABLE", async () => {
  mode = "unreachable";
  const err = await provider.comfyGenerateFromWorkflow({}).then(
    () => null,
    (e: unknown) => e
  );
  assert.ok(err instanceof provider.ComfyUIError);
  assert.equal((err as { code?: string }).code, "COMFYUI_UNREACHABLE");
});

test("049-3 正常路径不回归：队列有进度 + history 出图 → 返回 data URI", async () => {
  mode = "success";
  historyCalls = 0;
  const result = await provider.comfyGenerateFromWorkflow({});
  assert.ok(result.imageUrl.startsWith("data:image/png;base64,"));
  assert.ok(result.durationMs >= 0);
});

test("049-3b 旧版对象格式兼容：queue_running 为对象仍视为有进度", async () => {
  mode = "success_obj";
  historyCalls = 0;
  const result = await provider.comfyGenerateFromWorkflow({});
  assert.ok(result.imageUrl.startsWith("data:image/png;base64,"));
});

test("049-4 守卫透传：探测健康且 fn 成功 → 返回 fn 结果", async () => {
  const out = await lifecycle.runWithMidGenerationGuard(async () => "ok", {
    probe: async () => ({ apiOk: true, utilPct: 80, queueHasAny: true }),
    probeIntervalMs: 10,
  });
  assert.equal(out, "ok");
});

test("049-5 守卫 API 不可达 → 清理重启并抛错（stallReason=api_unreachable）", async () => {
  let probeCount = 0;
  const stalled: string[] = [];
  const err = await lifecycle
    .runWithMidGenerationGuard(() => new Promise(() => {}), {
      probe: async () => {
        probeCount += 1;
        return { apiOk: probeCount >= 2 ? false : true, utilPct: 0, queueHasAny: true };
      },
      onStall: async (reason: string) => {
        stalled.push(reason);
        return true;
      },
      probeIntervalMs: 10,
      apiFailProbes: 2,
      startupGraceMs: 0,
    })
    .then(
      () => null,
      (e: unknown) => e
    );
  assert.ok(err instanceof Error);
  assert.match(String((err as Error).message), /api_unreachable/);
  assert.equal(stalled.length, 1);
  assert.match(stalled[0] || "", /api_unreachable/);
});

test("049-6 守卫 GPU 卡死：队列仍在且利用率 0% 连续 zeroUtilProbes 次 → 清理重启并抛错", async () => {
  const stalled: string[] = [];
  const err = await lifecycle
    .runWithMidGenerationGuard(() => new Promise(() => {}), {
      probe: async () => ({ apiOk: true, utilPct: 0, queueHasAny: true }),
      onStall: async (reason: string) => {
        stalled.push(reason);
        return true;
      },
      probeIntervalMs: 10,
      zeroUtilProbes: 2,
      startupGraceMs: 0,
    })
    .then(
      () => null,
      (e: unknown) => e
    );
  assert.ok(err instanceof Error);
  assert.match(String((err as Error).message), /gpu_idle/);
  assert.match(stalled[0] || "", /gpu_idle/);
});

test("049-7 守卫 fn 自身抛错 → 原样抛出", async () => {
  const err = await lifecycle
    .runWithMidGenerationGuard(async () => {
      throw new Error("gen boom");
    }, {
      probe: async () => ({ apiOk: true, utilPct: 80, queueHasAny: true }),
      probeIntervalMs: 10,
    })
    .then(
      () => null,
      (e: unknown) => e
    );
  assert.ok(err instanceof Error);
  assert.match(String((err as Error).message), /gen boom/);
});

test("049-8 不死磕：单张连续失败仍继续下一张，批次不整轮卡死（maxAttempts=2）", async () => {
  let genCalls = 0;
  const { results, paused } = await runLogoBatchFlow({
    prompts: ["p1", "p2"],
    generate: async () => {
      genCalls += 1;
      throw new Error("gen fail");
    },
    check: async () => ({ status: "skipped" }),
    ensureReady: async () => true,
    isAvailable: async () => true,
    maxRounds: 1,
    maxAttempts: 2,
    retryGapMs: 0,
    label: "Midgen049",
  });
  assert.equal(results.length, 2);
  assert.ok(
    results.every((r: { imageUrl?: string | null; error?: string }) => !r.imageUrl && r.error)
  );
  assert.equal(paused, false);
  assert.equal(genCalls, 4); // 2 张 × 2 次尝试，全部处理完
});

test("049-9 样稿写入口径：vision passed 时客户视图仍展示（顶层 status=failed 不隐藏）", () => {
  const samples = [
    { id: "a", imageUrl: "https://x/a.png", status: "failed", vision: { status: "passed" } },
    { id: "b", imageUrl: "https://x/b.png", status: "needs_review", vision: { status: "needs_review" } },
  ];
  const visible = filterMascotSamples(samples).map((s) => s.id);
  assert.deepEqual(visible, ["a"]);
});

test("049-10 worker 源断言：守卫接入 + 公仔批次 2 次封顶 + status 推导写回", () => {
  const src = fs.readFileSync("scripts/worker.mjs", "utf8");
  assert.ok(src.includes("runWithMidGenerationGuard"));
  assert.ok(src.includes("withMidGenGuard('MascotSample'"));
  assert.ok(src.includes("withMidGenGuard('MascotFull'"));
  assert.ok(/maxAttempts: 2[\s\S]*?label: 'MascotSample'/.test(src));
  assert.ok(/maxAttempts: 2[\s\S]*?label: 'MascotFull'/.test(src));
  assert.ok(src.includes("status: sampleStatus"));
  assert.ok(src.includes('"needs_review"'));
});

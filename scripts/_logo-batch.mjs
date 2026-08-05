/**
 * 工单 030：Logo 批次循环编排（生成→统一校验→不合格下一轮统一重生成）。
 *
 * 纯 JS 模块，无副作用；生成/校验/健康门/日志均由调用方注入，
 * 便于离线单测（fake generate/check）与生产 worker 复用同一份逻辑。
 *
 * 返回：{ results, pending, paused }
 *  - results: 最终结果数组（index/prompt/imageUrl/error/vision/seed/model/durationMs/batchRound）
 *  - paused: 是否因 ComfyUI 不可用而暂停整个批次
 */
export async function runLogoBatchFlow(opts) {
  const {
    prompts,
    generate,      // async ({ prompt, seed }) => { imageUrl, model, durationMs, seed }
    check,         // async ({ imageBase64, prompt }) => vision result
    ensureReady,   // async () => boolean（ComfyUI 健康门）
    isAvailable,   // async () => boolean（单张前快速探测）
    log = (level, msg) => console.log(`[${level}] ${msg}`),
    gpuSnapshot = async () => '',
    maxRounds = 2,
    maxAttempts = 3,
    retryGapMs = 30_000,
  } = opts;

  const pending = prompts.map((prompt, index) => ({
    index,
    prompt,
    status: 'pending', // pending → generated → final | needs_review | failed
    imageUrl: null,
    seed: null,
    vision: null,
    error: null,
    model: null,
    durationMs: null,
    batchRound: 0,
  }));
  let consecutiveGenFailures = 0;
  let paused = false;

  for (let round = 1; round <= maxRounds; round++) {
    const todo = pending.filter((r) => r.status === 'pending');
    if (todo.length === 0) break;

    log('INFO', `[LOGO] 批次第 ${round}/${maxRounds} 轮，待生成 ${todo.length} 张（生成阶段，ComfyUI 独占，不触发 Ollama）`);
    log('INFO', `[GPU] 生成前 ${await gpuSnapshot()}`);

    const ready = await ensureReady();
    if (!ready) {
      paused = true;
      log('ERROR', '[LOGO] ComfyUI 多次重启仍不可用，暂停整个批次，等待人工处理');
      break;
    }

    for (const item of todo) {
      let attempts = 0;
      let genResult = null;
      let lastErr = null;
      while (attempts < maxAttempts && !genResult && !paused) {
        attempts++;
        const seed = Math.floor(Math.random() * 2147483647);
        try {
          if (!(await isAvailable())) {
            log('WARN', `[LOGO] ComfyUI 暂不可用，等待 5s 后重试 (round ${round}, attempt ${attempts})`);
            await new Promise((r) => setTimeout(r, 5_000));
            if (!(await isAvailable())) {
              throw new Error('ComfyUI not available before generation');
            }
          }
          log('INFO', `[LOGO] Logo ${item.index + 1}/${prompts.length} 第${round}轮 (attempt ${attempts}, seed=${seed})...`);
          genResult = await generate({ prompt: item.prompt, seed });
          consecutiveGenFailures = 0;
        } catch (err) {
          lastErr = err;
          consecutiveGenFailures++;
          log('WARN', `[LOGO] Logo ${item.index + 1} 第${round}轮 attempt ${attempts} 失败: ${err.message}`);
          if (consecutiveGenFailures >= 2) {
            log('WARN', `[LOGO] 连续 ${consecutiveGenFailures} 次生成失败，进入 ComfyUI 健康门`);
            const recovered = await ensureReady();
            if (!recovered) {
              paused = true;
              log('ERROR', '[LOGO] 健康门恢复失败，暂停批次');
              break;
            }
            consecutiveGenFailures = 0;
          }
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, retryGapMs));
          }
        }
      }
      if (paused) break;

      if (genResult) {
        item.imageUrl = genResult.imageUrl;
        item.seed = genResult.seed;
        item.model = genResult.model;
        item.durationMs = genResult.durationMs;
        item.batchRound = round;
        item.status = 'generated';
        log('INFO', `[LOGO] Logo ${item.index + 1} 第${round}轮 OK (${genResult.durationMs}ms)`);
      } else {
        item.status = 'failed';
        item.error = (lastErr && lastErr.message) || 'generate failed after max attempts';
        log('WARN', `[LOGO] Logo ${item.index + 1} 第${round}轮失败（已尝试 ${maxAttempts} 次）`);
      }
    }

    log('INFO', `[GPU] 生成后 ${await gpuSnapshot()}`);
    if (paused) break;

    // 统一校验（Ollama 校验阶段，ComfyUI 已空闲；逐张单图请求，keep_alive=0 由 vision-check 控制）
    const toCheck = todo.filter((x) => x.status === 'generated' && x.imageUrl);
    if (toCheck.length > 0) {
      log('INFO', `[VISION] 批次统一校验 ${toCheck.length} 张（Ollama 校验阶段，ComfyUI 已空闲）`);
      log('INFO', `[GPU] 校验前 ${await gpuSnapshot()}`);
      for (const item of toCheck) {
        let vision = null;
        try {
          vision = await check({ imageBase64: item.imageUrl, prompt: item.prompt });
        } catch (e) {
          vision = { status: 'skipped', reason: `vision_error: ${(e && e.message || '').slice(0, 120)}` };
        }
        item.vision = vision;
        log('INFO', `[VISION] Logo ${item.index + 1} ${vision.status}${vision.reason ? ` (${vision.reason})` : ''}`);
        if (vision.status === 'passed' || vision.status === 'skipped') {
          item.status = 'final';
        } else if (vision.status === 'suspect') {
          if (round < maxRounds) {
            item.status = 'pending'; // 下一轮统一重生成（换 seed）
            item.imageUrl = null;
            item.seed = null;
            item.vision = null;
            log('WARN', `[VISION] Logo ${item.index + 1} 校验不合格，进入下一轮统一重生成`);
          } else {
            item.status = 'needs_review';
            log('WARN', `[VISION] Logo ${item.index + 1} 重试轮后仍不合格，标记 needs_review（不静默交付）`);
          }
        }
      }
      log('INFO', `[GPU] 校验后 ${await gpuSnapshot()}`);
    }
  }

  const results = pending.map((item) => ({
    index: item.index,
    prompt: item.prompt,
    imageUrl: item.imageUrl || null,
    error: item.error || undefined,
    vision: item.vision || null,
    seed: item.seed,
    model: item.model,
    durationMs: item.durationMs,
    batchRound: item.batchRound,
  }));
  return { results, pending, paused };
}

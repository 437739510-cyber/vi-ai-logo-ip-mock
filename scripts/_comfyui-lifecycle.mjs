/**
 * 工单 030：ComfyUI 生命周期与健康门（本地 Windows）。
 *
 * - gpuSnapshot(): nvidia-smi 快照（供 worker 记录显存/进程状态）
 * - comfyuiPids() / isComfyUIProcessAlive(): 进程双检
 * - killComfyUI(): 结束残留 ComfyUI 进程
 * - startComfyUI(): 启动 ComfyUI（python312 --lowvram --reserve-vram 2 --disable-smart-memory）
 * - waitForComfyUIReady(): 轮询 /api 就绪
 * - ensureComfyUIReady(): 崩溃探测→自动重启→就绪→冷却；可注入 startFn 便于测试失败分支
 *
 * 本模块为工单 030 白名单新增文件（scripts/_comfyui-lifecycle.mjs）。
 */
import { spawn, spawnSync } from 'child_process';
import { isComfyUIAvailable } from '../src/lib/ip/ip-image-provider/comfyui-provider';

const PYTHON = 'D:\\disk\\CODEX\\python312\\python.exe';
const MAIN = 'D:\\ComfyUI-backup\\main.py';
const CWD = 'D:\\ComfyUI-backup';
const ARGS = ['--lowvram', '--reserve-vram', '2', '--disable-smart-memory'];

/** nvidia-smi 关键值快照（供日志诊断显存/进程状态）。 */
export async function gpuSnapshot() {
  try {
    const r = spawnSync(
      'nvidia-smi',
      ['--query-gpu=memory.used,memory.free,utilization.gpu', '--format=csv,noheader'],
      { encoding: 'utf8', timeout: 8000, windowsHide: true },
    );
    return (r.stdout || '').trim() || 'nvidia-smi no output';
  } catch {
    return 'nvidia-smi unavailable';
  }
}

function psScript() {
  return [
    "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" |",
    "Where-Object { $_.CommandLine -like '*main.py*' -and ($_.CommandLine -like '*ComfyUI*' -or $_.CommandLine -like '*8188*') } |",
    'Select-Object -ExpandProperty ProcessId',
  ].join(' ');
}

/** 返回正在运行 ComfyUI 的 python 进程 PID 列表（空=未运行）。 */
export function comfyuiPids() {
  try {
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript()], {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });
    if (r.status !== 0) return [];
    return (r.stdout || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

/** 进程双检：ComfyUI 的 python 进程是否存活。 */
export function isComfyUIProcessAlive() {
  return comfyuiPids().length > 0;
}

/** 结束残留 ComfyUI 进程（幂等）。 */
export function killComfyUI() {
  const pids = comfyuiPids();
  if (pids.length === 0) return;
  spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Stop-Process -Id ${pids.join(',')} -Force -ErrorAction SilentlyContinue`], {
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  });
}

/** 启动 ComfyUI（detached，隐藏窗口，不阻塞）。 */
export async function startComfyUI() {
  // 工单 047：先杀残留再单实例启动，防两个实例抢 8188 端口（假活）。
  killComfyUI();
  await new Promise((r) => setTimeout(r, 1_000));
  try {
    const child = spawn(PYTHON, [MAIN, ...ARGS], { cwd: CWD, detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** 轮询 /api 就绪（默认每 5s 一次，上限 180s；本机启动实测 90~140s）。 */
export async function waitForComfyUIReady(timeoutMs = 180_000, pollMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isComfyUIAvailable()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

/**
 * ComfyUI 健康门：
 * 1) API 可达 → 健康，直接返回 true（不杀不启）；
 * 2) API 不可达 → 3 次探测（间隔 5s）确认，期间恢复则返回 true；
 * 3) 确认异常 → 自动重启（≤2 次，间隔 20s；杀残留→启动→轮询就绪≤90s）；
 * 4) 就绪后冷却 10s 返回 true；全部失败返回 false（调用方暂停批次＋告警）。
 *
 * startFn 可注入（测试失败分支用）；log 可注入（worker 的 log 函数）。
 */
export async function ensureComfyUIReady(opts = {}) {
  const log = opts.log || ((level, msg) => console.log(`[${level}] ${msg}`));
  const probes = opts.probes ?? 3;
  const probeGapMs = opts.probeGapMs ?? 5_000;
  const restartAttempts = opts.restartAttempts ?? 2;
  const restartGapMs = opts.restartGapMs ?? 20_000;
  // 工单 047：90s→180s，匹配本机 90~140s 启动时长，避免误判后重复实例。
  const readyTimeoutMs = opts.readyTimeoutMs ?? 180_000;
  const coolMs = opts.coolMs ?? 10_000;
  const startFn = opts.startFn || startComfyUI;

  if (await isComfyUIAvailable()) return true;

  for (let i = 1; i <= probes; i++) {
    log('WARN', `[COMFYUI-HEALTH] API 不可达，探测 ${i}/${probes}`);
    await new Promise((r) => setTimeout(r, probeGapMs));
    if (await isComfyUIAvailable()) return true;
  }

  const procAlive = isComfyUIProcessAlive();
  log('WARN', `[COMFYUI-HEALTH] 确认异常（API 不可达，进程存活=${procAlive}），开始自动重启`);

  for (let attempt = 1; attempt <= restartAttempts; attempt++) {
    killComfyUI();
    await new Promise((r) => setTimeout(r, 1_500));
    const started = startFn();
    log('INFO', `[COMFYUI-HEALTH] 重启尝试 ${attempt}/${restartAttempts}（started=${started}），等待就绪...`);
    const ready = await waitForComfyUIReady(readyTimeoutMs);
    if (ready) {
      log('INFO', `[COMFYUI-HEALTH] ComfyUI 已就绪，冷却 ${coolMs}ms 后继续`);
      await new Promise((r) => setTimeout(r, coolMs));
      return true;
    }
    if (attempt < restartAttempts) {
      log('WARN', `[COMFYUI-HEALTH] 未就绪，${restartGapMs}ms 后重试`);
      await new Promise((r) => setTimeout(r, restartGapMs));
    }
  }

  log('ERROR', '[COMFYUI-HEALTH] 多次重启仍未就绪，返回失败（调用方应暂停批次并告警）');
  return false;
}

// ========== 工单 049：生成中健康探测与强清理重启 ==========

const COMFYUI_BASE = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188';

/** nvidia-smi 内存占用(MiB) 与 GPU 利用率(%)，失败返回 null。 */
export async function nvidiaSmiQuery() {
  try {
    const r = spawnSync(
      'nvidia-smi',
      ['--query-gpu=memory.used,utilization.gpu', '--format=csv,noheader,nounits'],
      { encoding: 'utf8', timeout: 8000, windowsHide: true },
    );
    const line = (r.stdout || '').trim().split(/\r?\n/)[0];
    const m = /^\s*(\d+)\s*,\s*(\d+)/.exec(line || '');
    if (!m) return null;
    return { usedMiB: Number(m[1]), utilPct: Number(m[2]) };
  } catch {
    return null;
  }
}

/** 等待 ComfyUI python 进程全部退出（上限 timeoutMs）。返回是否已清空。 */
export async function waitForComfyUIProcessExit(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (comfyuiPids().length === 0) return true;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return comfyuiPids().length === 0;
}

/**
 * 工单 084-C：等待显存回落至无 ComfyUI 负载的基线阈值（非精确归零）。
 * 本机桌面应用基线即占用约 0.8 GB 显存，精确归零（usedMiB === 0）永远不成立；
 * 改为阈值语义，参考 074 试点「回落至基线 + 512 MiB」。默认阈值 1536 MiB
 * （1.5 GB，覆盖基线约 0.8 GB 并留余量）。
 *
 * 兼容旧调用：第一个参数既可以是数字 timeoutMs（现有 waitForVramZero(60_000)），
 * 也可以是选项对象 { timeoutMs, thresholdMiB, query }；thresholdMiB 覆盖默认阈值，
 * query 可注入测试探针，默认仍用 nvidiaSmiQuery。返回是否已回落至阈值。
 */
export async function waitForVramZero(options = 60_000) {
  const config = typeof options === 'number' ? { timeoutMs: options } : (options || {});
  const timeoutMs = config.timeoutMs ?? 60_000;
  const thresholdMiB = config.thresholdMiB ?? 1536;
  const query = config.query || nvidiaSmiQuery;
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await query();
    if (last && last.usedMiB <= thresholdMiB) return true;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  if (last === null) last = await query();
  return last !== null && last.usedMiB <= thresholdMiB;
}

/**
 * 049：强清理 + 单实例重启（沿用 030/047）：
 * 杀残留 python → 等待进程退出 → nvidia-smi 复核显存归零 → 单实例启动 → 就绪 → 冷却。
 */
export async function killAndRestartComfyUI(opts = {}) {
  const log = opts.log || ((level, msg) => console.log(`[${level}] ${msg}`));
  const startFn = opts.startFn || startComfyUI;
  const readyTimeoutMs = opts.readyTimeoutMs ?? 180_000;
  const coolMs = opts.coolMs ?? 10_000;

  killComfyUI();
  const exited = await waitForComfyUIProcessExit(opts.exitTimeoutMs ?? 30_000);
  const vramZero = await waitForVramZero(opts.vramTimeoutMs ?? 60_000);
  log('WARN', `[COMFYUI-GUARD] 残留进程已退出=${exited}，显存归零=${vramZero}，开始单实例重启`);
  if (!vramZero) {
    log('WARN', '[COMFYUI-GUARD] 显存未归零（可能被其它进程占用），仍尝试重启；若反复复现请人工查 GPU');
  }

  const started = await startFn();
  log('INFO', `[COMFYUI-GUARD] 重启已发起（started=${started}），等待就绪...`);
  const ready = await waitForComfyUIReady(readyTimeoutMs);
  if (ready) await new Promise((r) => setTimeout(r, coolMs));
  return ready;
}

/**
 * 049：生成中健康探测守卫。
 * 在 fn（单张生成）执行期间周期性探测 ComfyUI：
 *   - API 连续 apiFailProbes 次不可达 → 挂死/崩溃 → 强清理重启；
 *   - 启动宽限后，队列仍持有 prompt 且 GPU 利用率连续 zeroUtilProbes 次为 0
 *     （API 可达但生成卡死）→ 强清理重启。
 * 探测失败：调用 killAndRestartComfyUI 后抛错（调用方批次重试逻辑接管「该张重试」）。
 * 探测正常且 fn 完成：返回 fn 结果。
 *
 * 测试可用 opts.probe / opts.onStall 注入（默认走真实 nvidia-smi + ComfyUI API）。
 */
export async function runWithMidGenerationGuard(fn, opts = {}) {
  const log = opts.log || ((level, msg) => console.log(`[${level}] ${msg}`));
  const probeIntervalMs = opts.probeIntervalMs ?? 20_000;
  const startupGraceMs = opts.startupGraceMs ?? 60_000;
  const apiFailProbes = opts.apiFailProbes ?? 2;
  const zeroUtilProbes = opts.zeroUtilProbes ?? 3;
  const defaultProbe = async () => {
    let apiOk = false;
    try {
      apiOk = await isComfyUIAvailable();
    } catch {
      apiOk = false;
    }
    let utilPct = null;
    const q = await nvidiaSmiQuery();
    if (q) utilPct = q.utilPct;
    let queueHasAny = false;
    try {
      const r = await fetch(`${COMFYUI_BASE}/queue`, { signal: AbortSignal.timeout(5_000) });
      if (r.ok) {
        const qd = await r.json();
        queueHasAny = ((qd?.queue_running || []).length + (qd?.queue_pending || []).length) > 0;
      }
    } catch {
      queueHasAny = false;
    }
    return { apiOk, utilPct, queueHasAny };
  };
  const probe = opts.probe || defaultProbe;
  const onStall = opts.onStall || (async (reason) => {
    log('WARN', `[COMFYUI-GUARD] 探测失败（${reason}），执行强清理重启`);
    return killAndRestartComfyUI({ log, ...(opts.restartOpts || {}) });
  });

  const startedAt = Date.now();
  let fnDone = false;
  let fnResult = null;
  let fnError = null;
  const runner = (async () => {
    try {
      fnResult = await fn();
    } catch (e) {
      fnError = e;
    }
    fnDone = true;
  })();

  let apiFails = 0;
  let zeroUtils = 0;
  let stallReason = null;
  while (!fnDone) {
    await new Promise((r) => setTimeout(r, probeIntervalMs));
    if (fnDone) break;
    let snap;
    try {
      snap = await probe();
    } catch {
      snap = { apiOk: false, utilPct: null, queueHasAny: false };
    }

    if (!snap.apiOk) {
      apiFails += 1;
      zeroUtils = 0;
      log('WARN', `[COMFYUI-GUARD] API 不可达 ${apiFails}/${apiFailProbes}`);
      if (apiFails >= apiFailProbes) {
        stallReason = `api_unreachable x${apiFails}`;
        break;
      }
    } else {
      apiFails = 0;
      if (Date.now() - startedAt >= startupGraceMs) {
        if (snap.utilPct === 0 && snap.queueHasAny) {
          zeroUtils += 1;
          log('WARN', `[COMFYUI-GUARD] GPU 利用率 0% ${zeroUtils}/${zeroUtilProbes}（队列仍在执行）`);
          if (zeroUtils >= zeroUtilProbes) {
            stallReason = `gpu_idle x${zeroUtils}`;
            break;
          }
        } else {
          zeroUtils = 0;
        }
      }
    }
  }

  if (fnDone) {
    if (fnError) throw fnError;
    return fnResult;
  }

  const recovered = await onStall(stallReason);
  log('WARN', `[COMFYUI-GUARD] 已清理重启（recovered=${recovered}），本次生成抛错交由批次重试`);
  throw new Error(`[COMFYUI-GUARD] generation aborted: ${stallReason} (recovered=${recovered})`);
}

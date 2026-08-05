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
    "Where-Object { $_.CommandLine -like '*ComfyUI-backup*main.py*' } |",
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
export function startComfyUI() {
  try {
    const child = spawn(PYTHON, [MAIN, ...ARGS], { cwd: CWD, detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** 轮询 /api 就绪（默认每 5s 一次，上限 90s）。 */
export async function waitForComfyUIReady(timeoutMs = 90_000, pollMs = 5_000) {
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
  const readyTimeoutMs = opts.readyTimeoutMs ?? 90_000;
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

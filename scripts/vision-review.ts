/**
 * TICKET-022 视觉评审助手（Gemini 2.5-flash 免费优先 + TokenHub hy-vision 兜底）。
 *
 * Usage:
 *   node --import tsx --env-file=.env.local scripts/vision-review.ts \
 *     <图片路径1> [图片路径2 ...] --industry <行业中文> --brand <品牌名>
 *     [--gemini-model gemini-2.5-flash] [--proxy-url http://127.0.0.1:22307]
 *     [--provider auto|gemini|tokenhub] [--tokenhub-model hy-vision-2.0-instruct]
 *     [--tokenhub-base-url <覆盖 TokenHub 地址，仅测试用>]
 *
 * Exit codes:
 *   0  = 所有图片 PASS
 *   1  = 存在 FAIL（行业一致性/跨行业物品问题）
 *   2  = 评审通道全部不可用（检查台湾代理 22307 / 网络 / TokenHub 配置）
 *
 * 约束：
 *   - 不打印任何 API Key；日志中的 Gemini URL 会做 key 掩码。
 *   - Gemini 必须经本地台湾代理（HTTP_PROXY http://127.0.0.1:22307）。
 *   - TokenHub key 从 D:\DISK\workbuddy\tokenhub_config.json 读取（只读，不外显）。
 */

import { spawn } from "child_process";
import { readFileSync } from "fs";
import { connect as tcpConnect } from "net";
import { parseArgs } from "util";

const TOKENHUB_CONFIG_PATH = "D:\\DISK\\workbuddy\\tokenhub_config.json";
const DEFAULT_PROXY_URL = "http://127.0.0.1:22307";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_TOKENHUB_MODEL = "hy-vision-2.0-instruct";
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/%MODEL%:generateContent";

interface Options {
  images: string[];
  industry: string;
  brand: string;
  geminiModel: string;
  proxyUrl: string;
  provider: "auto" | "gemini" | "tokenhub";
  tokenhubModel: string;
  tokenhubBaseUrl?: string;
}

interface ImagePayload {
  path: string;
  mime: string;
  b64: string;
}

interface ReviewOutcome {
  image: string;
  verdict: "PASS" | "FAIL";
  reason: string;
  channel: "gemini" | "tokenhub";
}

interface TokenHubConfig {
  provider: string;
  base_url: string;
  api_key: string;
  default_model: string;
}

function maskUrlKey(url: string): string {
  return url.replace(/[?&]key=[^&]*/, "?key=***");
}

function mimeOf(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function buildPrompt(industry: string, brand: string): string {
  return (
    `你是品牌 VI 评审员。请判断这张图片是否符合「${industry}」行业的视觉场景，` +
    `是否出现与「${industry}」无关的跨行业物品（例如沐浴乳、洗车液、五金工具等），` +
    `并结合品牌「${brand}」判断视觉一致性。` +
    `请以一行开头回答：先写 PASS 或 FAIL，冒号后一句话中文理由。` +
    `示例：PASS：奶茶杯与吸管符合饮品行业；FAIL：画面出现洗车液瓶，与饮品行业不符。`
  );
}

function classify(text: string): { verdict: "PASS" | "FAIL"; reason: string } {
  const m = /\b(PASS|FAIL)\b[:：\-—]?\s*(.*)/i.exec(text);
  if (!m) {
    return {
      verdict: "FAIL",
      reason: `未给出 PASS/FAIL 结论：${text.trim().slice(0, 120)}`,
    };
  }
  return {
    verdict: m[1].toUpperCase() === "PASS" ? "PASS" : "FAIL",
    reason: (m[2] || m[1]).trim().slice(0, 200),
  };
}

function parseOptions(argv: string[]): Options {
  const values = parseArgs({
    args: argv,
    options: {
      industry: { type: "string" },
      brand: { type: "string" },
      "gemini-model": { type: "string" },
      "proxy-url": { type: "string" },
      provider: { type: "string" },
      "tokenhub-model": { type: "string" },
      "tokenhub-base-url": { type: "string" },
    },
    allowPositionals: true,
  });
  const provider = values.values.provider ?? "auto";
  if (provider !== "auto" && provider !== "gemini" && provider !== "tokenhub") {
    throw new Error(`--provider 必须是 auto|gemini|tokenhub，收到: ${provider}`);
  }
  return {
    images: values.positionals,
    industry: values.values.industry ?? "",
    brand: values.values.brand ?? "",
    geminiModel: values.values["gemini-model"] ?? DEFAULT_GEMINI_MODEL,
    proxyUrl: values.values["proxy-url"] ?? DEFAULT_PROXY_URL,
    provider,
    tokenhubModel: values.values["tokenhub-model"] ?? DEFAULT_TOKENHUB_MODEL,
    tokenhubBaseUrl: values.values["tokenhub-base-url"],
  };
}

function loadTokenHubConfig(): TokenHubConfig {
  const envKey = process.env.TOKENHUB_API_KEY ?? "";
  if (envKey) {
    // 密钥已集中到 .env.local（--env-file 加载）；base_url 优先读配置文件，缺失时用默认地址
    let baseUrl = "https://tokenhub.tencentmaas.com/v1/chat/completions";
    try {
      const cfg = JSON.parse(readFileSync(TOKENHUB_CONFIG_PATH, "utf8")) as Partial<TokenHubConfig>;
      if (cfg.base_url) baseUrl = cfg.base_url;
    } catch {
      // 配置文件缺失不阻塞，使用默认地址
    }
    return { provider: "env", base_url: baseUrl, api_key: envKey, default_model: "" };
  }
  const raw = readFileSync(TOKENHUB_CONFIG_PATH, "utf8");
  const cfg = JSON.parse(raw) as Partial<TokenHubConfig>;
  if (!cfg.base_url || !cfg.api_key) {
    throw new Error(`TokenHub 配置不完整: ${TOKENHUB_CONFIG_PATH}（缺少 base_url 或 api_key）`);
  }
  return {
    provider: cfg.provider ?? "tencent-tokenhub",
    base_url: cfg.base_url,
    api_key: cfg.api_key,
    default_model: cfg.default_model ?? "",
  };
}

function isProxyOpen(proxyUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    let u: URL;
    try {
      u = new URL(proxyUrl);
    } catch {
      resolve(false);
      return;
    }
    const port = u.port ? Number(u.port) : 80;
    const sock = tcpConnect({ host: u.hostname, port, timeout: 3000 });
    const done = (ok: boolean) => {
      sock.destroy();
      resolve(ok);
    };
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
    sock.once("timeout", () => done(false));
  });
}

/**
 * Send a JSON HTTPS request through an HTTP CONNECT proxy via curl.
 * Returns { status, body }. Never logs the API key (URL is masked).
 */
function postViaProxy(
  proxyUrl: string,
  url: string,
  body: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const marker = "__CURL_HTTP_STATUS__";
    const args = [
      "-sS",
      "-x",
      proxyUrl,
      "-X",
      "POST",
      url,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@-",
      "--max-time",
      "60",
      "-w",
      `\n${marker}%{http_code}`,
    ];
    const child = spawn("curl", args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => stdout.push(c));
    child.stderr.on("data", (c: Buffer) => stderr.push(c));
    child.on("error", (err) =>
      reject(new Error(`curl 无法启动: ${err.message}（代理 ${proxyUrl} 未开？）`)),
    );
    child.on("close", (code) => {
      if (code !== 0) {
        const msg = Buffer.concat(stderr).toString("utf8").trim().split("\n")[0] ?? "";
        reject(new Error(`curl 退出码 ${code}${msg ? `：${msg}` : ""}`));
        return;
      }
      const raw = Buffer.concat(stdout).toString("utf8");
      const idx = raw.lastIndexOf(marker);
      if (idx < 0) {
        reject(new Error("curl 响应缺少状态码标记"));
        return;
      }
      const status = Number(raw.slice(idx + marker.length).trim());
      resolve({ status, body: raw.slice(0, idx).trim() });
    });
    child.stdin.end(body);
  });
}

async function geminiReview(
  opts: Options,
  image: ImagePayload,
  apiKey: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const url = GEMINI_ENDPOINT.replace("%MODEL%", opts.geminiModel) + `?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: buildPrompt(opts.industry, opts.brand) },
          { inline_data: { mime_type: image.mime, data: image.b64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
  });
  try {
    const { status, body: respBody } = await postViaProxy(opts.proxyUrl, url, body);
    if (status !== 200) {
      return { ok: false, error: `Gemini HTTP ${status}` };
    }
    const data = JSON.parse(respBody) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const reason = data.candidates?.[0]?.finishReason ?? "空结果";
      return { ok: false, error: `Gemini 无文本结果（${reason}）` };
    }
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Gemini 请求失败（${maskUrlKey(url)}）：${msg}` };
  }
}

async function tokenhubReview(
  opts: Options,
  image: ImagePayload,
  cfg: TokenHubConfig,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const endpoint = opts.tokenhubBaseUrl ?? cfg.base_url;
  const body = JSON.stringify({
    model: opts.tokenhubModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildPrompt(opts.industry, opts.brand) },
          {
            type: "image_url",
            image_url: { url: `data:${image.mime};base64,${image.b64}` },
          },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 300,
  });
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body,
      signal: AbortSignal.timeout(90_000),
    });
    const data = (await resp.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;
    if (!resp.ok) {
      const detail = data?.error?.message ?? `HTTP ${resp.status}`;
      return { ok: false, error: `TokenHub ${detail}` };
    }
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      return { ok: false, error: "TokenHub 无文本结果" };
    }
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `TokenHub 请求失败：${msg}` };
  }
}

function printUsage(): void {
  console.log(
    "用法：node --import tsx --env-file=.env.local scripts/vision-review.ts " +
      "<图片1> [图片2 ...] --industry <行业> --brand <品牌> [--provider auto|gemini|tokenhub]",
  );
}

async function main(): Promise<number> {
  let opts: Options;
  try {
    opts = parseOptions(process.argv.slice(2));
  } catch (err) {
    console.error(`参数错误：${err instanceof Error ? err.message : String(err)}`);
    printUsage();
    return 2;
  }
  if (opts.images.length === 0 || !opts.industry || !opts.brand) {
    console.error("缺少必填参数：图片路径、--industry、--brand");
    printUsage();
    return 2;
  }

  console.log(
    `[022] 视觉评审：${opts.images.length} 张图 | 行业=${opts.industry} | 品牌=${opts.brand} ` +
      `| 通道=${opts.provider}（Gemini ${opts.geminiModel} + TokenHub ${opts.tokenhubModel}）`,
  );

  const proxyOpen = await isProxyOpen(opts.proxyUrl);
  if (!proxyOpen) {
    console.warn(
      `⚠️ 代理 ${opts.proxyUrl} 未开启：Gemini 通道不可用。` +
        (opts.provider === "gemini"
          ? "（--provider gemini 将直接失败）"
          : "将回退 TokenHub 国内直连。如需 Gemini，请先开启台湾代理。"),
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY ?? "";
  let tokenhubCfg: TokenHubConfig | null = null;
  if (opts.provider !== "gemini") {
    try {
      tokenhubCfg = loadTokenHubConfig();
    } catch (err) {
      console.error(
        `TokenHub 配置读取失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const outcomes: ReviewOutcome[] = [];
  let channelUnavailable = false;

  for (const imagePath of opts.images) {
    let image: ImagePayload;
    try {
      image = {
        path: imagePath,
        mime: mimeOf(imagePath),
        b64: readFileSync(imagePath).toString("base64"),
      };
    } catch (err) {
      channelUnavailable = true;
      console.error(`无法读取图片 ${imagePath}：${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    let text: string | null = null;
    let channel: "gemini" | "tokenhub" = "tokenhub";

    if (opts.provider === "gemini" || (opts.provider === "auto" && proxyOpen)) {
      if (!geminiKey) {
        console.error("GEMINI_API_KEY 缺失（需 --env-file=.env.local），跳过 Gemini 通道");
      } else {
        const r = await geminiReview(opts, image, geminiKey);
        if (r.ok) {
          text = r.text;
          channel = "gemini";
        } else if (opts.provider === "auto") {
          console.log(`  Gemini 失败（${r.error}）→ 回退 TokenHub`);
        } else {
          console.error(`  Gemini 失败（${r.error}）`);
          channelUnavailable = true;
        }
      }
    }

    if (text === null && opts.provider !== "gemini") {
      if (!tokenhubCfg) {
        console.error("TokenHub 配置不可用，跳过 TokenHub 通道");
        channelUnavailable = true;
      } else {
        const r = await tokenhubReview(opts, image, tokenhubCfg);
        if (r.ok) {
          text = r.text;
          channel = "tokenhub";
        } else {
          console.error(`  TokenHub 失败（${r.error}）`);
          channelUnavailable = true;
        }
      }
    }

    if (text === null) {
      continue;
    }
    const { verdict, reason } = classify(text);
    outcomes.push({ image: imagePath, verdict, reason, channel });
    console.log(`  [${verdict}] ${imagePath}（via ${channel}）：${reason}`);
  }

  console.log("----");
  const failCount = outcomes.filter((o) => o.verdict === "FAIL").length;
  console.log(
    `结果：${outcomes.length} 张已评审，${outcomes.length - failCount} PASS / ${failCount} FAIL`,
  );

  if (channelUnavailable) {
    console.error(
      "评审通道不可用（退出码 2）：请检查台湾代理 22307 是否开启、网络连接、TokenHub 配置与 Key 状态。",
    );
    return 2;
  }
  if (failCount > 0) {
    return 1;
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`未预期错误：${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    process.exitCode = 2;
  },
);

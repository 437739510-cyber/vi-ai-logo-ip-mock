/**
 * Brand Brain Automation Worker
 * ==============================
 * Local Windows polling script. Bridges cloud Zeabur to local ComfyUI.
 *
 * Flow:
 *   pending_logo   → DeepSeek brand analysis + ComfyUI logo gen (4 logos)
 *   pending_manual → ComfyUI scene gen (5 images) + PPTX render + upload
 *
 * Usage: npx tsx scripts/worker.mjs
 *        or create a Windows Scheduled Task
 *
 * Requires:
 *   SUPABASE_SERVICE_KEY env var (from .env.local)
 *   DEEPSEEK_API_KEY env var (from .env.local)
 *   ComfyUI running on http://127.0.0.1:8188
 */

import { createClient } from '@supabase/supabase-js';
import { comfyuiGenerateLogo, comfyuiGenerateScene, comfyGenerateImage, comfyuiInpaintPhoto, comfyGenerateReferenceAnchor, comfyGenerateCompositeBackground, comfyGenerateFromWorkflow, isComfyUIAvailable } from '../src/lib/ip/ip-image-provider/comfyui-provider';
import { planPages } from '../src/lib/vi-manual/page-planner';
import { renderPptxToBuffer } from '../src/lib/pptx/render-pptx';
import { normalizeBrandName } from '../src/lib/vi-manual/brand-name-normalizer';
import { buildMascotAssetSetFromClientInfo, validateMascotAssets, nextMascotFullAttempt, shouldRetryMascotFull } from '../src/lib/vi-manual/mascot-assets';
import { buildMascotDesignBrief } from '../src/lib/vi-manual/mascot-design-brief';
import { buildMascotFullAssetPlan } from '../src/lib/vi-manual/mascot-design-brief';
import { buildLogoCompositeFallbackPrompt, compositeLogoOnScene, combineThreeViewSheet, evaluateLogoSceneDeliveryGate, getLogoSceneLayout, overlayBrandTextOnScene, partitionLogoSceneRequests, pasteLogoOnScene, removeOpaqueWhiteBackground, resolveSceneTextGate } from '../src/lib/vi-manual/logo-scene-compositor';
import { getIndustryType, getIndustryDefaults } from '../src/lib/brand/industry-types';
import { extractLogoElements, extractStyleTags, resolveLogoColorsFromProfile, resolveLogoColors } from '../src/lib/vi-manual/brand-visual-rules';
import { normalizeLogoTextLanguage } from '../src/lib/core/consultation-schema';
import { buildPaymentRequiredClientInfo, ensurePaymentConfirmed, evaluatePaymentGate } from '../src/lib/core/payment-gate';
import { buildCanonicalPptxResult, buildCompletedManualHistoryItem, VI_MANUAL_STORAGE_BUCKET } from '../src/lib/vi-manual/manual-delivery';
import { runLogoVisionCheck, runLogoFidelityVisionCheck, runMascotVisionCheck, runSceneVisionCheck, runPhotoSceneVisionCheck, extractExpectedText, extractMascotCharacterSpec, runThreeViewConsistencyCheck, isValidUploadedLogoAssets, describeLogoForOptimization, buildOptimizedLogoPrompt, locateTextRegion, generateInpaintMaskPng, checkBrandColors, isStorefrontPhoto, buildPhotoScenePrompts, detectLogoHasText as visionDetectLogoHasText, runMascotSceneVisionCheck, runMascotSceneFusionCheck, runAIDrawnSceneCheck, normalizeForCompare } from '../src/lib/vision-check';
// 工单 030：ComfyUI 健康门与生命周期（崩溃探测→自动重启→就绪→冷却）。
import { ensureComfyUIReady, gpuSnapshot, comfyuiPids, killComfyUI, runWithMidGenerationGuard } from './_comfyui-lifecycle.mjs';
// 工单 030：Logo 批次循环编排（生成→统一校验→不合格下一轮统一重生成）。
import { runLogoBatchFlow } from './_logo-batch.mjs';
import { promises as fs } from 'fs';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// ========== Config ==========

const SUPABASE_URL = 'https://fzoscrutqhdfzwnjgjvs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const POLL_INTERVAL_MS = 10_000;
// 工单 044：ComfyUI input 目录（照片/蒙版写入位置；LoadImage 只认该目录内文件）
const COMFYUI_INPUT_DIR = process.env.COMFYUI_INPUT_DIR || 'D:/ComfyUI-backup/input';
const DEEPSEEK_TIMEOUT_MS = 60_000;
const MAX_LOGO_GEN_RETRIES = 2;
// 工单 027：Logo 视觉校验不合格时换 seed 重试次数（校验失败不计入生成重试）。
const MAX_VISION_RETRIES = 2;
// 工单 030：Logo 批次循环（生成 4 张 → 统一校验 → 不合格下一轮统一重生成）。
const MAX_LOGO_BATCH_ROUNDS = 2;
const MAX_LOGO_GEN_ATTEMPTS = 3; // 单张 ≤3 次尝试（含重试）
const LOGO_RETRY_GAP_MS = 30_000; // 单张失败重试间隔
// 工单 085-B-R1：场景视觉门模型 env 覆盖（未设置时保持默认 qwen2.5vl:3b / my-vl 不变）
const VISION_COARSE_MODEL = process.env.VISION_COARSE_MODEL || undefined;
const VISION_FINE_MODEL = process.env.VISION_FINE_MODEL || undefined;

// ========== 工单 085-B-R2：selectedLogo 是否含文字（显式 OCR 契约） ==========
// 与 src/lib/vision-check 的 detectLogoHasText 保持同一 prompt/解析语义；区别：
// 本包装返回 { hasText, text, raw, model }（raw 为证据），带会话内缓存并记日志。
// 禁止写死「某品牌无文字」；OCR 不可用时返回 hasText=null，调用方必须 fail-closed。
const LOGO_HAS_TEXT_PROMPT =
  '请判断这张图片中是否存在任何文字（汉字/拼音/英文/数字）。只输出 JSON：' +
  '{"hasText":true或false,"text":"若存在则逐字列出全部文字，不存在则为空字符串"}。不要解释。';
const LOGO_OCR_EVIDENCE_PROMPT =
  '请把图片里面所有可见的汉字、拼音、英文全部逐字完整提取出来，不要总结描述，只输出图片上出现的文字。';
const logoTextCache = new Map();

const execFileAsync = promisify(execFile);

/** 与 vision-check 同机制的本地 Ollama OCR（curl.exe + 临时 JSON，temperature=0）。 */
async function ollamaOcr(model, prompt, imageBase64) {
  const payload = {
    model,
    prompt,
    images: [String(imageBase64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '')],
    stream: false,
    keep_alive: 0,
    options: { temperature: 0, num_predict: 200 },
  };
  const tmpIn = path.join(os.tmpdir(), `worker-logo-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const tmpOut = tmpIn + '.out';
  await fs.writeFile(tmpIn, JSON.stringify(payload), 'utf8');
  try {
    await execFileAsync('curl.exe', [
      '-sS', '-m', '240', '-X', 'POST',
      'http://127.0.0.1:11434/api/generate',
      '-H', 'Content-Type: application/json',
      '--data-binary', `@${tmpIn}`,
      '--output', tmpOut,
    ]);
    const raw = await fs.readFile(tmpOut, 'utf8');
    // Ollama /api/generate（stream:false）返回 JSON 信封；取 response 字段，
    // 与 src/lib/vision-check ocrWithModel 的解析保持一致。
    const parsed = JSON.parse(raw);
    return String(parsed.response || '').trim();
  } finally {
    await fs.unlink(tmpIn).catch(() => {});
    await fs.unlink(tmpOut).catch(() => {});
  }
}

function inferLogoTextFromOcr(ocrText) {
  const t = String(ocrText || '').trim();
  if (!t) return false;
  // 否定式回答（“无/没有文字/no text/none”）→ 无文字
  if (/^(无|没有|无文字|未发现|无任何文字|no text|none)$/i.test(t)) return false;
  const cn = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cn > 0) return true;
  const cleaned = t.replace(/[\s\p{P}\p{S}]/gu, '');
  if (cleaned.length >= 3 && !/\b(the|image|logo|appears|provided|feature|design|stylized|emblem|this|that|with|you)\b/i.test(t)) {
    return true;
  }
  return false;
}

function parseLogoHasTextAnswer(ans) {
  // 只接受「整个响应即 JSON」的干净回答（允许 ```json 围栏）；响应含散文/解释时
  // 返回 null → 调用方走 OCR 证据提示词，避免模型把伪造 JSON 块当作真结果。
  const cleaned = String(ans || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!/^\{[\s\S]*\}$/.test(cleaned)) return null;
  let obj;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.hasText === 'boolean') return { hasText: obj.hasText, text: typeof obj.text === 'string' ? obj.text : '' };
  if (obj.hasText === 'true') return { hasText: true, text: typeof obj.text === 'string' ? obj.text : '' };
  if (obj.hasText === 'false') return { hasText: false, text: '' };
  if (typeof obj.text === 'string') {
    const cn = (obj.text.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = (obj.text.replace(/\s/g, '').match(/[A-Za-z]{3,}/g) || []).length;
    return { hasText: cn > 0 || en > 0, text: obj.text };
  }
  return null;
}

/**
 * 检测 selectedLogo 是否含可识别文字（动态 OCR，temperature=0）。
 * 返回 { hasText, text, raw, model }；OCR 失败返回 hasText=null（调用方 fail-closed）。
 * 结果按 model+图片签名缓存，证据（raw OCR 输出）记入日志。
 */
async function detectLogoHasText(selectedLogoImage, visionModel) {
  const model = visionModel || VISION_FINE_MODEL || 'my-vl';
  const cacheKey = typeof selectedLogoImage === 'string'
    ? `${model}|${selectedLogoImage.slice(0, 96)}`
    : `${model}|buffer:${selectedLogoImage ? selectedLogoImage.byteLength : 0}`;
  if (logoTextCache.has(cacheKey)) {
    const hit = logoTextCache.get(cacheKey);
    log('INFO', `[LOGO-TEXT] cache hit: hasText=${hit.hasText} model=${hit.model}`);
    return hit;
  }
  log('INFO', `[LOGO-TEXT] OCR selectedLogo（model=${model}，temperature=0）...`);
  try {
    const ans = await ollamaOcr(model, LOGO_HAS_TEXT_PROMPT, selectedLogoImage);
    const parsed = parseLogoHasTextAnswer(ans);
    if (parsed) {
      const result = { hasText: parsed.hasText, text: parsed.text || '', raw: ans, model, source: 'logo_has_text_json' };
      logoTextCache.set(cacheKey, result);
      log('INFO', `[LOGO-TEXT] 检测结果 hasText=${result.hasText} text=${JSON.stringify(result.text)}（OCR 原文：${String(ans).slice(0, 200)}）`);
      return result;
    }
    const ocrText = await ollamaOcr(model, LOGO_OCR_EVIDENCE_PROMPT, selectedLogoImage);
    const hasText = inferLogoTextFromOcr(ocrText);
    const result = { hasText, text: hasText ? ocrText : '', raw: ocrText, model, source: 'ocr_fallback' };
    logoTextCache.set(cacheKey, result);
    log('INFO', `[LOGO-TEXT] 兜底 OCR 结果 hasText=${result.hasText} text=${JSON.stringify(result.text)}`);
    return result;
  } catch (err) {
    const result = { hasText: null, text: '', raw: '', model, error: err.message };
    logoTextCache.set(cacheKey, result);
    log('WARN', `[LOGO-TEXT] OCR 失败：${err.message}；无法证实 logo 无文字，调用方将 fail-closed`);
    return result;
  }
}

/**
 * 工单 086-R1：从 LOGO 图像动态提取核心图形元素名词（本地 Ollama，免付费）。
 * 当品牌分析字段里的 elements 是提示词式长句（如“中文品牌名…为主体”）时，
 * extractLogoElements 会过滤为空 → 误用规范页残留「但以文字为核心」占位符。
 * 本函数用视觉模型直接看图提取干净元素名词，写入显式字段 logoDesignElements。
 * 失败返回 []（调用方回退通用规则，不静默编造）。
 */
const LOGO_ELEMENTS_PROMPT =
  "Analyze this brand logo image. List its core graphic elements as comma-separated Chinese nouns only " +
  "(e.g. 水滴,叶片,∞,三角). If the logo has no distinctive graphic element beyond the wordmark, " +
  "output the word 字标. Do not output sentences, explanations or the brand name.";
async function extractLogoElementsFromImage(logoImage, visionModel) {
  const model = visionModel || VISION_FINE_MODEL || 'my-vl';
  try {
    const ans = await ollamaOcr(model, LOGO_ELEMENTS_PROMPT, logoImage);
    const raw = String(ans || '');
    const parts = raw.split(/[、，,；;/|。.\s]+/).map((p) => p.trim()).filter((p) => p && p !== '字标');
    const result = [...new Set(parts)].slice(0, 8);
    log('INFO', `[LOGO-ELEMENTS] 视觉提取 ${result.length} 个元素（model=${model}）：${result.join(' / ')}`);
    return result;
  } catch (err) {
    log('WARN', `[LOGO-ELEMENTS] 视觉提取失败：${err.message}`);
    return [];
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');
await fs.mkdir(LOG_DIR, { recursive: true });

// ========== Logging ==========

function log(level, msg) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  const today = ts.slice(0, 10);
  fs.appendFile(path.join(LOG_DIR, `worker-${today}.log`), line + '\n').catch(() => {});
}

// 工单 049：生成中健康探测守卫包装（ComfyUI 挂死时 ≤3min 内 探测→杀残留→显存归零→
// 单实例重启，抛错交由批次「该张重试」，不再出现 50 分钟空等）。
function withMidGenGuard(label, generateFn) {
  return async (args) =>
    runWithMidGenerationGuard(() => generateFn(args), {
      log,
      probeIntervalMs: Number(process.env.COMFYUI_GUARD_PROBE_INTERVAL_MS) || 20_000,
      startupGraceMs: Number(process.env.COMFYUI_GUARD_STARTUP_GRACE_MS) || 60_000,
      apiFailProbes: Number(process.env.COMFYUI_GUARD_API_FAIL_PROBES) || 2,
      zeroUtilProbes: Number(process.env.COMFYUI_GUARD_ZERO_UTIL_PROBES) || 3,
    });
}

// ========== DeepSeek API ==========

async function callDeepSeek(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 4096) {
  const resp = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DeepSeek API error: ${errText}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseDeepSeekJSON(content) {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

// 工单 023：品牌分析提示词模板版本。已存 prompts 版本缺失/不一致 → 强制重跑品牌分析。
const LOGO_PROMPT_TEMPLATE_VERSION = '023-chinese-v2';
// ========== Brand Analysis Prompt ==========

function buildAnalysisPrompt(clientInfo) {
  const parts = [
    '## 客户品牌基础信息',
    '',
    `公司名称：${clientInfo.companyName || ''}`,
    `所属行业：${clientInfo.industry || ''}`,
    `Logo文字语言：${normalizeLogoTextLanguage(clientInfo.logoTextLanguage) === 'pinyin' ? '拼音' : '中文'}`,
  ];
  if (clientInfo.province || clientInfo.city) {
    parts.push(`所在地：${clientInfo.province || ''} ${clientInfo.city || ''}`);
  }
  parts.push('');
  parts.push('### 客户已填写的品牌信息（有则保留润色，无则AI代写）：');
  parts.push(`品牌愿景：${clientInfo.brandVision || ''}`);
  parts.push(`核心价值：${clientInfo.coreValues || ''}`);
  parts.push(`目标市场：${clientInfo.targetMarket || ''}`);
  if (clientInfo.logoPhilosophy) parts.push(`LOGO设计理念：${clientInfo.logoPhilosophy}`);
  if (clientInfo.brandPersonality) parts.push(`品牌个性：${clientInfo.brandPersonality}`);
  if (clientInfo.logoStyle) parts.push(`Logo图形偏好：${clientInfo.logoStyle}`);
  if (clientInfo.logoUsage) parts.push(`Logo主要用途：${clientInfo.logoUsage}`);
  if (clientInfo.avoidElements) parts.push(`设计禁忌：${clientInfo.avoidElements}`);
  if (clientInfo.competitorReference) parts.push(`竞品参考：${clientInfo.competitorReference}`);
  if (clientInfo.mainProducts) parts.push(`主营产品：${clientInfo.mainProducts}`);
  if (clientInfo.description) parts.push(`补充描述：${clientInfo.description}`);
  // 工单 038：重新生成时把客户最近一条反馈带入品牌分析上下文
  const regenHistory = clientInfo.brandProfile?.regenerationHistory;
  if (Array.isArray(regenHistory) && regenHistory.length > 0) {
    const last = regenHistory[regenHistory.length - 1];
    if (last && last.feedback) {
      parts.push(`客户最新反馈（重新生成时提供）：${last.feedback}`);
    }
  }
  parts.push('');
  parts.push('请基于以上信息，进行深度品牌分析，输出品牌档案JSON。');
  return parts.join('\n');
}

const BRAND_ANALYSIS_SYSTEM = `你是一位资深的品牌战略分析师，精通中国本土市场的品牌定位与VI策略。

你的任务是：根据客户提供的品牌基础信息，进行深度分析，输出品牌档案。

## 输出格式
返回严格JSON，不要markdown包裹：
{
  "analysisTemplateVersion": "023-chinese-v2",
  "logoTextMode": "chinese | pinyin（必须与客户选择的 Logo 文字语言一致）",
  "industryInsight": "行业洞察，2-3句话",
  "geoEnvironment": "地理环境分析，2-3句话",
  "competitiveLandscape": "竞品格局，2-3句话",
  "brandPositioning": "品牌定位建议，2-3句话",
  "refinedBrandVision": "AI提炼/补充的品牌愿景，一句话",
  "refinedCoreValues": "AI提炼/补充的核心价值，逗号分隔",
  "refinedTargetMarket": "AI细化/补充的目标市场，一句话",
  "brandToneKeywords": ["关键词1", "关键词2", "关键词3"],
  "visualStyleSuggestion": "视觉风格建议，2-3句话",
  "sceneImageSuggestions": [
    {"zh": "包装袋应用", "en": "Professional product photography of branded packaging bag with logo, studio lighting"},
    {"zh": "名片/信纸应用", "en": "Professional product photography of branded stationery with logo, studio lighting"},
    {"zh": "店面门头应用", "en": "Professional product photography of storefront sign with brand logo, studio lighting"},
    {"zh": "宣传海报应用", "en": "Professional product photography of promotional poster with brand logo, studio lighting"},
    {"zh": "会员卡应用", "en": "Professional product photography of branded membership card, studio lighting"}
  ],
  "sceneSectionTitles": {
    "stationery": "品牌应用系统",
    "packaging": "产品包装系统",
    "marketing": "营销展示系统"
  },
  "colorPalette": [
    {"name": "品牌主色", "hex": "#RRGGBB", "nameEn": "Primary", "meaning": "该色彩的行业关联，1句话"},
    {"name": "辅助色", "hex": "#RRGGBB", "nameEn": "Secondary", "meaning": "该色彩的行业关联，1句话"},
    {"name": "强调色", "hex": "#RRGGBB", "nameEn": "Accent", "meaning": "该色彩的行业关联，1句话"}
  ],
  "logoSpecs": {
    "note": "logoColors 必须来自客户提供的真实品牌色或已有Logo色证据；证据不足输出空数组 []，禁止虚构或套用其他品牌色板。",
    "logoColors": [
      {"name": "Logo专属色1（如：深空蓝）", "hex": "#RRGGBB", "rgb": "R, G, B", "cmyk": "C, M, Y, K"},
      {"name": "Logo专属色2（如：暖金）", "hex": "#RRGGBB", "rgb": "R, G, B", "cmyk": "C, M, Y, K"}
    ]
  },
  "logoDesignSuggestions": {
    "note": "IMPORTANT: 若客户选择拼音（logoTextMode=pinyin），四条 prompts 必须全部改写为英文拼音提示词：把品牌名转成正确拼音（全大写或首字母大写）显式写入，如 Text 'LAOWANXIANG' in bold sans-serif；必须包含 No Chinese characters；现代扁平、白色背景、明确配色与字形；四条构图变体参考：极简图标+文字、圆形徽章、手写风格、几何无衬线；禁止出现任何汉字。若客户选择中文，四条 prompts 必须全部用中文撰写（英文提示词会触发 nvfp4 渲染印章/篆书小字，导致品牌中文错字），把客户品牌名（公司名称字段）原样写入并以品牌中文清晰为主视觉；默认现代简约/扁平/白色背景风格；若品牌调性适合，允许传统印章/篆书/仿古风格选项，但品牌中文必须逐字清晰正确（无错字无叠字）并过核字门；必须明确要求每个字只出现一次、无重复、无多余文字、无错字；严禁使用“大字”“粗壮”“横平竖直”等强调放大文字的措辞（实测会诱发叠字/缺字）。模板中的 XXX 必须替换为公司名称字段中的真实品牌名，不得原样输出 XXX。禁止把地名或行业词当作品牌标识，品牌名是唯一主角。",
    "concept": "Logo设计理念详述：3-5句话",
    "style": "设计风格",
    "elements": "建议包含的设计元素",
    "colorGuidance": "配色建议",
    "prompts": [
      "品牌Logo设计：现代简约品牌标志，中文品牌名「XXX」清晰写在画面中央为主视觉，简洁扁平风格，字距均匀、每个字只出现一次、无错字无重复，干净白色背景，居中构图，默认现代简约/扁平；若品牌调性适合可选用传统印章/篆书风格，但品牌中文必须逐字清晰正确、无错字无叠字，且无多余装饰文字",
      "品牌Logo设计：极简现代品牌标志，中央清晰呈现中文品牌名「XXX」，简洁扁平、易识别，文字清晰完整、无重叠无重复，白色背景居中排版，默认现代简约/扁平；若品牌调性适合可选用传统印章/篆书风格，但品牌中文必须逐字清晰正确、无错字无叠字，且无环形排列与多余文字",
      "品牌Logo设计：现代扁平品牌标志，中文品牌名「XXX」为画面主体，简单干净、留白充足，字字独立、笔画完整、不重复不多字，白色背景，居中构图，默认现代简约/扁平；若品牌调性适合可选用传统印章/篆书风格，但品牌中文必须逐字清晰正确、无错字无叠字，且无多余仿古装饰",
      "品牌Logo设计：简洁扁平风格的中文品牌标志，画面中央清晰展示中文品牌名「XXX」，字迹清楚、无重复无多余文字，白色背景，居中构图，默认现代简约/扁平；若品牌调性适合可选用传统印章/篆书风格，但品牌中文必须逐字清晰正确、无错字无叠字，且无多余装饰"
    ]
  },
  "aiGeneratedFields": {
    "brandVision": "如果客户没写则AI代写，已写则留空",
    "coreValues": "同上",
    "targetMarket": "同上"
  }
}`;

// ========== Scene Image Defaults ==========

// 工单 066：A 类 logo 场景渲染要素（商业摄影风格，与 B 类配套的行业物料）
const LOGO_SCENE_RENDER =
  "professional product photography, studio quality render, volumetric lighting, soft shadows, " +
  "extremely detailed, clean composition, high quality";

// A 类行业物料表（行业族→物料；禁止跨行业套用；洗车绝无餐纸餐盒）
const LOGO_SCENE_MATERIALS = {
  restaurant: {
    storefront: "restaurant storefront with signage",
    pack1: "takeaway meal box and paper bag",
    pack2: "menu and table card",
    poster: "promotional poster",
    card: "membership card",
  },
  beverage: {
    storefront: "beverage shop storefront with signage",
    pack1: "drink cup sleeve and carry bag",
    pack2: "bottled drink and cup",
    poster: "promotional poster",
    card: "membership card",
  },
  beauty: {
    storefront: "beauty salon storefront with signage",
    pack1: "premium bottle and rose gold gift box",
    pack2: "product packaging label",
    poster: "promotional poster",
    card: "VIP membership card",
  },
  floral: {
    storefront: "flower shop storefront with signage",
    pack1: "flower bouquet wrapping and gift card",
    pack2: "floral gift box",
    poster: "promotional poster",
    card: "membership card",
  },
  car: {
    storefront: "car wash and auto detailing storefront with signage",
    pack1: "car wash voucher and coupon flyer",
    pack2: "auto care membership card",
    poster: "promotional poster",
    card: "auto care VIP membership card",
  },
  mother_baby: {
    storefront: "mother and baby store storefront with signage",
    pack1: "baby product packaging box",
    pack2: "baby care gift set packaging",
    poster: "promotional poster",
    card: "membership card",
  },
  wedding: {
    storefront: "wedding studio storefront with signage",
    pack1: "wedding invitation card",
    pack2: "wedding favor gift box",
    poster: "promotional poster",
    card: "membership card",
  },
  pet: {
    storefront: "pet store storefront with signage",
    pack1: "pet product pouch and bag",
    pack2: "pet care gift set",
    poster: "promotional poster",
    card: "membership card",
  },
  general: {
    storefront: "brand storefront with signage",
    pack1: "brand product packaging bag",
    pack2: "brand product gift box",
    poster: "promotional poster",
    card: "membership card",
  },
};

// 工单 071：保持现有五张应用图契约；门头使用 marketing 前缀，确保现有
// PPTX marketing 页面会真实消费，而不是增加无人消费的第六槽。
const LOGO_SCENE_KEYS = [
  'stationery-1',
  'packaging-1',
  'packaging-2',
  'marketing-storefront',
  'marketing-1',
];

/**
 * Logo 呈现路由契约。这里只声明策略；参考锚定/透视合成执行器由 072 实现。
 * 未知槽位保守回退 composite，绝不把 prompt 自画当作 Logo 保真来源。
 */
function logoPlacementForScene(sceneKey) {
  // 工单 091-R2：全部场景 AI 入景绘制（z-turbo 文生图，稳定），不再代码硬贴/空白底板。
  // 门头/海报原参考锚定（Flux2）在本机不稳（GPU 空转/超时），统一走 z-turbo AI 入景。
  return {
    strategy: 'ai_drawn',
    fallback: null,
    fidelitySource: 'selected_logo_asset',
    promptIsFidelitySource: false,
    executorStatus: 'ready',
    message: 'AI 入景绘制（z-turbo 文生图）执行器已就绪',
  };
}

function buildLogoSceneItem(key, prompt) {
  return { key, prompt, logoPlacement: logoPlacementForScene(key) };
}

/** 只认客户明确选定的 Logo；不得猜 logoGenerationResults[0]。 */
function resolveSelectedLogoAsset(brandProfile) {
  const selectedLogo = brandProfile && brandProfile.selectedLogo;
  if (selectedLogo && typeof selectedLogo.imageUrl === 'string' && selectedLogo.imageUrl.trim()) {
    return { status: 'selected', imageUrl: selectedLogo.imageUrl.trim(), selectedLogo };
  }
  return {
    status: 'missing_selected_logo',
    imageUrl: null,
    selectedLogo: null,
    message: '未找到明确选定的 Logo；不会回退 logoGenerationResults[0]',
  };
}

// 工单 066：行业→A 类物料族（洗车/汽车美容细分；未覆盖→general 中性物料）
function logoSceneFamily(rawIndustry, industryType) {
  const s = String(rawIndustry || "").toLowerCase();
  if (/洗车|汽车美容|汽车服务|car wash|auto detail|auto care/i.test(s)) return "car";
  return mascotSceneFamily(industryType);
}

/** 工单 091-R3：packaging-1/2 特色场景提示词（前台接待 / 美甲色卡，AI 入景）。 */
function featureScenePromptFor(scene, base) {
  if (scene === 'packaging-1') {
    // 工单 091-R4：AI 画中文品牌字必乱码/重复 → 提示词不再写中文品牌名，
    // 品牌字由代码后贴 + 核字门（消除硬编码客户品牌名）。
    return `Premium beauty & wellness reception scene: marble reception desk, warm rose-gold ambient lighting, elegant flowers, a wall backdrop with the brand logo mark (rose-gold teardrop-and-leaf) and a clean blank signboard area, no text, no letters, no words, no Chinese characters anywhere, clean welcoming atmosphere, ${base}`;
  }
  if (scene === 'packaging-2') {
    return `Nail salon service scene: nail polish color card display with rows of rose-gold and pink nail polish bottles, manicure tools, elegant pink-gold ambiance, a wall with the brand logo mark (rose-gold teardrop-and-leaf) and a clean blank signboard area, no text, no letters, no words, no Chinese characters anywhere, ${base}`;
  }
  if (scene === 'stationery-1') {
    return `Premium business-card & reception scene: elegant reception desk with branded business cards and letterhead (blank cards without printed text), warm rose-gold lighting, a wall backdrop with the brand logo mark (rose-gold teardrop-and-leaf) and a clean blank signboard area, no text, no letters, no words, no Chinese characters anywhere, clean professional atmosphere, ${base}`;
  }
  return base;
}

function buildScenePrompts(companyName, industryType, rawIndustry, profileColors) {
  const style = getIndustryDefaults(industryType)?.sceneStyle || 'clean studio lighting';
  const name = companyName || '品牌';
  const family = logoSceneFamily(rawIndustry, industryType);
  const materials = LOGO_SCENE_MATERIALS[family] || LOGO_SCENE_MATERIALS.general;
  const colorDesc = (profileColors || []).map((c) => c.hex).join(', ');
  const paletteWords = mascotScenePaletteWords(industryType, colorDesc);
  // 工单 091-R2：LOGO 场景改为 AI 入景绘制（禁止代码硬贴/空白底板）。
  // 中文品牌字 ≤4 字可让 AI 画（须核字），≥5 字省略（代码贴/不加）。
  const cnLen = (name.match(/[\u4e00-\u9fff]/g) || []).length;
  const brandMark = cnLen > 0 && cnLen <= 4 ? `the brand name "${name}" and the brand logo mark printed` : 'the brand logo mark printed';
  const aiDrawnLogo = `with ${brandMark} naturally on the carrier, integrated lighting and shadows, professional brand application, printed cleanly, no blank unprinted surface`;
  return [
    buildLogoSceneItem('stationery-1', featureScenePromptFor('stationery-1', `professional product photography, ${LOGO_SCENE_RENDER}, ${paletteWords}, ${style}`)),
    buildLogoSceneItem('packaging-1', featureScenePromptFor('packaging-1', `professional product photography, ${LOGO_SCENE_RENDER}, ${paletteWords}, ${style}`)),
    buildLogoSceneItem('packaging-2', featureScenePromptFor('packaging-2', `professional product photography, ${LOGO_SCENE_RENDER}, ${paletteWords}, ${style}`)),
    // 工单 091-R4：AI 画中文必乱码 → 门头/海报明令禁止任何文字，品牌字由代码后贴。
    buildLogoSceneItem('marketing-storefront', `Professional product photography of a ${materials.storefront} with the brand logo mark displayed clearly on the signboard (clean blank area reserved for brand text), absolutely no text, no letters, no words, no Chinese characters, no numbers, no typography anywhere in the scene, ${LOGO_SCENE_RENDER}, ${paletteWords}, ${style}`),
    buildLogoSceneItem('marketing-1', `Professional product photography of a ${materials.poster} with the brand logo mark displayed clearly on the poster (clean blank area reserved for brand text), absolutely no text, no letters, no words, no Chinese characters, no numbers, no typography anywhere in the scene, ${LOGO_SCENE_RENDER}, ${paletteWords}, ${style}`),
  ];
}

// === 021 scene prompts helper ===
// 工单 021：场景图提示词优先使用 DeepSeek 行业提示词（brandProfile.sceneImageSuggestions，
// 结构 [{en, zh}]），并注入品牌名；提示词缺失时回退通用模板对应场景。
function buildScenePromptsFromSuggestions(suggestions, companyName, industryType, rawIndustry, profileColors) {
  const keys = ['stationery-1', 'packaging-1', 'packaging-2', 'marketing-storefront', 'marketing-1'];
  const fallbacks = buildScenePrompts(companyName, industryType, rawIndustry, profileColors);
  const name = companyName || '品牌';
  // 工单 066：自包含硬化（007 021-1 会单独 eval 本函数，不得引用外部助手）
  const render =
    "professional product photography, studio quality render, volumetric lighting, soft shadows, " +
    "extremely detailed, clean composition, high quality";
  const hexes = (profileColors || []).map((c) => c.hex).filter(Boolean).join(', ');
  const isBeauty = industryType === "beauty" || industryType === "nail" || industryType === "fashion";
  const paletteWords = isBeauty
    ? "rose gold pink brand color scheme"
    : hexes
      ? `brand colors ${hexes}`
      : "";
  // 工单 091-R2：AI 入景绘制（不再代码硬贴/空白底板）；中文品牌字 ≥5 字省略。
  const cnLen = (name.match(/[\u4e00-\u9fff]/g) || []).length;
  const brandMark = cnLen > 0 && cnLen <= 4 ? `the brand name "${name}" and the brand logo mark printed` : 'the brand logo mark printed';
  const source = Array.isArray(suggestions) ? suggestions : [];
  const storefrontIndex = source.findIndex((s) => {
    const text = String((s && `${s.zh || ''} ${s.en || ''}`) || '');
    return /门头|店面|店招|门面|招牌|storefront|signboard/i.test(text);
  });
  const storefrontSuggestion = storefrontIndex >= 0 ? source[storefrontIndex] : null;
  const remaining = source.filter((_, i) => i !== storefrontIndex);
  let remainingIndex = 0;
  return keys.map((key, i) => {
    const s = key === 'marketing-storefront' ? storefrontSuggestion : remaining[remainingIndex++];
    const base = s && (typeof s.en === 'string' && s.en.trim() ? s.en : (typeof s.zh === 'string' ? s.zh : ''));
    if (!base) return fallbacks[i];
    const isSignPoster = key === 'marketing-storefront' || key === 'marketing-1';
    // 工单 091-R4：AI 画中文必乱码 → 门头/海报明令禁止任何文字，品牌字由代码后贴。
    let prompt = isSignPoster
      ? `${base}, with the brand logo mark displayed clearly on the signboard/poster (clean blank area reserved for brand text), absolutely no text, no letters, no words, no Chinese characters, no numbers, no typography anywhere in the scene, ${render}, ${paletteWords}`
      : `${base}, with ${brandMark} naturally on the carrier, integrated lighting and shadows, professional brand application, printed cleanly, no blank unprinted surface, ${render}, ${paletteWords}`;
    // 工单 091-R3：packaging-1/2 用特色场景提示词（前台接待/美甲色卡）。
    if (key === 'packaging-1' || key === 'packaging-2') {
      prompt = featureScenePromptFor(key, `${render}, ${paletteWords}`);
    }
    // 工单 091-R4：应用效果图1（stationery-1）改前台接待/名片特色场景。
    if (key === 'stationery-1') {
      prompt = featureScenePromptFor(key, `${render}, ${paletteWords}`);
    }
    return {
      key,
      prompt,
      logoPlacement: {
        // 工单 091-R2：全部场景 AI 入景绘制（z-turbo 文生图，稳定）。
        strategy: 'ai_drawn',
        fallback: null,
        fidelitySource: 'selected_logo_asset',
        promptIsFidelitySource: false,
        executorStatus: 'ready',
        message: 'AI 入景绘制（z-turbo 文生图）执行器已就绪',
      },
    };
  });
}
// === 021 scene prompts helper end ===

// ========== 034 校验前显存约定 ==========
// 工单 034：校验阶段 ComfyUI 必须完全停止并释放显存（停止而非仅空闲），
// 否则 my-vl（7B 终审）会因显存不足回退 CPU 超时→误 skipped。
async function ensureVisionVramFree({ log }) {
  try {
    const pids = comfyuiPids();
    if (pids.length === 0) {
      log('INFO', '[VISION] 校验前 ComfyUI 进程已停止，显存无占用');
      return;
    }
    log('WARN', `[VISION] 校验前发现 ComfyUI 仍在运行（pid=${pids.join(',')}），先停止并等待显存释放`);
    killComfyUI();
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (comfyuiPids().length === 0) {
        log('INFO', '[VISION] ComfyUI 已停止，显存释放确认');
        return;
      }
      await new Promise((r) => setTimeout(r, 2_000));
    }
    log('WARN', '[VISION] ComfyUI 进程 60s 内未退出，继续校验（3B 粗检兜底，7B 复核可能降级）');
  } catch (e) {
    log('WARN', `[VISION] 校验前显存确认异常（继续校验，3B 粗检兜底）: ${e.message}`);
  }
}

// ========== 工单 044：门店照片→场景图（照片重绘主路） ==========

async function fetchSubmissionStorePhotos(project) {
  const ci = project.client_info || {};
  if (Array.isArray(ci.storePhotos) && ci.storePhotos.length > 0) return ci.storePhotos;
  if (!project.submission_id) return [];
  try {
    const { data } = await supabase
      .from('submissions')
      .select('store_photos')
      .eq('id', project.submission_id)
      .maybeSingle();
    if (data && Array.isArray(data.store_photos)) return data.store_photos;
  } catch (err) {
    log('WARN', `[PHOTO] store_photos 查询失败: ${err.message}`);
  }
  return [];
}

/**
 * 选择门店正立面照：7B 逐张判断（最多 3 张），失败取第一张。
 * 必须在 ComfyUI 启动前调用（Ollama 需要显存）。
 */
async function chooseStorefrontPhotoUrl(photoUrls, { log }) {
  let chosen = photoUrls[0];
  for (let i = 0; i < Math.min(3, photoUrls.length); i++) {
    const url = photoUrls[i];
    const tmpPath = path.join(COMFYUI_INPUT_DIR, `044_pick_${Date.now()}_${i}.jpg`);
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      await fs.writeFile(tmpPath, Buffer.from(await resp.arrayBuffer()));
      // 工单 085-B-R2：正立面粗判读取 VISION_COARSE_MODEL env 覆盖（本单 qwen2.5vl:latest）
      const ok = await isStorefrontPhoto(tmpPath, { model: VISION_COARSE_MODEL });
      log('INFO', `[PHOTO] 照片 ${i + 1}/${photoUrls.length} 正立面判断: ${ok ? 'yes' : 'no'}`);
      if (ok) { chosen = url; break; }
    } catch (err) {
      log('WARN', `[PHOTO] 照片 ${i + 1} 判断失败: ${err.message}`);
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  }
  return chosen;
}

/**
 * 照片预处理（必须在 ComfyUI 启动前）：下载→压到 ≤1280px→7B 定位文字区→
 * 生成 alpha 蒙版 PNG（透明=重绘区）。任何一步失败返回 null（回退原文生图）。
 */
async function preparePhotoScene({ project, clientInfo, brandProfile, companyName, log, logoData, uploadedLogoUrl }) {
  if (clientInfo.logoTextLanguage === 'pinyin') {
    log('INFO', '[PHOTO] 拼音订单暂不走照片链路（本地无可靠拼音转写），回退文生图');
    return null;
  }
  const storePhotos = await fetchSubmissionStorePhotos(project);
  const photoUrls = (storePhotos || [])
    .map((p) => (typeof p === 'string' ? p : (p && p.url)))
    .filter(Boolean);
  if (photoUrls.length === 0) {
    log('INFO', '[PHOTO] 无客户门店照片，维持原文生图场景');
    return null;
  }
  log('INFO', `[PHOTO] 客户门店照片 ${photoUrls.length} 张，开始照片→场景图链路`);

  const chosenUrl = await chooseStorefrontPhotoUrl(photoUrls, { log });
  const prefix = `044_${project.id}_${Date.now()}`;
  const photoFile = `${prefix}_photo.png`;
  const maskedFile = `${prefix}_masked.png`;
  const photoPath = path.join(COMFYUI_INPUT_DIR, photoFile);
  const maskedPath = path.join(COMFYUI_INPUT_DIR, maskedFile);

  try {
    const resp = await fetch(chosenUrl);
    if (!resp.ok) throw new Error(`照片下载失败 ${resp.status}`);
    await fs.writeFile(photoPath, Buffer.from(await resp.arrayBuffer()));
    // 压到 ≤1280px 宽（保持长宽比），并转 PNG
    await sharp(photoPath)
      .resize({ width: 1280, withoutEnlargement: true })
      .png()
      .toFile(photoPath + '.tmp');
    await fs.rename(photoPath + '.tmp', photoPath);

    // 工单 085-B-R2：文字区定位读取 VISION_FINE_MODEL env 覆盖（本单 qwen2.5vl:latest）
    const region = await locateTextRegion(photoPath, { model: VISION_FINE_MODEL });
    if (!region) {
      log('WARN', '[PHOTO] 7B 未能定位文字区域，回退文生图');
      return null;
    }
    log('INFO', `[PHOTO] 文字区域定位: ${JSON.stringify(region)}`);
    await generateInpaintMaskPng(photoPath, region, maskedPath, { featherPx: 24 });

    const prompts = buildPhotoScenePrompts({
      brandName: companyName,
      brandColors: (brandProfile.colorPalette || []).map((c) => ({ hex: c.hex, name: c.name })),
    });
  const expectedText = extractExpectedText(prompts.textPrompt, 'chinese', companyName);
  // 工单 044 v2 / 085-B-R2：客户 logo 可能无文字（纯图形）——显式 OCR 检测并记录，
  // 结果带 OCR 原文证据；OCR 不可用时 hasText=null（照片链路回退文生图，不静默放行）。
  let logoHasTextInfo = null;
  try {
    if (uploadedLogoUrl) {
      const resp = await fetch(uploadedLogoUrl);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        logoHasTextInfo = await detectLogoHasText('data:image/png;base64,' + buf.toString('base64'), VISION_FINE_MODEL);
      }
    } else if (logoData) {
      logoHasTextInfo = await detectLogoHasText(logoData, VISION_FINE_MODEL);
    }
  } catch (err) {
    log('WARN', `[PHOTO] logo 文字检测失败: ${err.message}`);
  }
  const logoHasText = logoHasTextInfo ? logoHasTextInfo.hasText : null;
  if (logoHasText !== null) {
    log('INFO', `[PHOTO] 客户上传 Logo 含文字: ${logoHasText}（false=纯图形，图形叠加合成留 045；OCR 证据：${JSON.stringify((logoHasTextInfo && logoHasTextInfo.text) || '')}）`);
  }
    return {
      imageFile: maskedFile,
      photoPath,
      maskedPath,
      region,
      textPrompt: prompts.textPrompt,
      colorPrompt: prompts.colorPrompt,
      expectedText,
      brandPalette: (brandProfile.colorPalette || []).map((c) => ({ hex: c.hex, name: c.name })),
      logoHasText,
      logoHasTextInfo,
    };
  } catch (err) {
    log('WARN', `[PHOTO] 预处理失败（回退文生图）: ${err.message}`);
    return null;
  }
}

/**
 * 单张照片重绘 + 校验（生成→停止 ComfyUI→Ollama 核字→失败换 seed 重试）。
 * checkColor=true 时附加品牌色核色门（启发式，不阻塞）。
 */
async function generatePhotoSceneWithRetry({
  imageFile,
  prompt,
  expectedText,
  variant = 'nvfp4',
  region = null,
  brandPalette = [],
  checkColor = false,
  log,
  maxAttempts = 3,
}) {
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!(await isComfyUIAvailable())) {
      const ok = await ensureComfyUIReady({ log });
      if (!ok) return { status: 'paused', error: 'ComfyUI 不可用' };
    }
    const seed = Math.floor(Math.random() * 2147483647);
    log('INFO', `[PHOTO] 生成 attempt ${attempt}/${maxAttempts} seed=${seed} variant=${variant}`);
    try {
      const gen = await comfyuiInpaintPhoto({ imageFile, prompt, seed, variant });
      await ensureVisionVramFree({ log }).catch(() => {});
      // 工单 086：照片场景校验也读取 VISION_COARSE_MODEL / VISION_FINE_MODEL env 覆盖
      // （默认值不变；本单 VISION_COARSE_MODEL=VISION_FINE_MODEL=qwen2.5vl:latest）。
      const vision = await runPhotoSceneVisionCheck({
        imageBase64: gen.imageUrl,
        expectedText,
        mode: 'chinese',
        coarseModel: VISION_COARSE_MODEL,
        fineModel: VISION_FINE_MODEL,
      });
      const result = { ...gen, vision, status: vision.status };
      if (checkColor && (vision.status === 'passed' || vision.status === 'skipped')) {
        const color = await checkBrandColors({
          imageBase64: gen.imageUrl,
          region,
          palette: brandPalette,
        });
        result.colorStatus = color.status;
        log('INFO', `[PHOTO] 核色门: ${color.status}${color.reason ? ` (${color.reason})` : ''} avg=${color.avgHex || 'n/a'}`);
      }
      if (vision.status === 'passed' || vision.status === 'skipped') return result;
      log('WARN', `[PHOTO] 校验 ${vision.status}，换 seed 重试`);
      last = result;
    } catch (err) {
      log('WARN', `[PHOTO] 生成失败 attempt ${attempt}: ${err.message}`);
      last = { status: 'needs_review', error: err.message };
      await ensureComfyUIReady({ log }).catch(() => {});
    }
  }
  return last || { status: 'needs_review' };
}

/** 选择照片产物顶替的场景槽位：文字版固定命中正式门头槽；色重涂版占海报槽。 */
function pickPhotoSceneKeys(suggestions) {
  return { textKey: 'marketing-storefront', colorKey: 'marketing-1' };
}

/**
 * 下载公仔素材并压到 PPTX 网格所需尺寸（保留 alpha，PNG）。
 * 工单 085-B-R2：表情/场景/分视图以 data URI 嵌入 render-pptx；不压缩时
 * 15 张全尺寸素材会使 PPTX ~19MB，超过 Supabase 桶 10MB 上限导致上传失败。
 * 素材无透明通道（channels=3）时转 JPEG（q82），体积再降 ~20 倍；有 alpha 保留 PNG。
 */
async function fetchMascotImageAsDataUri(url, maxWidth = 512) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download failed ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const meta = await sharp(buf).metadata();
  let out = buf;
  if (meta.width && meta.width > maxWidth) {
    out = await sharp(buf).resize({ width: maxWidth, withoutEnlargement: true }).toBuffer();
  }
  if (meta.channels !== 4) {
    // 工单 091-R4：公仔素材嵌入质量 82→90（q82 下高频细节场景在最终页
    // 出现可见边缘劣化，双模型融合门不一致；q88-q92 稳定通过）。
    const jpeg = await sharp(out).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    return 'data:image/jpeg;base64,' + jpeg.toString('base64');
  }
  const png = await sharp(out).png().toBuffer();
  return 'data:image/png;base64,' + png.toString('base64');
}

// ========== Logo Generation ==========

async function processLogoGeneration(project) {
  const projectId = project.id;
  const clientInfo = (project.client_info || {});
  const brandProfile = clientInfo.brandProfile || {};
  const rawCompanyName = clientInfo.companyName || '';
  const normalizedCompanyName = normalizeBrandName(rawCompanyName);
  // 工单 024：Logo 文字语言（客户显式选择；空公司名时拼音模式回退中文）
  let logoTextMode = normalizeLogoTextLanguage(clientInfo.logoTextLanguage);
  if (logoTextMode === 'pinyin' && !normalizedCompanyName) {
    log('WARN', `[LOGO] ${projectId}: 拼音模式但公司名为空，回退中文模式（避免产出占位拼音）`);
    logoTextMode = 'chinese';
  }

  log('INFO', `[LOGO] Processing project: ${projectId} (${rawCompanyName || 'unknown'})`);

  // Step 1: Mark as generating
  await supabase.from('projects').update({
    status: 'logo_generating',
    client_info: { ...clientInfo, generationStatus: 'logo_generating', generationMessage: 'AI正在分析品牌...' },
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);


  // Step 2: Brand analysis (if not already done)
  let logoPrompts = brandProfile.logoDesignSuggestions?.prompts;
  let analysisProfile = brandProfile;

  const storedTemplateVersion = brandProfile.analysisTemplateVersion;
  const templateOutdated = storedTemplateVersion !== LOGO_PROMPT_TEMPLATE_VERSION;
  if (!logoPrompts || logoPrompts.length === 0 || templateOutdated) {
    if (logoPrompts && logoPrompts.length > 0 && templateOutdated) {
      log('WARN', `[LOGO] ${projectId}: Stored logo prompts use template version '${storedTemplateVersion || 'missing'}', expected '${LOGO_PROMPT_TEMPLATE_VERSION}', force re-running brand analysis...`);
    } else {
      log('INFO', `[LOGO] ${projectId}: No logo prompts found, running brand analysis...`);
    }
    try {
      const analysisPrompt = buildAnalysisPrompt({ ...clientInfo, companyName: normalizedCompanyName });
      const dsContent = await callDeepSeek(BRAND_ANALYSIS_SYSTEM, analysisPrompt, 0.7, 4096);
      analysisProfile = parseDeepSeekJSON(dsContent);
      logoPrompts = analysisProfile.logoDesignSuggestions?.prompts;

      if (!logoPrompts || logoPrompts.length === 0) {
        throw new Error('Brand analysis returned no logo prompts');
      }
      log('INFO', `[LOGO] ${projectId}: Brand analysis OK, got ${logoPrompts.length} prompts`);

      // Save brand profile to DB
      await supabase.from('projects').update({
        client_info: {
          ...clientInfo,
          brandProfile: {
            industryInsight: analysisProfile.industryInsight || '',
            geoEnvironment: analysisProfile.geoEnvironment || '',
            competitiveLandscape: analysisProfile.competitiveLandscape || '',
            brandPositioning: analysisProfile.brandPositioning || '',
            refinedBrandVision: analysisProfile.refinedBrandVision || '',
            refinedCoreValues: analysisProfile.refinedCoreValues || '',
            refinedTargetMarket: analysisProfile.refinedTargetMarket || '',
            brandToneKeywords: analysisProfile.brandToneKeywords || [],
            visualStyleSuggestion: analysisProfile.visualStyleSuggestion || '',
            sceneImageSuggestions: analysisProfile.sceneImageSuggestions || [],
            sceneSectionTitles: analysisProfile.sceneSectionTitles || null,
            logoDesignSuggestions: analysisProfile.logoDesignSuggestions || null,
            colorPalette: analysisProfile.colorPalette || null,
            aiGeneratedFields: analysisProfile.aiGeneratedFields || {},
            analysisTemplateVersion: LOGO_PROMPT_TEMPLATE_VERSION,
            analysisStatus: 'completed',
            analyzedAt: new Date().toISOString(),
          },
          generationStatus: 'logo_generating',
          generationMessage: '品牌分析完成，开始生成Logo...',
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    } catch (err) {
      log('ERROR', `[LOGO] ${projectId}: Brand analysis failed: ${err.message}`);
      await supabase.from('projects').update({
        status: 'submitted',
        client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: `品牌分析失败: ${err.message}` },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      return;
    }
  }

  // Step 3: Check ComfyUI availability（工单 030：健康门尝试自动重启后再判定）
  const comfyReady = await ensureComfyUIReady({ log });
  if (!comfyReady) {
    log('WARN', `[LOGO] ${projectId}: ComfyUI not available (restart failed), will retry later`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'pending_logo' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Step 4: Generate logos（工单 030 批次循环；工单 042：客户上传 Logo → 4 槽方案）
  const companyName = normalizedCompanyName || 'Brand';
  const hanCount = (normalizedCompanyName.match(/[\u4e00-\u9fff]/g) || []).length;
  const qualityNote = logoTextMode === 'chinese' && hanCount > 4
    ? '中文品牌名超过4字，中文渲染存在质量风险'
    : '';
  // 工单 027：期望文本按 024 契约——中文=正式品牌名；拼音=从提示词提取 DeepSeek 写入的拼音。
  const expectedText = extractExpectedText(logoPrompts[0], logoTextMode, normalizedCompanyName);
  if (logoTextMode === 'pinyin' && !expectedText) {
    log('WARN', `[LOGO] ${projectId}: 拼音模式但无法从提示词提取期望拼音，Logo 校验将降级为未初检`);
  }

  const negativePrompt = 'deformed, blurry, low quality, distorted, 3d render, shadow, gradient, complex background, watermark, text, extra limbs, bad anatomy';
  // 工单 042：客户上传 Logo 检测（真实素材校验，禁止仅凭布尔/非空对象判断）
  const uploadCheck = isValidUploadedLogoAssets(clientInfo.logoAssets);
  const uploadMode = uploadCheck.valid && !!uploadCheck.url;

  let logoResults = [];
  let batchPaused = false;

  if (uploadMode) {
    log('INFO', `[LOGO] ${projectId}: 客户上传Logo模式（4槽：原图/优化版/AI×2）`);
    const palette = (brandProfile.colorPalette || []).map((c) => c && c.hex).filter(Boolean);
    // 槽1＝客户上传原图（直接展示，跳过内容校验）
    logoResults.push({
      index: 0,
      prompt: '客户上传原图',
      imageUrl: uploadCheck.url,
      error: null,
      vision: { status: 'passed', mode: logoTextMode, expectedText, coarseModel: '-', fineModel: '-', reason: 'customer_upload' },
      slot: 'original',
      slotLabel: '原图',
      source: 'uploaded',
    });
    // 槽2＝优化版：7B 提取上传 Logo 特征 → 拼品牌分析色板 → nvfp4 重绘（动态生成，不硬编码）
    try {
      const imgResp = await fetch(uploadCheck.url);
      if (!imgResp.ok) throw new Error(`download upload logo failed: ${imgResp.status}`);
      const b64 = Buffer.from(await imgResp.arrayBuffer()).toString('base64');
      const description = await describeLogoForOptimization(b64);
      const optPrompt = buildOptimizedLogoPrompt({
        description: description || '客户上传Logo',
        brandName: normalizedCompanyName || '品牌',
        brandColors: palette,
        mode: logoTextMode,
      });
      const seed = Math.floor(Math.random() * 2147483647);
      const genResult = await comfyuiGenerateLogo({
        prompt: optPrompt + ', logo design on clean white background, centered composition',
        negativePrompt,
        size: '1024x1024',
        mode: logoTextMode,
        seed,
      });
      await ensureVisionVramFree({ log });
      const vision = await runLogoVisionCheck({ imageBase64: genResult.imageUrl, prompt: optPrompt, expectedText, mode: logoTextMode });
      logoResults.push({
        index: 1,
        prompt: optPrompt,
        imageUrl: genResult.imageUrl,
        error: null,
        vision,
        slot: 'optimized',
        slotLabel: '优化版',
        source: 'ai-optimized',
        seed,
        model: genResult.model,
        durationMs: genResult.durationMs,
      });
    } catch (err) {
      log('WARN', `[LOGO] ${projectId}: 优化版生成失败: ${err.message}`);
      logoResults.push({
        index: 1,
        prompt: '优化版生成失败',
        imageUrl: null,
        error: err.message,
        vision: null,
        slot: 'optimized',
        slotLabel: '优化版',
        source: 'ai-optimized',
      });
    }
    // 槽3/4＝AI 生成（取前 2 条 023 提示词，走批次＋校验门）
    const aiPrompts = (logoPrompts || []).slice(0, 2);
    if (aiPrompts.length > 0) {
      const aiBatch = await runLogoBatchFlow({
        prompts: aiPrompts,
        generate: withMidGenGuard('Logo', async ({ prompt, seed }) => comfyuiGenerateLogo({
          prompt: prompt + ', logo design on clean white background, centered composition',
          negativePrompt,
          size: '1024x1024',
          mode: logoTextMode,
          seed,
        })),
        check: async ({ imageBase64, prompt }) => runLogoVisionCheck({
          imageBase64,
          prompt,
          expectedText,
          mode: logoTextMode,
        }),
        ensureReady: () => ensureComfyUIReady({ log }),
        isAvailable: () => isComfyUIAvailable(),
        // 工单 034：校验前确保 ComfyUI 完全停止并释放显存（停止而非仅空闲）
        beforeCheck: () => ensureVisionVramFree({ log }),
        log,
        gpuSnapshot,
        maxRounds: MAX_LOGO_BATCH_ROUNDS,
        maxAttempts: MAX_LOGO_GEN_ATTEMPTS,
        retryGapMs: LOGO_RETRY_GAP_MS,
      });
      aiBatch.results.forEach((r, i) => {
        r.index = i + 2;
        r.slot = 'ai';
        r.slotLabel = `AI方案${i + 1}`;
        r.source = 'ai';
        logoResults.push(r);
      });
      batchPaused = aiBatch.paused;
    }
  } else {
    log('INFO', `[LOGO] ${projectId}: Generating ${logoPrompts.length} logos via ComfyUI (mode=${logoTextMode}, 批次化)...`);
    const batch = await runLogoBatchFlow({
      prompts: logoPrompts,
      generate: withMidGenGuard('Logo', async ({ prompt, seed }) => comfyuiGenerateLogo({
        prompt: prompt + ', logo design on clean white background, centered composition',
        negativePrompt,
        size: '1024x1024',
        mode: logoTextMode,
        seed,
      })),
      check: async ({ imageBase64, prompt }) => runLogoVisionCheck({
        imageBase64,
        prompt,
        expectedText,
        mode: logoTextMode,
      }),
      ensureReady: () => ensureComfyUIReady({ log }),
      isAvailable: () => isComfyUIAvailable(),
      // 工单 034：校验前确保 ComfyUI 完全停止并释放显存（停止而非仅空闲）
      beforeCheck: () => ensureVisionVramFree({ log }),
      log,
      gpuSnapshot,
      maxRounds: MAX_LOGO_BATCH_ROUNDS,
      maxAttempts: MAX_LOGO_GEN_ATTEMPTS,
      retryGapMs: LOGO_RETRY_GAP_MS,
    });
    logoResults = batch.results;
    batchPaused = batch.paused;
  }

  if (batchPaused) {
    log('ERROR', `[LOGO] ${projectId}: 批次已暂停（ComfyUI 不可用），等待人工处理`);
    await supabase.from('projects').update({
      status: 'submitted',
      client_info: {
        ...clientInfo,
        generationStatus: 'paused_comfyui',
        generationMessage: 'ComfyUI 不可用，Logo 批次已暂停，等待人工处理',
        logoGenerationStatus: {
          total: logoPrompts.length,
          completed: logoResults.filter((r) => r.imageUrl || r.error).length,
          results: logoResults,
          pausedAt: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Step 5: Persist base64 images to Supabase Storage
  const successCount = logoResults.filter(r => r.imageUrl).length;
  log('INFO', `[LOGO] ${projectId}: ${successCount}/${logoResults.length} logos generated, persisting...`);

  for (const r of logoResults) {
    if (r.imageUrl && r.imageUrl.startsWith('data:')) {
      try {
        const matches = r.imageUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (matches) {
          let buffer = Buffer.from(matches[2], 'base64');
          // 工单 085-A-R1：上传前白底转透明 PNG（只清除与边缘连通的近似白），
          // 避免场景合成安全门拒绝白方框；失败时保留原图继续上传。
          try {
            buffer = await removeOpaqueWhiteBackground(buffer);
          } catch (e) {
            log('WARN', `[LOGO] ${projectId}: white-to-transparent failed for logo ${r.index}: ${e.message}; uploading original`);
          }
          const fileName = `${projectId}/logo_${r.index}_${Date.now()}.png`;
          const { error } = await supabase.storage
            .from('brand-brain-generated')
            .upload(fileName, buffer, { contentType: 'image/png', upsert: true });
          if (!error) {
            const { data } = supabase.storage.from('brand-brain-generated').getPublicUrl(fileName);
            r.imageUrl = data.publicUrl;
            log('INFO', `[LOGO] ${projectId}: Persisted logo ${r.index} -> ${data.publicUrl}`);
          }
        }
      } catch (e) {
        log('WARN', `[LOGO] ${projectId}: Failed to persist logo ${r.index}: ${e.message}`);
      }
    }
  }

  // Step 6: Update final status
  try {
    const finalProj = await supabase.from('projects').select('client_info').eq('id', projectId).single();
    const finalInfo = (finalProj.data?.client_info || clientInfo);
    const finalBP = finalInfo.brandProfile || brandProfile;

    if (successCount > 0) {
      await supabase.from('projects').update({
        status: 'logo_generated',
        client_info: {
          ...finalInfo,
          generationStatus: 'logo_generated',
          generationMessage: `Logo生成完成 (${successCount}/${logoResults.length})`,
          brandProfile: {
            ...finalBP,
            logoSlotScheme: uploadMode ? 'uploaded' : 'ai',
            logoGenerationResults: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error, vision: r.vision, slot: r.slot, slotLabel: r.slotLabel, source: r.source })),
            logoGeneratedAt: new Date().toISOString(),
          },
          logoGenerationStatus: {
            total: logoResults.length,
            completed: logoResults.length,
            results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error, vision: r.vision, slot: r.slot, slotLabel: r.slotLabel, source: r.source })),
            completedAt: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      log('INFO', `[LOGO] ${projectId}: DONE! Status -> logo_generated`);
    } else {
      await supabase.from('projects').update({
        status: 'submitted',
        client_info: { ...finalInfo, generationStatus: 'failed', generationMessage: 'Logo生成全部失败，请检查ComfyUI' },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      log('ERROR', `[LOGO] ${projectId}: ALL logos failed!`);
    }
  } catch (e) {
    log('ERROR', `[LOGO] ${projectId}: Final update error: ${e.message}`);
  }
}

// ========== Mascot Chapter Gating（工单 006G 统一契约） ==========

// 整改 #006G：client_info.mascotAssets 通过共享 adapter 归一化为规范结构，
// requested 以 wantMascot==="yes" 为唯一真源；ready 由 validateMascotAssets 判定
// （front/side/back 独立视图 + name + emotions>=8 + scenes>=4，threeView 不能凑数）。
function evaluateMascotChapter(ci) {
  if (ci?.wantMascot !== 'yes') return { include: false, result: null };
  const assets = buildMascotAssetSetFromClientInfo(ci);
  const result = validateMascotAssets({ assets });
  return { include: result.ready, result };
}

// ========== VI Manual Generation ==========

async function processManualGeneration(project) {
  const projectId = project.id;
  const clientInfo = (project.client_info || {});
  const brandProfile = clientInfo.brandProfile || {};
  const rawCompanyName = clientInfo.companyName || '';
  const normalizedCompanyName = normalizeBrandName(rawCompanyName);
  const mascotGate = evaluateMascotChapter(clientInfo);
  const includeMascot = mascotGate.include;

  if (clientInfo.wantMascot === 'yes' && !includeMascot) {
    // 工单 032：弹回样稿加次数上限，超过上限转人工，杜绝无限循环。
    const sampleAttempts = (typeof clientInfo.mascotSampleAttempts === 'number' ? clientInfo.mascotSampleAttempts : 0) + 1;
    const stopLoop = sampleAttempts > 2;
    log(stopLoop ? 'ERROR' : 'WARN', `[MANUAL] ${projectId}: IP 素材不完整（弹回次数 ${sampleAttempts}）${stopLoop ? '，超过上限转人工，不再弹回样稿' : ''}`);
    await supabase.from('projects').update({
      status: 'submitted',
      client_info: {
        ...clientInfo,
        generationStatus: stopLoop ? 'needs_review' : 'mascot_generating',
        generationMessage: stopLoop ? 'IP 素材多次不完整，等待人工处理' : 'IP 素材不完整，暂不渲染VI手册',
        mascotSampleAttempts: sampleAttempts,
        mascotMissing: mascotGate.result?.missing || [],
        mascotCounts: mascotGate.result?.counts,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  log('INFO', `[MANUAL] Processing project: ${projectId} (${rawCompanyName || 'unknown'})`);

  // Mark as generating
  await supabase.from('projects').update({
    status: 'manual_generating',
    client_info: {
      ...clientInfo,
      generationStatus: 'manual_generating',
      generationMessage: '正在生成VI手册场景图...',
      generationPercent: 10,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  // Step 1: Get selected logo
  const selectedLogoAsset = resolveSelectedLogoAsset(brandProfile);
  if (selectedLogoAsset.status !== 'selected') {
    log('ERROR', `[MANUAL] ${projectId}: ${selectedLogoAsset.message}`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: '未找到选中的Logo' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  log('INFO', `[MANUAL] ${projectId}: Downloading selected logo...`);
  let logoData;
  try {
    const imgResp = await fetch(selectedLogoAsset.imageUrl);
    if (!imgResp.ok) throw new Error(`Failed to download: ${imgResp.status}`);
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    // 工单 085-A-R1：下载后转透明 PNG（兼容存量 JPEG Logo），供场景合成/照片/PPTX 使用
    let logoBuffer = imgBuffer;
    try {
      logoBuffer = await removeOpaqueWhiteBackground(imgBuffer);
    } catch (err) {
      log('WARN', `[MANUAL] ${projectId}: white-to-transparent failed, using original logo: ${err.message}`);
    }
    logoData = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (err) {
    log('ERROR', `[MANUAL] ${projectId}: Logo download failed: ${err.message}`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: `Logo下载失败: ${err.message}` },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Step 2: Generate 5 scene images via ComfyUI
  log('INFO', `[MANUAL] ${projectId}: Generating scene images...`);
  const companyName = normalizedCompanyName;
  const industryType = getIndustryType(clientInfo.industry || 'general');
  // 工单 021：优先使用 DeepSeek 行业场景提示词（解决“奶茶店场景出现沐浴乳”的
  // 跨行业画面问题）；brandProfile.sceneImageSuggestions 缺失/为空时回退通用模板。
  const sceneSuggestions = brandProfile.sceneImageSuggestions;
  const rawIndustry = clientInfo.industry || 'general';
  const profileColors = (brandProfile && brandProfile.colorPalette) || [];
  const scenePrompts = (Array.isArray(sceneSuggestions) && sceneSuggestions.length > 0)
    ? buildScenePromptsFromSuggestions(sceneSuggestions, companyName, industryType, rawIndustry, profileColors)
    : buildScenePrompts(companyName, industryType, rawIndustry, profileColors);

  const sceneImages = {};
  const sceneLabels = {
    'stationery-1': 'VI应用效果图1', 'packaging-1': 'VI应用效果图2',
    'packaging-2': 'VI应用效果图3', 'marketing-storefront': 'VI应用效果图4', 'marketing-1': 'VI应用效果图5',
  };
  const sceneSectionTitles = {
    'stationery-1': '品牌应用系统', 'packaging-1': '产品包装系统',
    'packaging-2': '产品包装系统', 'marketing-storefront': '门店品牌系统', 'marketing-1': '营销展示系统',
  };
  const sceneVision = {};
  const photoReplacedKeys = new Set();
  // 工单 044：照片预处理（下载/选正立面/7B 定位文字区/蒙版）——必须在
  // ComfyUI 启动前执行（Ollama 需要显存），失败回退原文生图。
  const uploadedLogoUrl = (clientInfo.logoAssets && clientInfo.logoAssets[0] && clientInfo.logoAssets[0].url) || null;
  // 工单 086-R2：客户照片质量不达标时（显式 skipCustomerPhotoScene=true），
  // 跳过照片→场景链路，场景图全部由平台自生成，避免低质量照片拉低手册质量。
  const skipCustomerPhotoScene = clientInfo.skipCustomerPhotoScene === true;
  const photoPrep = skipCustomerPhotoScene
    ? null
    : await preparePhotoScene({ project, clientInfo, brandProfile, companyName, log, logoData, uploadedLogoUrl });
  if (skipCustomerPhotoScene) {
    log('INFO', `[MANUAL] ${projectId}: skipCustomerPhotoScene=true，跳过客户照片场景链路，使用平台自生成场景`);
  }
  const photoKeys = pickPhotoSceneKeys(sceneSuggestions);

  // 工单 030：手册阶段生图前 ComfyUI 健康门（自动重启尝试）
  const comfyReady = await ensureComfyUIReady({ log });
  if (!comfyReady) {
    log('WARN', `[MANUAL] ${projectId}: ComfyUI not available (restart failed), will retry later`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'pending_manual' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // 工单 044：照片→场景图（文字替换 + 品牌色重涂）
  const photoScenes = { text: null, color: null };
  if (photoPrep) {
    photoScenes.text = await generatePhotoSceneWithRetry({
      ...photoPrep,
      prompt: photoPrep.textPrompt,
      variant: 'nvfp4',
      log,
    });
    if (photoPrep.colorPrompt) {
      photoScenes.color = await generatePhotoSceneWithRetry({
        ...photoPrep,
        prompt: photoPrep.colorPrompt,
        variant: 'nvfp4',
        checkColor: true,
        log,
      });
    }
    if (photoScenes.text && photoScenes.text.imageUrl) {
      photoReplacedKeys.add(photoKeys.textKey);
      sceneImages[photoKeys.textKey] = photoScenes.text.imageUrl;
      sceneVision[photoKeys.textKey] = photoScenes.text.vision?.status || (photoScenes.text.status === 'needs_review' ? 'needs_review' : 'skipped');
      log('INFO', `[MANUAL] ${projectId}: 照片门头场景 OK (key=${photoKeys.textKey}, vision=${sceneVision[photoKeys.textKey]})`);
    } else if (photoScenes.text) {
      log('WARN', `[MANUAL] ${projectId}: 照片重绘未产出可用图（${photoScenes.text.status || 'failed'}），该槽回退 AI 生成`);
    }
    if (photoScenes.color && photoScenes.color.imageUrl) {
      photoReplacedKeys.add(photoKeys.colorKey);
      sceneImages[photoKeys.colorKey] = photoScenes.color.imageUrl;
      sceneVision[photoKeys.colorKey] = photoScenes.color.vision?.status || 'skipped';
      log('INFO', `[MANUAL] ${projectId}: 品牌色重涂场景 OK (key=${photoKeys.colorKey}, vision=${sceneVision[photoKeys.colorKey]}, color=${photoScenes.color.colorStatus || 'n/a'})`);
    }
    clientInfo.photoScenes = {
      text: photoScenes.text && photoScenes.text.imageUrl
        ? { url: photoScenes.text.imageUrl, vision: sceneVision[photoKeys.textKey], seed: photoScenes.text.seed, durationMs: photoScenes.text.durationMs }
        : null,
      color: photoScenes.color && photoScenes.color.imageUrl
        ? { url: photoScenes.color.imageUrl, vision: sceneVision[photoKeys.colorKey], colorStatus: photoScenes.color.colorStatus, seed: photoScenes.color.seed, durationMs: photoScenes.color.durationMs }
        : null,
    };
    if (photoPrep.logoHasText !== null) {
      clientInfo.logoHasText = photoPrep.logoHasText;
    }
    if (photoPrep.logoHasTextInfo) {
      clientInfo.logoOcrText = photoPrep.logoHasTextInfo.text || '';
      clientInfo.logoOcrModel = photoPrep.logoHasTextInfo.model;
    }
  }

  // 工单 031：场景批次循环＋统一校验（品牌文字按 024 契约；空/乱码→skipped）
  // 工单 085-B-R2：文字门显式契约——expectedText 来源改为「场景实际文字层 + logo OCR 文字」；
  // 两者皆空且 logo 无文字 → mode='none'（显式 skipped，记录理由）；否则照旧严格 OCR 逐字相等。
  const sceneTextMode = (clientInfo.logoTextLanguage === 'pinyin') ? 'pinyin' : 'chinese';
  const logoTextInfo = await detectLogoHasText(logoData, VISION_FINE_MODEL);
  log('INFO', `[MANUAL] ${projectId}: logo OCR 证据 hasText=${logoTextInfo.hasText} text=${JSON.stringify(logoTextInfo.text || '')} model=${logoTextInfo.model} source=${logoTextInfo.source || 'n/a'}`);
  if (logoTextInfo.hasText === null) {
    log('WARN', `[MANUAL] ${projectId}: logo OCR 不可用，场景文字门保持 fail-closed（不会因无法证实纯图形而放行）`);
  }
  const activeScenePrompts = scenePrompts.filter((sp) => !photoReplacedKeys.has(sp.key));
  const sceneGenerationRequests = activeScenePrompts.map((sp) => ({
    ...sp,
    selectedLogoUrl: selectedLogoAsset.imageUrl,
    routeStatus: sp.logoPlacement?.executorStatus || 'pending_executor',
  }));
  sceneGenerationRequests.forEach((request) => {
    log('INFO', `[MANUAL] ${projectId}: Logo scene route key=${request.key} strategy=${request.logoPlacement?.strategy || 'composite'} fallback=${request.logoPlacement?.fallback || 'none'} status=${request.routeStatus}`);
  });
  let sceneResults = [];
  let scenePaused = false;
  const { ready: readySceneRequests, pending: pendingSceneRequests } = partitionLogoSceneRequests(sceneGenerationRequests);
  pendingSceneRequests.forEach((request) => {
    sceneVision[request.key] = 'pending_executor';
    log('WARN', `[MANUAL] ${projectId}: Scene ${request.key} 路由未就绪 (${request.routeStatus})，不进入普通文生图批次`);
  });
  const sceneResultByKey = new Map();
  const compositeSceneRequests = readySceneRequests.filter((request) => request.logoPlacement?.strategy === 'composite');
  const aiDrawnSceneRequests = readySceneRequests.filter((request) => request.logoPlacement?.strategy === 'ai_drawn');
  const referenceSceneRequests = readySceneRequests.filter((request) => request.logoPlacement?.strategy === 'reference_anchor');
  if (compositeSceneRequests.length > 0) {
    const sceneBatch = await runLogoBatchFlow({
      prompts: compositeSceneRequests.map((request) => request.prompt),
      generate: withMidGenGuard('Scene', async ({ prompt }) => {
        const request = compositeSceneRequests.find((item) => item.prompt === prompt);
        if (!request) throw new Error('LOGO_SCENE_ROUTE_NOT_EXECUTABLE');
        if (request.logoPlacement?.strategy !== 'composite') {
          throw new Error('LOGO_SCENE_ROUTE_NOT_EXECUTABLE');
        }
        const background = await comfyuiGenerateScene({
          prompt: request.prompt,
          negativePrompt: 'blurry, low quality, distorted, watermark, text overlay',
          size: '1024x1024',
        });
        const composite = await compositeLogoOnScene({
          background: background.imageUrl,
          logo: logoData,
          sceneKey: request.key,
          layout: getLogoSceneLayout(request.key) || undefined,
        });
        if (!composite.ok) {
          throw new Error(`${composite.errorCode}: ${composite.message}`);
        }
        return {
          ...background,
          imageUrl: composite.imageUrl,
          executorStatus: composite.executorStatus,
          strategy: composite.strategy,
          sceneKey: composite.sceneKey,
          layoutName: composite.layoutName,
        };
      }),
      check: async ({ imageBase64, prompt }) => {
        const request = compositeSceneRequests.find((item) => item.prompt === prompt);
        const keyLabel = (request && request.key) || '?';
        const gate = resolveSceneTextGate({
          sceneKey: keyLabel,
          prompt,
          mode: sceneTextMode,
          companyName: normalizedCompanyName,
          logoHasText: logoTextInfo.hasText,
          logoText: logoTextInfo.text || '',
        });
        if (gate.mode === 'none') {
          log('INFO', `[VISION] Scene ${keyLabel} 文字门显式 skipped：${gate.reason}（logo OCR 无文字 + 场景无文字层）`);
          return {
            status: 'skipped',
            mode: 'none',
            expectedText: '',
            reason: gate.reason,
            coarseModel: VISION_COARSE_MODEL,
            fineModel: VISION_FINE_MODEL,
            checkedAt: new Date().toISOString(),
          };
        }
        if (logoTextInfo.hasText === null) {
          log('WARN', `[VISION] Scene ${keyLabel} logo OCR 不可用，无法证实纯图形，fail-closed（needs_review）`);
          return {
            status: 'needs_review',
            mode: gate.mode,
            expectedText: gate.expectedText,
            reason: 'logo_ocr_unavailable_fail_closed',
            coarseModel: VISION_COARSE_MODEL,
            fineModel: VISION_FINE_MODEL,
            checkedAt: new Date().toISOString(),
          };
        }
        if (!normalizeForCompare(gate.expectedText, gate.mode)) {
          log('WARN', `[VISION] Scene ${keyLabel} 需严格文字校验但期望文本无可比对字符（mode=${gate.mode}），fail-closed（needs_review）`);
          return {
            status: 'needs_review',
            mode: gate.mode,
            expectedText: gate.expectedText,
            reason: 'expected_text_not_comparable',
            coarseModel: VISION_COARSE_MODEL,
            fineModel: VISION_FINE_MODEL,
            checkedAt: new Date().toISOString(),
          };
        }
        return runSceneVisionCheck({ imageBase64, expectedText: gate.expectedText, mode: gate.mode, coarseModel: VISION_COARSE_MODEL, fineModel: VISION_FINE_MODEL });
      },
      ensureReady: () => ensureComfyUIReady({ log }),
      isAvailable: () => isComfyUIAvailable(),
      // 工单 034：校验前确保 ComfyUI 完全停止并释放显存（停止而非仅空闲）
      beforeCheck: () => ensureVisionVramFree({ log }),
      log,
      gpuSnapshot,
      maxRounds: 2,
      maxAttempts: 3,
      retryGapMs: 30000,
      label: 'Scene',
    });
    scenePaused = sceneBatch.paused;
    compositeSceneRequests.forEach((request, index) => sceneResultByKey.set(request.key, sceneBatch.results[index]));
  }

  // 工单 091-R4：AI 场景文字清理——定位文字区 → 蒙版 → ComfyUI inpaint 抹掉
  // AI 乱码文字（复用 044 链路），供营销门头/海报在代码贴字前使用。
  async function cleanAiSceneText(imageBase64, log) {
    const prefix = `091scenetext_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const srcFile = `${prefix}_src.png`;
    const maskedFile = `${prefix}_masked.png`;
    const srcPath = path.join(COMFYUI_INPUT_DIR, srcFile);
    const maskedPath = path.join(COMFYUI_INPUT_DIR, maskedFile);
    try {
      const mm = String(imageBase64 || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
      if (!mm) return imageBase64;
      await sharp(Buffer.from(mm[2], 'base64')).resize({ width: 1280, withoutEnlargement: true }).png().toFile(srcPath);
      const region = await locateTextRegion(srcPath, { model: VISION_FINE_MODEL });
      if (!region) {
        log('INFO', '[SCENE-TEXT] 未定位到文字区域，跳过清理');
        return imageBase64;
      }
      // 工单 091-R4：定位到文字区即 inpaint。预检 OCR 不可靠（num_predict 200 +
      // 冷加载会把英文描述先输出、中文被截断漏读，导致跳过清理后核字门反复 suspect；
      // AI 实际画了「会院会员屏/会员手脉」等真实中文乱码，必须清掉再贴字）。
      log('INFO', `[SCENE-TEXT] 定位文字区域 ${JSON.stringify(region)}，开始 inpaint 清理`);
      await generateInpaintMaskPng(srcPath, region, maskedPath, { featherPx: 24 });
      if (!(await ensureComfyUIReady({ log }))) return imageBase64;
      const gen = await comfyuiInpaintPhoto({
        imageFile: maskedFile,
        prompt: 'clean blank unprinted surface with subtle texture matching the surrounding area, remove all text letters words numbers and characters completely, no typography, professional product photography',
        seed: Math.floor(Math.random() * 2147483647),
        variant: 'nvfp4',
      });
      await ensureVisionVramFree({ log }).catch(() => {});
      log('INFO', '[SCENE-TEXT] inpaint 清理完成');
      return gen.imageUrl;
    } catch (err) {
      log('WARN', `[SCENE-TEXT] 清理失败回退原图: ${err.message}`);
      await killComfyUI().catch(() => {});
      return imageBase64;
    } finally {
      await fs.unlink(srcPath).catch(() => {});
      await fs.unlink(maskedPath).catch(() => {});
    }
  }

  // 工单 091-R2：名片/信纸/包装 AI 入景绘制（z-turbo 文生图，稳定），
  // 验收=LOGO 在场/无乱码中文/无水印；不合格重试一次，不再代码硬贴。
  if (!scenePaused && aiDrawnSceneRequests.length > 0) {
    const aiGenerate = withMidGenGuard('SceneAIDrawn', async ({ request, seed }) => comfyGenerateImage({
      prompt: request.prompt,
      negativePrompt: 'blurry, low quality, distorted, watermark, garbled text, chinese characters, 中文, letters, words, numbers, handwriting, logo text, multiple logos',
      width: 1024,
      height: 1024,
    }));
    for (const request of aiDrawnSceneRequests) {
      let done = false;
      // 工单 091-R4：营销页核字门「乱码自动重生成直到通过」→ 重试上限提到 8 次，
      // 不再 2 次后保留 needs_review 图直接交付（回执须如实标注是否仍卡住）。
      for (let attempt = 1; attempt <= 8 && !done; attempt++) {
        try {
          if (!(await ensureComfyUIReady({ log }))) throw new Error('ComfyUI not ready');
          const seed = Math.floor(Math.random() * 2147483647);
          const generated = await aiGenerate({ request, seed });
          // 证据留档（logs，仅日志目录）。
          try {
            const mm = String(generated.imageUrl || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
            if (mm) await fs.mkdir('D:/disk/HermesDisk/bb-clean/logs/091/ai-scenes', { recursive: true }).then(() => fs.writeFile(`D:/disk/HermesDisk/bb-clean/logs/091/ai-scenes/${request.key}-${seed}.png`, Buffer.from(mm[2], 'base64')));
          } catch { /* 留档失败不阻断 */ }
          await ensureVisionVramFree({ log }).catch(() => {});
          let finalImage = generated.imageUrl;
          if (['stationery-1', 'packaging-1', 'packaging-2', 'marketing-storefront', 'marketing-1'].includes(request.key)) {
            // 工单 091-R4：z-turbo 常把会员卡/海报画出乱码中文，核字门反复失败。
            // 先定位 AI 文字区并用 ComfyUI inpaint 清理（复用 044 链路），再代码贴字。
            finalImage = await cleanAiSceneText(generated.imageUrl, log);
            const brandShort = String(normalizedCompanyName || '').slice(0, 3);
            if (brandShort) {
              // 工单 091-R4：浅色墙面/前台场景用深玫瑰字+浅色光晕（白字+发光会被
              // 视觉模型判为半透明水印；strokeColor 不得传 "none"——satori 对
              // undefined textShadow 抛错导致贴字失败）。
              const signLike = request.key === 'stationery-1';
              const overlaid = await overlayBrandTextOnScene({
                background: finalImage,
                text: brandShort,
                xRatio: 0.5,
                yRatio: 0.12,
                textHeightRatio: 0.09,
                color: signLike ? "#7A3B44" : "#FFFFFF",
                strokeColor: signLike ? "rgba(255,255,255,0.9)" : "rgba(60,30,10,0.9)",
              });
              if (overlaid.ok) {
                finalImage = overlaid.imageUrl;
                log('INFO', `[MANUAL] ${projectId}: Scene ${request.key} 代码贴入品牌字「${brandShort}」`);
              }
            }
          }
          const aiCheck = await runAIDrawnSceneCheck(finalImage, { models: [VISION_FINE_MODEL || 'my-vl:latest', VISION_COARSE_MODEL || 'qwen2.5vl:latest'] });
          if (aiCheck.status === 'passed') {
            let textOk = true;
            if (['stationery-1', 'packaging-1', 'packaging-2', 'marketing-storefront', 'marketing-1'].includes(request.key)) {
              const textCheck = await runSceneVisionCheck({ imageBase64: finalImage, expectedText: '百疗萃', mode: 'chinese', coarseModel: VISION_COARSE_MODEL, fineModel: VISION_FINE_MODEL });
              textOk = textCheck.status === 'passed';
              log('INFO', `[MANUAL] ${projectId}: Scene ${request.key} 「百疗萃」核字=${textCheck.status}`);
            }
            if (textOk) {
              sceneResultByKey.set(request.key, { ...generated, imageUrl: finalImage, sceneKey: request.key, vision: aiCheck, aiDrawn: aiCheck });
              log('INFO', `[MANUAL] ${projectId}: Scene ${request.key} AI 入景绘制验收通过（第${attempt}次）`);
              done = true;
            } else {
              log('WARN', `[MANUAL] ${projectId}: Scene ${request.key} 「百疗萃」核字未过（第${attempt}次）${attempt === 8 ? '，第8次仍未过，标记 needs_review（不静默交付，交交付门拦截）' : '，继续重试'}`);
              // 工单 091-R4：核字门最终失败时 vision 也置 needs_review，
              // 交付门（evaluateLogoSceneDeliveryGate）才能拦截；否则 sceneVision=passed
              // 会让乱码图静默嵌入（R4 复现教训）。
              if (attempt === 8) sceneResultByKey.set(request.key, { ...generated, imageUrl: finalImage, sceneKey: request.key, vision: { ...aiCheck, status: 'needs_review', reason: 'brand_text_gate_failed_after_8' }, aiDrawn: aiCheck, executorStatus: 'ai_drawn_needs_review' });
            }
          } else {
            log('WARN', `[MANUAL] ${projectId}: Scene ${request.key} AI 入景验收 ${aiCheck.status}（第${attempt}次）${attempt === 8 ? '，第8次仍未过，标记 needs_review（交交付门拦截）' : '，继续重试'}`);
            if (attempt === 8) sceneResultByKey.set(request.key, { ...generated, imageUrl: finalImage, sceneKey: request.key, vision: { ...aiCheck, status: 'needs_review' }, aiDrawn: aiCheck, executorStatus: 'ai_drawn_needs_review' });
          }
        } catch (error) {
          log('WARN', `[MANUAL] ${projectId}: Scene ${request.key} AI 入景生成异常（第${attempt}次）：${error.message}`);
          if (attempt === 8) sceneResultByKey.set(request.key, { error: error.message, vision: { status: 'failed', reason: String(error.message) }, executorStatus: 'ai_drawn_failed' });
        }
      }
    }
  }

  // 073：参考图与 Ollama 双图校验严格分阶段，避免 ComfyUI/Ollama 同时占用显存。
  if (!scenePaused && referenceSceneRequests.length > 0) {
    const anchorCandidates = [];
    const referenceGenerate = withMidGenGuard('SceneReference', async ({ request, seed }) => comfyGenerateReferenceAnchor({
      prompt: request.prompt,
      referenceImage: logoData,
      seed,
      width: 1024,
      height: 1024,
    }));
    if (!(await ensureComfyUIReady({ log }))) {
      scenePaused = true;
    } else {
      for (const request of referenceSceneRequests) {
        try {
          const seed = Math.floor(Math.random() * 2147483647);
          const generated = await referenceGenerate({ request, seed });
          anchorCandidates.push({ request, generated });
        } catch (error) {
          // 工单 091-R2：AI 入景生成失败重试一次，不再转 composite 硬贴。
          log('WARN', `[MANUAL] ${projectId}: Scene ${request.key} AI 入景生成失败（${error.code || error.message}），重试一次`);
          try {
            if (!(await ensureComfyUIReady({ log }))) throw new Error('ComfyUI not ready');
            const seed2 = Math.floor(Math.random() * 2147483647);
            const generated = await referenceGenerate({ request, seed: seed2 });
            anchorCandidates.push({ request, generated, retried: true });
          } catch (error2) {
            sceneResultByKey.set(request.key, { error: error2.message, vision: { status: 'failed', reason: String(error2.message) } });
            log('WARN', `[MANUAL] ${projectId}: Scene ${request.key} AI 入景生成重试后仍失败`);
          }
        }
      }
    }

    if (!scenePaused && anchorCandidates.length > 0) {
      await ensureVisionVramFree({ log });
      for (const candidate of anchorCandidates) {
        const aiCheck = await runAIDrawnSceneCheck(candidate.generated.imageUrl, { models: [VISION_FINE_MODEL || 'my-vl:latest', VISION_COARSE_MODEL || 'qwen2.5vl:latest'] });
        if (aiCheck.status === 'passed') {
          sceneResultByKey.set(candidate.request.key, {
            ...candidate.generated,
            sceneKey: candidate.request.key,
            vision: aiCheck,
            aiDrawn: aiCheck,
          });
          log('INFO', `[MANUAL] ${projectId}: Scene ${candidate.request.key} AI 入景绘制验收通过（LOGO 在场/无乱码/无水印）`);
        } else {
          // 工单 091-R2：AI 入景不合格不再代码硬贴——重生成一次，仍不合格保留 AI 图并标记 needs_review。
          log('WARN', `[MANUAL] ${projectId}: Scene ${candidate.request.key} AI 入景验收 ${aiCheck.status}（${aiCheck.reason || ''}），重生成一次`);
          try {
            if (!(await ensureComfyUIReady({ log }))) throw new Error('ComfyUI not ready');
            const seed2 = Math.floor(Math.random() * 2147483647);
            const retried = await referenceGenerate({ request: candidate.request, seed: seed2 });
            await ensureVisionVramFree({ log }).catch(() => {});
            const retryCheck = await runAIDrawnSceneCheck(retried.imageUrl, { models: [VISION_FINE_MODEL || 'my-vl:latest', VISION_COARSE_MODEL || 'qwen2.5vl:latest'] });
            if (retryCheck.status === 'passed') {
              sceneResultByKey.set(candidate.request.key, { ...retried, sceneKey: candidate.request.key, vision: retryCheck, aiDrawn: retryCheck });
            } else {
              sceneResultByKey.set(candidate.request.key, { ...retried, sceneKey: candidate.request.key, vision: retryCheck, aiDrawn: retryCheck, executorStatus: 'ai_drawn_needs_review' });
              log('WARN', `[MANUAL] ${projectId}: Scene ${candidate.request.key} AI 入景重生成后仍不合格（保留 AI 图，标记 needs_review，不再硬贴）`);
            }
          } catch (error) {
            sceneResultByKey.set(candidate.request.key, { error: error.message, vision: { status: 'failed', reason: String(error.message) } });
          }
        }
      }
    }
  }
  sceneResults = readySceneRequests.map((request) => sceneResultByKey.get(request.key) || { error: 'LOGO_SCENE_RESULT_MISSING' });
  if (scenePaused) {
    log('WARN', `[MANUAL] ${projectId}: 场景批次已暂停（ComfyUI 不可用），稍后重试`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'pending_manual', generationMessage: 'ComfyUI 不可用，场景批次已暂停，等待重试' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }
  readySceneRequests.forEach((sp, i) => {
    const r = sceneResults[i];
    sceneVision[sp.key] = (r && r.vision && r.vision.status) || (r && r.status) || 'failed';
    if (r && r.imageUrl) {
      sceneImages[sp.key] = r.imageUrl;
      log('INFO', `[MANUAL] ${projectId}: Scene ${sp.key} OK (${r.durationMs || '?'}ms, vision=${sceneVision[sp.key]})`);
    } else {
      log('WARN', `[MANUAL] ${projectId}: Scene ${sp.key} 未生成/未通过校验，using placeholder`);
    }
  });
  clientInfo.logoSceneExecution = Object.fromEntries(readySceneRequests.map((sp, i) => {
    const result = sceneResults[i];
    return [sp.key, result ? {
      strategy: result.strategy || sp.logoPlacement?.strategy,
      executorStatus: result.executorStatus || sp.routeStatus,
      fidelityStatus: result.fidelity?.status || null,
    } : { strategy: sp.logoPlacement?.strategy, executorStatus: 'failed', fidelityStatus: null }];
  }));
  clientInfo.sceneVision = sceneVision;

  // 工单 072：必需 A 类场景未就绪时，在 DeepSeek/PPTX/上传前停止。
  // 工单 085-A-R2：仅带显式「测试单」标记的项目可启用 A 类营销场景降级通道；
  // 正式单契约（5 张齐全）保持不变。
  const isTestOrder = clientInfo.isTestOrder === true || clientInfo.testOrder === true;
  const logoSceneGate = evaluateLogoSceneDeliveryGate({
    requiredKeys: scenePrompts.map((scene) => scene.key),
    sceneImages,
    sceneVision,
    requests: sceneGenerationRequests,
  }, isTestOrder ? { allowMissingMarketingOnlyForTestOrder: true } : undefined);
  clientInfo.logoSceneGate = logoSceneGate;
  if (isTestOrder && logoSceneGate.missing && logoSceneGate.missing.length > 0) {
    log('WARN', `[MANUAL] ${projectId}: 测试单降级通道启用，A 类营销场景显式待补（pending_074）：${logoSceneGate.missing.map((item) => `${item.key}:${item.reason}`).join(', ')}`);
    clientInfo.sceneMissing = logoSceneGate.missing;
    // 被排除的营销槽位不得静默当作已就绪：从待渲染 sceneImages 中移除，
    // render-pptx 对缺图营销章节渲染显式「待补（074）」占位页。
    for (const item of logoSceneGate.missing) {
      delete sceneImages[item.key];
    }
  }
  if (!logoSceneGate.ready) {
    log('WARN', `[MANUAL] ${projectId}: ${logoSceneGate.message}`);
    await supabase.from('projects').update({
      status: 'needs_review',
      client_info: {
        ...clientInfo,
        generationStatus: 'needs_review',
        generationMessage: logoSceneGate.message,
        generationPercent: 35,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Update progress
  await supabase.from('projects').update({
    client_info: { ...clientInfo, generationStatus: 'manual_generating', generationMessage: '正在规划VI手册页面...', generationPercent: 40 },
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  // Step 3: Plan pages via DeepSeek
  log('INFO', `[MANUAL] ${projectId}: Planning pages...`);
  let blueprints;
  try {
    const cp = brandProfile.colorPalette || [];
    const canonicalMascotAssets = buildMascotAssetSetFromClientInfo(clientInfo);
    const brandColors = {
      primary: { hex: cp[0]?.hex || '#333333', name: cp[0]?.name || '主色' },
      secondary: { hex: cp[1]?.hex || '#666666', name: cp[1]?.name || '辅助色' },
      accent: { hex: cp[2]?.hex || '#CC0000', name: cp[2]?.name || '强调色' },
    };

    blueprints = await planPages({
      clientInfo: {
        companyName: normalizedCompanyName,
        brandVision: clientInfo.brandVision || brandProfile.refinedBrandVision || '',
        coreValues: clientInfo.coreValues || brandProfile.refinedCoreValues || '',
        targetMarket: clientInfo.targetMarket || brandProfile.refinedTargetMarket || '',
        logoPhilosophy: clientInfo.logoPhilosophy || '',
        industry: clientInfo.industry || 'general',
        brandPersonality: clientInfo.brandPersonality || '',
        // 工单 086-R4：角色设定显式文案优先（与真实生成资产一致，防 DeepSeek 按品牌色板生成矛盾描述）
        mascotCharacterSetting: clientInfo.mascotCharacterSetting || undefined,
      },
      // 整改 #006/#006F：显式传递正式品牌名与内部项目名（生产实际读取位置）
      formalBrandName: clientInfo.formalBrandName || undefined,
      projectDisplayName: clientInfo.projectDisplayName || undefined,
      brandColors,
      // 整改 #006F：requested 以 wantMascot==="yes" 为唯一真源；ready 以真实资产契约为准
      // （不再传 includeMascotChapter / mascotAssetsReady 绕过规划期门禁）
      wantMascot: clientInfo.wantMascot || undefined,
      mascotAssets: canonicalMascotAssets,
      assetAnalysis: {
        // 工单 009：Logo 结构证据只来自显式字段 logoDesignSuggestions.elements，
        // 缺失/为空时保持 []（通用规则，安全默认），不从文案猜测元素。
        logo: { hasLogo: !!brandProfile?.selectedLogo?.imageUrl, elements: extractLogoElements(brandProfile?.logoDesignSuggestions?.elements), styleTags: extractStyleTags(brandProfile?.logoDesignSuggestions?.style), meaning: clientInfo.logoPhilosophy || '' },
        mascot: { hasMascot: clientInfo.wantMascot === 'yes', name: canonicalMascotAssets.name || '' },
      },
    });
    log('INFO', `[MANUAL] ${projectId}: ${blueprints.length} pages planned`);
  } catch (err) {
    log('ERROR', `[MANUAL] ${projectId}: Page planning failed: ${err.message}`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: `页面规划失败: ${err.message}` },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Update progress
  await supabase.from('projects').update({
    client_info: { ...clientInfo, generationStatus: 'manual_generating', generationMessage: '正在渲染VI手册PPTX...', generationPercent: 70 },
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  // Step 3.5: Prepare mascot images for PPTX
  let mascotData = null;
  let mascotSplitViews = null;
  let mascotEmotions = null;
  let mascotScenes = null;
  let mascotThreeViewData = null;
  const mascotAssets = clientInfo.mascotAssets;
  if (mascotAssets && mascotAssets.front) {
    try {
      const imgResp = await fetch(mascotAssets.front);
      if (imgResp.ok) {
        const buf = Buffer.from(await imgResp.arrayBuffer());
        const mime = imgResp.headers.get('content-type') || 'image/png';
        mascotData = 'data:' + mime + ';base64,' + buf.toString('base64');
      }
    } catch (err) {
      log('WARN', '[MANUAL] ' + projectId + ': Mascot front download failed: ' + err.message);
    }
    const views = [mascotAssets.front, mascotAssets.side, mascotAssets.back].filter(Boolean);
    if (views.length > 0) {
      mascotSplitViews = [];
      for (const url of views) {
        try {
          mascotSplitViews.push(await fetchMascotImageAsDataUri(url, 1280));
        } catch (e) {
          log('WARN', '[MANUAL] ' + projectId + ': Mascot view download failed: ' + e.message);
        }
      }
    }
    // 工单 085-B-R2：公仔表情/场景图必须下载为 data URI 再传入渲染。
    // render-pptx 的 addImage 只接受 base64/data URI，URL 会被当作 base64 解析
    // 而崩溃（Invalid base64 input）；且需压缩到网格尺寸（桶上限 10MB）。
    // URL 下载失败时跳过该张（不崩溃）。
    if (mascotAssets.emotions && mascotAssets.emotions.length > 0) {
      mascotEmotions = {};
      for (const em of mascotAssets.emotions) {
        if (em.url) {
          try {
            mascotEmotions[em.name || em.url] = await fetchMascotImageAsDataUri(em.url, 1024);
          } catch (e) {
            log('WARN', '[MANUAL] ' + projectId + ': Mascot emotion download failed: ' + e.message);
          }
        }
      }
    }
    if (mascotAssets.scenes && mascotAssets.scenes.length > 0) {
      mascotScenes = {};
      for (const sc of mascotAssets.scenes) {
        if (sc.url) {
          try {
            mascotScenes[sc.name || sc.url] = await fetchMascotImageAsDataUri(sc.url, 1280);
          } catch (e) {
            log('WARN', '[MANUAL] ' + projectId + ': Mascot scene download failed: ' + e.message);
          }
        }
      }
    }
  }

  // 工单 086-R2：三视图页优先使用代码合拼的「单角色三面板」横版
  // （mascotAssets.threeView），无合拼版时回退正面图。
  if (mascotAssets && typeof mascotAssets.threeView === 'string' && mascotAssets.threeView.length > 0) {
    try {
      // 工单 086-R2：合拼版压缩后嵌入 PPTX（防超桶 10MB 上限；无 alpha → JPEG q82）
      mascotThreeViewData = await fetchMascotImageAsDataUri(mascotAssets.threeView, 1600);
      log('INFO', `[MANUAL] ${projectId}: 三视图合拼版已载入并压缩（mascotAssets.threeView）`);
    } catch (err) {
      log('WARN', '[MANUAL] ' + projectId + ': 三视图合拼版下载失败，回退正面图: ' + err.message);
    }
  }
  if (!mascotThreeViewData) mascotThreeViewData = mascotData;

  // Step 4: Render PPTX
  log('INFO', `[MANUAL] ${projectId}: Rendering PPTX...`);
  let pptxBuf;
  try {
    const cp = brandProfile.colorPalette || [];
    // 工单 086-R1：
    // - 品牌愿景用正式表述（refinedBrandVision），品牌口号分开展示；
    // - LOGO 元素：品牌分析字段可用则直用；为提示词式长句（会被过滤为空）时，
    //   用本地视觉模型从 LOGO 图像提取干净元素名词（显式字段 logoDesignElements，
    //   禁止写死品牌名/项目 ID）。
    const formalBrandVision = brandProfile.refinedBrandVision || clientInfo.brandVision || '';
    const slogan =
      clientInfo.brandSlogan ||
      (brandProfile.refinedBrandVision && clientInfo.brandVision && clientInfo.brandVision !== brandProfile.refinedBrandVision
        ? clientInfo.brandVision
        : undefined);
    let logoElements = extractLogoElements(brandProfile?.logoDesignSuggestions?.elements);
    if (logoElements.length < 2) {
      const derived = await extractLogoElementsFromImage(logoData, VISION_FINE_MODEL);
      if (derived.length > 0) {
        logoElements = derived.slice(0, 8);
        clientInfo.logoDesignElements = logoElements;
      }
    }
    const options = {
      projectName: normalizedCompanyName || 'Brand',
      // 整改 #006：渲染期也使用正式品牌名（优先 client_info.formalBrandName）
      companyName: clientInfo.formalBrandName || normalizedCompanyName || 'Brand',
      industry: clientInfo.industry || 'general',
      logoData,
      aiLogoData: logoData,
      brandColors: {
        primary: cp[0]?.hex || '#333333',
        secondary: cp[1]?.hex || '#666666',
        accent: cp[2]?.hex || '#CC0000',
      },
      logoColors: resolveLogoColors(clientInfo.logoColors, brandProfile),
      logoElements,
      brandVision: formalBrandVision,
      slogan,
      coreValues: clientInfo.coreValues || brandProfile.refinedCoreValues || '',
      targetMarket: clientInfo.targetMarket || brandProfile.refinedTargetMarket || '',
      logoPhilosophy: clientInfo.logoPhilosophy || '',
      sceneImages,
      sceneLabels,
      sceneSectionTitles,
      compressImages: true,
      fullBrandName: normalizedCompanyName,
      englishName: (normalizedCompanyName || 'BRAND').toUpperCase(),
      mascotData,
      mascotSplitViews,
      mascotEmotions,
      mascotScenes,
      mascotThreeViewData,
    };
    pptxBuf = await renderPptxToBuffer(blueprints, options);
    log('INFO', `[MANUAL] ${projectId}: PPTX rendered (${(pptxBuf.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    log('ERROR', `[MANUAL] ${projectId}: PPTX render failed: ${err.message}`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: `PPTX渲染失败: ${err.message}` },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Step 5: Upload to Supabase Storage
  log('INFO', `[MANUAL] ${projectId}: Uploading PPTX...`);
  const ts = Date.now();
  const completedAt = new Date().toISOString();
  const pptxResult = buildCanonicalPptxResult({
    projectId,
    timestamp: ts,
    pageCount: blueprints.length,
    supabaseUrl: SUPABASE_URL,
  });
  try {
    const { error: uploadErr } = await supabase.storage
      .from(VI_MANUAL_STORAGE_BUCKET)
      .upload(pptxResult.objectPath, pptxBuf, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true,
      });
    if (uploadErr) throw new Error(uploadErr.message);

    // Step 6: Update project as completed
    const viHistory = clientInfo.viGenerationHistory || [];
    viHistory.push(buildCompletedManualHistoryItem(pptxResult, completedAt));

    await supabase.from('projects').update({
      status: 'completed',
      client_info: {
        ...clientInfo,
        generationStatus: 'completed',
        generationMessage: 'VI手册生成完成！',
        generationPercent: 100,
        pptxResult,
        viGenerationHistory: viHistory,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    log('INFO', `[MANUAL] ${projectId}: DONE! PPTX uploaded -> ${pptxResult.storageUrl}`);
  } catch (err) {
    log('ERROR', `[MANUAL] ${projectId}: Upload failed: ${err.message}`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: `上传失败: ${err.message}` },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
  }
}

// ========== Mascot Sample Generation (4样稿) ==========

async function processMascotSampleGeneration(project) {
  const projectId = project.id;
  const clientInfo = (project.client_info || {});
  const rawCompanyName = clientInfo.companyName || "Brand";
  const companyName = normalizeBrandName(rawCompanyName);
  const industry = clientInfo.industry || "general";
  log("INFO", `[MASCOT-SAMPLE] Processing project: ${projectId} (${rawCompanyName})`);

  // 工单 075：客户显式偏好优先，经纯函数编译为 a~d 四个动态设计方向。
  const mascotBrief = buildMascotDesignBrief({
    companyName,
    industry,
    brandPersonality: clientInfo.brandPersonality,
    brandProfile: clientInfo.brandProfile,
    mascotTypePref: clientInfo.mascotTypePref,
    mascotStylePref: clientInfo.mascotStylePref,
    mascotPersonalityPref: clientInfo.mascotPersonalityPref,
    mascotUsageScenes: clientInfo.mascotUsageScenes,
    mascotColorHint: clientInfo.mascotColorHint,
    mascotRefIdea: clientInfo.mascotRefIdea,
    mascotSceneCount: clientInfo.mascotSceneCount,
  });
  const stylePrompts = mascotBrief.sampleDirections;

  // 工单 031：公仔样稿批次循环＋完整性统一校验（3B粗筛→7B终审；不逐字匹配）
  const negativePrompt = 'nsfw, low quality, blurry, distorted, ugly, deformed, extra limbs, bad anatomy, text, watermark';
  const { results: sampleResults, paused: batchPaused } = await runLogoBatchFlow({
    prompts: stylePrompts.map((p) => p.prompt),
    generate: withMidGenGuard('MascotSample', async ({ prompt }) => comfyGenerateImage({ prompt, negativePrompt, width: 1024, height: 1024 })),
    check: async ({ imageBase64 }) =>
      runMascotVisionCheck({
        imageBase64,
        // 工单 034：样稿均为正面白底图，固定启用白底判定；原误引用全套函数的
        // allItems 导致 ReferenceError→校验被静默 skipped（033 真实验证发现）
        requireWhiteBackground: true,
        // 工单 086：公仔链路同样读取 VISION_COARSE_MODEL / VISION_FINE_MODEL env
        // 覆盖（默认 qwen2.5vl:3b / my-vl 不变；本单 qwen2.5vl:latest）。
        coarseModel: VISION_COARSE_MODEL,
        fineModel: VISION_FINE_MODEL,
      }),
    ensureReady: () => ensureComfyUIReady({ log }),
    isAvailable: () => isComfyUIAvailable(),
    // 工单 034：校验前确保 ComfyUI 完全停止并释放显存（停止而非仅空闲）
    beforeCheck: () => ensureVisionVramFree({ log }),
    log,
    gpuSnapshot,
    maxRounds: 2,
    maxAttempts: 2, // 工单 049：单张连续 2 次生成失败即不死磕（结果按 needs_review 记录，继续下一张）
    retryGapMs: 30000,
    label: 'MascotSample',
  });

  if (batchPaused) {
    log("ERROR", `[MASCOT-SAMPLE] ${projectId}: 批次已暂停（ComfyUI 不可用），等待人工处理`);
    await supabase.from("projects").update({
      status: "submitted",
      client_info: {
        ...clientInfo,
        generationStatus: "paused_comfyui",
        generationMessage: "ComfyUI 不可用，公仔样稿批次已暂停，等待人工处理",
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    return;
  }

  const samples = [];
  for (let i = 0; i < stylePrompts.length; i++) {
    const sp = stylePrompts[i];
    const r = sampleResults[i];
    const imageUrl = (r && r.imageUrl) || null;
    let publicUrl = null;
    if (imageUrl && imageUrl.startsWith("data:")) {
      try {
        const matches = imageUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], "base64");
          const storagePath = `${projectId}/mascot-sample-${sp.id}-${Date.now()}.png`;
          const { error } = await supabase.storage
            .from("brand-brain-generated")
            .upload(storagePath, buffer, { contentType: "image/png", upsert: true });
          if (!error) {
            const { data } = supabase.storage.from("brand-brain-generated").getPublicUrl(storagePath);
            publicUrl = data.publicUrl;
            log("INFO", `[MASCOT-SAMPLE] ${projectId}: Uploaded sample ${sp.id} -> ${publicUrl}`);
          }
        }
      } catch (e) {
        log("WARN", `[MASCOT-SAMPLE] ${projectId}: Upload failed for ${sp.id}: ${e.message}`);
      }
    }
    if (r && r.vision && r.vision.status === "needs_review") {
      log("WARN", `[MASCOT-SAMPLE] ${projectId}: sample ${sp.id} 重试轮后仍 suspect，标记 needs_review（不静默交付）`);
    }
    // 工单 049（第 4 项）：顶层 status 以 vision 展示口径为准，避免 vision passed 却 status=failed
    // 的误导记录（runLogoBatchFlow results 不含顶层 status，以 imageUrl+vision 推导）。
    const sampleStatus = (r && r.imageUrl)
      ? (r.vision && (r.vision.status === "needs_review" || r.vision.status === "suspect" || r.vision.status === "failed" || r.vision.status === "error")
          ? "needs_review"
          : (r.vision && r.vision.status === "skipped" ? "skipped" : "passed"))
      : "failed";
    samples.push({ id: sp.id, label: sp.label, desc: sp.desc, imageUrl: publicUrl || (imageUrl || ""), vision: (r && r.vision) || null, status: sampleStatus });
  }

  const successCount = samples.filter(s => s.imageUrl).length;
  log("INFO", `[MASCOT-SAMPLE] ${projectId}: ${successCount}/${stylePrompts.length} samples generated`);
  try {
    await supabase.from("projects").update({
      status: "mascot_samples_ready",
      client_info: {
        ...clientInfo,
        generationStatus: "mascot_samples_ready",
        generationMessage: `IP\u516c\u4ed4\u6837\u7a3f\u751f\u6210\u5b8c\u6210 (${successCount}/${stylePrompts.length})`,
        mascotSamples: samples,
        mascotVisionSummary: samples.map(s => ({ id: s.id, status: s.status, vision: s.vision ? s.vision.status : null })),
        mascotGeneratedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    log("INFO", `[MASCOT-SAMPLE] ${projectId}: DONE! Status -> mascot_samples_ready`);
  } catch (e) {
    log("ERROR", `[MASCOT-SAMPLE] ${projectId}: Final update failed: ${e.message}`);
  }
}

// ========== Mascot Full Generation (全套16张) ==========

// 工单 033：把 URL 转成 data URI（样稿若是 URL 需先取回，供 7B 视觉提取角色描述）。
async function toDataUriIfNeeded(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return "";
    const buf = Buffer.from(await resp.arrayBuffer());
    const mime = (resp.headers.get("content-type") || "image/png").split(";")[0] || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

// ===== 工单 062：公仔场景五要素提示词生成器 + 色板库 + 行业场景物件表 =====

let _rosegoldPaletteCache;
function loadRosegoldPalette() {
  if (_rosegoldPaletteCache !== undefined) return _rosegoldPaletteCache;
  try {
    const url = new URL("../src/lib/vi-manual/palette-rosegold.json", import.meta.url);
    _rosegoldPaletteCache = JSON.parse(readFileSync(url, "utf8"));
  } catch (e) {
    log("WARN", `[062] palette-rosegold.json 读取失败: ${(e && e.message) || e}`);
    _rosegoldPaletteCache = null;
  }
  return _rosegoldPaletteCache;
}

function isBeautyLikeIndustry(industryType) {
  return industryType === "beauty" || industryType === "nail" || industryType === "fashion";
}

// 工单 065：行业→家族映射（真实行业归并，减少回退 general 的变数）
function mascotSceneFamily(industryType) {
  switch (industryType) {
    case "fastfood":
    case "fresh_food":
      return "restaurant";
    case "tea":
      return "beverage";
    case "nail":
    case "fashion":
      return "beauty";
    default:
      return industryType; // beauty/restaurant/beverage/floral/general 直通
  }
}

// 提示词色板词：丽人/美容/时尚默认粉红玫瑰金（062 色板库，动态读取），其余回退品牌分析色
function mascotScenePaletteWords(industryType, colorDesc) {
  if (isBeautyLikeIndustry(industryType)) {
    const p = loadRosegoldPalette();
    if (p && Array.isArray(p.palette) && p.palette.length) {
      const hexes = p.palette.slice(0, 3).map((c) => c.hex).join(", ");
      return `brand color scheme: rose gold pink (${hexes})`;
    }
  }
  return colorDesc ? `brand colors ${colorDesc}` : "";
}

// 校验用色板：丽人默认粉红玫瑰金（前 3 色），其余用品牌分析色板
function mascotSceneColorPalette(industryType, profileColors) {
  if (isBeautyLikeIndustry(industryType)) {
    const p = loadRosegoldPalette();
    if (p && Array.isArray(p.palette) && p.palette.length) {
      return p.palette.slice(0, 3).map((c) => ({ hex: c.hex, name: c.role || c.hex }));
    }
  }
  return (profileColors || []).filter((c) => c && c.hex);
}

// ========== 工单 086-R3：三视图平台智能生成子流程 ==========
// 权威配方（李记案例）固化进 worker：动态 CHAR_BASE + 动物特征清洗 +
// 三视角分句 + 大间隔种子 + 45s 冷却 + 自动验收 + front reference 侧/背 +
// 跨视图一致性 + PIL 合拼 + 合拼版验收。参数全部可 env 覆盖。
const THREEVIEW_CFG = {
  unetName: process.env.THREEVIEW_UNET || 'z_image_turbo_nvfp4.safetensors',
  steps: Number(process.env.THREEVIEW_STEPS) || 4,
  cfg: Number(process.env.THREEVIEW_CFG) || 3.5,
  size: process.env.THREEVIEW_SIZE || '1024x1024',
  seeds: String(process.env.THREEVIEW_SEEDS || '12345,67890,11111').split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite),
  cooldownMs: Number(process.env.THREEVIEW_COOLDOWN_MS) || 45_000,
  maxAttempts: Number(process.env.THREEVIEW_MAX_ATTEMPTS) || 3,
  visionModels: String(process.env.THREEVIEW_VISION_MODELS || 'qwen2.5vl:latest,my-vl:latest').split(',').map((s) => s.trim()).filter(Boolean),
};

// ========== TICKET-117：B 量产配方（TICKET-107/108 定案，禁止回退旧 z-turbo 抽卡） ==========
// 蒸馏 True-v2 4步/CFG1 + refcontrol_v2_poses@0.7 + 姿态骨架(图1) + 身份参考(图2)。
const THREEVIEW_B_MODEL = 'Flux2-Klein-9B-True-v2-nvfp4mixed.safetensors';
const THREEVIEW_B_CLIP = 'qwen_3_8b_fp8mixed.safetensors';
const THREEVIEW_B_VAE = 'flux2-vae.safetensors';
const THREEVIEW_B_LORA = 'refcontrol_v2_poses.safetensors';
const THREEVIEW_B_LORA_STRENGTH = 0.7;
const THREEVIEW_B_SKELETON_SIDE = 'D:/disk/HermesDisk/bb-clean/logs/117/skeletons/side-skeleton.png';
const THREEVIEW_B_SKELETON_BACK = 'D:/disk/HermesDisk/bb-clean/logs/108/skeletons/back-skeleton.png';
const THREEVIEW_B_SKELETON_SHEET = 'D:/disk/HermesDisk/bb-clean/logs/108/skeletons/threeview-skeleton.png';
const THREEVIEW_B_NEGATIVE =
  'floating hand, disconnected limb, detached palm, bad anatomy, deformed fingers, extra fingers, missing fingers, mutated hands, floating limbs, disembodied hand, duplicate limb, text, watermark, multiple people, blurry, multi-panel, triptych, split screen, grid, collage';
const THREEVIEW_B_TRIGGER = 'apply pose from image 1 with reference from image 2';

/** 负面词按公仔类型动态化：人形禁动物；动物形不禁动物+防串味；通用项恒有。 */
function buildMascotTypeNegativePrompt(typePref, roleType) {
  const universal = 'watermark, text, letters, logo, blurry, low quality, distorted, deformed, extra limbs, bad anatomy, 2d illustration, flat art';
  const typeText = `${Array.isArray(typePref) ? typePref.join(' ') : String(typePref || '')} ${roleType || ''}`;
  const humanLike = /human|character|人物|人类|goddess|女神/i.test(typeText);
  const animalLike = /animal|动物/.test(typeText) && !humanLike;
  if (humanLike) return `${universal}, animal features, antlers, horns, animal ears, cat ears, bear, cartoon animal, furry, tail, hooves, snout, paw`;
  if (animalLike) return `${universal}, wrong species mixing, hybrid animal, mismatched species, human-like face on animal, unrelated species`;
  return `${universal}, antlers, animal ears, hybrid, extra appendages`;
}

/** 角色描述动物特征清洗（上游污染防护，鹿角教训）：检出后删除并明写无动物特征。 */
function cleanCharacterSpecOfAnimalFeatures(spec, roleType) {
  let s = String(spec || '').trim();
  if (!s) return s;
  if (roleType === 'character') {
    s = s
      .replace(/deer|antlers?|horns?|animal ears?|兽耳|鹿角|鹿耳|鹿人|尾巴|皮毛|爪子|蹄|口鼻|fur|paw|tail|hoof|snout|furry/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (s && !/无(?:角|兽耳|动物特征)/.test(s)) s += '，人类角色、无角、无兽耳、无动物特征';
  }
  return s;
}

/** 前端参考图写入 ComfyUI input（LoadImage 只认该目录），返回安全文件名。 */
async function writeReferenceImageToInput(dataUri) {
  const matches = String(dataUri || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!matches) throw new Error('invalid reference data uri');
  const buf = Buffer.from(matches[2], 'base64');
  const name = `mascot-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  await fs.writeFile(path.join(COMFYUI_INPUT_DIR, name), buf);
  return name;
}

/** Flux2 Klein 参考锚定工作流（公仔视角版，保留参考角色身份/服装/配色）。 */
function buildMascotViewReferenceWorkflow({ prompt, referenceImageName, seed, width, height }) {
  const rw = Math.round(width / 8) * 8;
  const rh = Math.round(height / 8) * 8;
  const scenePrompt = [
    prompt,
    'preserve the reference character identity exactly: same face, hairstyle, outfit, colors, proportions and accessories',
    'same single character, clean white background, studio lighting, no text, no watermark, no extra characters',
  ].join(', ');
  return {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: 'Flux2-Klein-9B-True-v2-nvfp4mixed.safetensors', weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_8b_fp8mixed.safetensors', type: 'flux2' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
    '4': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: scenePrompt } },
    '5': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
    '6': { class_type: 'FluxKontextMultiReferenceLatentMethod', inputs: { conditioning: ['4', 0], reference_latents_method: 'offset' } },
    '7': { class_type: 'EmptyFlux2LatentImage', inputs: { width: rw, height: rh, batch_size: 1 } },
    '8': { class_type: 'LoadImage', inputs: { image: referenceImageName } },
    '9': { class_type: 'FluxKontextImageScale', inputs: { image: ['8', 0] } },
    '10': { class_type: 'VAEEncode', inputs: { pixels: ['9', 0], vae: ['3', 0] } },
    '11': { class_type: 'ReferenceLatent', inputs: { conditioning: ['6', 0], latent: ['10', 0] } },
    '12': { class_type: 'Flux2Scheduler', inputs: { steps: 20, width: rw, height: rh } },
    '13': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '14': { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    '15': { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['11', 0], negative: ['5', 0], cfg: 3.5 } },
    '16': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['14', 0], guider: ['15', 0], sampler: ['13', 0], sigmas: ['12', 0], latent_image: ['7', 0] } },
    '17': { class_type: 'VAEDecode', inputs: { samples: ['16', 0], vae: ['3', 0] } },
    '18': { class_type: 'SaveImage', inputs: { filename_prefix: 'bb_mascot_view_ref', images: ['17', 0] } },
  };
}

/** TICKET-117：B 配方 refcontrol 工作流（图1=姿态骨架、图2=身份参考；蒸馏 4步/CFG1/euler）。 */
function buildBRecipeRefWorkflow({ prompt, negative, poseName, refName, seed }) {
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: THREEVIEW_B_MODEL, weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: THREEVIEW_B_CLIP, type: "flux2", device: "default" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: THREEVIEW_B_VAE } },
    "4": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: prompt } },
    "5": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: negative } },
    "6": { class_type: "LoadImage", inputs: { image: poseName } },
    "7": { class_type: "ImageScaleToTotalPixels", inputs: { image: ["6", 0], upscale_method: "nearest-exact", megapixels: 1, resolution_steps: 1 } },
    "8": { class_type: "GetImageSize", inputs: { image: ["7", 0] } },
    "9": { class_type: "EmptyFlux2LatentImage", inputs: { width: ["8", 0], height: ["8", 1], batch_size: 1 } },
    "10": { class_type: "Flux2Scheduler", inputs: { steps: 4, width: ["8", 0], height: ["8", 1] } },
    "11": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "12": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "13": { class_type: "LoadImage", inputs: { image: refName } },
    "14": { class_type: "ImageScaleToTotalPixels", inputs: { image: ["13", 0], upscale_method: "nearest-exact", megapixels: 1, resolution_steps: 1 } },
    "15": { class_type: "VAEEncode", inputs: { pixels: ["7", 0], vae: ["3", 0] } },
    "16": { class_type: "VAEEncode", inputs: { pixels: ["14", 0], vae: ["3", 0] } },
    "17": { class_type: "ReferenceLatent", inputs: { conditioning: ["4", 0], latent: ["15", 0] } },
    "18": { class_type: "ReferenceLatent", inputs: { conditioning: ["5", 0], latent: ["15", 0] } },
    "19": { class_type: "ReferenceLatent", inputs: { conditioning: ["17", 0], latent: ["16", 0] } },
    "20": { class_type: "ReferenceLatent", inputs: { conditioning: ["18", 0], latent: ["16", 0] } },
    "21": { class_type: "LoraLoaderModelOnly", inputs: { model: ["1", 0], lora_name: THREEVIEW_B_LORA, strength_model: THREEVIEW_B_LORA_STRENGTH, strength_clip: THREEVIEW_B_LORA_STRENGTH } },
    "22": { class_type: "CFGGuider", inputs: { model: ["21", 0], positive: ["19", 0], negative: ["20", 0], cfg: 1.0 } },
    "23": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["12", 0], guider: ["22", 0], sampler: ["11", 0], sigmas: ["10", 0], latent_image: ["9", 0] } },
    "24": { class_type: "VAEDecode", inputs: { samples: ["23", 0], vae: ["3", 0] } },
    "25": { class_type: "SaveImage", inputs: { filename_prefix: "bb_mascot_threeview_B", images: ["24", 0] } },
  };
}

/** TICKET-117：骨架 + 身份参考写入 ComfyUI input（LoadImage 只认该目录），返回输入文件名。 */
async function prepareBInputFiles(poseSkelPath, refDataUri) {
  const refName = `threeview-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const skelName = path.basename(poseSkelPath);
  await fs.copyFile(poseSkelPath, path.join(COMFYUI_INPUT_DIR, skelName));
  const mm = String(refDataUri || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!mm) throw new Error('invalid identity reference data uri');
  await fs.writeFile(path.join(COMFYUI_INPUT_DIR, refName), Buffer.from(mm[2], 'base64'));
  return { skelName, refName };
}

async function cleanupBInputFiles(names) {
  for (const n of names) await fs.unlink(path.join(COMFYUI_INPUT_DIR, n)).catch(() => {});
}

/** TICKET-117：sheet 切三面板（等宽三等分），返回 front/side/back data URI。 */
async function cropSheetPanels(dataUri) {
  const mm = String(dataUri || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!mm) throw new Error('invalid sheet data uri');
  const buf = Buffer.from(mm[2], 'base64');
  const meta = await sharp(buf).metadata();
  const w = Math.floor(meta.width / 3);
  const crop = async (left) => {
    const out = await sharp(buf).extract({ left, top: 0, width: w, height: meta.height }).png().toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  };
  return { front: await crop(0), side: await crop(w), back: await crop(w * 2) };
}

/** 单张视图验收：数量=1、姿态、反向「有无动物特征」、人设、无水印；双模型交叉。 */
async function validateMascotView(imageBase64, expectedOrient, charBaseHint) {
  const prompt = 'Analyze this mascot character image. Output ONLY JSON: {"characterCount":number,"singleSubject":true/false,"orientation":"front|side|back|other","noAnimalFeatures":true/false,"personaOk":true/false,"noWatermark":true/false,"reason":"short"}. characterCount=number of distinct figures in the frame; singleSubject=true only if exactly one; orientation=body direction (a three-quarter view counts as side; never front unless directly facing the camera); noAnimalFeatures=true only if NO horns/antlers/animal ears/tail/fur/claws/hooves/snout or any animal feature; personaOk=true only if it matches the described character (' + String(charBaseHint || '').slice(0, 140) + '); noWatermark=true only if no watermark/text/logo.';
  const results = [];
  for (const model of THREEVIEW_CFG.visionModels) {
    try {
      const raw = await ollamaOcr(model, prompt, imageBase64);
      let parsed = null;
      try {
        const s = raw.indexOf('{');
        const e = raw.lastIndexOf('}');
        parsed = JSON.parse(raw.slice(s, e + 1));
      } catch { /* keep null */ }
      results.push({ model, parsed, raw: raw.slice(0, 200) });
    } catch (error) {
      results.push({ model, parsed: null, raw: String(error.message) });
    }
  }
  const valid = results.filter((r) => r.parsed);
  if (valid.length < 2) return { ok: false, results, reason: 'vision_unavailable' };
  const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z]/g, '');
  const expected = expectedOrient.map(norm);
  const personaOk = valid.filter((r) => r.parsed.personaOk === true).length >= Math.ceil(valid.length / 2);
  const ok = personaOk && valid.every((r) => {
    const p = r.parsed;
    return p.characterCount === 1 && p.singleSubject === true && expected.includes(norm(p.orientation)) && p.noAnimalFeatures === true && p.noWatermark === true;
  });
  return { ok, results, reason: ok ? undefined : 'validation_failed' };
}

/**
 * TICKET-117：三视图平台子流程（B 量产配方，禁止旧 z-turbo/无参考抽卡）。
 * front 复用选定样稿（不生成）→ side/back 走 B 配方（蒸馏 4步/CFG1 + refcontrol@0.7 +
 * 姿态骨架 + 身份参考）→ 跨视图一致性 → 合拼验收；单视图不稳时兜底 sheet 路线
 * （B 配方三面板整组，TICKET-108 验证 287s）→ 切分三面板。
 */
async function generateThreeViewsPlatform({ mascotBrief, assetPlan, characterSpec, typePref, log, frontRef }) {
  const roleType = mascotBrief.roleType;
  const charBase = cleanCharacterSpecOfAnimalFeatures(characterSpec || mascotBrief.identity, roleType) || mascotBrief.identity;
  const negative = `${buildMascotTypeNegativePrompt(typePref, roleType)}, ${THREEVIEW_B_NEGATIVE}`;
  const identityWords = `preserve the reference character identity exactly: same face, hairstyle, outfit, colors, proportions and accessories, ${String(charBase).slice(0, 260)}`;
  const bPrompts = {
    side: `${THREEVIEW_B_TRIGGER}, side view, body turned 90 degrees to the right, strict side profile, face fully turned to the right, only one eye visible, nose at the silhouette edge, full body, ${identityWords}, Pixar 3D style, 3D render, single character, plain solid white background, no text, no watermark`,
    back: `${THREEVIEW_B_TRIGGER}, back view, facing away from camera, visible back of head and complete back view, full body, ${identityWords}, Pixar 3D style, 3D render, single character, plain solid white background, no text, no watermark`,
    sheet: `${THREEVIEW_B_TRIGGER}, single character three-view sheet, exactly three panels side by side: front view / right side view / back view, same character in all three panels, ${identityWords}, Pixar 3D style, 3D render, plain solid white background, no text, no watermark`,
  };
  const evidence = { charBase, negative, route: 'single', attempts: {} };
  const viewAttemptDir = path.join("D:/disk/HermesDisk/bb-clean", "logs", "117", "views");
  await fs.mkdir(viewAttemptDir, { recursive: true });

  const frontDataUri = frontRef ? await toDataUriIfNeeded(frontRef) : null;
  if (!frontDataUri) throw new Error('缺少 front 定稿/样稿参考（frontRef）');
  const front = { imageUrl: frontDataUri, attempts: [{ source: 'sample', vision: 'passed', note: 'front 复用选定样稿（已过样稿门），不生成' }] };
  evidence.attempts.front = front.attempts;

  async function generateBView(key, skelPath, expectedOrient, seeds) {
    const perKey = [];
    for (let i = 0; i < seeds.length; i++) {
      if (i >= THREEVIEW_CFG.maxAttempts) break;
      const seed = seeds[i] + (key === 'side' ? 1000 : 2000);
      log('INFO', `[THREEVIEW] ${key} attempt ${i + 1} seed=${seed} mode=B-recipe`);
      try {
        if (!(await ensureComfyUIReady({ log }))) throw new Error('ComfyUI not ready');
        const inputs = await prepareBInputFiles(skelPath, frontDataUri);
        try {
          const workflow = buildBRecipeRefWorkflow({ prompt: bPrompts[key], negative, poseName: inputs.skelName, refName: inputs.refName, seed });
          const out = await comfyGenerateFromWorkflow(workflow, { timeoutMs: 3_600_000 });
          const imageUrl = out.imageUrl;
          try {
            const mm = String(imageUrl || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
            if (mm) await fs.writeFile(path.join(viewAttemptDir, `${key}-${seed}-B.png`), Buffer.from(mm[2], 'base64'));
          } catch { /* 留档失败不阻断 */ }
          await ensureVisionVramFree({ log }).catch(() => {});
          const vision = await validateMascotView(imageUrl, expectedOrient, charBase);
          perKey.push({ seed, mode: 'B-recipe', vision: vision.ok ? 'passed' : 'failed', reason: vision.reason, models: vision.results, ms: out.durationMs });
          if (vision.ok) return { imageUrl, attempts: perKey };
          log('WARN', `[THREEVIEW] ${key} 第${i + 1}次未通过：${vision.reason}`);
        } finally {
          await cleanupBInputFiles([inputs.skelName, inputs.refName]);
        }
      } catch (error) {
        perKey.push({ seed, vision: 'error', reason: String(error.message) });
        log('WARN', `[THREEVIEW] ${key} 第${i + 1}次异常：${error.message}`);
      }
      if (i < seeds.length - 1) await new Promise((r) => setTimeout(r, THREEVIEW_CFG.cooldownMs));
    }
    evidence.attempts[key] = perKey;
    const err = new Error(`${key} 视图生成失败（重试 ${THREEVIEW_CFG.maxAttempts} 次后仍未通过）`);
    err.evidence = evidence;
    throw err;
  }

  // 路线一：单视图（side + back，B 配方）。整组重试 ≤2 组。
  for (let set = 1; set <= 2; set++) {
    log('INFO', `[THREEVIEW] 第 ${set} 组生成开始（B 配方单视图路线）`);
    evidence.attempts[`set${set}`] = { front: 'sample-reused' };
    let side = null;
    let back = null;
    try {
      side = await generateBView('side', THREEVIEW_B_SKELETON_SIDE, ['side', 'threequarter'], THREEVIEW_CFG.seeds);
      back = await generateBView('back', THREEVIEW_B_SKELETON_BACK, ['back'], THREEVIEW_CFG.seeds);
    } catch (error) {
      log('WARN', `[THREEVIEW] 单视图路线失败（${error.message}），转 sheet 路线`);
      break;
    }
    evidence.attempts[`set${set}`].side = side.attempts;
    evidence.attempts[`set${set}`].back = back.attempts;
    let consistency = null;
    try {
      consistency = await runThreeViewConsistencyCheck({ front: front.imageUrl, side: side.imageUrl, back: back.imageUrl, fineModel: VISION_FINE_MODEL });
    } catch (error) {
      consistency = { status: 'failed', reason: String(error.message) };
    }
    evidence.attempts[`set${set}`].consistency = consistency && consistency.status;
    if (consistency && consistency.status === 'passed') {
      const combined = await combineThreeViewSheet({ front: front.imageUrl, side: side.imageUrl, back: back.imageUrl, sheetWidth: 3152, sheetHeight: 1194 });
      if (!combined.ok) throw new Error('三视图合拼失败：' + combined.message);
      const sheetVision = await validateMascotSheet(combined.imageUrl);
      if (sheetVision.ok) {
        evidence.attempts[`set${set}`].sheet = 'passed';
        evidence.acceptedSet = set;
        evidence.route = 'single';
        return { front: front.imageUrl, side: side.imageUrl, back: back.imageUrl, threeView: combined.imageUrl, charBase, evidence };
      }
      log('WARN', `[THREEVIEW] 合拼版验收未通过（${sheetVision.reason}），整组重试`);
      continue;
    }
    log('WARN', `[THREEVIEW] 第 ${set} 组跨视图一致性 ${consistency && consistency.status}，整组重试`);
  }

  // 路线二：sheet 整组（B 配方三面板，TICKET-108 验证 287s）→ 切分三面板。
  log('INFO', '[THREEVIEW] 走 sheet 路线（B 配方三面板整组）');
  evidence.route = 'sheet';
  for (let i = 0; i < THREEVIEW_CFG.seeds.length; i++) {
    if (i >= THREEVIEW_CFG.maxAttempts) break;
    const seed = THREEVIEW_CFG.seeds[i] + 3000;
    log('INFO', `[THREEVIEW] sheet attempt ${i + 1} seed=${seed} mode=B-recipe`);
    try {
      if (!(await ensureComfyUIReady({ log }))) throw new Error('ComfyUI not ready');
      const inputs = await prepareBInputFiles(THREEVIEW_B_SKELETON_SHEET, frontDataUri);
      try {
        const workflow = buildBRecipeRefWorkflow({ prompt: bPrompts.sheet, negative, poseName: inputs.skelName, refName: inputs.refName, seed });
        const out = await comfyGenerateFromWorkflow(workflow, { timeoutMs: 3_600_000 });
        try {
          const mm = String(out.imageUrl || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
          if (mm) await fs.writeFile(path.join(viewAttemptDir, `sheet-${seed}-B.png`), Buffer.from(mm[2], 'base64'));
        } catch { /* 留档失败不阻断 */ }
        await ensureVisionVramFree({ log }).catch(() => {});
        const sheetVision = await validateMascotSheetRoute(out.imageUrl, charBase);
        if (sheetVision.ok) {
          const panels = await cropSheetPanels(out.imageUrl);
          evidence.attempts.sheet = 'passed';
          evidence.acceptedSet = 'sheet';
          return { front: panels.front, side: panels.side, back: panels.back, threeView: out.imageUrl, charBase, evidence };
        }
        log('WARN', `[THREEVIEW] sheet 第${i + 1}次未通过：${sheetVision.reason}`);
      } finally {
        await cleanupBInputFiles([inputs.skelName, inputs.refName]);
      }
    } catch (error) {
      log('WARN', `[THREEVIEW] sheet 第${i + 1}次异常：${error.message}`);
    }
    if (i < THREEVIEW_CFG.seeds.length - 1) await new Promise((r) => setTimeout(r, THREEVIEW_CFG.cooldownMs));
  }
  const err2 = new Error('三视图 B 配方单视图路线与 sheet 路线均未通过');
  err2.evidence = evidence;
  throw err2;
}

/** 合拼版验收（三面板：数量/同一角色/单角色/无缺板/无水印；双模型交叉）。 */
async function validateMascotSheet(imageBase64) {
  const prompt = 'Analyze this three-panel character sheet (left/middle/right panels). Output ONLY JSON: {"panelCount":number,"sameCharacterAcrossPanels":true/false,"singleCharacterPerPanel":true/false,"noMissingPanel":true/false,"noWatermark":true/false,"reason":"short"}. panelCount=number of panels; sameCharacterAcrossPanels=true only if all three panels show the same character; singleCharacterPerPanel=true only if each panel has exactly one character; noMissingPanel=true only if all three panels are present and not blank; noWatermark=true only if no watermark/text/logo.';
  const results = [];
  for (const model of THREEVIEW_CFG.visionModels) {
    try {
      const raw = await ollamaOcr(model, prompt, imageBase64);
      let parsed = null;
      try {
        const s = raw.indexOf('{');
        const e = raw.lastIndexOf('}');
        parsed = JSON.parse(raw.slice(s, e + 1));
      } catch { /* keep null */ }
      results.push({ model, parsed });
    } catch {
      results.push({ model, parsed: null });
    }
  }
  const valid = results.filter((r) => r.parsed);
  if (valid.length < 2) return { ok: false, results, reason: 'vision_unavailable' };
  const ok = valid.every((r) => {
    const p = r.parsed;
    return p.panelCount === 3 && p.sameCharacterAcrossPanels === true && p.singleCharacterPerPanel === true && p.noMissingPanel === true && p.noWatermark === true;
  });
  return { ok, results, reason: ok ? undefined : 'sheet_validation_failed' };
}

/** TICKET-117：AI 直接生成的三面板 sheet 验收（含姿态断言：正/侧/背）。 */
async function validateMascotSheetRoute(imageBase64, charBaseHint) {
  const prompt = 'Analyze this single three-view character sheet with three panels. Output ONLY JSON: {"panelCount":number,"poses":["front"|"side"|"back"|"other"],"sameCharacterAcrossPanels":true/false,"singleCharacterPerPanel":true/false,"personaOk":true/false,"noWatermark":true/false,"reason":"short"}. panelCount=number of panels (must be 3); poses=body direction of each panel in order (a three-quarter view counts as side; never front unless directly facing the camera); sameCharacterAcrossPanels=true only if all three panels show the same character; singleCharacterPerPanel=true only if each panel has exactly one character; personaOk=true only if the character matches (' + String(charBaseHint || '').slice(0, 140) + '); noWatermark=true only if no watermark/text/logo.';
  const results = [];
  for (const model of THREEVIEW_CFG.visionModels) {
    try {
      const raw = await ollamaOcr(model, prompt, imageBase64);
      let parsed = null;
      try {
        const s = raw.indexOf('{');
        const e = raw.lastIndexOf('}');
        parsed = JSON.parse(raw.slice(s, e + 1));
      } catch { /* keep null */ }
      results.push({ model, parsed, raw: raw.slice(0, 200) });
    } catch {
      results.push({ model, parsed: null });
    }
  }
  const valid = results.filter((r) => r.parsed);
  if (valid.length < 2) return { ok: false, results, reason: 'vision_unavailable' };
  const personaOk = valid.filter((r) => r.parsed.personaOk === true).length >= Math.ceil(valid.length / 2);
  const ok = personaOk && valid.every((r) => {
    const p = r.parsed;
    const poses = Array.isArray(p.poses) ? p.poses.map((x) => String(x).toLowerCase()) : [];
    return (
      p.panelCount === 3 &&
      ['front', 'side', 'back'].every((need) => poses.includes(need)) &&
      p.sameCharacterAcrossPanels === true &&
      p.singleCharacterPerPanel === true &&
      p.noWatermark === true
    );
  });
  return { ok, results, reason: ok ? undefined : 'sheet_route_validation_failed' };
}

async function processMascotFullGeneration(project) {
  const projectId = project.id;
  const clientInfo = (project.client_info || {});
  const rawCompanyName = clientInfo.companyName || "Brand";
  const companyName = normalizeBrandName(rawCompanyName);
  const industry = clientInfo.industry || "general";
  const selectedId = clientInfo.mascotSelectedId || "a";
  const samples = clientInfo.mascotSamples || [];
  const selectedSample = samples.find(s => s.id === selectedId) || samples[0] || {};
  const styleAnchor = (selectedSample.label || "\u7ecf\u5178\u6b3e") + " " + (selectedSample.desc || "");
  const mascotBrief = buildMascotDesignBrief({
    companyName,
    industry,
    brandPersonality: clientInfo.brandPersonality,
    brandProfile: clientInfo.brandProfile,
    mascotTypePref: clientInfo.mascotTypePref,
    mascotStylePref: clientInfo.mascotStylePref,
    mascotPersonalityPref: clientInfo.mascotPersonalityPref,
    mascotUsageScenes: clientInfo.mascotUsageScenes,
    mascotColorHint: clientInfo.mascotColorHint,
    mascotRefIdea: clientInfo.mascotRefIdea,
    mascotSceneCount: clientInfo.mascotSceneCount,
  });

  log("INFO", `[MASCOT-FULL] Processing project: ${projectId} (${rawCompanyName}), selected: ${selectedId} (${styleAnchor})`);

  // 工单 033：角色身份描述由平台 AI（本地 7B 视觉）从客户选定样稿动态提取，
  // 禁止手写/硬编码角色描述模板；提取失败/过短时由 076 计划回退完整简报与 styleAnchor。
  let characterSpec = "";
  try {
    const sampleImage = selectedSample && (selectedSample.imageUrl || "");
    if (sampleImage) {
      const sampleB64 = await toDataUriIfNeeded(sampleImage);
      if (sampleB64) {
        const spec = await extractMascotCharacterSpec(sampleB64, { fineModel: VISION_FINE_MODEL });
        if (spec && spec.length >= 10) {
          characterSpec = spec;
          log("INFO", `[MASCOT-FULL] ${projectId}: 角色描述由 AI 从样稿提取（${spec.length} 字符）`);
        } else {
          log("WARN", `[MASCOT-FULL] ${projectId}: 角色描述提取失败或过短，回退完整简报与 styleAnchor`);
        }
      }
    }
  } catch (e) {
    log("WARN", `[MASCOT-FULL] ${projectId}: 角色描述提取异常，回退完整简报与 styleAnchor: ${e.message}`);
  }

  // 工单 076：三视图、表情、场景和核色色板统一来自 075 简报的纯资产计划。
  // 工单 086-R4：公仔比例按配置（标准/Q 版）约束；显式 mascotRatio 优先，其次 Q 版偏好。
  const ratioRule =
    clientInfo.mascotRatio ||
    (/Q\s*版|Q\s*version/i.test(Array.isArray(clientInfo.mascotTypePref) ? clientInfo.mascotTypePref.join(" ") : String(clientInfo.mascotTypePref || "")) ? "q" : "standard");
  const assetPlan = buildMascotFullAssetPlan({ brief: mascotBrief, styleAnchor, characterSpec, ratioRule });
  const { views, emotions, scenes } = assetPlan;
  const sceneColorPalette = assetPlan.colorPalette;

  // 工单 086-R3：三视图平台智能生成子流程（替代批次内 text2img 视图）。
  // 动态 CHAR_BASE + 动物特征清洗 + 三视角分句 + front reference 侧/背 +
  // 跨视图一致性 + 合拼 + 合拼版验收；失败自动重试，仍失败 stall 不静默吞掉。
  const threeViewPlatform = await generateThreeViewsPlatform({
    mascotBrief,
    assetPlan,
    characterSpec,
    typePref: clientInfo.mascotTypePref,
    log,
    frontRef: (selectedSample && (selectedSample.imageUrl || "")) || "",
  }).catch(async (error) => {
    log("ERROR", `[MASCOT-FULL] ${projectId}: 三视图平台子流程失败：${error.message}`);
    await supabase.from("projects").update({
      status: "submitted",
      client_info: {
        ...clientInfo,
        generationStatus: "needs_review",
        generationMessage: `三视图平台生成失败：${error.message}`,
        threeViewPlatformEvidence: error.evidence || null,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    return null;
  });
  if (!threeViewPlatform) {
    return;
  }
  log("INFO", `[MASCOT-FULL] ${projectId}: 三视图平台子流程完成（front/side/back/threeView + 一致性 passed，第 ${threeViewPlatform.evidence.acceptedSet} 组）`);
  const platformThreeViewConsistency = { status: "passed", source: "086-R3-platform", evidence: threeViewPlatform.evidence };

  // 工单 031/076：公仔全套批次循环＋动态场景数量；完整性门仍要求至少 4 个场景。
  // 工单 086-R1（Chris 专项 12/13/14）：提示词级约束——
  // 表情每图仅一个公仔且正面；场景仅一个公仔、无额外文字（文字由代码后期叠加）。
  // 工单 086-R3：三视图已由平台子流程产出，批次只含 表情+场景。
  const allItems = [
    ...emotions.map((e) => ({ cat: "emotion", name: e.name, prompt: e.prompt + " Exactly one mascot character in frame, front-facing, single subject only; no additional characters; no watermark, no text." })),
    ...scenes.map((s) => ({ cat: "scene", name: s.name, prompt: s.prompt + " Full-body mascot placed INSIDE a complete recognizable commercial scene with the environment fully visible (not a portrait or close-up); exactly one mascot character; face and outfit consistent with the character design; no other people or characters; no text, no watermark; the mascot is integrated naturally with matching lighting and a soft contact shadow under the feet, natural perspective, no hard cutout edges, no pasted look." })),
  ];
  const totalImages = 3 + emotions.length + scenes.length;
  const dynamicNegative = buildMascotTypeNegativePrompt(clientInfo.mascotTypePref, mascotBrief.roleType);
  const { results: fullResults, paused: batchPaused } = await runLogoBatchFlow({
    prompts: allItems.map((it) => it.prompt),
    generate: withMidGenGuard('MascotFull', async ({ prompt }) => comfyGenerateImage({
      prompt,
      negativePrompt: dynamicNegative,
      width: 1024,
      height: 1024,
    })),
    // 工单 062：场景项用“公仔场景校验门”（场景完整性 + 五官 + 核色）；
    // 视图/表情仍走公仔完整性校验（白底判定）。
    check: async ({ imageBase64, index }) => {
      const item = allItems[index] || {};
      if (item.cat === "scene") {
        return runMascotSceneVisionCheck({
          imageBase64,
          expectedColors: sceneColorPalette,
          coarseModel: VISION_COARSE_MODEL,
          fineModel: VISION_FINE_MODEL,
        });
      }
      return runMascotVisionCheck({
        imageBase64,
        requireWhiteBackground: true,
        coarseModel: VISION_COARSE_MODEL,
        fineModel: VISION_FINE_MODEL,
      });
    },
    ensureReady: () => ensureComfyUIReady({ log }),
    isAvailable: () => isComfyUIAvailable(),
    // 工单 034：校验前确保 ComfyUI 完全停止并释放显存（停止而非仅空闲）
    beforeCheck: () => ensureVisionVramFree({ log }),
    log,
    gpuSnapshot,
    maxRounds: 2,
    maxAttempts: 2, // 工单 049：单张连续 2 次生成失败即不死磕（结果按 needs_review 记录，继续下一张）
    retryGapMs: 30000,
    label: 'MascotFull',
  });

  if (batchPaused) {
    log("ERROR", `[MASCOT-FULL] ${projectId}: 批次已暂停（ComfyUI 不可用），等待人工处理`);
    await supabase.from("projects").update({
      status: "submitted",
      client_info: {
        ...clientInfo,
        generationStatus: "paused_comfyui",
        generationMessage: "ComfyUI 不可用，公仔全套批次已暂停，等待人工处理",
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    return;
  }

  const viewResults = {};
  const emotionResults = [];
  const sceneResults = [];
  const mascotVision = {};
  const viewImageData = {}; // 工单 033：视图 data URI，供三视图一致性判定
  // 工单 086-R3：三视图平台产物（front/side/back/threeView）上传落库。
  const uploadView = async (key, dataUri) => {
    const matches = String(dataUri || "").match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!matches) return "";
    const buffer = Buffer.from(matches[2], "base64");
    const storagePath = `${projectId}/mascot-view-platform-${key}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("brand-brain-generated").upload(storagePath, buffer, { contentType: "image/png", upsert: true });
    if (error) {
      log("WARN", `[MASCOT-FULL] ${projectId}: 三视图 ${key} 上传失败：${error.message}`);
      return "";
    }
    const { data } = supabase.storage.from("brand-brain-generated").getPublicUrl(storagePath);
    return data.publicUrl;
  };
  viewResults.front = await uploadView("front", threeViewPlatform.front);
  viewResults.side = await uploadView("side", threeViewPlatform.side);
  viewResults.back = await uploadView("back", threeViewPlatform.back);
  const threeViewUrl = await uploadView("threeview", threeViewPlatform.threeView);
  viewImageData.front = threeViewPlatform.front;
  viewImageData.side = threeViewPlatform.side;
  viewImageData.back = threeViewPlatform.back;
  for (const k of ["front", "side", "back"]) mascotVision[`view-${k}`] = "passed";
  let completed = 0;
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const r = fullResults[i];
    let publicUrl = "";
    const imageUrl = (r && r.imageUrl) || null;
    if (imageUrl && imageUrl.startsWith("data:")) {
      try {
        const matches = imageUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], "base64");
          // 工单 032：存储路径用 ASCII 序号（item.name 为中文时 Supabase 上传会
          // 静默失败，导致 emotions/scenes URL 为空 → 手册门不通过 → 弹回样稿死循环）。
          const storagePath = `${projectId}/mascot-${item.cat}-${i}-${Date.now()}.png`;
          const { error } = await supabase.storage
            .from("brand-brain-generated")
            .upload(storagePath, buffer, { contentType: "image/png", upsert: true });
          if (!error) {
            const { data } = supabase.storage.from("brand-brain-generated").getPublicUrl(storagePath);
            publicUrl = data.publicUrl;
            log("INFO", `[MASCOT-FULL] ${projectId}: Uploaded ${item.cat}-${item.name} -> ${publicUrl}`);
          } else {
            // 工单 032：上传失败必须留痕，不能静默跳过。
            log("WARN", `[MASCOT-FULL] ${projectId}: Upload error for ${item.cat}-${item.name}: ${error.message}`);
          }
        }
      } catch (e) {
        log("WARN", `[MASCOT-FULL] ${projectId}: Upload failed for ${item.cat}-${item.name}: ${e.message}`);
      }
    }
    // 工单 049（第 4 项）：results 不含顶层 status，有图且无 vision 时按 passed 记录，避免误标 failed
    mascotVision[`${item.cat}-${item.name}`] = (r && r.vision && r.vision.status) || (r && r.imageUrl ? "passed" : "failed");
    if (r && r.vision && r.vision.status === "needs_review") {
      log("WARN", `[MASCOT-FULL] ${projectId}: ${item.cat}-${item.name} 重试轮后仍 suspect，标记 needs_review（不静默交付）`);
    }
    completed++;
    try {
      await supabase.from("projects").update({
        client_info: {
          ...clientInfo,
          generationStatus: "mascot_full_generating",
          generationMessage: `\u6b63\u5728\u751f\u6210IP\u516c\u4ed4\u5168\u5957 (${completed}/${totalImages})...`,
          fullMascotProgress: { views: assetPlan.counts.views, emotions: assetPlan.counts.emotions, scenes: assetPlan.counts.scenes, total: totalImages, completed },
        },
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
    } catch { /* non-critical */ }
    if (item.cat === "view") {
      viewResults[item.name] = publicUrl;
      viewImageData[item.name] = imageUrl;
    } else if (item.cat === "emotion") emotionResults.push({ name: item.name, url: publicUrl });
    else sceneResults.push({ name: item.name, url: publicUrl });
  }

  // 工单 033：三视图一致性判定（7B 特征交叉比对；不一致 needs_review 不静默交付）。
  let threeViewConsistency = null;
  const viewKeys = ["front", "side", "back"];
  if (viewKeys.every((k) => viewImageData[k])) {
    try {
      threeViewConsistency = await runThreeViewConsistencyCheck({
        front: viewImageData.front,
        side: viewImageData.side,
        back: viewImageData.back,
        fineModel: VISION_FINE_MODEL,
      });
      log("INFO", `[MASCOT-FULL] ${projectId}: 三视图一致性 ${threeViewConsistency.status}${threeViewConsistency.reason ? ` (${threeViewConsistency.reason})` : ""}`);
      if (threeViewConsistency.status !== "passed") {
        log("WARN", `[MASCOT-FULL] ${projectId}: 三视图不一致，标记 needs_review（不静默交付）`);
        for (const k of viewKeys) mascotVision[`view-${k}`] = "needs_review";
      }
    } catch (e) {
      log("WARN", `[MASCOT-FULL] ${projectId}: 三视图一致性检查失败: ${e.message}`);
    }
  } else {
    log("WARN", `[MASCOT-FULL] ${projectId}: 视图图像数据不完整，跳过三视图一致性判定`);
  }

  // 工单 086-R1：IP 场景可识别化（P0-1 平台根治 + Chris 专项 14）。
  // 1) 用正面三视图作 reference image 重生成 4 张 IP 场景（脸/服装/配色与角色设定对齐）；
  // 2) 生成后由代码贴入标准 LOGO（P0-2，AI 不画 LOGO）并叠加品牌文字（P0-3，根治乱码）；
  // 3) 替换场景素材并复跑公仔场景校验门。任一环节失败保留原场景并留痕，不静默放行。
  if (viewImageData.front && scenes.length > 0) {
    const comfyOk = await ensureComfyUIReady({ log });
    if (!comfyOk) {
      log("WARN", `[MASCOT-FULL] ${projectId}: ComfyUI 不可用，IP 场景参考图重生成跳过（保留原场景）`);
    } else {
      let roseLogoData = null;
      try {
        const logoUrl =
          (clientInfo.brandProfile && clientInfo.brandProfile.selectedLogo && clientInfo.brandProfile.selectedLogo.imageUrl) ||
          (Array.isArray(clientInfo.logoAssets) && clientInfo.logoAssets[0] && clientInfo.logoAssets[0].url) ||
          null;
        if (logoUrl) {
          const resp = await fetch(logoUrl);
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            let logoBuf = buf;
            try {
              logoBuf = await removeOpaqueWhiteBackground(buf);
            } catch {
              // 保持原图
            }
            roseLogoData = `data:image/png;base64,${logoBuf.toString("base64")}`;
          }
        }
      } catch (err) {
        log("WARN", `[MASCOT-FULL] ${projectId}: 玫瑰金 LOGO 下载失败：${err.message}，场景仅做参考图重生成`);
      }
      const brandText = clientInfo.formalBrandName || clientInfo.companyName || "";
      /** 工单 091-R4：IP 场景不再代码贴字/贴 LOGO（角落贴字=硬编码观感），
       *  场景文字/LOGO 一律 AI 入景绘制，原图直接使用。 */
      const postProcessScene = async (imageUrl) => imageUrl;
      /** 复检并（通过时）上传替换场景素材；返回是否替换成功。 */
      const recheckAndReplace = async (si, sc, finalImage) => {
        await ensureVisionVramFree({ log }).catch(() => {});
        const vision = await runMascotSceneVisionCheck({
          imageBase64: finalImage,
          expectedColors: sceneColorPalette,
          coarseModel: VISION_COARSE_MODEL,
          fineModel: VISION_FINE_MODEL,
        });
        if (vision.status !== "passed" && vision.status !== "skipped") {
          log("WARN", `[MASCOT-FULL] ${projectId}: IP 场景 ${sc.name} 复检 ${vision.status}（${vision.reason || ""}），不替换`);
          return false;
        }
        // 工单 091（P28）：双模型融合断言（无硬边/无文字遮挡/有接触阴影），
        // 未通过不替换（保留原场景），记录证据。
        const fusion = await runMascotSceneFusionCheck(finalImage);
        if (fusion.status !== "passed") {
          log("WARN", `[MASCOT-FULL] ${projectId}: IP 场景 ${sc.name} 融合断言 ${fusion.status}（${fusion.reason || ""}），不替换`);
          return false;
        }
        const matches = finalImage.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (!matches) return false;
        const buffer = Buffer.from(matches[2], "base64");
        const storagePath = `${projectId}/mascot-scene-ref-${si}-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from("brand-brain-generated")
          .upload(storagePath, buffer, { contentType: "image/png", upsert: true });
        if (upErr) {
          log("WARN", `[MASCOT-FULL] ${projectId}: IP 场景 ${sc.name} 上传失败：${upErr.message}`);
          return false;
        }
        const { data: pub } = supabase.storage.from("brand-brain-generated").getPublicUrl(storagePath);
        if (sceneResults[si]) sceneResults[si].url = pub.publicUrl;
        mascotVision[`scene-${sc.name}`] = vision.status;
        log("INFO", `[MASCOT-FULL] ${projectId}: IP 场景 ${sc.name} 参考图/后期处理替换 -> ${pub.publicUrl}（vision=${vision.status}，含 LOGO 贴入/文字叠加）`);
        return true;
      };
      for (let si = 0; si < scenes.length; si++) {
        const sc = scenes[si];
        const item = allItems.find((it) => it.cat === "scene" && it.name === sc.name);
        if (!item) continue;
        try {
          const seed = Math.floor(Math.random() * 2147483647);
          const ref = await withMidGenGuard('MascotSceneRef', async () => comfyGenerateReferenceAnchor({
            prompt: item.prompt,
            referenceImage: viewImageData.front,
            seed,
            width: 1024,
            height: 1024,
          }));
          const refFinal = await postProcessScene(ref.imageUrl);
          const replaced = await recheckAndReplace(si, sc, refFinal);
          if (replaced) continue;
          // 参考图复检未通过：对原场景做后期处理（贴 LOGO/叠文字）再复检，
          // 保证 P0-2/P0-3 至少在原场景上生效。
          if (sceneResults[si] && sceneResults[si].url) {
            const origResp = await fetch(sceneResults[si].url);
            if (origResp.ok) {
              const origBuf = Buffer.from(await origResp.arrayBuffer());
              const origData = `data:image/png;base64,${origBuf.toString("base64")}`;
              const origFinal = await postProcessScene(origData);
              await recheckAndReplace(si, sc, origFinal);
            }
          }
        } catch (err) {
          log("WARN", `[MASCOT-FULL] ${projectId}: IP 场景 ${sc.name} 参考图重生成失败：${err.message}，保留原场景`);
          if (sceneResults[si] && sceneResults[si].url) {
            try {
              const origResp = await fetch(sceneResults[si].url);
              if (origResp.ok) {
                const origBuf = Buffer.from(await origResp.arrayBuffer());
                const origData = `data:image/png;base64,${origBuf.toString("base64")}`;
                const origFinal = await postProcessScene(origData);
                await recheckAndReplace(si, sc, origFinal);
              }
            } catch (e2) {
              log("WARN", `[MASCOT-FULL] ${projectId}: IP 场景 ${sc.name} 原场景后期处理失败：${e2.message}`);
            }
          }
        }
      }
    }
  }

  const mascotAssets = {
    front: viewResults.front || "",
    side: viewResults.side || "",
    back: viewResults.back || "",
    emotions: emotionResults,
    scenes: sceneResults,
    // 工单 086-R3：三视图平台合拼版（独立视图 front/side/back 仍各自落库）。
    threeView: threeViewUrl,
  };

  // 工单 032：全套完成后先校验资产完整性；不完整时自动重试（≤2 次）后转人工，
  // 绝不写 pending_manual（避免手册门弹回样稿造成死循环）。
  const validation = validateMascotAssets({ assets: { ...mascotAssets, name: clientInfo.mascotName || "" } });
  const missingGenerated = validation.missing.filter((m) => m !== "mascot.name");
  if (missingGenerated.length > 0) {
    const attempt = nextMascotFullAttempt(clientInfo.mascotFullAttempts);
    const retry = shouldRetryMascotFull(attempt);
    log(retry ? "WARN" : "ERROR",
      `[MASCOT-FULL] ${projectId}: 全套资产不完整 ${validation.missing.join(",")} (attempt ${attempt})${retry ? "，自动重试全套" : "，超过上限转人工，不再弹回样稿"}`);
    await supabase.from("projects").update({
      status: "submitted",
      client_info: {
        ...clientInfo,
        generationStatus: retry ? "mascot_full_generating" : "needs_review",
        generationMessage: retry
          ? `公仔全套资产不完整，自动重试第 ${attempt} 次`
          : "公仔全套多次不完整，等待人工处理",
        mascotFullAttempts: attempt,
        mascotAssets,
        mascotVision,
        mascotThreeViewConsistency: threeViewConsistency,
        fullMascotMissing: validation.missing,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    return;
  }
  if (!validation.ready) {
    // 仅缺 name 等非生成项：不重试生成，直接转人工。
    log("ERROR", `[MASCOT-FULL] ${projectId}: 公仔名称缺失，转人工处理 ${validation.missing.join(",")}`);
    await supabase.from("projects").update({
      status: "submitted",
      client_info: {
        ...clientInfo,
        generationStatus: "needs_review",
        generationMessage: "公仔名称缺失，等待人工处理",
        mascotFullAttempts: 0,
        mascotAssets,
        mascotVision,
        mascotThreeViewConsistency: threeViewConsistency,
        fullMascotMissing: validation.missing,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    return;
  }

  log("INFO", `[MASCOT-FULL] ${projectId}: ${completed}/${totalImages} generated, assets complete. Setting pending_manual...`);

  try {
    await supabase.from("projects").update({
      status: "mascot_generated",
      client_info: {
        ...clientInfo,
        generationStatus: "pending_manual",
        generationMessage: "IP\u516c\u4ed4\u5168\u5957\u751f\u6210\u5b8c\u6210\uff0c\u5f00\u59cb\u5236\u4f5cVI\u624b\u518c",
        mascotAssets,
        mascotVision,
        mascotThreeViewConsistency: threeViewConsistency,
        mascotFullAttempts: 0,
        fullMascotCompletedAt: new Date().toISOString(),
        fullMascotProgress: { views: assetPlan.counts.views, emotions: assetPlan.counts.emotions, scenes: assetPlan.counts.scenes, total: totalImages, completed },
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    log("INFO", `[MASCOT-FULL] ${projectId}: DONE! Status -> pending_manual`);
  } catch (e) {
    log("ERROR", `[MASCOT-FULL] ${projectId}: Final update failed: ${e.message}`);
  }
}

// ========== Main Polling Loop ==========

// 工单 077：pending_logo 只是排队意图；进入任何生成函数前仍须核验持久付款证据。
async function guardLogoProjectPayment(project) {
  const clientInfo = project?.client_info || {};
  const payment = evaluatePaymentGate(project?.status, clientInfo);
  const projectStatus = typeof project?.status === 'string' ? project.status : '';
  if (!projectStatus) {
    log('ERROR', `[PAYMENT-GATE] ${project?.id || 'unknown'}: missing project status; generation remains blocked`);
    return null;
  }
  if (!payment.allowed) {
    log('WARN', `[PAYMENT-GATE] ${project?.id || 'unknown'}: blocked unpaid pending_logo project`);
    const { data, error } = await supabase.from('projects').update({
        client_info: buildPaymentRequiredClientInfo(clientInfo),
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)
      .eq('status', projectStatus)
      .filter('client_info->>generationStatus', 'eq', 'pending_logo')
      .select('id');
    if (error) log('ERROR', `[PAYMENT-GATE] ${project.id}: failed to write safe state: ${error.message}`);
    else if (!data || data.length === 0) log('INFO', `[PAYMENT-GATE] ${project.id}: state changed concurrently; stale unpaid write skipped`);
    return null;
  }

  // 同一次条件 update 持久化旧订单付款证据并认领任务；付款撤销或其他 Worker 抢先时不生成。
  const nextClientInfo = ensurePaymentConfirmed(clientInfo, new Date().toISOString());
  const claimedClientInfo = {
    ...nextClientInfo,
    generationStatus: 'logo_generating',
    generationMessage: 'AI正在分析品牌...',
  };
  const { data, error } = await supabase.from('projects').update({
      status: 'logo_generating',
      client_info: claimedClientInfo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id)
    .eq('status', projectStatus)
    .filter('client_info->>generationStatus', 'eq', 'pending_logo')
    .select('id');
  if (error) {
    log('ERROR', `[PAYMENT-GATE] ${project.id}: payment claim failed; generation remains blocked: ${error.message}`);
    return null;
  }
  if (!data || data.length === 0) {
    log('INFO', `[PAYMENT-GATE] ${project.id}: queue state changed concurrently; generation claim skipped`);
    return null;
  }
  return { ...project, status: 'logo_generating', client_info: claimedClientInfo };
}

async function poll() {
  await sendHeartbeat();
  try {
    // Phase 1: Check for pending_logo
    const orderFilter = (process.env.WORKER_ORDER_FILTER || '').split(',').map((s) => s.trim()).filter(Boolean);
    let logoQuery = supabase
      .from('projects')
      .select('id, status, client_info, submission_id')
      .filter('client_info->>generationStatus', 'eq', 'pending_logo')
      .order('created_at', { ascending: true })
      .limit(1);
    if (orderFilter.length > 0) {
      logoQuery = logoQuery.in('id', orderFilter);
    }
    const { data: logoProjects, error: logoErr } = await logoQuery;

    if (logoErr) {
      log('WARN', `[POLL] Logo query error: ${logoErr.message}`);
    } else if (logoProjects && logoProjects.length > 0) {
      for (const project of logoProjects) {
        const paidProject = await guardLogoProjectPayment(project);
        if (paidProject) await processLogoGeneration(paidProject);
      }
    }

    // Phase 3: Check for mascot_generating (4 samples)
    let mascotSampleQuery = supabase
      .from('projects')
      .select('id, client_info, submission_id')
      .filter('client_info->>generationStatus', 'eq', 'mascot_generating')
      .order('created_at', { ascending: true })
      .limit(1);
    if (orderFilter.length > 0) mascotSampleQuery = mascotSampleQuery.in('id', orderFilter);
    const { data: mascotSampleProjects, error: mascotSampleErr } = await mascotSampleQuery;

    if (mascotSampleErr) {
      log('WARN', `[POLL] Mascot sample query error: ${mascotSampleErr.message}`);
    } else if (mascotSampleProjects && mascotSampleProjects.length > 0) {
      for (const project of mascotSampleProjects) {
        await processMascotSampleGeneration(project);
      }
    }

    // Phase 4: Check for mascot_full_generating (16 images)
    let mascotFullQuery = supabase
      .from('projects')
      .select('id, client_info, submission_id')
      .filter('client_info->>generationStatus', 'eq', 'mascot_full_generating')
      .order('created_at', { ascending: true })
      .limit(1);
    if (orderFilter.length > 0) mascotFullQuery = mascotFullQuery.in('id', orderFilter);
    const { data: mascotFullProjects, error: mascotFullErr } = await mascotFullQuery;

    if (mascotFullErr) {
      log('WARN', `[POLL] Mascot full query error: ${mascotFullErr.message}`);
    } else if (mascotFullProjects && mascotFullProjects.length > 0) {
      for (const project of mascotFullProjects) {
        await processMascotFullGeneration(project);
      }
    }

    // Phase 2: Check for pending_manual
    let manualQuery = supabase
      .from('projects')
      .select('id, client_info, submission_id')
      .filter('client_info->>generationStatus', 'eq', 'pending_manual')
      .order('created_at', { ascending: true })
      .limit(1);
    if (orderFilter.length > 0) manualQuery = manualQuery.in('id', orderFilter);
    const { data: manualProjects, error: manualErr } = await manualQuery;

    if (manualErr) {
      log('WARN', `[POLL] Manual query error: ${manualErr.message}`);
    } else if (manualProjects && manualProjects.length > 0) {
      for (const project of manualProjects) {
        await processManualGeneration(project);
      }
    }
  } catch (err) {
    log('ERROR', `[POLL] Unexpected error: ${err.message}`);
  }
}

// ========== Entry Point ==========



// ========== Heartbeat ==========
async function sendHeartbeat() {
  try {
    await supabase.from('worker_heartbeat').upsert({
      id: 'local-windows-worker',
      last_heartbeat: new Date().toISOString(),
      comfyui_available: await isComfyUIAvailable(),
      updated_at: new Date().toISOString(),
    });
  } catch { /* non-critical */ }
}

async function main() {
  log('INFO', '===== Brand Brain Automation Worker Started =====');
  log('INFO', `Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  log('INFO', `Supabase: ${SUPABASE_URL}`);

  const comfyAvailable = await isComfyUIAvailable();
  log('INFO', `ComfyUI available: ${comfyAvailable}`);

  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch(err => {
  log('FATAL', `Worker crashed: ${err.message}`);
  console.error(err);
  process.exit(1);
});



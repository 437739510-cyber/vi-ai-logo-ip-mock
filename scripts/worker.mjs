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
import { comfyuiGenerateLogo, comfyuiGenerateScene, comfyGenerateImage, comfyuiInpaintPhoto, isComfyUIAvailable } from '../src/lib/ip/ip-image-provider/comfyui-provider';
import { planPages } from '../src/lib/vi-manual/page-planner';
import { renderPptxToBuffer } from '../src/lib/pptx/render-pptx';
import { normalizeBrandName } from '../src/lib/vi-manual/brand-name-normalizer';
import { buildMascotAssetSetFromClientInfo, validateMascotAssets, MASCOT_EMOTION_NAMES, MASCOT_SCENE_NAMES, nextMascotFullAttempt, shouldRetryMascotFull } from '../src/lib/vi-manual/mascot-assets';
import { getIndustryType, getIndustryDefaults } from '../src/lib/brand/industry-types';
import { extractLogoElements, extractStyleTags, resolveLogoColorsFromProfile, resolveLogoColors } from '../src/lib/vi-manual/brand-visual-rules';
import { normalizeLogoTextLanguage } from '../src/lib/core/consultation-schema';
import { runLogoVisionCheck, runMascotVisionCheck, runSceneVisionCheck, runPhotoSceneVisionCheck, extractExpectedText, extractMascotCharacterSpec, runThreeViewConsistencyCheck, isValidUploadedLogoAssets, describeLogoForOptimization, buildOptimizedLogoPrompt, locateTextRegion, generateInpaintMaskPng, checkBrandColors, isStorefrontPhoto, buildPhotoScenePrompts, detectLogoHasText } from '../src/lib/vision-check';
// 工单 030：ComfyUI 健康门与生命周期（崩溃探测→自动重启→就绪→冷却）。
import { ensureComfyUIReady, gpuSnapshot, comfyuiPids, killComfyUI } from './_comfyui-lifecycle.mjs';
// 工单 030：Logo 批次循环编排（生成→统一校验→不合格下一轮统一重生成）。
import { runLogoBatchFlow } from './_logo-batch.mjs';
import { promises as fs } from 'fs';
import path from 'path';
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
const LOGO_PROMPT_TEMPLATE_VERSION = '023-chinese-v1';
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
  "analysisTemplateVersion": "023-chinese-v1",
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
    "note": "IMPORTANT: 若客户选择拼音（logoTextMode=pinyin），四条 prompts 必须全部改写为英文拼音提示词：把品牌名转成正确拼音（全大写或首字母大写）显式写入，如 Text 'LAOWANXIANG' in bold sans-serif；必须包含 No Chinese characters；现代扁平、白色背景、明确配色与字形；四条构图变体参考：极简图标+文字、圆形徽章、手写风格、几何无衬线；禁止出现任何汉字。若客户选择中文，四条 prompts 必须全部用中文撰写（英文提示词会触发 nvfp4 渲染印章/篆书小字，导致品牌中文错字），把客户品牌名（公司名称字段）原样写入并以品牌中文清晰为主视觉；仅允许现代简约/扁平/白色背景风格；必须明确要求每个字只出现一次、无重复、无多余文字、无错字；严禁使用“大字”“粗壮”“横平竖直”等强调放大文字的措辞（实测会诱发叠字/缺字）；严禁 seal stamp、印章、篆书、雕刻、engraved、环形小字、仿古纹样。模板中的 XXX 必须替换为公司名称字段中的真实品牌名，不得原样输出 XXX。禁止把地名或行业词当作品牌标识，品牌名是唯一主角。",
    "concept": "Logo设计理念详述：3-5句话",
    "style": "设计风格",
    "elements": "建议包含的设计元素",
    "colorGuidance": "配色建议",
    "prompts": [
      "品牌Logo设计：现代简约品牌标志，中文品牌名「XXX」清晰写在画面中央为主视觉，简洁扁平风格，字距均匀、每个字只出现一次、无错字无重复，干净白色背景，居中构图，禁止印章、篆书、雕刻、仿古纹样与多余装饰文字",
      "品牌Logo设计：极简现代品牌标志，中央清晰呈现中文品牌名「XXX」，简洁扁平、易识别，文字清晰完整、无重叠无重复，白色背景居中排版，禁止印章、篆书、雕刻、seal stamp、环形排列与多余文字",
      "品牌Logo设计：现代扁平品牌标志，中文品牌名「XXX」为画面主体，简单干净、留白充足，字字独立、笔画完整、不重复不多字，白色背景，居中构图，禁止印章、篆书、雕刻与任何仿古装饰",
      "品牌Logo设计：简洁扁平风格的中文品牌标志，画面中央清晰展示中文品牌名「XXX」，字迹清楚、无重复无多余文字，白色背景，居中构图，禁止印章、篆书、雕刻与仿古装饰"
    ]
  },
  "aiGeneratedFields": {
    "brandVision": "如果客户没写则AI代写，已写则留空",
    "coreValues": "同上",
    "targetMarket": "同上"
  }
}`;

// ========== Scene Image Defaults ==========

function buildScenePrompts(companyName, industryType) {
  const style = getIndustryDefaults(industryType)?.sceneStyle || 'clean studio lighting';
  const name = companyName || '品牌';
  return [
    { key: 'stationery-1', prompt: `Professional product photography of branded stationery set (business cards, letterhead, envelopes) with company logo "${name}" printed, arranged on clean desk surface, studio lighting, product fully visible, ${style}` },
    { key: 'packaging-1', prompt: `Professional product photography of a branded paper bag with company logo "${name}" printed, standing upright on clean surface, studio lighting, product fully visible, ${style}` },
    { key: 'packaging-2', prompt: `Professional product photography of branded product packaging box with company logo "${name}" printed, clean studio background, product fully visible, ${style}` },
    { key: 'marketing-1', prompt: `Professional product photography of a promotional poster display with company branding "${name}" visible, studio setting, product fully visible` },
    { key: 'marketing-2', prompt: `Professional product photography of a branded membership card with company logo "${name}" printed, clean studio background, product fully visible` },
  ];
}

// === 021 scene prompts helper ===
// 工单 021：场景图提示词优先使用 DeepSeek 行业提示词（brandProfile.sceneImageSuggestions，
// 结构 [{en, zh}]），并注入品牌名；提示词缺失时回退通用模板对应场景。
function buildScenePromptsFromSuggestions(suggestions, companyName, industryType) {
  const keys = ['stationery-1', 'packaging-1', 'packaging-2', 'marketing-1', 'marketing-2'];
  const fallbacks = buildScenePrompts(companyName, industryType);
  const name = companyName || '品牌';
  return keys.map((key, i) => {
    const s = suggestions && suggestions[i];
    const base = s && (typeof s.en === 'string' && s.en.trim() ? s.en : (typeof s.zh === 'string' ? s.zh : ''));
    if (!base) return fallbacks[i];
    const prompt = base.includes(name) ? base : `${base}, with company logo "${name}" printed`;
    return { key, prompt };
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
      const ok = await isStorefrontPhoto(tmpPath);
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

    const region = await locateTextRegion(photoPath);
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
  // 工单 044 v2：客户 logo 可能无文字（纯图形）——检测并记录，叠加合成留 045。
  let logoHasText = null;
  try {
    if (uploadedLogoUrl) {
      const resp = await fetch(uploadedLogoUrl);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        logoHasText = await detectLogoHasText('data:image/png;base64,' + buf.toString('base64'));
      }
    } else if (logoData) {
      logoHasText = await detectLogoHasText(logoData);
    }
  } catch (err) {
    log('WARN', `[PHOTO] logo 文字检测失败: ${err.message}`);
  }
  if (logoHasText !== null) {
    log('INFO', `[PHOTO] 客户上传 Logo 含文字: ${logoHasText}（false=纯图形，图形叠加合成留 045）`);
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
      const vision = await runPhotoSceneVisionCheck({ imageBase64: gen.imageUrl, expectedText, mode: 'chinese' });
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

/** 选择照片产物顶替的场景槽位：文字版=门头/店面槽（无则 marketing-1）；色重涂版=另一个营销槽。 */
function pickPhotoSceneKeys(suggestions) {
  const keys = ['stationery-1', 'packaging-1', 'packaging-2', 'marketing-1', 'marketing-2'];
  let textKey = null;
  if (Array.isArray(suggestions)) {
    suggestions.forEach((s, i) => {
      const t = String((s && (s.zh || s.en)) || '');
      if (!textKey && /门头|店面|店招|门面|storefront|sign/i.test(t)) textKey = keys[i];
    });
  }
  textKey = textKey || 'marketing-1';
  const marketingKeys = keys.filter((k) => k.startsWith('marketing') && k !== textKey);
  const colorKey = marketingKeys[0] || (textKey === 'marketing-1' ? 'marketing-2' : 'marketing-1');
  return { textKey, colorKey };
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
        generate: async ({ prompt, seed }) => comfyuiGenerateLogo({
          prompt: prompt + ', logo design on clean white background, centered composition',
          negativePrompt,
          size: '1024x1024',
          mode: logoTextMode,
          seed,
        }),
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
      generate: async ({ prompt, seed }) => comfyuiGenerateLogo({
        prompt: prompt + ', logo design on clean white background, centered composition',
        negativePrompt,
        size: '1024x1024',
        mode: logoTextMode,
        seed,
      }),
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
          const buffer = Buffer.from(matches[2], 'base64');
          const fileName = `${projectId}/logo_${r.index}_${Date.now()}.jpeg`;
          const { error } = await supabase.storage
            .from('brand-brain-generated')
            .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
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
  const selectedLogo = brandProfile.selectedLogo;
  if (!selectedLogo?.imageUrl) {
    log('ERROR', `[MANUAL] ${projectId}: No selected logo found`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: '未找到选中的Logo' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  log('INFO', `[MANUAL] ${projectId}: Downloading selected logo...`);
  let logoData;
  try {
    const imgResp = await fetch(selectedLogo.imageUrl);
    if (!imgResp.ok) throw new Error(`Failed to download: ${imgResp.status}`);
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const mime = imgResp.headers.get('content-type') || 'image/png';
    logoData = `data:${mime};base64,${imgBuffer.toString('base64')}`;
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
  const scenePrompts = (Array.isArray(sceneSuggestions) && sceneSuggestions.length > 0)
    ? buildScenePromptsFromSuggestions(sceneSuggestions, companyName, industryType)
    : buildScenePrompts(companyName, industryType);

  const sceneImages = {};
  const sceneLabels = {
    'stationery-1': 'VI应用效果图1', 'packaging-1': 'VI应用效果图2',
    'packaging-2': 'VI应用效果图3', 'marketing-1': 'VI应用效果图4', 'marketing-2': 'VI应用效果图5',
  };
  const sceneSectionTitles = {
    'stationery-1': '品牌应用系统', 'packaging-1': '产品包装系统',
    'packaging-2': '产品包装系统', 'marketing-1': '营销展示系统', 'marketing-2': '营销展示系统',
  };
  const sceneVision = {};
  const photoReplacedKeys = new Set();
  // 工单 044：照片预处理（下载/选正立面/7B 定位文字区/蒙版）——必须在
  // ComfyUI 启动前执行（Ollama 需要显存），失败回退原文生图。
  const uploadedLogoUrl = (clientInfo.logoAssets && clientInfo.logoAssets[0] && clientInfo.logoAssets[0].url) || null;
  const photoPrep = await preparePhotoScene({ project, clientInfo, brandProfile, companyName, log, logoData, uploadedLogoUrl });
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
  }

  // 工单 031：场景批次循环＋统一校验（品牌文字按 024 契约；空/乱码→skipped）
  const sceneTextMode = (clientInfo.logoTextLanguage === 'pinyin') ? 'pinyin' : 'chinese';
  const sceneExpectedText = extractExpectedText(scenePrompts[0]?.prompt, sceneTextMode, normalizedCompanyName);
  const activeScenePrompts = scenePrompts.filter((sp) => !photoReplacedKeys.has(sp.key));
  const { results: sceneResults, paused: scenePaused } = await runLogoBatchFlow({
    prompts: activeScenePrompts.map((p) => p.prompt),
    generate: async ({ prompt }) => comfyuiGenerateScene({
      prompt,
      negativePrompt: 'blurry, low quality, distorted, watermark, text overlay',
      size: '1024x1024',
    }),
    check: async ({ imageBase64 }) => runSceneVisionCheck({ imageBase64, expectedText: sceneExpectedText, mode: sceneTextMode }),
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
  if (scenePaused) {
    log('WARN', `[MANUAL] ${projectId}: 场景批次已暂停（ComfyUI 不可用），稍后重试`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'pending_manual', generationMessage: 'ComfyUI 不可用，场景批次已暂停，等待重试' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }
  activeScenePrompts.forEach((sp, i) => {
    const r = sceneResults[i];
    sceneVision[sp.key] = (r && r.vision && r.vision.status) || (r && r.status) || 'failed';
    if (r && r.imageUrl) {
      sceneImages[sp.key] = r.imageUrl;
      log('INFO', `[MANUAL] ${projectId}: Scene ${sp.key} OK (${r.durationMs || '?'}ms, vision=${sceneVision[sp.key]})`);
    } else {
      log('WARN', `[MANUAL] ${projectId}: Scene ${sp.key} 未生成/未通过校验，using placeholder`);
    }
  });
  clientInfo.sceneVision = sceneVision;

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
        mascotThreeViewData = mascotData;
      }
    } catch (err) {
      log('WARN', '[MANUAL] ' + projectId + ': Mascot front download failed: ' + err.message);
    }
    const views = [mascotAssets.front, mascotAssets.side, mascotAssets.back].filter(Boolean);
    if (views.length > 0) {
      mascotSplitViews = [];
      for (const url of views) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            const mime = resp.headers.get('content-type') || 'image/png';
            mascotSplitViews.push('data:' + mime + ';base64,' + buf.toString('base64'));
          }
        } catch (e) {
          log('WARN', '[MANUAL] ' + projectId + ': Mascot view download failed: ' + e.message);
        }
      }
    }
    if (mascotAssets.emotions && mascotAssets.emotions.length > 0) {
      mascotEmotions = {};
      for (const em of mascotAssets.emotions) {
        if (em.url) mascotEmotions[em.name || em.url] = em.url;
      }
    }
    if (mascotAssets.scenes && mascotAssets.scenes.length > 0) {
      mascotScenes = {};
      for (const sc of mascotAssets.scenes) {
        if (sc.url) mascotScenes[sc.name || sc.url] = sc.url;
      }
    }
  }

  // Step 4: Render PPTX
  log('INFO', `[MANUAL] ${projectId}: Rendering PPTX...`);
  let pptxBuf;
  try {
    const cp = brandProfile.colorPalette || [];
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
      logoElements: extractLogoElements(brandProfile?.logoDesignSuggestions?.elements),
      brandVision: clientInfo.brandVision || brandProfile.refinedBrandVision || '',
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
  const fileName = `vi-manual-${projectId}-${ts}.pptx`;
  const storagePath = `${projectId}/${fileName}`;
  try {
    const { error: uploadErr } = await supabase.storage
      .from('brand-brain-generated')
      .upload(storagePath, pptxBuf, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true,
      });
    if (uploadErr) throw new Error(uploadErr.message);

    const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/brand-brain-generated/${storagePath}`;

    // Step 6: Update project as completed
    const pptxResult = {
      url: `/api/ai/download-pptx/${fileName}`,
      downloadUrl: `/api/ai/download-pptx/${fileName}`,
      fileName,
      pageCount: blueprints.length,
      storageUrl,
    };

    const viHistory = clientInfo.viGenerationHistory || [];
    viHistory.push({
      timestamp: new Date().toISOString(),
      pptxResult,
      pageCount: blueprints.length,
      status: 'completed',
    });

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

    log('INFO', `[MANUAL] ${projectId}: DONE! PPTX uploaded -> ${storageUrl}`);
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
  const profileColors = clientInfo.brandProfile?.colorPalette || [];
  const colorDesc = profileColors.map(c => c.hex).join(", ");

  log("INFO", `[MASCOT-SAMPLE] Processing project: ${projectId} (${rawCompanyName})`);

  const stylePrompts = [
    { id: "a", label: "\u7ecf\u5178\u6b3e", desc: "\u5706\u6da6\u53ef\u7231\u98ce\u683c",
      prompt: `3D Pixar style cute brand mascot for ${companyName}, ${industry} industry, round friendly shapes, warm brand colors ${colorDesc}, cute big eyes, full body front view, white background, soft studio lighting` },
    { id: "b", label: "\u6e05\u65b0\u6b3e", desc: "\u7b80\u7ea6\u6e05\u65b0\u98ce\u683c",
      prompt: `3D Pixar style modern minimalist brand mascot for ${companyName}, ${industry} industry, clean geometric shapes, fresh brand colors ${colorDesc}, simple expressive face, full body front view, white background` },
    { id: "c", label: "\u5320\u4eba\u6b3e", desc: "\u81ea\u4fe1\u5927\u65b9\u98ce\u683c",
      prompt: `3D Pixar style character brand mascot for ${companyName}, ${industry} industry, bold design, confident pose, brand accent colors ${colorDesc}, friendly smile, full body front view, white background` },
    { id: "d", label: "Q\u7248\u6b3e", desc: "\u8d85\u5927\u5934\u53ef\u7231\u98ce\u683c",
      prompt: `3D Pixar style super-deformed chibi brand mascot for ${companyName}, ${industry} industry, extra large head, tiny body, ultra cute, round soft shapes, full body front view, white background` },
  ];

  // 工单 031：公仔样稿批次循环＋完整性统一校验（3B粗筛→7B终审；不逐字匹配）
  const negativePrompt = "blurry, low quality, distorted, deformed, ugly, watermark, extra limbs, bad anatomy";
  const { results: sampleResults, paused: batchPaused } = await runLogoBatchFlow({
    prompts: stylePrompts.map((p) => p.prompt),
    generate: async ({ prompt }) => comfyGenerateImage({ prompt, negativePrompt, width: 1024, height: 1024 }),
    check: async ({ imageBase64 }) =>
      runMascotVisionCheck({
        imageBase64,
        // 工单 034：样稿均为正面白底图，固定启用白底判定；原误引用全套函数的
        // allItems 导致 ReferenceError→校验被静默 skipped（033 真实验证发现）
        requireWhiteBackground: true,
      }),
    ensureReady: () => ensureComfyUIReady({ log }),
    isAvailable: () => isComfyUIAvailable(),
    // 工单 034：校验前确保 ComfyUI 完全停止并释放显存（停止而非仅空闲）
    beforeCheck: () => ensureVisionVramFree({ log }),
    log,
    gpuSnapshot,
    maxRounds: 2,
    maxAttempts: 3,
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
    samples.push({ id: sp.id, label: sp.label, desc: sp.desc, imageUrl: publicUrl || (imageUrl || ""), vision: (r && r.vision) || null, status: (r && r.status) || "failed" });
  }

  const successCount = samples.filter(s => s.imageUrl).length;
  log("INFO", `[MASCOT-SAMPLE] ${projectId}: ${successCount}/4 samples generated`);
  try {
    await supabase.from("projects").update({
      status: "mascot_samples_ready",
      client_info: {
        ...clientInfo,
        generationStatus: "mascot_samples_ready",
        generationMessage: `IP\u516c\u4ed4\u6837\u7a3f\u751f\u6210\u5b8c\u6210 (${successCount}/4)`,
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
  const profileColors = clientInfo.brandProfile?.colorPalette || [];
  const colorDesc = profileColors.map(c => c.hex).join(", ");

  log("INFO", `[MASCOT-FULL] Processing project: ${projectId} (${rawCompanyName}), selected: ${selectedId} (${styleAnchor})`);

  // 工单 033：角色身份描述由平台 AI（本地 7B 视觉）从客户选定样稿动态提取，
  // 禁止手写/硬编码角色描述模板；提取失败/过短则回退 styleAnchor 并告警。
  let characterSpec = styleAnchor;
  try {
    const sampleImage = selectedSample && (selectedSample.imageUrl || "");
    if (sampleImage) {
      const sampleB64 = await toDataUriIfNeeded(sampleImage);
      if (sampleB64) {
        const spec = await extractMascotCharacterSpec(sampleB64);
        if (spec && spec.length >= 10) {
          characterSpec = spec;
          log("INFO", `[MASCOT-FULL] ${projectId}: 角色描述由 AI 从样稿提取（${spec.length} 字符）`);
        } else {
          log("WARN", `[MASCOT-FULL] ${projectId}: 角色描述提取失败或过短，回退 styleAnchor`);
        }
      }
    }
  } catch (e) {
    log("WARN", `[MASCOT-FULL] ${projectId}: 角色描述提取异常，回退 styleAnchor: ${e.message}`);
  }

  const views = [
    { name: "front", prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, front view facing camera, full body, white background, soft studio lighting` },
    { name: "side", prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, side profile view, full body side view, white background, soft studio lighting` },
    { name: "back", prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, seen from behind, no face visible, just the back of the character, back of head, full body back view, white background` },
  ];
  const emotions = [
    { name: MASCOT_EMOTION_NAMES[0], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, warm friendly smile expression, gentle happy eyes, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[1], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, welcoming greeting gesture with open arms, friendly smile, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[2], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, focused attentive expression, gentle determined look, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[3], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, surprised delighted expression, wide eyes, mouth open in joy, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[4], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, calm reassuring smile, peaceful warm expression, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[5], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, big happy smile, joyful expression, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[6], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, guiding gesture with one hand pointing forward, confident friendly look, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[7], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, playful cute expression, winking, cheerful mood, full body front view, white background` },
  ];
  const scenes = [
    { name: MASCOT_SCENE_NAMES[0], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, full body mascot welcoming customers at the store entrance, storefront signage and entrance context, commercial setting` },
    { name: MASCOT_SCENE_NAMES[1], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, mascot applied on the brand product packaging such as cup box or paper bag, product display context, commercial setting` },
    { name: MASCOT_SCENE_NAMES[2], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, mascot on membership card and interactive member terminal, membership service context, commercial setting` },
    { name: MASCOT_SCENE_NAMES[3], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${characterSpec}, brand colors ${colorDesc}, mascot in social media banner and avatar context on digital screen, social interaction context` },
  ];

  // 工单 031：公仔全套批次循环＋完整性统一校验（15 张：3 视图＋8 表情＋4 场景）
  const allItems = [
    ...views.map((v) => ({ cat: "view", name: v.name, prompt: v.prompt })),
    ...emotions.map((e) => ({ cat: "emotion", name: e.name, prompt: e.prompt })),
    ...scenes.map((s) => ({ cat: "scene", name: s.name, prompt: s.prompt })),
  ];
  // 工单 032：进度计数按实际项数（3 视图＋8 表情＋4 场景 = 15），修正旧的 +1 偏差。
  const totalImages = allItems.length;
  const { results: fullResults, paused: batchPaused } = await runLogoBatchFlow({
    prompts: allItems.map((it) => it.prompt),
    generate: async ({ prompt }) => comfyGenerateImage({
      prompt,
      negativePrompt: "blurry, low quality, distorted, deformed, ugly, watermark, extra limbs, bad anatomy",
      width: 1024,
      height: 1024,
    }),
    // 工单 032：全套场景项跳过白底判定（与样稿一致），避免场景图误报 needs_review。
    check: async ({ imageBase64, index }) =>
      runMascotVisionCheck({
        imageBase64,
        requireWhiteBackground: (allItems[index] || {}).cat !== "scene",
      }),
    ensureReady: () => ensureComfyUIReady({ log }),
    isAvailable: () => isComfyUIAvailable(),
    // 工单 034：校验前确保 ComfyUI 完全停止并释放显存（停止而非仅空闲）
    beforeCheck: () => ensureVisionVramFree({ log }),
    log,
    gpuSnapshot,
    maxRounds: 2,
    maxAttempts: 3,
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
    mascotVision[`${item.cat}-${item.name}`] = (r && r.vision && r.vision.status) || (r && r.status) || "failed";
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
          fullMascotProgress: { views: 3, emotions: MASCOT_EMOTION_NAMES.length, scenes: MASCOT_SCENE_NAMES.length, total: totalImages, completed },
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

  const mascotAssets = {
    front: viewResults.front || "",
    side: viewResults.side || "",
    back: viewResults.back || "",
    emotions: emotionResults,
    scenes: sceneResults,
    // 工单 006G：不把 front 伪造成合成三视图；threeView 不能替代独立视图。
    threeView: "",
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
        fullMascotProgress: { views: 3, emotions: MASCOT_EMOTION_NAMES.length, scenes: MASCOT_SCENE_NAMES.length, total: totalImages, completed },
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    log("INFO", `[MASCOT-FULL] ${projectId}: DONE! Status -> pending_manual`);
  } catch (e) {
    log("ERROR", `[MASCOT-FULL] ${projectId}: Final update failed: ${e.message}`);
  }
}

// ========== Main Polling Loop ==========

async function poll() {
  await sendHeartbeat();
  try {
    // Phase 1: Check for pending_logo
    const orderFilter = (process.env.WORKER_ORDER_FILTER || '').split(',').map((s) => s.trim()).filter(Boolean);
    let logoQuery = supabase
      .from('projects')
      .select('id, client_info, submission_id')
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
        await processLogoGeneration(project);
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



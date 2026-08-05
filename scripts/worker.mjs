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
import { comfyuiGenerateLogo, comfyuiGenerateScene, comfyGenerateImage, isComfyUIAvailable } from '../src/lib/ip/ip-image-provider/comfyui-provider';
import { arkGenerate } from '../src/lib/ip/ip-image-provider/ark-fallback';
import { planPages } from '../src/lib/vi-manual/page-planner';
import { renderPptxToBuffer } from '../src/lib/pptx/render-pptx';
import { normalizeBrandName } from '../src/lib/vi-manual/brand-name-normalizer';
import { buildMascotAssetSetFromClientInfo, validateMascotAssets, MASCOT_EMOTION_NAMES, MASCOT_SCENE_NAMES } from '../src/lib/vi-manual/mascot-assets';
import { getIndustryType, getIndustryDefaults } from '../src/lib/brand/industry-types';
import { extractLogoElements, extractStyleTags, resolveLogoColorsFromProfile, resolveLogoColors } from '../src/lib/vi-manual/brand-visual-rules';
import { normalizeLogoTextLanguage } from '../src/lib/core/consultation-schema';
import { runLogoVisionCheck, extractExpectedText } from '../src/lib/vision-check';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ========== Config ==========

const SUPABASE_URL = 'https://fzoscrutqhdfzwnjgjvs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const POLL_INTERVAL_MS = 10_000;
const DEEPSEEK_TIMEOUT_MS = 60_000;
const MAX_LOGO_GEN_RETRIES = 2;
// 工单 027：Logo 视觉校验不合格时换 seed 重试次数（校验失败不计入生成重试）。
const MAX_VISION_RETRIES = 2;

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

  // Step 3: Check ComfyUI availability
  const comfyAvailable = await isComfyUIAvailable();
  if (!comfyAvailable) {
    log('WARN', `[LOGO] ${projectId}: ComfyUI not available, will retry later`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'pending_logo' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Step 4: Generate 4 logos via ComfyUI (serial)
  log('INFO', `[LOGO] ${projectId}: Generating ${logoPrompts.length} logos via ComfyUI (mode=${logoTextMode})...`);
  const logoResults = [];
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

  for (let i = 0; i < logoPrompts.length; i++) {
    const rawPrompt = logoPrompts[i];
    const enhancedPrompt = rawPrompt + ', logo design on clean white background, centered composition';
    const negativePrompt = 'deformed, blurry, low quality, distorted, 3d render, shadow, gradient, complex background, watermark, text, extra limbs, bad anatomy';

    let genRetries = 0;
    let visionRetries = 0;
    let result = null;

    while (genRetries <= MAX_LOGO_GEN_RETRIES && !result) {
      const seed = Math.floor(Math.random() * 2147483647);
      try {
        log('INFO', `[LOGO] ${projectId}: Logo ${i + 1}/${logoPrompts.length} (attempt ${genRetries + 1}, seed=${seed})...`);
        // 工单 029：重活前 ComfyUI 健康检查——避免与 Ollama 驻留/高负载叠加时挂起。
        if (!(await isComfyUIAvailable())) {
          log('WARN', `[LOGO] ${projectId}: ComfyUI 暂不可用，等待 5s 后重试 (attempt ${genRetries + 1})`);
          await new Promise(r => setTimeout(r, 5000));
          if (!(await isComfyUIAvailable())) {
            throw new Error('ComfyUI not available before generation');
          }
        }
        const genResult = await comfyuiGenerateLogo({
          prompt: enhancedPrompt,
          negativePrompt,
          size: '1024x1024',
          mode: logoTextMode,
          seed,
        });

        // 工单 027：生成后自动视觉校验（Ollama 可用时）；不可用/无期望文本 → 未初检标记。
        let vision = null;
        if (genResult.imageUrl && expectedText) {
          try {
            vision = await runLogoVisionCheck({
              imageBase64: genResult.imageUrl,
              prompt: rawPrompt,
              expectedText,
              mode: logoTextMode,
            });
          } catch (e) {
            vision = { status: 'skipped', reason: `vision_error: ${e.message.slice(0, 120)}`, mode: logoTextMode, expectedText, coarseModel: 'qwen2.5vl:3b', fineModel: 'my-vl' };
          }
          log('INFO', `[VISION] ${projectId}: Logo ${i + 1} ${vision.status}${vision.reason ? ` (${vision.reason})` : ''} (expected=${expectedText}${vision.fineText ? ` fine=${vision.fineText.slice(0, 60)}` : ''})`);
          if (vision.status === 'suspect' && visionRetries < MAX_VISION_RETRIES) {
            visionRetries++;
            log('WARN', `[VISION] ${projectId}: Logo ${i + 1} 校验不合格，换 seed 重试 ${visionRetries}/${MAX_VISION_RETRIES}`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (vision.status === 'suspect') {
            vision = { ...vision, status: 'needs_review' };
            log('WARN', `[VISION] ${projectId}: Logo ${i + 1} 重试后仍不合格，标记 needs_review（不静默交付）`);
          }
        } else if (genResult.imageUrl && !expectedText) {
          vision = { status: 'skipped', reason: 'expected_text_unavailable', mode: logoTextMode, expectedText: '', coarseModel: 'qwen2.5vl:3b', fineModel: 'my-vl' };
          log('WARN', `[VISION] ${projectId}: Logo ${i + 1} 无法校验（期望文本缺失），标记未初检`);
        }

        result = {
          index: i,
          prompt: rawPrompt,
          imageUrl: genResult.imageUrl,
          model: genResult.model,
          durationMs: genResult.durationMs,
          seed,
          vision,
        };
        log('INFO', `[LOGO] ${projectId}: Logo ${i + 1} OK (${genResult.durationMs}ms${vision ? `, vision=${vision.status}` : ''})`);
      } catch (err) {
        genRetries++;
        log('WARN', `[LOGO] ${projectId}: Logo ${i + 1} failed (attempt ${genRetries}): ${err.message}`);
        if (genRetries > MAX_LOGO_GEN_RETRIES) {
          result = { index: i, prompt: rawPrompt, imageUrl: null, error: err.message };
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    logoResults.push(result);

    // Update progress after each logo (non-critical, don't throw)
    try {
      const fresh = await supabase.from('projects').select('client_info').eq('id', projectId).single();
      const freshCI = { ...(fresh.data?.client_info || clientInfo) };
      freshCI.generationStatus = 'logo_generating';
      freshCI.generationMessage = `正在生成Logo (${i + 1}/${logoPrompts.length})...`;
      freshCI.logoGenerationStatus = {
        total: logoPrompts.length,
        completed: i + 1,
        results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error, vision: r.vision })),
        startedAt: freshCI.logoGenerationStatus?.startedAt || new Date().toISOString(),
        ...(qualityNote ? { qualityNote } : {}),
      };
      await supabase.from('projects').update({ client_info: freshCI, updated_at: new Date().toISOString() }).eq('id', projectId);
    } catch (e) { /* non-critical */ }

    if (i < logoPrompts.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Step 5: Persist base64 images to Supabase Storage
  const successCount = logoResults.filter(r => r.imageUrl).length;
  log('INFO', `[LOGO] ${projectId}: ${successCount}/${logoPrompts.length} logos generated, persisting...`);

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
          generationMessage: `Logo生成完成 (${successCount}/${logoPrompts.length})`,
          brandProfile: {
            ...finalBP,
            logoGenerationResults: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error, vision: r.vision })),
            logoGeneratedAt: new Date().toISOString(),
          },
          logoGenerationStatus: {
            total: logoPrompts.length,
            completed: logoPrompts.length,
            results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error, vision: r.vision })),
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
    await supabase.from('projects').update({
      status: 'submitted',
      client_info: {
        ...clientInfo,
        generationStatus: 'mascot_generating',
        generationMessage: 'IP 素材不完整，暂不渲染VI手册',
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

  const comfyAvailable = await isComfyUIAvailable();
  if (!comfyAvailable) {
    log('WARN', `[MANUAL] ${projectId}: ComfyUI not available, will retry later`);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'pending_manual' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  for (const sp of scenePrompts) {
    try {
      log('INFO', `[MANUAL] ${projectId}: Scene ${sp.key}...`);
      const result = await comfyuiGenerateScene({
        prompt: sp.prompt,
        negativePrompt: 'blurry, low quality, distorted, watermark, text overlay',
        size: '1024x1024',
      });
      if (result.imageUrl) {
        sceneImages[sp.key] = result.imageUrl;
        log('INFO', `[MANUAL] ${projectId}: Scene ${sp.key} OK (${result.durationMs || '?'}ms)`);
      }
    } catch (err) {
      log('WARN', `[MANUAL] ${projectId}: Scene ${sp.key} failed: ${err.message}, using placeholder`);
    }
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

  const samples = [];
  for (const sp of stylePrompts) {
    log("INFO", `[MASCOT-SAMPLE] ${projectId}: Generating sample ${sp.id} (${sp.label})...`);
    let imageUrl = null;
    try {
      const result = await comfyGenerateImage({
        prompt: sp.prompt,
        negativePrompt: "blurry, low quality, distorted, deformed, ugly, watermark, extra limbs, bad anatomy",
        width: 1024,
        height: 1024,
      });
      imageUrl = result.imageUrl;
    } catch (err) {
      log("WARN", `[MASCOT-SAMPLE] ${projectId}: ComfyUI failed for ${sp.id}: ${err.message}, trying ARK...`);
      // 部署红线（Chris 2026-08-03）：生图必须本地完成，禁止回退到付费 ARK。
      if ((process.env.COMFYUI_DISABLE_ARK_FALLBACK || "").trim() === "1") throw err;
      try {
        const arkResult = await arkGenerate(sp.prompt, "blurry, low quality, distorted", 1024, 1024);
        imageUrl = arkResult.imageUrl;
      } catch (arkErr) {
        log("ERROR", `[MASCOT-SAMPLE] ${projectId}: ARK also failed for ${sp.id}: ${arkErr.message}`);
      }
    }

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

    samples.push({ id: sp.id, label: sp.label, desc: sp.desc, imageUrl: publicUrl || (imageUrl || "") });
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

  const views = [
    { name: "front", prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, front view facing camera, full body, white background, soft studio lighting` },
    { name: "side", prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, side profile view, full body side view, white background, soft studio lighting` },
    { name: "back", prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, seen from behind, no face visible, just the back of the character, back of head, full body back view, white background` },
  ];
  const emotions = [
    { name: MASCOT_EMOTION_NAMES[0], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, warm friendly smile expression, gentle happy eyes, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[1], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, welcoming greeting gesture with open arms, friendly smile, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[2], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, focused attentive expression, gentle determined look, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[3], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, surprised delighted expression, wide eyes, mouth open in joy, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[4], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, calm reassuring smile, peaceful warm expression, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[5], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, big happy smile, joyful expression, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[6], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, guiding gesture with one hand pointing forward, confident friendly look, full body front view, white background` },
    { name: MASCOT_EMOTION_NAMES[7], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, playful cute expression, winking, cheerful mood, full body front view, white background` },
  ];
  const scenes = [
    { name: MASCOT_SCENE_NAMES[0], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, full body mascot welcoming customers at the store entrance, storefront signage and entrance context, commercial setting` },
    { name: MASCOT_SCENE_NAMES[1], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, mascot applied on the brand product packaging such as cup box or paper bag, product display context, commercial setting` },
    { name: MASCOT_SCENE_NAMES[2], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, mascot on membership card and interactive member terminal, membership service context, commercial setting` },
    { name: MASCOT_SCENE_NAMES[3], prompt: `3D Pixar style brand mascot for ${companyName}, ${industry} industry, ${styleAnchor}, brand colors ${colorDesc}, mascot in social media banner and avatar context on digital screen, social interaction context` },
  ];

  const totalImages = views.length + emotions.length + scenes.length + 1;
  let completed = 0;

  async function generateAndUpload(category, name, prompt) {
    log("INFO", `[MASCOT-FULL] ${projectId}: ${category}-${name} (${completed + 1}/${totalImages})...`);
    let imageUrl = null;
    try {
      const result = await comfyGenerateImage({
        prompt,
        negativePrompt: "blurry, low quality, distorted, deformed, ugly, watermark, extra limbs, bad anatomy",
        width: 1024,
        height: 1024,
      });
      imageUrl = result.imageUrl;
    } catch (err) {
      log("WARN", `[MASCOT-FULL] ${projectId}: ComfyUI failed for ${category}-${name}: ${err.message}, trying ARK...`);
      // 部署红线（Chris 2026-08-03）：生图必须本地完成，禁止回退到付费 ARK。
      if ((process.env.COMFYUI_DISABLE_ARK_FALLBACK || "").trim() === "1") throw err;
      try {
        const arkResult = await arkGenerate(prompt, "blurry, low quality, distorted", 1024, 1024);
        imageUrl = arkResult.imageUrl;
      } catch (arkErr) {
        log("ERROR", `[MASCOT-FULL] ${projectId}: ARK also failed for ${category}-${name}: ${arkErr.message}`);
      }
    }

    let publicUrl = "";
    if (imageUrl && imageUrl.startsWith("data:")) {
      try {
        const matches = imageUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], "base64");
          const storagePath = `${projectId}/mascot-${category}-${name}-${Date.now()}.png`;
          const { error } = await supabase.storage
            .from("brand-brain-generated")
            .upload(storagePath, buffer, { contentType: "image/png", upsert: true });
          if (!error) {
            const { data } = supabase.storage.from("brand-brain-generated").getPublicUrl(storagePath);
            publicUrl = data.publicUrl;
            log("INFO", `[MASCOT-FULL] ${projectId}: Uploaded ${category}-${name} -> ${publicUrl}`);
          }
        }
      } catch (e) {
        log("WARN", `[MASCOT-FULL] ${projectId}: Upload failed for ${category}-${name}: ${e.message}`);
      }
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

    return publicUrl;
  }

  const viewResults = {};
  for (const v of views) {
    viewResults[v.name] = await generateAndUpload("view", v.name, v.prompt);
    await new Promise(r => setTimeout(r, 2000));
  }
  const emotionResults = [];
  for (const e of emotions) {
    emotionResults.push({ name: e.name, url: await generateAndUpload("emotion", e.name, e.prompt) });
    await new Promise(r => setTimeout(r, 2000));
  }
  const sceneResults = [];
  for (const s of scenes) {
    sceneResults.push({ name: s.name, url: await generateAndUpload("scene", s.name, s.prompt) });
    await new Promise(r => setTimeout(r, 2000));
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

  log("INFO", `[MASCOT-FULL] ${projectId}: ${completed}/${totalImages} generated. Setting pending_manual...`);

  try {
    await supabase.from("projects").update({
      status: "mascot_generated",
      client_info: {
        ...clientInfo,
        generationStatus: "pending_manual",
        generationMessage: "IP\u516c\u4ed4\u5168\u5957\u751f\u6210\u5b8c\u6210\uff0c\u5f00\u59cb\u5236\u4f5cVI\u624b\u518c",
        mascotAssets,
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



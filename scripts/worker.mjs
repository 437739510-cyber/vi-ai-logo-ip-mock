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
import { comfyuiGenerateLogo, comfyuiGenerateScene, isComfyUIAvailable } from '../src/lib/ip/ip-image-provider/comfyui-provider';
import { planPages } from '../src/lib/vi-manual/page-planner';
import { renderPptxToBuffer } from '../src/lib/pptx/render-pptx';
import { getIndustryType, getIndustryDefaults } from '../src/lib/brand/industry-types';
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

// ========== Brand Analysis Prompt ==========

function buildAnalysisPrompt(clientInfo) {
  const parts = [
    '## 客户品牌基础信息',
    '',
    `公司名称：${clientInfo.companyName || ''}`,
    `所属行业：${clientInfo.industry || ''}`,
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
  "logoDesignSuggestions": {
    "concept": "Logo设计理念详述：3-5句话",
    "style": "设计风格",
    "elements": "建议包含的设计元素",
    "colorGuidance": "配色建议",
    "prompts": [
      "English prompt 1: detailed AI image generation prompt with design style, graphic elements, color scheme, layout",
      "English prompt 2: style variant of concept 1",
      "English prompt 3: different creative direction",
      "English prompt 4: another creative direction"
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

// ========== Logo Generation ==========

async function processLogoGeneration(project) {
  const projectId = project.id;
  const clientInfo = (project.client_info || {});
  const brandProfile = clientInfo.brandProfile || {};

  log('INFO', `[LOGO] Processing project: ${projectId} (${clientInfo.companyName || 'unknown'})`);

  // Step 1: Mark as generating
  await supabase.from('projects').update({
    status: 'logo_generating',
    client_info: { ...clientInfo, generationStatus: 'logo_generating', generationMessage: 'AI正在分析品牌...' },
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  // Step 2: Brand analysis (if not already done)
  let logoPrompts = brandProfile.logoDesignSuggestions?.prompts;
  let analysisProfile = brandProfile;

  if (!logoPrompts || logoPrompts.length === 0) {
    log('INFO', `[LOGO] ${projectId}: No logo prompts found, running brand analysis...`);
    try {
      const analysisPrompt = buildAnalysisPrompt(clientInfo);
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
  log('INFO', `[LOGO] ${projectId}: Generating ${logoPrompts.length} logos via ComfyUI...`);
  const logoResults = [];
  const companyName = clientInfo.companyName || 'Brand';

  for (let i = 0; i < logoPrompts.length; i++) {
    const rawPrompt = logoPrompts[i];
    const enhancedPrompt = rawPrompt + ', logo design on clean white background, centered composition';
    const negativePrompt = 'cartoon, illustration, vector art, flat design, digital art, photorealistic, shadow, gradient, complex background, text, watermark';

    let retries = 0;
    let result = null;

    while (retries <= MAX_LOGO_GEN_RETRIES && !result) {
      try {
        log('INFO', `[LOGO] ${projectId}: Logo ${i + 1}/${logoPrompts.length} (attempt ${retries + 1})...`);
        const genResult = await comfyuiGenerateLogo({
          prompt: enhancedPrompt,
          negativePrompt,
          size: '1024x1024',
        });
        result = {
          index: i,
          prompt: rawPrompt,
          imageUrl: genResult.imageUrl,
          model: genResult.model,
          durationMs: genResult.durationMs,
        };
        log('INFO', `[LOGO] ${projectId}: Logo ${i + 1} OK (${genResult.durationMs}ms)`);
      } catch (err) {
        retries++;
        log('WARN', `[LOGO] ${projectId}: Logo ${i + 1} failed (attempt ${retries}): ${err.message}`);
        if (retries > MAX_LOGO_GEN_RETRIES) {
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
        results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error })),
        startedAt: freshCI.logoGenerationStatus?.startedAt || new Date().toISOString(),
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
            logoGenerationResults: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error })),
            logoGeneratedAt: new Date().toISOString(),
          },
          logoGenerationStatus: {
            total: logoPrompts.length,
            completed: logoPrompts.length,
            results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error })),
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

// ========== VI Manual Generation ==========

async function processManualGeneration(project) {
  const projectId = project.id;
  const clientInfo = (project.client_info || {});
  const brandProfile = clientInfo.brandProfile || {};

  log('INFO', `[MANUAL] Processing project: ${projectId} (${clientInfo.companyName || 'unknown'})`);

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
  const companyName = clientInfo.companyName || '';
  const industryType = getIndustryType(clientInfo.industry || 'general');
  const scenePrompts = buildScenePrompts(companyName, industryType);

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
    const brandColors = {
      primary: { hex: cp[0]?.hex || '#333333', name: cp[0]?.name || '主色' },
      secondary: { hex: cp[1]?.hex || '#666666', name: cp[1]?.name || '辅助色' },
      accent: { hex: cp[2]?.hex || '#CC0000', name: cp[2]?.name || '强调色' },
    };

    blueprints = await planPages({
      clientInfo: {
        companyName: clientInfo.companyName || '',
        brandVision: clientInfo.brandVision || brandProfile.refinedBrandVision || '',
        coreValues: clientInfo.coreValues || brandProfile.refinedCoreValues || '',
        targetMarket: clientInfo.targetMarket || brandProfile.refinedTargetMarket || '',
        logoPhilosophy: clientInfo.logoPhilosophy || '',
        industry: clientInfo.industry || 'general',
        brandPersonality: clientInfo.brandPersonality || '',
      },
      brandColors,
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

  // Step 4: Render PPTX
  log('INFO', `[MANUAL] ${projectId}: Rendering PPTX...`);
  let pptxBuf;
  try {
    const cp = brandProfile.colorPalette || [];
    const options = {
      projectName: clientInfo.companyName || 'Brand',
      companyName: clientInfo.companyName || 'Brand',
      industry: clientInfo.industry || 'general',
      logoData,
      aiLogoData: logoData,
      brandColors: {
        primary: cp[0]?.hex || '#333333',
        secondary: cp[1]?.hex || '#666666',
        accent: cp[2]?.hex || '#CC0000',
      },
      brandVision: clientInfo.brandVision || brandProfile.refinedBrandVision || '',
      coreValues: clientInfo.coreValues || brandProfile.refinedCoreValues || '',
      targetMarket: clientInfo.targetMarket || brandProfile.refinedTargetMarket || '',
      logoPhilosophy: clientInfo.logoPhilosophy || '',
      sceneImages,
      sceneLabels,
      sceneSectionTitles,
      compressImages: true,
      fullBrandName: clientInfo.companyName || '',
      englishName: (clientInfo.companyName || 'BRAND').toUpperCase(),
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

// ========== Main Polling Loop ==========

async function poll() {
  try {
    // Phase 1: Check for pending_logo
    const { data: logoProjects, error: logoErr } = await supabase
      .from('projects')
      .select('id, client_info, submission_id')
      .filter('client_info->>generationStatus', 'eq', 'pending_logo')
      .order('created_at', { ascending: true })
      .limit(1);

    if (logoErr) {
      log('WARN', `[POLL] Logo query error: ${logoErr.message}`);
    } else if (logoProjects && logoProjects.length > 0) {
      for (const project of logoProjects) {
        await processLogoGeneration(project);
      }
    }

    // Phase 2: Check for pending_manual
    const { data: manualProjects, error: manualErr } = await supabase
      .from('projects')
      .select('id, client_info, submission_id')
      .filter('client_info->>generationStatus', 'eq', 'pending_manual')
      .order('created_at', { ascending: true })
      .limit(1);

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


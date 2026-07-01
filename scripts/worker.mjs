/**
 * Brand Brain Automation Worker
 * ==============================
 * Runs on local PC (Windows 10). Polls Supabase for pending tasks,
 * calls ComfyUI locally for image generation, uploads results.
 *
 * Flow:
 *   pending_logo  → DeepSeek brand analysis + ComfyUI logo gen (4 logos)
 *   pending_manual → ComfyUI scene gen (5 images) + PPTX render + upload
 *
 * Usage: npx tsx scripts/worker.mjs
 *        or  node --import tsx scripts/worker.mjs
 *
 * Startup: Add to Windows Task Scheduler or run in terminal.
 */

import { createClient } from '@supabase/supabase-js';
import { comfyuiGenerateLogo, comfyuiGenerateScene, isComfyUIAvailable } from '../src/lib/ip/ip-image-provider/comfyui-provider';
import { planPages } from '../src/lib/vi-manual/page-planner';
import { renderPptxToBuffer } from '../src/lib/pptx/render-pptx';
import { getIndustryType, getIndustryDefaults } from '../src/lib/brand/industry-types';
import { getIndustryKnowledge } from '../src/lib/brand/industry-knowledge';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ========== Config ==========

const SUPABASE_URL = 'https://fzoscrutqhdfzwnjgjvs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
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
  const line = [] [] ;
  console.log(line);
  // Also append to log file
  const date = ts.slice(0, 10);
  fs.appendFile(path.join(LOG_DIR, worker-.log), line + '\n').catch(() => {});
}

// ========== DeepSeek API ==========

async function callDeepSeek(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 4096) {
  const resp = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': Bearer ,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
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
    throw new Error(DeepSeek : );
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
}

function parseDeepSeekJSON(content) {
  const cleaned = content
    .replace(/^`(?:json)?\s*/i, '')
    .replace(/\s*`$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

// ========== Brand Analysis ==========

function buildAnalysisPrompt(clientInfo) {
  const parts = [
    '## 客户品牌基础信息',
    '',
    公司名称：,
    所属行业：,
  ];
  if (clientInfo.province || clientInfo.city) {
    parts.push(所在地：);
  }
  parts.push('');
  parts.push('### 客户已填写的品牌信息（有则保留润色，无则AI代写）：');
  parts.push(品牌愿景：);
  parts.push(核心价值：);
  parts.push(目标市场：);
  if (clientInfo.logoPhilosophy) parts.push(LOGO设计理念：);
  if (clientInfo.brandPersonality) parts.push(品牌个性：);
  if (clientInfo.logoStyle) parts.push(Logo图形偏好：);
  if (clientInfo.logoUsage) parts.push(Logo主要用途：);
  if (clientInfo.avoidElements) parts.push(设计禁忌：);
  if (clientInfo.competitorReference) parts.push(竞品参考：);
  if (clientInfo.mainProducts) parts.push(主营产品：);
  if (clientInfo.description) parts.push(补充描述：);
  parts.push('');
  parts.push('请基于以上信息，进行深度品牌分析，输出品牌档案JSON。');
  return parts.join('\n');
}

const BRAND_ANALYSIS_SYSTEM = 你是一位资深的品牌战略分析师，精通中国本土市场的品牌定位与VI策略。

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
};

// ========== Logo Generation ==========

async function processLogoGeneration(project) {
  const projectId = project.id;
  const clientInfo = (project.client_info || {});
  const brandProfile = clientInfo.brandProfile || {};

  log('INFO', [LOGO] Processing project:  ());

  // Step 1: Mark as generating
  await supabase.from('projects').update({
    status: 'logo_generating',
    client_info: {
      ...clientInfo,
      generationStatus: 'logo_generating',
      generationMessage: 'AI正在分析品牌...',
    },
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  // Step 2: Brand analysis (if not already done)
  let logoPrompts = brandProfile.logoDesignSuggestions?.prompts;
  let analysisProfile = brandProfile;

  if (!logoPrompts || logoPrompts.length === 0) {
    log('INFO', [LOGO] : No logo prompts found, running brand analysis...);
    try {
      const analysisPrompt = buildAnalysisPrompt(clientInfo);
      const dsContent = await callDeepSeek(BRAND_ANALYSIS_SYSTEM, analysisPrompt, 0.7, 4096);
      analysisProfile = parseDeepSeekJSON(dsContent);
      logoPrompts = analysisProfile.logoDesignSuggestions?.prompts;

      if (!logoPrompts || logoPrompts.length === 0) {
        throw new Error('Brand analysis returned no logo prompts');
      }
      log('INFO', [LOGO] : Brand analysis OK, got  prompts);

      // Save brand profile
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
      log('ERROR', [LOGO] : Brand analysis failed: );
      await supabase.from('projects').update({
        status: 'submitted',
        client_info: {
          ...clientInfo,
          generationStatus: 'failed',
          generationMessage: 品牌分析失败: ,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      return;
    }
  }

  // Step 3: Check ComfyUI
  const comfyAvailable = await isComfyUIAvailable();
  if (!comfyAvailable) {
    log('WARN', [LOGO] : ComfyUI not available, will retry later);
    // Reset status so it gets picked up again
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'pending_logo' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Step 4: Generate 4 logos via ComfyUI (serial)
  log('INFO', [LOGO] : Generating  logos via ComfyUI...);
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
        log('INFO', [LOGO] : Logo / (attempt )...);
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
        log('INFO', [LOGO] : Logo  OK (ms));
      } catch (err) {
        retries++;
        log('WARN', [LOGO] : Logo  failed (attempt ): );
        if (retries > MAX_LOGO_GEN_RETRIES) {
          result = { index: i, prompt: rawPrompt, imageUrl: null, error: err.message };
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    logoResults.push(result);

    // Update progress
    try {
      const freshCI = { ...(await supabase.from('projects').select('client_info').eq('id', projectId).single()).data?.client_info || clientInfo };
      freshCI.generationStatus = 'logo_generating';
      freshCI.generationMessage = 正在生成Logo (/)...;
      freshCI.logoGenerationStatus = {
        total: logoPrompts.length,
        completed: i + 1,
        results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error })),
        startedAt: freshCI.logoGenerationStatus?.startedAt || new Date().toISOString(),
      };
      await supabase.from('projects').update({
        client_info: freshCI,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    } catch (e) { /* non-critical */ }

    if (i < logoPrompts.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Step 5: Persist base64 images to Supabase Storage
  const successCount = logoResults.filter(r => r.imageUrl).length;
  log('INFO', [LOGO] : / logos generated, persisting...);

  for (const r of logoResults) {
    if (r.imageUrl && r.imageUrl.startsWith('data:')) {
      try {
        const matches = r.imageUrl.match(/^data:image.(png|jpeg|jpg);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], 'base64');
          const fileName = ${projectId}/logo__.jpeg;
          const { error } = await supabase.storage
            .from('brand-brain-generated')
            .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
          if (!error) {
            const { data } = supabase.storage.from('brand-brain-generated').getPublicUrl(fileName);
            r.imageUrl = data.publicUrl;
            log('INFO', [LOGO] : Persisted logo  -> );
          }
        }
      } catch (e) {
        log('WARN', [LOGO] : Failed to persist logo : );
      }
    }
  }

  // Step 6: Update project status
  try {
    const { data: finalProj } = await supabase.from('projects').select('client_info').eq('id', projectId).single();
    const finalInfo = (finalProj?.client_info || clientInfo);
    const finalBP = finalInfo.brandProfile || brandProfile;

    if (successCount > 0) {
      await supabase.from('projects').update({
        status: 'logo_generated',
        client_info: {
          ...finalInfo,
          generationStatus: 'logo_generated',
          generationMessage: Logo生成完成 (/),
          brandProfile: {
            ...finalBP,
            logoGenerationResults: logoResults.map(r => ({
              index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error,
            })),
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
      log('INFO', [LOGO] : DONE! Status -> logo_generated);
    } else {
      await supabase.from('projects').update({
        status: 'submitted',
        client_info: {
          ...finalInfo,
          generationStatus: 'failed',
          generationMessage: 'Logo生成全部失败，请检查ComfyUI',
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      log('ERROR', [LOGO] : ALL logos failed!);
    }
  } catch (e) {
    log('ERROR', [LOGO] : Final update error: );
  }
}

// ========== VI Manual Generation ==========

async function processManualGeneration(project) {
  const projectId = project.id;
  const clientInfo = (project.client_info || {});
  const brandProfile = clientInfo.brandProfile || {};

  log('INFO', [MANUAL] Processing project:  ());

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
    log('ERROR', [MANUAL] : No selected logo found);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: '未找到选中的Logo' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  log('INFO', [MANUAL] : Downloading selected logo...);
  let logoData;
  try {
    const imgResp = await fetch(selectedLogo.imageUrl);
    if (!imgResp.ok) throw new Error(Failed to download: );
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const mime = imgResp.headers.get('content-type') || 'image/png';
    logoData = data:;base64,;
  } catch (err) {
    log('ERROR', [MANUAL] : Logo download failed: );
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: Logo下载失败:  },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Step 2: Generate 5 scene images via ComfyUI
  log('INFO', [MANUAL] : Generating scene images...);
  const industryType = getIndustryType(clientInfo.industry || 'general');
  const industryDefaults = getIndustryDefaults(industryType);

  const scenePrompts = [
    { key: 'stationery-1', prompt: Professional product photography of branded stationery set (business cards, letterhead, envelopes) with company logo "" printed, arranged on clean desk surface, studio lighting, product fully visible,  industry style },
    { key: 'packaging-1', prompt: Professional product photography of a branded paper bag with company logo "" printed, standing upright on clean surface, studio lighting, product fully visible,  industry style },
    { key: 'packaging-2', prompt: Professional product photography of branded product packaging box with company logo "" printed, clean studio background, product fully visible,  industry style },
    { key: 'marketing-1', prompt: Professional product photography of a promotional poster display with company branding "" visible, studio setting, product fully visible },
    { key: 'marketing-2', prompt: Professional product photography of a branded membership card with company logo "" printed, clean studio background, product fully visible },
  ];

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
    log('WARN', [MANUAL] : ComfyUI not available, will retry later);
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'pending_manual' },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  for (const sp of scenePrompts) {
    try {
      log('INFO', [MANUAL] : Scene ...);
      const result = await comfyuiGenerateScene({
        prompt: sp.prompt,
        negativePrompt: 'blurry, low quality, distorted, watermark, text overlay',
        size: '1024x1024',
      });
      sceneImages[sp.key] = result.imageUrl;
      log('INFO', [MANUAL] : Scene  OK (ms));
    } catch (err) {
      log('WARN', [MANUAL] : Scene  failed: , using placeholder);
      // Continue without this scene
    }
  }

  // Update progress
  await supabase.from('projects').update({
    client_info: {
      ...clientInfo,
      generationStatus: 'manual_generating',
      generationMessage: '正在规划VI手册页面...',
      generationPercent: 40,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  // Step 3: Plan pages via DeepSeek
  log('INFO', [MANUAL] : Planning pages...);
  let blueprints;
  try {
    const brandColors = brandProfile.colorPalette
      ? {
          primary: { hex: brandProfile.colorPalette[0]?.hex || '#333333', name: brandProfile.colorPalette[0]?.name || '主色' },
          secondary: { hex: brandProfile.colorPalette[1]?.hex || '#666666', name: brandProfile.colorPalette[1]?.name || '辅助色' },
          accent: { hex: brandProfile.colorPalette[2]?.hex || '#CC0000', name: brandProfile.colorPalette[2]?.name || '强调色' },
        }
      : { primary: { hex: '#333333', name: '主色' }, secondary: { hex: '#666666', name: '辅助色' }, accent: { hex: '#CC0000', name: '强调色' } };

    blueprints = await planPages({
      clientInfo: {
        companyName: clientInfo.companyName || '',
        brandVision: clientInfo.brandVision || brandProfile.refinedBrandVision || '',
        coreValues: clientInfo.coreValues || brandProfile.refinedCoreValues || '',
        targetMarket: clientInfo.targetMarket || brandProfile.refinedTargetMarket || '',
        logoPhilosophy: clientInfo.logoPhilosophy || '',
        industry: clientInfo.industry || 'general',
        brandPersonality: clientInfo.brandPersonality || '',
        logoStyle: clientInfo.logoStyle || '',
        avoidElements: clientInfo.avoidElements || '',
        competitorReference: clientInfo.competitorReference || '',
        description: clientInfo.description || '',
      },
      brandColors,
    });
    log('INFO', [MANUAL] :  pages planned);
  } catch (err) {
    log('ERROR', [MANUAL] : Page planning failed: );
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: 页面规划失败:  },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Update progress
  await supabase.from('projects').update({
    client_info: {
      ...clientInfo,
      generationStatus: 'manual_generating',
      generationMessage: '正在渲染VI手册PPTX...',
      generationPercent: 70,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  // Step 4: Render PPTX
  log('INFO', [MANUAL] : Rendering PPTX...);
  let pptxBuf;
  try {
    const options = {
      projectName: clientInfo.companyName || 'Brand',
      companyName: clientInfo.companyName || 'Brand',
      industry: clientInfo.industry || 'general',
      logoData,
      aiLogoData: logoData,
      brandColors: {
        primary: brandProfile.colorPalette?.[0]?.hex || '#333333',
        secondary: brandProfile.colorPalette?.[1]?.hex || '#666666',
        accent: brandProfile.colorPalette?.[2]?.hex || '#CC0000',
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
    log('INFO', [MANUAL] : PPTX rendered ( KB));
  } catch (err) {
    log('ERROR', [MANUAL] : PPTX render failed: );
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: PPTX渲染失败:  },
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
    return;
  }

  // Step 5: Upload to Supabase Storage
  log('INFO', [MANUAL] : Uploading PPTX...);
  const fileName = i-manual--.pptx;
  const storagePath = ${projectId}/;
  try {
    const { error: uploadErr } = await supabase.storage
      .from('manuals')
      .upload(storagePath, pptxBuf, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true,
      });
    if (uploadErr) throw new Error(uploadErr.message);

    const storageUrl = https://fzoscrutqhdfzwnjgjvs.supabase.co/storage/v1/object/public/manuals/;

    // Step 6: Update project
    const pptxResult = {
      url: '/api/ai/download-pptx/' + fileName,
      downloadUrl: '/api/ai/download-pptx/' + fileName,
      fileName,
      pageCount: blueprints.length,
      storageUrl,
    };

    // Also update viGenerationHistory for member backend
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

    log('INFO', [MANUAL] : DONE! PPTX uploaded, status -> completed);
  } catch (err) {
    log('ERROR', [MANUAL] : Upload failed: );
    await supabase.from('projects').update({
      client_info: { ...clientInfo, generationStatus: 'failed', generationMessage: 上传失败:  },
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
      log('WARN', [POLL] Logo query error: );
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
      log('WARN', [POLL] Manual query error: );
    } else if (manualProjects && manualProjects.length > 0) {
      for (const project of manualProjects) {
        await processManualGeneration(project);
      }
    }
  } catch (err) {
    log('ERROR', [POLL] Unexpected error: );
  }
}

// ========== Entry Point ==========

async function main() {
  log('INFO', '===== Brand Brain Automation Worker Started =====');
  log('INFO', Poll interval: s);
  log('INFO', Supabase: );
  log('INFO', ComfyUI: http://127.0.0.1:8188);

  // Check ComfyUI on startup
  const comfyAvailable = await isComfyUIAvailable();
  log('INFO', ComfyUI available: );

  // Main loop
  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch(err => {
  log('FATAL', Worker crashed: );
  console.error(err);
  process.exit(1);
});



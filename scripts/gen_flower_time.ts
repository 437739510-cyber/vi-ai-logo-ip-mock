import { planPages } from '../src/lib/vi-manual/page-planner';
import { renderPptxToBuffer } from '../src/lib/pptx/render-pptx';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Load content_patch
  let contentPatch: Record<string, any> = {};
  try {
    const cpPath = path.join(__dirname, 'content_patch_flower.json');
    contentPatch = JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
    console.log('content_patch loaded:', Object.keys(contentPatch).join(', '));
  } catch (e: any) {
    console.log('No content_patch:', e.message);
  }
  console.log('=== Generation Start ===');
  
  const companyName = '花语时光美容院';
  const industry = '丽人:美容SPA';
  
  // Page planner input
  const input = {
    clientInfo: {
      companyName,
      brandVision: '成为中国都市职场女性首选的午间30分钟轻护肤品牌',
      coreValues: '专业、温暖、治愈、高效',
      targetMarket: '忙碌的深圳25-45岁职场女性',
      logoPhilosophy: '玫瑰红+薰衣紫+米金色',
      industry,
    },
    brandColors: {
      primary: { hex: '#E8576C', name: '玫瑰红' },
      secondary: { hex: '#9B72CF', name: '薰衣紫' },
      accent: { hex: '#F0D5A8', name: '米金色' },
    },
    assetAnalysis: {
      logo: { hasLogo: false, meaning: '玫瑰红+薰衣紫+米金色' },
      mascot: { hasMascot: false },
    },
  };

  console.log('Step 1: planPages...');
  let blueprints;
  try {
    blueprints = await planPages(input as any);
    console.log('  -> ' + blueprints.length + ' pages');
  } catch (err: any) {
    console.error('FAIL:', err.message);
    throw err;
  }

  const brandStory = '花语时光美容院扎根深圳，以“专业、温暖、治愈、高效”为核心价值，致力于为忙碌的深圳职场女性提供午间30分钟轻护肤体验。';

  const renderOpts = {
    projectName: 'VI-20260625-OCEM',
    companyName,
    industry,
    brandColors: { primary: '#E8576C', secondary: '#9B72CF', accent: '#F0D5A8' },
    brandVision: '成为中国都市职场女性首选的午间30分钟轻护肤品牌',
    coreValues: '专业、温暖、治愈、高效',
    targetMarket: '忙碌的深圳25-45岁职场女性',
    logoPhilosophy: '玫瑰红+薰衣紫+米金色',
    sceneImages: {},
    sceneLabels: {},
    compressImages: true,
    brandStory: brandStory,
    auxGraphicsIntro: '花语时光美容院的辅助图形源自品牌核心视觉元素，以柔美的花瓣曲线和渐变线条为主。',
    colorMeaning: '玫瑰红象征着热情与关爱，薰衣紫传递宁静与专业，米金色带来温暖与亲近感。',
    // V114: content_patch fields
    fontCopyrightNotice: contentPatch.fontCopyrightNotice,
    logoOutputSpec: contentPatch.logoOutputSpec,
    modificationAuthority: contentPatch.modificationAuthority,
    materialPriorityList: contentPatch.materialPriorityList,
    closingCustomerPerception: contentPatch.closingCustomerPerception,
    fullBrandName: contentPatch.fullBrandName,
    englishName: contentPatch.englishName,
  };

  console.log('Step 2: renderPptxToBuffer...');
  let buffer;
  try {
    buffer = await renderPptxToBuffer(blueprints, renderOpts as any);
    console.log('  -> ' + buffer.length + ' bytes');
  } catch (err: any) {
    console.error('FAIL:', err.message);
    throw err;
  }

  const outputDir = path.join(process.cwd(), 'public', 'generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = Date.now();
  const fileName = 'vi-manual-' + timestamp + '.pptx';
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(outputPath, buffer);
  console.log('OK: ' + outputPath);
  console.log('Size: ' + (buffer.length / 1024).toFixed(1) + ' KB');
  
  // Also to HermesDisk
  const hp = 'D:\\disk\\HermesDisk\\花语时光美容院-VI手册-v112.pptx';
  fs.writeFileSync(hp, buffer);
  console.log('Also: ' + hp);
}

main().catch(err => { console.error('FAILED:', err); process.exit(1); });




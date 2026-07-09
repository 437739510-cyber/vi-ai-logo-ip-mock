import { renderPptxToBuffer } from '../src/lib/pptx/render-pptx';
import { planPages } from '../src/lib/vi-manual/page-planner';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const OUT = 'D:/disk/CODEX/vi手册logo';
const PROJECT_ID = 'VI-20260630-CKJ0';

const supabase = createClient(
  'https://fzoscrutqhdfzwnjgjvs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3NjcnV0cWhkZnp3bmpnanZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2MDg2NywiZXhwIjoyMDk1NDM2ODY3fQ.RvZsEYr12HRKsyQQWl2etjpN0yf20hKjbL-wsNpfHno'
);

console.log('Loading assets...');

const logoBuf = await fs.readFile(path.join(OUT, 'zhaocai_burger_03_00001_.png'));
const logoData = 'data:image/png;base64,' + logoBuf.toString('base64');
console.log('[OK] Logo loaded');

const sceneDefs = {
  storefront: '门店招牌应用',
  packaging: '包装系统应用',  
  tray: '托盘餐垫应用',
  poster: '宣传海报应用',
  card: '会员卡应用',
};
const sceneImages = {};
for (const [key, label] of Object.entries(sceneDefs)) {
  const fp = path.join(OUT, 'zhaocai_scene2_' + key + '_00001_.png');
  const buf = await fs.readFile(fp);
  sceneImages[key] = 'image/png;base64,' + buf.toString('base64');
  console.log('[OK] Scene: ' + key);
}

console.log('Planning pages via DeepSeek...');
const blueprints = await planPages({
  clientInfo: {
    companyName: '招财进堡',
    brandVision: '打造南昌最有活力的汉堡炸鸡品牌，成为年轻人心中的美食记忆',
    coreValues: '新鲜、活力、真诚、进取',
    targetMarket: '16-28岁高中生和大学生，追求性价比和年轻化体验',
    logoPhilosophy: '招财进堡标志以美式复古风格呈现，采用红金配色，融合汉堡与皇冠元素，传达经典、活力与品质感',
    industry: 'fastfood',
  },
  brandColors: {
    primary: { hex: '#E63946', name: '招财红' },
    secondary: { hex: '#F4A261', name: '活力橙' },
    accent: { hex: '#FFD700', name: '招财金' },
  },
});
console.log('Blueprints: ' + blueprints.length + ' pages');

const options = {
  projectName: '招财进堡',
  companyName: '招财进堡',
  industry: 'fastfood',
  logoData,
  aiLogoData: logoData,
  brandColors: { primary: '#E63946', secondary: '#F4A261', accent: '#FFD700' },
  brandVision: '打造南昌最有活力的汉堡炸鸡品牌，成为年轻人心中的美食记忆',
  coreValues: '新鲜、活力、真诚、进取',
  targetMarket: '16-28岁高中生和大学生，追求性价比和年轻化体验',
  logoPhilosophy: '招财进堡标志以美式复古风格呈现，采用红金配色，融合汉堡与皇冠元素，传达经典、活力与品质感',
  sceneImages,
  sceneLabels: {
    storefront: '门店招牌应用',
    packaging: '包装系统应用',
    tray: '托盘餐垫应用',
    poster: '宣传海报应用',
    card: '会员卡应用',
  },
  sceneSectionTitles: {
    storefront: '快餐门店应用',
    packaging: '快餐包装系统',
    tray: '快餐包装系统',
    poster: '快餐营销系统',
    card: '快餐营销系统',
  },
  auxGraphicsIntro: '品牌辅助图形提取自标志中的火焰和皇冠元素，通过重复、旋转、渐变等方式形成品牌独特的视觉纹理，应用于包装、店面、社交媒体等多种场景。',
  colorMeaning: '招财红代表热情与活力，活力橙传递温暖与亲和，招财金点缀高端质感。',
  colorPaletteMeanings: {
    primary: '招财红 -- 品牌核心识别色，象征热情与活力',
    secondary: '活力橙 -- 温暖过渡色，传递温暖与亲和感',
    accent: '招财金 -- 高端点缀色，彰显品质与信任',
  },
  compressImages: false,
  brandStory: '南昌开了十年的汉堡炸鸡店，主要服务附近高中和大学学生。从一家小店开始，始终坚持现点现做，用新鲜食材和真诚服务赢得了一代又一代学生的喜爱。招财进堡不只是一家快餐店，更是无数年轻人青春记忆中的味道。',
  fullBrandName: '招财进堡',
  englishName: 'ZHAOCAI JINBAO',
};

console.log('Rendering PPTX...');
const buf = await renderPptxToBuffer(blueprints, options);
const fileName = '招财进堡-VI手册-bb-v2.pptx';
const outPath = path.join(OUT, fileName);
await fs.writeFile(outPath, buf);
console.log('DONE: ' + outPath + ' (' + (buf.length / 1024).toFixed(0) + ' KB)');

// Upload to Supabase
const storagePath = PROJECT_ID + '/' + fileName;
await supabase.storage.from('manuals').upload(storagePath, buf, { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', upsert: true });
const storageUrl = 'https://fzoscrutqhdfzwnjgjvs.supabase.co/storage/v1/object/public/manuals/' + storagePath;
console.log('Upload OK: ' + storageUrl);

const pptxResult = {
  url: '/api/ai/download-pptx/' + fileName,
  fileName: fileName,
  pageCount: blueprints.length,
  storageUrl: storageUrl,
};

const { data: proj } = await supabase.from('projects').select('client_info').eq('id', PROJECT_ID).single();
const ci = proj.client_info || {};
ci.pptxResult = pptxResult;
ci.generationStatus = 'completed';
ci.generationPercent = 100;
ci.generationMessage = '生成完成!';

await supabase.from('projects').update({ client_info: ci, status: 'completed' }).eq('id', PROJECT_ID);
console.log('Project updated to completed!');

import { renderPptxToBuffer } from '../src/lib/pptx/render-pptx';
import { planPages } from '../src/lib/vi-manual/page-planner';
import { promises as fs } from 'fs';
import path from 'path';

const OUT = 'D:/disk/CODEX/vi手册logo';

// Load logo
const logoBuf = await fs.readFile(path.join(OUT, 'zhaocai_burger_03_00001_.png'));
const logoData = 'data:image/png;base64,' + logoBuf.toString('base64');
console.log('  [OK] Loaded logo: zhaocai_burger_03_00001_.png');

// Load scene images
const sceneKeys = ['storefront', 'packaging', 'tray', 'poster', 'card'];
const sceneImages = {};
const sceneLabels = {
  storefront: '门店形象应用',
  packaging: '包装系统应用',
  tray: '产品展示应用',
  poster: '宣传海报应用',
  card: '会员卡应用',
};

for (const key of sceneKeys) {
  const fp = path.join(OUT, 'zhaocai_scene2_' + key + '_00001_.png');
  try {
    const buf = await fs.readFile(fp);
    sceneImages[key] = 'image/png;base64,' + buf.toString('base64');
    console.log('  [OK] Loaded scene: ' + key);
  } catch (e) {
    console.log('  [MISS] Scene: ' + key);
  }
}

// Generate page blueprints via page planner
const blueprints = await planPages({
  clientInfo: {
    companyName: '招财进堡',
    brandVision: '让每一口汉堡都成为年轻人的好运加持',
    coreValues: '潮流活力、好运体验、品质快餐、社交乐趣、创新玩法',
    targetMarket: '18-35岁追求潮流、热衷社交、喜欢尝鲜的Z世代及年轻白领',
    logoPhilosophy: '招财进堡标识以汉堡与筷子为核心元素，采用椭圆徽章构图，传达品牌融合中西饮食文化的独特定位。',
    industry: 'food',
  },
  brandColors: {
    primary: { hex: '#E63946', name: '招财红' },
    secondary: { hex: '#F4A261', name: '活力橙' },
    accent: { hex: '#FFD700', name: '幸运金' },
  },
});

console.log('  Blueprints: ' + blueprints.length + ' pages');

const options = {
  projectName: '招财进堡',
  companyName: '招财进堡',
  industry: 'food',
  logoData,
  aiLogoData: logoData,
  brandColors: { primary: '#E63946', secondary: '#F4A261', accent: '#FFD700' },
  brandVision: '让每一口汉堡都成为年轻人的好运加持',
  coreValues: '潮流活力、好运体验、品质快餐、社交乐趣、创新玩法',
  targetMarket: '18-35岁追求潮流、热衷社交、喜欢尝鲜的Z世代及年轻白领',
  logoPhilosophy: '招财进堡标识以汉堡与筷子为核心元素，采用椭圆徽章构图，传达品牌融合中西饮食文化的独特定位。汉堡层叠饱满，寓意产品丰富有料。',
  sceneImages,
  sceneLabels,
  sceneSectionTitles: {
    storefront: '门店形象',
    packaging: '外卖包装',
    tray: '产品出品',
    poster: '宣传物料',
    card: '会员体系',
  },
  auxGraphicsIntro: '品牌辅助图形提取自汉堡层叠结构与筷子环绕动态，通过重复、旋转、渐变形成独特的视觉纹理，应用于包装、门店、社媒等多种场景。',
  colorMeaning: '招财红代表品牌热情与活力，活力橙传递年轻朝气，幸运金点缀品质感与好运寓意。',
  colorPaletteMeanings: {
    primary: '招财红 — 品牌核心识别色，象征热情与好运',
    secondary: '活力橙 — 辅助过渡色，传递年轻朝气',
    accent: '幸运金 — 高端点缀色，彰显品质与吉祥寓意',
  },
  fontCopyrightNotice: '品牌字体使用授权已获许可，禁止未经授权商用',
  logoOutputSpec: 'Logo源文件提供AI/EPS/SVG/PNG四种格式',
  modificationAuthority: '品牌方拥有VI手册最终解释权，任何修改需经品牌方书面授权',
  closingCustomerPerception: '好运加持，每一口都是幸运的味道',
  fullBrandName: '招财进堡',
  englishName: 'ZHAOCAI JINBAO',
};

const buf = await renderPptxToBuffer(options, blueprints);
const pptxPath = path.join(OUT, '招财进堡-VI手册-22页.pptx');
await fs.writeFile(pptxPath, buf);
console.log('PPTX saved: ' + pptxPath);
console.log('Pages: ' + blueprints.length);

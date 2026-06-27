/**
 * V108: 规范页图片化渲染器
 * 
 * 将"字体系统"和"色彩规范"等规范页用satori+sharp渲染为PNG图片
 * 插入PPTX中，解决设备未安装思源字体时黑体宋体看起来一样的问题
 * 
 * 原理：
 * 1. satori (纯JS) 将JSX布局渲染为SVG，内嵌字体
 * 2. sharp 将SVG转换为PNG
 * 3. PNG作为图片插入PPTX，字体100%锁定
 */

import satori from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

// 页面尺寸 (英寸 → 像素，PPTX标准10x7.5英寸，用600x450渲染足够清晰)
const PAGE_W = 1200;
const PAGE_H = 1697;  // A4 portrait: 8.27:11.69 ratio

// 字体缓存
let fontsCache: any = null;

function loadFonts() {
  if (fontsCache) return fontsCache as any;
  const fontsDir = join(process.cwd(), 'public', 'fonts');
  fontsCache = [
    { name: 'Noto Sans SC', data: readFileSync(join(fontsDir, 'NotoSansSC-Regular-sub.otf')).buffer as ArrayBuffer, weight: 400 as const, style: 'normal' },
    { name: 'Noto Sans SC', data: readFileSync(join(fontsDir, 'NotoSansSC-Bold-sub.otf')).buffer as ArrayBuffer, weight: 700 as const, style: 'normal' },
    { name: 'Noto Serif SC', data: readFileSync(join(fontsDir, 'NotoSerifSC-Regular-sub.otf')).buffer as ArrayBuffer, weight: 400 as const, style: 'normal' },
    { name: 'Noto Serif SC', data: readFileSync(join(fontsDir, 'NotoSerifSC-Bold-sub.otf')).buffer as ArrayBuffer, weight: 700 as const, style: 'normal' },
  ];
  return fontsCache;
}

interface BrandColors {
  pri: string;
  sec: string;
  acc: string;
  priDark: string;
}

interface SpecPageOptions {
  bc: BrandColors;
  colorMeaning?: string;
  companyName?: string;
}

/** 渲染字体系统页为PNG base64 */
export async function renderTypographyPng(opts: SpecPageOptions): Promise<string> {
  const fonts = loadFonts();
  const { bc } = opts;

  const jsx = {
    type: 'div',
    props: {
      style: { width: PAGE_W, height: PAGE_H, backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', padding: '40px 60px' },
      children: [
        // 标题
        { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }, children: [
          { type: 'div', props: { style: { fontSize: 44, fontWeight: 700, color: `#${bc.pri}`, fontFamily: 'Noto Sans SC' }, children: '字体系统' } },
        ]}},
        // 装饰线
        { type: 'div', props: { style: { width: '100%', height: 4, backgroundColor: '#F5E6D0', borderRadius: 2, marginBottom: 30 } } },
        // 中文字体区
        { type: 'div', props: { style: { display: 'flex', marginBottom: 30 }, children: [
          // 左侧色条
          { type: 'div', props: { style: { width: 8, height: 120, backgroundColor: `#${bc.pri}`, borderRadius: 4, marginRight: 20, flexShrink: 0 } } },
          // 右侧内容
          { type: 'div', props: { style: { display: 'flex', flexDirection: 'column' }, children: [
            { type: 'div', props: { style: { fontSize: 30, fontWeight: 700, color: `#${bc.pri}`, fontFamily: 'Noto Sans SC', marginBottom: 12 }, children: '中文字体' } },
            { type: 'div', props: { style: { fontSize: 24, color: '#444444', fontFamily: 'Noto Sans SC', marginBottom: 6 }, children: '标题字体：思源黑体 / Noto Sans SC' } },
            { type: 'div', props: { style: { fontSize: 24, color: '#444444', fontFamily: 'Noto Serif SC' }, children: '正文字体：思源宋体 / Noto Serif SC' } },
          ]}},
        ]}},
        // 英文字体区
        { type: 'div', props: { style: { display: 'flex', marginBottom: 30 }, children: [
          { type: 'div', props: { style: { width: 8, height: 120, backgroundColor: `#${bc.sec}`, borderRadius: 4, marginRight: 20, flexShrink: 0 } } },
          { type: 'div', props: { style: { display: 'flex', flexDirection: 'column' }, children: [
            { type: 'div', props: { style: { fontSize: 30, fontWeight: 700, color: `#${bc.sec}`, fontFamily: 'Noto Sans SC', marginBottom: 12 }, children: '英文字体' } },
            { type: 'div', props: { style: { fontSize: 24, color: '#444444', fontFamily: 'Noto Sans SC', marginBottom: 6 }, children: 'Brand Font: Montserrat' } },
            { type: 'div', props: { style: { fontSize: 24, color: '#444444', fontFamily: 'Noto Sans SC' }, children: 'Body Font: Open Sans' } },
          ]}},
        ]}},
        // 字号层级
        { type: 'div', props: { style: { fontSize: 30, fontWeight: 700, color: `#${bc.pri}`, fontFamily: 'Noto Sans SC', marginBottom: 12 }, children: '字号层级规范' } },
        // 表格
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', border: '1px solid #E0E0E0', borderRadius: 4, overflow: 'hidden' }, children: [
          // 表头
          { type: 'div', props: { style: { display: 'flex', backgroundColor: `#${bc.pri}`, color: '#FFFFFF', fontSize: 24, fontWeight: 700, fontFamily: 'Noto Sans SC' }, children: [
            { type: 'div', props: { style: { width: 200, padding: '8px 12px' }, children: '层级' } },
            { type: 'div', props: { style: { width: 200, padding: '8px 12px' }, children: '字号' } },
            { type: 'div', props: { style: { width: 360, padding: '8px 12px' }, children: '应用场景' } },
          ]}},
          // 数据行
          ...([
            ['一级标题', '36-40pt', '封面标题'],
            ['二级标题', '22-26pt', '章节标题'],
            ['三级标题', '18pt', '小标题/栏目'],
            ['正文', '14pt', '正文说明'],
            ['辅助文字', '12pt', '注释/标注/页码'],
          ] as const).map(([level, size, usage], i) => ({
            type: 'div',
            props: {
              style: { display: 'flex', backgroundColor: i % 2 === 0 ? '#FAFAFA' : '#FFFFFF', fontSize: 13, color: '#333333', fontFamily: 'Noto Sans SC' },
              children: [
                { type: 'div', props: { style: { width: 200, padding: '8px 12px' }, children: level } },
                { type: 'div', props: { style: { width: 200, padding: '8px 12px' }, children: size } },
                { type: 'div', props: { style: { width: 360, padding: '8px 12px' }, children: usage } },
              ]
            }
          })),
        ]}},
      ]
    }
  };

  const svg = await satori(jsx as any, { width: PAGE_W, height: PAGE_H, fonts });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** 渲染色彩规范页为PNG base64 */
export async function renderColorSpecPng(opts: SpecPageOptions): Promise<string> {
  const fonts = loadFonts();
  const { bc, colorMeaning } = opts;

  const colors = [
    { hex: bc.pri, label: '品牌主色', name: 'Primary' },
    { hex: bc.sec, label: '辅助色', name: 'Secondary' },
    { hex: bc.acc, label: '强调色', name: 'Accent' },
  ];

  // hex转RGB
  function hex2rgb(hex: string) {
    const h = hex.replace('#', '');
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  }
  // RGB转CMYK
  function rgb2cmyk(r: number, g: number, b: number) {
    const k = 1 - Math.max(r,g,b)/255;
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round(((1-r/255)-k)/(1-k)*100),
      m: Math.round(((1-g/255)-k)/(1-k)*100),
      y: Math.round(((1-b/255)-k)/(1-k)*100),
      k: Math.round(k*100)
    };
  }
  function isLight(hex: string) {
    const {r,g,b} = hex2rgb(hex);
    return (r*299+g*587+b*114)/1000 > 150;
  }

        const jsx = {
    type: 'div',
    props: {
      style: { width: PAGE_W, height: PAGE_H, backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', padding: '40px 50px' },
      children: [
        { type: 'div', props: { style: { fontSize: 54, fontWeight: 700, color: `#${bc.pri}`, fontFamily: 'Noto Sans SC', marginBottom: 6 }, children: '品牌色板' } },
        { type: 'div', props: { style: { width: 60, height: 3, backgroundColor: '#E0E0E0', borderRadius: 2, marginBottom: 20 } } },
        // 三色卡
        { type: 'div', props: { style: { display: 'flex', gap: 20, marginBottom: 12 }, children: [
          { type: 'div', props: { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, padding: '20px 16px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }, children: [
            { type: 'div', props: { style: { width: '100%', height: 160, borderRadius: 8, backgroundColor: `#${bc.pri}`, marginBottom: 10 } } },
            { type: 'div', props: { style: { fontSize: 34, fontWeight: 700, color: '#222222', fontFamily: 'Noto Sans SC' }, children: '品牌主色' } },
            { type: 'div', props: { style: { fontSize: 28, color: `#${bc.pri}`, fontFamily: 'Noto Sans SC', marginTop: 2, fontWeight: 600 }, children: `HEX: #${bc.pri}` } },
            { type: 'div', props: { style: { fontSize: 24, color: '#666666', fontFamily: 'Noto Sans SC', marginTop: 1 }, children: (() => { const rgb = hex2rgb(`#${bc.pri}`); return `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`; })() } },
            { type: 'div', props: { style: { fontSize: 22, color: '#888888', fontFamily: 'Noto Sans SC', marginTop: 1 }, children: (() => { const rgb = hex2rgb(`#${bc.pri}`); const cmyk = rgb2cmyk(rgb.r, rgb.g, rgb.b); return `CMYK: ${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`; })() } },
          ]}},
          { type: 'div', props: { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, padding: '20px 16px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }, children: [
            { type: 'div', props: { style: { width: '100%', height: 160, borderRadius: 8, backgroundColor: `#${bc.sec}`, marginBottom: 10 } } },
            { type: 'div', props: { style: { fontSize: 34, fontWeight: 700, color: '#222222', fontFamily: 'Noto Sans SC' }, children: '辅助色' } },
            { type: 'div', props: { style: { fontSize: 28, color: `#${bc.sec}`, fontFamily: 'Noto Sans SC', marginTop: 2, fontWeight: 600 }, children: `HEX: #${bc.sec}` } },
            { type: 'div', props: { style: { fontSize: 24, color: '#666666', fontFamily: 'Noto Sans SC', marginTop: 1 }, children: (() => { const rgb = hex2rgb(`#${bc.sec}`); return `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`; })() } },
            { type: 'div', props: { style: { fontSize: 22, color: '#888888', fontFamily: 'Noto Sans SC', marginTop: 1 }, children: (() => { const rgb = hex2rgb(`#${bc.sec}`); const cmyk = rgb2cmyk(rgb.r, rgb.g, rgb.b); return `CMYK: ${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`; })() } },
          ]}},
          { type: 'div', props: { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, padding: '20px 16px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }, children: [
            { type: 'div', props: { style: { width: '100%', height: 160, borderRadius: 8, backgroundColor: `#${bc.acc}`, marginBottom: 10 } } },
            { type: 'div', props: { style: { fontSize: 34, fontWeight: 700, color: '#222222', fontFamily: 'Noto Sans SC' }, children: '强调色' } },
            { type: 'div', props: { style: { fontSize: 28, color: `#${bc.acc}`, fontFamily: 'Noto Sans SC', marginTop: 2, fontWeight: 600 }, children: `HEX: #${bc.acc}` } },
            { type: 'div', props: { style: { fontSize: 24, color: '#666666', fontFamily: 'Noto Sans SC', marginTop: 1 }, children: (() => { const rgb = hex2rgb(`#${bc.acc}`); return `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`; })() } },
            { type: 'div', props: { style: { fontSize: 22, color: '#888888', fontFamily: 'Noto Sans SC', marginTop: 1 }, children: (() => { const rgb = hex2rgb(`#${bc.acc}`); const cmyk = rgb2cmyk(rgb.r, rgb.g, rgb.b); return `CMYK: ${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`; })() } },
          ]}},
        ]}},
        // 三色说明框（与色卡一一对应）
        { type: 'div', props: { style: { display: 'flex', gap: 20, marginBottom: 12 }, children: [
          { type: 'div', props: { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA', borderRadius: 6, padding: '10px 12px', minHeight: 50 }, children: [
            { type: 'div', props: { style: { fontSize: 34, color: '#444444', fontFamily: 'Noto Sans SC', lineHeight: 1.4, textAlign: 'center' }, children: `品牌主色#${bc.pri}传递品牌核心调性，` } },
          ]}},
          { type: 'div', props: { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA', borderRadius: 6, padding: '10px 12px', minHeight: 50 }, children: [
            { type: 'div', props: { style: { fontSize: 34, color: '#444444', fontFamily: 'Noto Sans SC', lineHeight: 1.4, textAlign: 'center' }, children: `辅助色#${bc.sec}营造层次与和谐，` } },
          ]}},
          { type: 'div', props: { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA', borderRadius: 6, padding: '10px 12px', minHeight: 50 }, children: [
            { type: 'div', props: { style: { fontSize: 34, color: '#444444', fontFamily: 'Noto Sans SC', lineHeight: 1.4, textAlign: 'center' }, children: `强调色#${bc.acc}用于关键信息突出与视觉焦点引导。` } },
          ]}},
        ]}},
        // 底部总说明（三栏宽，居中，20mm高≈57px）
        { type: 'div', props: { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', borderRadius: 6, padding: '12px 20px', minHeight: 100, width: '100%' }, children: [
          { type: 'div', props: { style: { fontSize: 34, color: '#555555', fontFamily: 'Noto Sans SC', lineHeight: 1.4, textAlign: 'center' }, children: '三色组合确保品牌视觉的专业性、一致性与识别度。' } },
        ]}},
      ]
    }
  };
const svg = await satori(jsx as any, { width: PAGE_W, height: PAGE_H, fonts });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

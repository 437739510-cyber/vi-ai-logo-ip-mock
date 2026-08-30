// 在线冒烟：Phase A 行业注入后，真实 DeepSeek 输出是否行业适配 + 是否泛化(不写死)。
// 只打印分析字段(色板/风格/场景/理念)，绝不打印任何 key/token。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载 .env.local（仅注入 process.env，不打印任何值）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('!! DEEPSEEK_API_KEY 未从 .env.local 加载');
  process.exit(2);
}

interface Fixture { label: string; clientInfo: any; }
const fixtures: Fixture[] = [
  {
    label: 'A 椰岛工坊(椰子水/beverage)',
    clientInfo: { companyName: '椰岛工坊', industry: 'beverage', mainProducts: '椰子水', targetMarket: '健身人群+高端酒店', brandVision: '', coreValues: '', logoTextLanguage: 'chinese' },
  },
  {
    label: 'B 健身房(fitness)',
    clientInfo: { companyName: '铁人健身', industry: 'fitness', mainProducts: '健身私教/团课', targetMarket: '都市白领健身人群', brandVision: '', coreValues: '', logoTextLanguage: 'chinese' },
  },
];

async function main() {
  const { buildAnalysisPrompt, BRAND_ANALYSIS_SYSTEM, parseDeepSeekJSON } = await import('./worker.mjs');
  const { guardedDeepSeekCall } = await import('../src/lib/core/billing/deepseek-guard');
  const { getIndustryDefaults } = await import('../src/lib/brand/industry-types');

  for (const { label, clientInfo } of fixtures) {
    console.log('\n================ ' + label + ' ================');
    const user = buildAnalysisPrompt(clientInfo);
    const system = BRAND_ANALYSIS_SYSTEM;
    const def = getIndustryDefaults(clientInfo.industry);
    console.log(`行业锚定色板(INDUSTRY_DEFAULTS): primary=${def.primary} secondary=${def.secondary} accent=${def.accent} sceneStyle=${def.sceneStyle}`);
    console.log(`${label} 是否注入行业知识层: ${user.includes('行业锚定色板') ? 'YES' : 'NO'}`);

    try {
      const resp = await guardedDeepSeekCall({
        route: 'worker-brand-analysis', projectId: 'smoke-phaseA', requestSummary: 'PhaseA online smoke',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        body: { model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.5, max_tokens: 8192 },
        timeoutMs: 120000,
      });
      if (!resp.ok) { console.error('API error', resp.status, await resp.text()); continue; }
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';
      let parsed: any = null;
      try { parsed = parseDeepSeekJSON(content); } catch (e) { console.error('JSON parse fail:', String(e)); console.error('RAW[截断]:', content.slice(0, 400)); continue; }

      console.log('--- colorPalette (name/hex/meaning) ---');
      for (const c of parsed.colorPalette || []) console.log(`  ${c.name} ${c.hex} | ${c.meaning}`);
      console.log('--- visualStyleSuggestion ---');
      console.log('  ' + (parsed.visualStyleSuggestion || ''));
      console.log('--- brandPositioning ---');
      console.log('  ' + (parsed.brandPositioning || ''));
      console.log('--- sceneImageSuggestions[0].zh ---');
      console.log('  ' + (parsed.sceneImageSuggestions?.[0]?.zh || '(none)'));
      console.log('--- logoDesignSuggestions.concept ---');
      console.log('  ' + (parsed.logoDesignSuggestions?.concept || '(none)'));
    } catch (e) {
      console.error('callDeepSeek error:', String(e));
    }
  }
  console.log('\n=== SMOKE DONE ===');
}

main().catch((e) => { console.error('SMOKE ERROR:', e); process.exit(1); });

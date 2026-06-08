const fs = require('fs');
const p = 'C:/Users/Administrator/Documents/Codex/vi-ai-logo-ip-mock/src/app/admin/manual-pages/[projectId]/page.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('"品牌色, hex:', '"品牌色", hex:');
c = c.replace('"辅助色, hex:', '"辅助色", hex:');
c = c.replace('"强调色, hex:', '"强调色", hex:');
fs.writeFileSync(p, c, 'utf8');
console.log('Fixed quotes');

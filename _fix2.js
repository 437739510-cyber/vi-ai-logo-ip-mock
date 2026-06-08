const fs = require('fs');
const p1 = 'C:/Users/Administrator/Documents/Codex/vi-ai-logo-ip-mock/src/app/admin/manual-pages/[projectId]/page.tsx';
const p2 = 'C:/Users/Administrator/Documents/Codex/vi-ai-logo-ip-mock/src/app/api/ai/generate-manual-pages-stream/route.ts';

// Fix 1: page.tsx - missing closing quote
let c1 = fs.readFileSync(p1, 'utf8');
c1 = c1.replace('"未指定 }', '"未指定" }');
fs.writeFileSync(p1, c1, 'utf8');
console.log('Fixed page.tsx');

// Fix 2: stream route - remove redundant lines
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace(/\n  \/\/ Accept asset URLs from the request\n  let logoUrl = \(req as any\)\.logoUrl \|\| null;\n  let mascotUrl = \(req as any\)\.mascotUrl \|\| null;/, '');
fs.writeFileSync(p2, c2, 'utf8');
console.log('Fixed stream route');

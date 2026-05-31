const fs = require('fs');
const path = 'C:\\Users\\Administrator\\Documents\\Codex\\vi-ai-logo-ip-mock\\src\\app\\admin\\manual-pages\\[projectId]\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix garbled Chinese text + missing closing quote
// Replace the broken industry string with correct Chinese text
const target = 'industry: "鏈寚瀹? }';
const replacement = 'industry: "\u672a\u6307\u5b9a" }';
content = content.replace(target, replacement);

fs.writeFileSync(path, content, 'utf8');
console.log('Done');

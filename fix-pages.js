const fs = require('fs');
const path = require('path');

const file = path.join('src', 'app', 'admin', 'projects', '[id]', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace "11 页图片" with "页面图片"
content = content.replace(/11 \u9875\u56FE\u7247/g, '\u9875\u9762\u56FE\u7247');

fs.writeFileSync(file, content, 'utf8');
console.log('Done: replaced page count text');

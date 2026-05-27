const fs = require('fs');
const path = 'C:/Users/Administrator/Documents/Codex/vi-ai-logo-ip-mock/src/app/admin/manual-pages/[projectId]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const fixes = {
  '\u93dd\u2665\u6bbc\u74dd\u884c\u4ef6': '\u54c1\u724c\u540d\u79f0',
  '\u93c8\u2665\u6bac\u6307\u5b9a': '\u672a\u6307\u5b9a',
  '\u93dd\u2665\u6bbc\u8272': '\u54c1\u724c\u8272',
  '\u8f85\u52a9\u8272': '\u8f85\u52a9\u8272',
  '\u5f3a\u8c03\u8272': '\u5f3a\u8c03\u8272',
  '\u8fd4\u56de\u9879\u76ee': '\u8fd4\u56de\u9879\u76ee',
  'VI \u624b\u518c\u9875\u9762': 'VI \u624b\u518c\u9875\u9762',
};

// Actually, let's just replace by known garbled sequences
const garbledMap = {
  '杩斿洖椤圭洰': '返回项目',
  'VI 鎵嬪唽椤甸潰': 'VI 手册页面',
  '姝ｅ湪鐢熸垚': '正在生成',
  '宸茬敓鎴?': '已生成',
  '澶辫触': '失败',
  '灏氭湭鐢熸垚': '尚未生成',
  '鐐瑰嚮': '点击',
  '鎸夐挳': '按钮',
  '寮€濮?': '开始',
  '閲嶆柊鐢熸垚': '重新生成',
  '鍏ㄩ儴椤甸潰': '全部页面',
  '鐢熸垚涓?': '生成中',
  'AI 姝ｅ湪': 'AI 正在',
  '閫愰〉': '逐页',
  '鏃犻渶': '无需',
  '绛夊緟': '等待',
  '椤圭洰锛?': '项目：',
  '灏嗙縼': '将调',
  '鐢ㄩ€氫箟涓囩浉': '用通义万相',
  '瀹屾暣鐨?VI 鎵嬪唽鍥剧墖': '完整的 VI 手册图片',
  '鍝佺墝鍚嶇О': '品牌名称',
  '鏈寚瀹?': '未指定',
  '鍝佺墝鑹?': '品牌色',
  '杈呭姪鑹?': '辅助色',
  '寮鸿皟鑹?': '强调色',
};

for (const [garbled, correct] of Object.entries(garbledMap)) {
  content = content.replaceAll(garbled, correct);
}

// Fix remaining known issues
content = content.replace(/鍝佺墝鍚嶇О/g, '品牌名称');
content = content.replace(/鏈寚瀹?/g, '未指定');
content = content.replace(/鍝佺墝鑹?/g, '品牌色');
content = content.replace(/杈呭姪鑹?/g, '辅助色');
content = content.replace(/寮鸿皟鑹?/g, '强调色');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed encoding issues in page.tsx');

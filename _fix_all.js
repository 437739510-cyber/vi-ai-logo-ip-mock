const fs = require('fs');
const path = 'C:/Users/Administrator/Documents/Codex/vi-ai-logo-ip-mock/src/app/admin/manual-pages/[projectId]/page.tsx';
let c = fs.readFileSync(path, 'utf8');
// Fix all remaining garbled text
const allFixes = {
  '椤圭洰锛?': '项目：',
  '椤?': '页',
  '锛?': '，',
  '锛氾紵': '：',
  '锛氾?': '：',
  '锛氾紝': '：',
  '鍑讳笅': '击下',
  '鏂规寜閽?': '方按钮',
  '寮€濮?': '开始',
  '宸茬敓鎴?': '已生成',
  '澶辫触': '失败',
  '鏈?': '有',
  '椤电敓': '页生',
  '鎴愬け': '成失',
  '璐ワ細': '败：',
  '鐐瑰嚮': '点击',
  '涓婃柟': '上方',
  '鎸夐挳': '按钮',
  '灏嗚皟': '将调',
  '鐢ㄩ€氫箟': '用通义',
  '涓囩浉': '万相',
  '閫愰〉': '逐页',
  '鐢熸垚': '生成',
  '瀹屾暣': '完整',
  '鐨?VI': '的 VI',
  '鎵嬪唽': '手册',
  '鍥剧墖': '图片',
  '鍏?11': '共 11',
  '椤碉紝': '页，',
  '鐢熸垚涓€': '生成一',
  '鏃犻渶': '无需',
  '绛夊緟': '等待',
  '鍏ㄩ儴': '全部',
  '瀹屾垚': '完成',
  '鏄剧ず': '显示',
  '涓€椤?': '一页',
  '潐?': '页',
  '潐?璇峰埌': '页。请到',
  '鍚庣?': '后台',
  '鏌ョ湅': '查看',
};
for (const [k, v] of Object.entries(allFixes)) {
  c = c.replaceAll(k, v);
}
fs.writeFileSync(path, c, 'utf8');
console.log('Fixed all remaining garbled text');

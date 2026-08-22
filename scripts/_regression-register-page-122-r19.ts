// TICKET-122-R19 注册页失败路径本地验证（不连生产库）。
// 源码级断言：mock 失败响应时页面应展示错误而非成功；
// 对应删除 src/app/student/register/page.tsx 中「API 失败也显示成功」的假成功逻辑。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/student/register/page.tsx", "utf8");

// 1) 已移除假成功注释与「失败也显示成功」逻辑
assert.equal(source.includes("Even if API fails, show success for now"), false, "已移除假成功注释");
assert.equal(source.includes("API 失败也显示成功"), false, "不残留中文注释说明");

// 2) 引入 error 状态，用于展示失败信息
assert.match(source, /const \[error, setError\] = useState\(""\)/, "存在 error 状态");

// 3) 成功分支唯一：setSubmitted(true) 只出现在 if (res.ok) 分支内
const successOccurrences = source.split("setSubmitted(true)").length - 1;
assert.equal(successOccurrences, 1, "setSubmitted(true) 全文件仅出现一次（仅成功分支）");
const successIdx = source.indexOf("setSubmitted(true)");
const ifOkIdx = source.indexOf("if (res.ok)");
const elseIdx = source.indexOf("} else {", successIdx);
assert.ok(ifOkIdx !== -1 && successIdx > ifOkIdx, "setSubmitted(true) 位于 if (res.ok) 之后");
assert.ok(elseIdx !== -1 && successIdx < elseIdx, "setSubmitted(true) 位于 else 之前（成功分支内）");

// 4) 失败分支如实提示错误
assert.match(source, /let message = "提交失败，请稍后重试";/, "非成功响应默认错误文案");
assert.match(source, /setError\(message\);/, "非成功响应写入 error 状态");
assert.match(source, /const data = await res\.json\(\);\s*if \(data && data\.error\) message = data\.error;/, "解析服务端 error 字段");
assert.match(source, /setError\("网络错误，提交失败，请稍后重试"\)/, "网络异常显示错误");

// 5) 页面渲染错误提示块（而非在失败时跳转成功页）
assert.match(source, /\{error && \(\s*<div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">/, "渲染错误提示块");

// 6) 成功页仍保留，仅在 res.ok 时到达
assert.match(source, /if \(submitted\) \{/, "成功页分支保留");

console.log("TICKET-122-R19 register-page regression: ALL ASSERTIONS PASSED");

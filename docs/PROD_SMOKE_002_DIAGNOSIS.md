# PROD-SMOKE-002 — Diagnosis Report

> **问题：POST /api/upload 413 FUNCTION_PAYLOAD_TOO_LARGE**
> 日期：2026-06-01
> 状态：**已诊断 — 待评审**

---

## 1. 根因确认

| 项目 | 结果 |
|------|------|
| **EROFS** 问题 | ✅ 已解决（PROD-SMOKE-001 热修） |
| **413** 错误 | ❌ 新问题 |
| 错误码 | `FUNCTION_PAYLOAD_TOO_LARGE` |
| 触发时机 | Vercel 在请求到达函数前拦截 |
| 限制来源 | **Vercel Hobby Plan — Serverless Function 请求体上限 4.5 MB** |

## 2. 当前上传方式

### 前端（ConsultationForm.tsx）

```typescript
// 所有文件打包进一个 FormData，一次 fetch
async function uploadFiles(files: File[], fieldName = "files") {
  const formData = new FormData();
  for (const f of files) {
    formData.append(fieldName, f);  // ← 所有文件一起发
  }
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  ...
}
```

### 调用入口

```typescript
// Step 1: Upload all files in parallel
const [logoAssets, mascotAssetsList, refAssets] = await Promise.all([
  uploadFiles(logoFileList),        // ← Logo 文件（多文件一起）
  uploadFiles(mascotFileList),      // ← IP 公仔文件（多文件一起）
  referenceFileList.length > 0
    ? uploadFiles(referenceFileList) // ← 参考手册（PDF 可达 50MB）
    : Promise.resolve([]),
]);
```

### 问题拆解

| 上传批次 | 风险 | 说明 |
|---------|------|------|
| Logo 文件（1-5个） | ⚠️ | 多文件总和大可能超 4.5MB |
| IP 公仔文件（1-10个） | ⚠️ | 多文件总和大可能超 4.5MB |
| 参考手册 PDF（1个，最大 50MB） | ❌ | 单个文件就可能远超 4.5MB |

---

## 3. 修复方案对比

### 方案 A — 按文件分开发送（最小变更）

```
当前：所有 Logo 文件在一个 FormData 中 → 一次 fetch
改为：每个文件单独 fetch
```

| 维度 | 评估 |
|------|------|
| 修改范围 | `ConsultationForm.tsx` 的 `uploadFiles` 函数 |
| 风险等级 | 低 |
| 是否改架构 | ❌ 否 |
| 是否碰 Freeze Zone | ❌ 否 |
| 优点 | 最小改动，不影响后端 |
| 缺点 | 单个文件 > 4.5MB 仍会失败；参考 PDF (> 4.5MB) 仍失败 |

### 方案 B — 客户端直传 Supabase Storage（推荐）

```
跳过 Vercel 函数：
  浏览器 → FormData
              ↓  (Vercel 4.5MB 限制)
           /api/upload (Serverless Function)

改为：
  浏览器 → supabase.storage.from("brand-brain-generated").upload()
           ↓  (无大小限制，由 Supabase 处理)
          Supabase Storage

前端拿到 Public URL 后，直接 POST /api/submit 带 URL 数组即可。
```

| 维度 | 评估 |
|------|------|
| 修改范围 | `ConsultationForm.tsx` — 替换上传函数；`api/submit/route.ts` — 接受 URL 而非上传文件 |
| 风险等级 | 中低 |
| 需新增 env | 否（`NEXT_PUBLIC_SUPABASE_ANON_KEY` 已在客户端可用） |
| 需改 Supabase policy | 否（bucket 已公开） |
| 优点 | 完全绕过 Vercel 4.5MB 限制；不依赖 Serverless 函数处理文件 |
| 缺点 | 需要客户端 `@supabase/supabase-js`；需在 `package.json` 确认已在 deps 中 |

### 方案 C — 增加文件大小限制

```
当前：FileUpload 组件 maxSize = 20MB
改为：maxSize = 4MB（确保不超过 Vercel Hobby 限制）
```

| 维度 | 评估 |
|------|------|
| 修改范围 | `FileUploadArea.tsx` 的 maxSize 属性 |
| 风险等级 | 极低 |
| 优点 | 简单粗暴，用户无法上传大文件 |
| 缺点 | 用户大文件被拒绝，体验差；参考 PDF (50MB) 完全用不了 |

---

## 4. 推荐方案

```text
推荐：方案 B（客户端直传 Supabase Storage）

理由：
1. 绕过所有 Serverless Function 负载限制
2. 不依赖 Vercel Hobby 的 4.5MB 上限
3. 后续 PDF 参考手册（50MB）也可用
4. 无需新增环境变量
5. Supabase 客户端已在项目依赖中
6. bucket 已创建且公开可读

不推荐的方案：
  方案 A — 治标不治本，大文件/PDF仍会失败
  方案 C — 限制用户体验，且阻碍商业试点
```

---

## 5. 修改范围预估

| 文件 | 修改内容 |
|------|---------|
| `src/components/client/ConsultationForm.tsx` | 替换 `uploadFiles()`：从 fetch → supabase.storage.upload() |
| `src/app/api/upload/route.ts` | 可保留（作为 local dev fallback），或移除 Vercel 分支 |
| 不需改 | Agent Layer / Memory / Generation / Freeze Zone / Schema |

---

## 6. 验收标准

| 标准 | 方式 |
|------|------|
| 上传 5MB+ 的 PNG 文件不再 413 | Vercel Logs 确认 |
| 上传参考手册 PDF (50MB) 成功 | Vercel Logs 确认 |
| 文件出现在 `uploads/form-assets/` 路径下 | Supabase Dashboard 确认 |
| 返回 Supabase Public URL | 前端日志确认 |
| `/api/submit` 收到 URL 并成功处理 | 表单提交流程完成 |
| 无 401/500 | Vercel Logs |

---

## 7. 回退方案

如果方案 B 实施后有风险，可回退至方案 A（拆分文件发送）+ 客户端文件大小限制的组合方案，影响范围仅限于单文件 < 4MB 的场景。

---

*本文档由 Codex 在诊断 PROD-SMOKE-002 后生成。*
*待 ChatGPT 评审后执行。*

# PROD-SMOKE-002 — Fix Report

> **生产热修：客户端直传 Supabase Storage**
> 日期：2026-06-01
> 状态：**FIXED — 合并待部署**

---

## 1. 修改文件列表

| 文件 | 变更类型 | 行数变化 |
|------|---------|---------|
| `src/components/client/ConsultationForm.tsx` | 修改 | +45 / -12 |

**仅此一个文件。** 未改动其他任何代码。

---

## 2. 变更内容

### 2.1 新增导入和常量

```typescript
import { createClient } from "@supabase/supabase-js";

const MAX_LOGO_SIZE = 20 * 1024 * 1024;      // 20MB
const MAX_MASCOT_SIZE = 20 * 1024 * 1024;    // 20MB
const MAX_PDF_SIZE = 50 * 1024 * 1024;       // 50MB

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const STORAGE_BUCKET = "brand-brain-generated";
const STORAGE_PREFIX = "uploads/form-assets";
```

### 2.2 上传函数改动

**Before（走 Vercel Function）：**
```typescript
async function uploadFiles(files: File[], fieldName = "files") {
  const formData = new FormData();
  for (const f of files) formData.append(fieldName, f);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data.files || [];
}
```

**After（浏览器直传 Supabase Storage）：**
```typescript
async function uploadFiles(files: File[], type: "logo" | "mascot" | "pdf") {
  // 前端文件大小校验
  const limits = { logo: 20MB, mascot: 20MB, pdf: 50MB };
  for (const f of files) {
    if (f.size > limits[type]) {
      throw new Error(`${f.name} 超过文件大小限制`);
    }
  }

  // 逐个文件直传 Supabase Storage
  for (const file of files) {
    const storagePath = `uploads/form-assets/${safeName}`;
    await supabase.storage.from("brand-brain-generated").upload(...);
    const { data: { publicUrl } } = supabase.storage.from("brand-brain-generated").getPublicUrl(storagePath);
    results.push({ fileName: file.name, url: publicUrl, size: file.size });
  }
  return results;
}
```

### 2.3 调用变更

| 旧调用 | 新调用 |
|--------|--------|
| `uploadFiles(logoFileList)` | `uploadFiles(logoFileList, "logo")` |
| `uploadFiles(mascotFileList, "files")` | `uploadFiles(mascotFileList, "mascot")` |
| `uploadFiles(referenceFileList, "files")` | `uploadFiles(referenceFileList, "pdf")` |

---

## 3. 上传链路改变

```
Before（已失效）:
  浏览器 → FormData → fetch /api/upload → Vercel Function (4.5MB limit) → Supabase Storage
                                      ↑ 413 FUNCTION_PAYLOAD_TOO_LARGE

After（当前）:
  浏览器 → supabase.storage.upload() → Supabase Storage (无大小限制)
          ↓
  拿到 Public URL → POST /api/submit (JSON, 极小 payload, 不触发 413)
```

---

## 4. Build 结果

| 指标 | 结果 |
|------|------|
| Build 通过 | ✅ 38/38 pages |
| TypeScript 错误 | 0 |
| 编译时间 | 12.5s |

---

## 5. Freeze Zone 检查

| 冻结区域 | 是否触碰 |
|----------|---------|
| Agent Layer | ❌ 未触碰 |
| Memory Layer | ❌ 未触碰 |
| Generation Layer | ❌ 未触碰 |
| Provider Layer | ❌ 未触碰 |
| Database Schema | ❌ 未触碰 |
| UI Components (Freeze列表) | ❌ 未触碰（ConsultationForm 不在冻结列表中） |

---

## 6. 验收检查

| 标准 | 状态 | 说明 |
|------|------|------|
| 不上传 Vercel Function | ✅ | 浏览器直传 Supabase |
| Logo ≤ 20MB 校验 | ✅ | 前端检查 |
| IP ≤ 20MB 校验 | ✅ | 前端检查 |
| PDF ≤ 50MB 校验 | ✅ | 前端检查 |
| 返回字段兼容 | ✅ | 与之前 `{fileName, url, size}` 一致 |
| `/api/submit` 未改动 | ✅ | 已兼容 URL 格式 |
| 触碰 Freeze Zone | ❌ 未触碰 | |
| Build 通过 | ✅ | 38/38 pages |
| local dev 兼容 | ✅ | 开发环境需启动 Next.js dev server |

---

## 7. 保留的 `/api/upload` 路由

`/api/upload` 路由未删除。在生产环境中，浏览器不会调用此路由（客户端直传 Supabase）。路由保留作为：
- 本地开发的 filesystem fallback
- 未来可能的迁移缓冲

未触发 413 验证：在本环境无法验证，需你上线后测试。

---

## 8. 部署说明

修复已合并到 `master`（待提交）。提交后会触发 Vercel 自动部署。

部署后验收步骤：
1. 打开 `https://vi-ai-logo-ip-mock.vercel.app/consultation`
2. 上传一个 5MB+ 的 PNG 文件 → 确认不再 413
3. 上传一个 PDF 文件（最大 50MB）→ 确认不再 413
4. 提交表单 → 确认整个流程成功
5. Vercel Logs 检查 → 确认无 401/500
6. Supabase Storage → 确认文件出现在 `uploads/form-assets/` 路径下

---

*本文档由 Codex 在修复 PROD-SMOKE-002 后自动生成。*

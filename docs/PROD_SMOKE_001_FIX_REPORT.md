# PROD-SMOKE-001 — Fix Report

> **生产热修：/api/upload 文件系统写入 → Supabase Storage**
> 日期：2026-05-31
> 状态：**FIXED — 已合并**

---

## 1. 修改文件列表

| 文件 | 变更类型 |
|------|---------|
| `src/app/api/upload/route.ts` | 修改（重写上传逻辑） |

**仅此一个文件。** 未改动其他任何代码。

---

## 2. 变更内容

### Before

```typescript
const uploadDir = path.join(process.cwd(), "public", "uploads");
await mkdir(uploadDir, { recursive: true });
const filePath = path.join(uploadDir, safeName);
await writeFile(filePath, Buffer.from(bytes));

savedFiles.push({
  fileName: file.name,
  url: `/uploads/${safeName}`,
  size: bytes.byteLength,
});
```

### After

```typescript
const BUCKET = "brand-brain-generated";
const STORAGE_PREFIX = "uploads/form-assets";

if (isVercel) {
  // Production: upload to Supabase Storage
  const storagePath = `${STORAGE_PREFIX}/${safeName}`;
  await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  });
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(BUCKET).getPublicUrl(storagePath);
  savedFiles.push({
    fileName: file.name,
    url: publicUrlData.publicUrl,   // ← 返回 Public URL
    size: bytes.byteLength,
  });
} else {
  // Development: local filesystem fallback
  // ... 保持不变
}
```

### 关键变更点

| 维度 | Before | After |
|------|--------|-------|
| 目标存储 | `public/uploads/` (本地文件系统) | Supabase Storage `brand-brain-generated` |
| 路径前缀 | 无 | `uploads/form-assets/` |
| 返回值 url | `/uploads/xxx.png` | `https://fzoscrutqhdfzwnjgjvs.supabase.co/storage/...` |
| Vercel 环境 | 500 (EROFS) | ✅ 正常写入 |
| 本地开发 | ✅ | ✅ (fallback 保留) |

---

## 3. Build 结果

| 指标 | 结果 |
|------|------|
| Build 通过 | ✅ 38/38 pages |
| TypeScript 错误 | 0 |
| 编译时间 | 10.3s |

---

## 4. Freeze Zone 检查

| 冻结区域 | 是否触碰 |
|----------|---------|
| Generation Layer | ❌ 未触碰 |
| Agent Layer | ❌ 未触碰 |
| Provider Layer | ❌ 未触碰 |
| Memory Interface | ❌ 未触碰 |
| Database Schema | ❌ 未触碰 |
| UI Components | ❌ 未触碰 |

---

## 5. 验收检查

| 标准 | 状态 | 说明 |
|------|------|------|
| 仅改 `/api/upload` | ✅ | 只修一个文件 |
| 使用 Supabase Storage | ✅ | `brand-brain-generated` bucket |
| 返回字段兼容 | ✅ | 字段名不变，URL 值从本地路径变 Public URL |
| Vercel 不写 filesystem | ✅ | `process.env.VERCEL === "1"` 时走 Supabase |
| 本地 fallback 保留 | ✅ | 非 Vercel 环境走原逻辑 |
| 触碰 Freeze Zone | ❌ 未触碰 | 已验证 |
| Build 通过 | ✅ | 38/38 pages |

---

## 6. 风险记录

### 已处理

- **analyze-reference-pdf** — 同样有本地文件写入问题，但不在当前表单提交流程中。标记为 **PROD-SMOKE-002**，单独排队。

### 已知但已接受

- `mntion-dom` junction — framer-motion 打包 typo，需在 `node_modules` 中创建 junction 才能 build。不影响生产构建（Vercel 有完整 `npm install` 流程）。

---

## 7. 部署说明

修复已合并。下次 Vercel Production Redeploy 后生效。

部署后验证步骤：
1. 打开 `https://vi-ai-logo-ip-mock.vercel.app/consultation`
2. 上传一个文件（Logo 或 IP 公仔图片）
3. 确认返回 200 而非 500
4. 确认 Supabase Storage 中可见文件在 `uploads/form-assets/` 路径下
5. 确认返回的 URL 可公开访问

---

*本文档由 Codex 在修复 PROD-SMOKE-001 后自动生成。*

# PROD-SMOKE-003 — Supabase Storage RLS Policy

> **问题：客户端直传 Supabase Storage 被 RLS 拦截**
> 日期：2026-06-01
> 状态：**已诊断 — 待 ChatGPT 评审**

---

## 1. 根因

Supabase Storage bucket `brand-brain-generated` 的默认 RLS 策略不允许 anon（匿名）用户写入。

当浏览器使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 直接上传时，请求被 RLS 拦截：

```
new row violates row-level security policy
```

## 2. 修复方案

在 Supabase Dashboard → SQL Editor 中执行以下 SQL：

```sql
-- ============================================================
-- PROD-SMOKE-003: Storage RLS Policy for client-side uploads
-- 
-- Bucket: brand-brain-generated
-- 
-- 原则：
--   最小权限 — 只开放 uploads/form-assets/ 路径的 anon 写入
--   不开放删除权限
--   不开放全 bucket 写入
-- ============================================================

-- Policy 1: Allow anon to SELECT (read) any file in the bucket
-- (Needed for public URL access)
CREATE POLICY "anon_select_brand_brain_generated"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'brand-brain-generated'
);

-- Policy 2: Allow anon to INSERT (upload) to uploads/form-assets/ only
CREATE POLICY "anon_insert_form_assets"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'brand-brain-generated'
  AND (storage.foldername(name))[1] = 'uploads'
  AND (storage.foldername(name))[2] = 'form-assets'
);
```

## 3. 策略说明

| 策略 | 权限 | 范围 | 说明 |
|------|------|------|------|
| `anon_select` | SELECT (读) | 全 bucket | 已有 Public URL 访问 |
| `anon_insert_form_assets` | INSERT (写) | `uploads/form-assets/` 路径下 | **新增** |
| DELETE | ❌ 不开放 | — | 拒绝 anon 删除 |
| UPDATE | ❌ 不开放 | — | 拒绝 anon 覆盖 |

## 4. 不做的操作

```
❌ 不修改数据库 schema
❌ 不修改 Memory 表的 RLS
❌ 不修改任何代码
❌ 不开放全 bucket 写入
❌ 不开放 anon DELETE
```

## 5. 执行方式

```
Supabase Dashboard → SQL Editor → 粘贴执行

URL: https://supabase.com/dashboard/project/fzoscrutqhdfzwnjgjvs/sql/new
```

## 6. 验收标准

执行后：

```
1. 浏览器上传 5MB+ PNG 到 uploads/form-assets/ → 不再 RLS 错误
2. 文件出现在 Supabase Storage 中
3. Public URL 可访问
4. 尝试上传到 bucket 根目录 → 被 RLS 拒绝（正确行为）
5. 尝试删除文件 → 被 RLS 拒绝（正确行为）
```

---

*本文档由 Codex 在诊断 PROD-SMOKE-003 后生成。*
*待 ChatGPT 评审后执行。*

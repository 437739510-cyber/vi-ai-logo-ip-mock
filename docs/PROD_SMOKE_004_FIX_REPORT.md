# PROD-SMOKE-004 — Fix Report

> **生产热修：/api/submit 本地 mock 写入 → VERCEL 守卫**
> 日期：2026-06-01
> 状态：**FIXED — 已推送，等待自动部署**

---

## 1. 修改文件

| 文件 | 变更 |
|------|------|
| `src/app/api/submit/route.ts` | +14 / -11 行 |

**仅此一个文件。**

---

## 2. 变更内容

### Before

```typescript
// Local JSON backup — write once per file
await mkdir(MOCK_DIR, { recursive: true });

const subsPath = path.join(MOCK_DIR, "submissions.json");
const subs = await loadJson<any[]>(subsPath);
subs.unshift(submission);
await writeFile(subsPath, JSON.stringify(subs, null, 2));
// ... same for projects.json
```

### After

```typescript
// Local JSON backup — Vercel production only writes to Supabase
if (process.env.VERCEL !== "1") {
  await mkdir(MOCK_DIR, { recursive: true });
  // ... local JSON writes unchanged inside the guard
}
```

## 3. 影响分析

| 环境 | 行为 |
|------|------|
| Vercel Production | Supabase 表写入 ✅ / 跳过本地 JSON ✅ |
| 本地开发 | Supabase 表写入 ✅ / 本地 JSON 备份 ✅ |

Supabase 表写入已在独立的 `try/catch` 块中，不受本次改动影响。

## 4. 构建结果

| 指标 | 结果 |
|------|------|
| Build | ✅ 38/38 pages |
| 编译时间 | 9.8s |
| TypeScript 错误 | 0 |

## 5. Freeze Zone

| 区域 | 状态 |
|------|------|
| Agent Layer | ❌ 未触碰 |
| Memory | ❌ 未触碰 |
| Generation | ❌ 未触碰 |
| Provider | ❌ 未触碰 |
| Freeze Zone | ✅ 0 violations |

## 6. 提交信息

```
commit 14f127a
master → origin/master ✅
```

## 7. PROD-SMOKE 系列状态

| 编号 | 问题 | 状态 |
|------|------|------|
| 001 | EROFS in /api/upload | ✅ CLOSED |
| 002 | 413 FUNCTION_PAYLOAD_TOO_LARGE | ✅ CLOSED |
| 003 | Supabase Storage RLS | ✅ CLOSED |
| **004** | **EROFS in /api/submit** | **✅ FIXED — 待部署验证** |

---

*本文档由 Codex 在修复 PROD-SMOKE-004 后自动生成。*

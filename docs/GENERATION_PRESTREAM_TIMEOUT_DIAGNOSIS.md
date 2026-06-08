# Generation API Pre-Stream Timeout Diagnosis

**Task**: RC-DEPLOYMENT-005  
**Date**: 2026-05-31  
**Status**: ROOT CAUSE IDENTIFIED AND FIXED

---

## Root Cause

**Parameter ordering bug** in `assemblePage()` call site.

### Bug Description

When `projectId` was added to `assemblePage()` as a new parameter (RC-DEPLOYMENT-003), it was inserted:

- **Function signature**: as 2nd parameter (correct — after `pageDef`)
- **Call site**: at the **end** of the argument list (wrong!)

This caused a complete parameter shift:

| Expected Position | Expected Value | Actual Value Received |
|-|-|-|
| 1 `pageDef` | `page` | `page` |
| 2 `projectId` | `projectId` | `clientInfo` |
| 3 `clientInfo` | `clientInfo` | `brandColors` |
| 4 `brandColors` | `brandColors` | `logoUrl` |
| 5 `logoUrl` | `undefined` | `mascotUrl` |
| 6 `mascotUrl` | `undefined` | `dashscopeKey` (API key string) |
| 7 `dashscopeKey` | API key | `deepseekKey` (API key string) |
| 8 `deepseekKey` | API key | `pageIndex` (numeric) |

### Consequences

- `mascotUrl` received the Aliyun API key string, so the code tried to open a file at `public/sk-1337d8...`
- `deepseekKey` received a numeric `pageIndex`, causing TypeErrors deep in the AI call
- The `assemblePage()` function threw inside the `ReadableStream.start()` callback, which meant the SSE stream never emitted events
- HTTP response headers were sent (200), but no events followed, causing the client to wait forever

### Evidence

Server log captured during diagnosis:
```
[diag] POST: request received
[diag] json parsed, projectId: VI-20260528-NDKW-DIAG
[mascot] fallback failed: ENOENT: .../public/sk-1337d8b2d6944fd792f0650c004aa43a
[generate] assemblePage error for cover: TypeError: Cannot read properties of undefined (reading 'primaryColor')
```

The file path `sk-1337d8b2d6944fd792f0650c004aa43a` is the ALIYUN_API_KEY value, confirming the parameter shift.

---

## Fix

Moved `projectId` from the end of the argument list to position 2, right after `page`:

```typescript
// Before (buggy):
assemblePage(page, clientInfo, brandColors, logoUrl, mascotUrl, ..., pageBlueprints[page.id], projectId)

// After (fixed):
assemblePage(page, projectId, clientInfo, brandColors, logoUrl, mascotUrl, ..., pageBlueprints[page.id])
```

---

## Verification

After fix, the generation API successfully:

1. **Parsed request** — immediate
2. **Created SSE stream** — immediate
3. **Generated cover page** — ~24 seconds (DeepSeek prompt + Aliyun image + sharp composite)
4. **Uploaded to Supabase Storage** — confirmed
5. **Returned Supabase public URL**:
   `https://fzoscrutqhdfzwnjgjvs.supabase.co/storage/v1/object/public/brand-brain-generated/VI-20260528-NDKW-DIAG/1780228541374-cover-final.png`
6. **Completed** — `totalPages:1, failedPages:0`

---

## Classification

| Question | Answer |
|-|-|
| Data-size issue? | No (530 byte payload) |
| AI-call issue? | No (both DeepSeek and Aliyun APIs work independently) |
| Filesystem issue? | No (parameter shift caused wrong file path) |
| Synchronous loop / deadlock? | No |
| **Parameter ordering mistake?** | **Yes — root cause** |

---

## File Changed

`src/app/api/ai/generate-manual-pages-stream/route.ts`

One line changed at the call site (line 542):
```
-              page, clientInfo, brandColors,
+              page, projectId, clientInfo, brandColors,
```

---

## Current State After Fix

```
Build                   ✅  (20.4s, 38/38)
Supabase Storage        ✅  (upload + public URL verified)
DeepSeek API            ✅
Tongyi Wanxiang API     ✅
Generation API          ✅  (24s, cover page generated)
Local fallback          ✅  (preserved)
SSE event format        ✅  (unchanged)
Manual Composer payload ✅  (unchanged)
Freeze zone             ✅  (not violated)
```

The full pipeline is now verified end-to-end for the first time.

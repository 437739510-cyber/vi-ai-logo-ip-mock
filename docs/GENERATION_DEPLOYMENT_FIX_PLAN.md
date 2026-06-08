# Generation Service — Deployment Fix Plan

> **RC-DEPLOYMENT-002**
> 目标：解决 Generation Service 的两个生产阻断项
> 前置：RC-DEPLOYMENT-001 (PASS AS DIAGNOSTIC)
> 日期：2026-05-31

---

## 0. Executive Summary

Generation Service 代码已就绪，但有两个部署层问题阻止其投入生产：

| 问题 | 严重度 | 影响 |
|------|--------|------|
| GS-01: API 被外部认证层 401 阻断 | HIGH | 无法完成 Full Mode 验证 |
| GS-02: Vercel Serverless 文件系统不可持久化 | HIGH | 生成图片无法保存 |

本文档分析两个问题的根因、解决路径和执行计划。

---

## 1. GS-01: 外部认证层 401

### 1.1 问题现象

```text
POST /api/ai/generate-manual-pages-stream
→ 401 Unauthorized: {"error":"Unauthorized","message":"Invalid or missing access key"}
```

对 `/api/brand/analyze` 等其他 API 同样 401，说明**不是路由特定问题**，而是整个 API 层被保护。

### 1.2 可能来源

| 来源 | 可能性 | 证据 |
|------|--------|------|
| Vercel Deployment Protection | 高 | Vercel 默认保护 Preview Deployments，要求登录或访问密钥 |
| 外部反向代理 (Nginx / Cloudflare) | 中 | `.env.local` 中 `XYQ_ACCESS_KEY` 暗示可能存在自定义代理 |
| Next.js Custom Middleware | 低 | `src/middleware.ts` 只保护 `/admin` 路由，不保护 API |
| Vercel Edge Config | 低 | 未在项目中配置 |

**最可能的根因：Vercel Preview Deployment Protection。**

Vercel 的 Preview Deployments 默认启用 **Deployment Protection**，需要通过 Vercel 账户登录或提供有效的访问密钥才能访问。这是 Vercel 平台行为，不在项目代码中。

### 1.3 如何确认

| 方法 | 操作 | 复杂度 |
|------|------|--------|
| 方法 A | 登录 Vercel Dashboard → Settings → Deployment Protection → 检查 Protection Bypass for Automation | Low |
| 方法 B | 在 Vercel 项目设置中检查是否启用了 Password Protection 或 Vercel Authentication | Low |
| 方法 C | 尝试通过 Vercel Preview URL 访问（如 `https://vi-ai-logo-ip-mock.vercel.app`），看是否弹出认证界面 | Low |
| 方法 D | 检查 `XYQ_ACCESS_KEY` 是否是自定义代理的密钥 | Medium |

### 1.4 各环境处理方式

| 环境 | 建议处理方式 | 说明 |
|------|-------------|------|
| 本地开发 | 移除或绕过认证层 | 本地开发应可以直接访问 API |
| Vercel Preview | 保留 Protection (Password) | 保护 Preview 分支不被公开访问，手动输入密码即可 |
| **Vercel Production** | **关闭 Protection 或启用 API Token** | 生产 API 需要无需认证即可从 Manual Composer 调用 |

### 1.5 推荐方案

```
1. 登录 Vercel Dashboard
   → 项目 vi-ai-logo-ip-mock
   → Settings → Deployment Protection
   → 检查是否启用了 Vercel Authentication 或 Password Protection

2. 如果启用了 Password Protection:
   → 本地开发：移除 Protection Bypass 要求（或本地停用）
   → Preview: 保留 Password Protection
   → Production: 关闭 Protection（API 需要公开访问）或配置 API Token Bypass

3. 如果使用了自定义认证层（XYQ_ACCESS_KEY）:
   → 确认密钥配置方式
   → 在 API 调用请求头中加入正确的密钥
```

**Codex 无法直接操作 Vercel Dashboard。** 需要人工确认 Vercel 项目设置。

---

## 2. GS-02: 存储持久化问题

### 2.1 问题本质

当前生成服务将图片写入：

```typescript
const outputDir = path.join(process.cwd(), "public", "generated");
await writeFile(outputPath, buf);
```

在 Vercel Serverless Functions 中：

```text
/vara/task/{hash}/
  ├── public/
  │   └── generated/   ← 写入成功，但函数执行完毕即销毁
  └── ...
```

- 写入操作不会报错
- 但文件不会在多个函数调用之间共享
- 读取时可能返回 404
- 文件不会出现在 Vercel 的静态资源 CDN 中

### 2.2 Supabase Storage 方案

| 维度 | 说明 |
|------|------|
| 集成成本 | 低 — 已有 `supabaseAdmin` client 和 `@/lib/supabase.ts` |
| 存储桶 | 创建 `brand-brain-generated` bucket |
| 上传方式 | `supabaseAdmin.storage.from('bucket').upload(path, fileBuffer)` |
| URL 获取 | `supabaseAdmin.storage.from('bucket').getPublicUrl(path)` |
| 权限控制 | Bucket Public + Row Level Security |
| 与其他系统的关系 | 已有 Supabase Project，Memory 数据也在同一数据库中 |
| 定价 | 免费套餐包含 1GB 存储 + 带宽 |
| CDN | Supabase Storage 内置 CDN |

**改动的代码范围：**

```
src/app/api/ai/generate-manual-pages-stream/route.ts
  └── assemblePage() 中的文件写入部分
      └── 将 writeFile + 本地路径
          → 替换为 supabaseAdmin.storage.from().upload()

src/agents/manual-composer.ts
  └── 仅依赖返回的 URL（不关心存储后端）
      └── 无需修改
```

### 2.3 Vercel Blob 方案

| 维度 | 说明 |
|------|------|
| 集成成本 | 低 — `@vercel/blob` 包 |
| 存储 | Vercel Blob Store |
| 上传方式 | `put(path, fileBuffer, { access: 'public' })` |
| URL 获取 | 上传时直接返回 `url` |
| 与其他系统的关系 | 独立于现有项目基础设施 |
| 定价 | 免费套餐包含 5GB 存储 |
| CDN | Vercel Edge Network |

**改动的代码范围：**

```
src/app/api/ai/generate-manual-pages-stream/route.ts
  └── assemblePage() 中的文件写入部分
      └── 将 writeFile + 本地路径
          → 替换为 @vercel/blob 的 put()
```

### 2.4 两者对比

| 对比项 | Supabase Storage | Vercel Blob |
|--------|-----------------|-------------|
| 现有集成 | ✅ 已有 Supabase Project + Client | ❌ 需新增 `@vercel/blob` 依赖 |
| 学习成本 | Low — 同一生态 | Low — 但全新依赖 |
| 数据统一性 | ✅ Memory + 生成图片同一生态 | ❌ 数据分布在 Supabase + Vercel |
| 权限管理 | RLS + Bucket Policy | Public / Private |
| CDN | 内置 | Vercel Edge |
| 免费配额 | 1GB | 5GB |
| 迁移复杂度 | 更简单（已有 supabaseAdmin） | 需安装新包 + 配置 |
| 长期维护 | 更少依赖 | 多一个外部依赖 |

### 2.5 推荐方案

```
推荐: Supabase Storage

理由:
  1. 已有 Supabase Project 和 supabaseAdmin client
  2. Memory (memory_projects 表中的 snapshot) + 生成图片同一生态
  3. 不需要新增外部依赖
  4. Asset URL 可通过相同的数据管道获取
  5. 未来 Asset Guardian 可以直接引用存储路径

不推荐 Vercel Blob:
  1.需要新增依赖包
  2.品牌数据分散在两个平台
  3.Vercel Blob 超出免费配额后计费较高
```

**改动预估：**
- 文件：仅 `src/app/api/ai/generate-manual-pages-stream/route.ts` 中的 `assemblePage()`
- 新增行：约 **10-15 行**
- 不修改：Agent、MemoryAdapter、Orchestrator

---

## 3. Migration Scope

### 3.1 需要改动的文件

| 文件 | 改动类型 | 预计行数 | 风险 |
|------|----------|----------|------|
| `src/app/api/ai/generate-manual-pages-stream/route.ts` | 修改 assemblePage() 文件写入部分 | ~15 行 | LOW |
| `src/lib/supabase.ts` | 检查是否已导出 supabaseAdmin（已存在） | 0 行 | ✅ 无需修改 |
| `src/agents/manual-composer.ts` | 无需修改 | 0 行 | ✅ |
| 其余文件 | 无需修改 | 0 行 | ✅ |

### 3.2 不能改动的区域

```
❌ src/agents/orchestrator.ts
❌ src/agents/brand-analyst.ts
❌ src/agents/brand-planner.ts
❌ src/agents/mascot-designer.ts
❌ src/agents/design-director.ts
❌ src/agents/asset-guardian.ts
❌ src/agents/manual-composer.ts
❌ src/lib/memory/* (包括 memory/types.ts)
❌ src/lib/brand-analyzer.ts
❌ src/lib/brand-dictionary.ts
❌ src/lib/module-planner.ts
❌ src/lib/business-profile.ts
❌ src/lib/industry-knowledge.ts
❌ docs/* (除本文档外)
```

### 3.3 Generation Layer 触碰评估

生成服务路由 `generate-manual-pages-stream/route.ts` 属于 **Generation Layer**，当前处于 Frozen 状态。

| 评估项 | 结论 |
|--------|------|
| 是否属于 Freeze Zone | ✅ 是 — Generation Layer |
| 是否需要 Architecture Review | ✅ 是 |
| Storage 迁移是否改变生成逻辑 | **否** — 仅改变文件保存方式 |
| 是否影响 SVG 合成逻辑 | **否** — 仅替换 writeFile → cloud upload |
| 是否影响提示词生成逻辑 | **否** — 仅替换文件持久化方式 |
| 是否影响页面渲染逻辑 | **否** — 仅替换写入目标 |

**结论：Storage 迁移不改变生成服务的行为，只改变输出存储的后端。** 这是一个**基础设施变更**，不是**业务逻辑变更**。

如批准，可以在 Architecture Review 后将这个变更视为"基础设施适配"而非"功能开发"。

---

## 4. Implementation Plan

### Phase 1: Auth Unblock（人工操作，< 15 分钟）

```text
操作:
  1. 登录 Vercel Dashboard
     → vi-ai-logo-ip-mock → Settings → Deployment Protection
  2. 检查 Protection 类型
     - Vercel Authentication: 本地开发需关闭或配置 bypass
     - Password Protection: 本地需要密码
     - (如果是 XYQ 代理，需确认密钥传递方式)
  3. 本地开发环境：确保无需认证即可调用 API
  4. 生产环境：关闭 Protection 或配置 API Token Bypass

验收:
  POST /api/ai/generate-manual-pages-stream → 200 (非 401)
```

### Phase 2: Storage Adapter Design（本文档已完成）

```text
输出:
  - 本文档第 2 节的分析
  - 推荐方案：Supabase Storage

决策点:
  - 批准 Supabase Storage 方案
  - 批准 Generation Layer 触碰范围
```

### Phase 3: Storage Migration（代码修改，~30 分钟）

```text
修改文件:
  src/app/api/ai/generate-manual-pages-stream/route.ts

具体变更:
  在 assemblePage() 中:
  
  // Before:
  const outputPath = path.join(outputDir, outputFileName);
  await sharp(...).png().toFile(outputPath);
  return `/generated/${outputFileName}`;

  // After:
  const buf = await sharp(...).png().toBuffer();
  const { data: { path: storagePath } } = await supabaseAdmin
    .storage
    .from('brand-brain-generated')
    .upload(`${projectId}/${outputFileName}`, buf, {
      contentType: 'image/png',
      upsert: true,
    });
  const { data: { publicUrl } } = supabaseAdmin
    .storage
    .from('brand-brain-generated')
    .getPublicUrl(storagePath);
  return publicUrl;

额外:
  - 在 Supabase Dashboard 创建 brand-brain-generated bucket
  - 确认 bucket 为 public（允许公开访问）

验收:
  npm run build 通过
  POST /api/ai/generate-manual-pages-stream → 返回 Supabase 存储 URL
```

### Phase 4: Yedao Full Mode Re-run（~30 分钟）

```text
操作:
  1. 确认 Auth 已解除
  2. 确认 Storage Bucket 已创建
  3. 运行:
     POST /api/ai/generate-manual-pages-stream with Yedao input
  4. 确认:
     - SSE stream 正常返回所有页面
     - 每个 page:done 包含 Supabase Storage URL
     - 最终 done event 正确
     - public/mock/manual-pages-{projectId}.json 已保存

验收:
  Full Mode (6 个 Agent) 全部成功
  Memory 写入完整 brainResult
  Quality Score 在 Memory 中
```

---

## 5. Risk Register

| 编号 | 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|------|----------|
| R1 | Supabase Storage Bucket 创建后未配置公开访问 | Low | 生成图片 404 | 创建后立即验证 public URL |
| R2 | Supabase 免费套餐 1GB 存储不足 | Low | 存储费用超出 | 1GB 对初期的几十张图片完全足够 |
| R3 | Auth 解除后 API 被公开访问 | Medium | 非授权用户可调用生成 API | Production 只保留必要的保护（如 API Token） |
| R4 | Storage 迁移中生成服务暂时不可用 | Low | 部署期间无法生成 | Phase 3 完成后立即回归验证 |
| R5 | 本地 FileSystem fallback 场景被覆盖 | Low | JSON adapter 用户无 cloud upload | 保留 `if (no supabase) { writeFile fallback }` |
| R6 | 生成 API 调用通义万相失败 | Medium | 图片生成失败 | 已有 3 次重试 + 纯色 fallback |

---

## 6. Go / No-Go Recommendation

### 6.1 当前状态

```text
Generation Service: CODE READY
Auth:              BLOCKED (需要人工确认 Vercel 设置)
Storage:           NOT PRODUCTION READY (需要迁移至 Supabase Storage)
```

### 6.2 推荐

```text
RECOMMENDATION: GO → Phase 1 (Auth Resolution)

原因:
  Auth 问题是使用 Vercel 的常见配置项
  Storage 迁移改动极小（~15 lines, single file）
  两个问题都可以独立修复
  修复后即可运行 Yedao Full Mode

前提条件:
  1. 人工确认 Vercel Dashboard 认证设置（无法自动完成）
  2. 批准 Generation Layer 的 Storage 迁移（基础设施变更，非功能变更）
```

### 6.3 如果按优先级排序

```text
P0 — 人工确认 Auth 配置（Vercel Dashboard）
     时间：15 分钟
     影响：不解决则 API 全部不可用

P0 — Supabase Dashboard 创建 Storage Bucket
     时间：2 分钟
     影响：不创建则无法持久化生成图片

P1 — Storage 迁移代码修改
     时间：30 分钟
     影响：解决生产图片持久化

P2 — Yedao Full Mode 验证
     时间：30 分钟
     影响：确认全链路可用
```

### 6.4 最终判定

```text
RC-DEPLOYMENT-002
PASS AS PLAN

不可由 Codex 自动完成的事项：
  1. Vercel Dashboard → 检查 Deployment Protection 设置
  2. Supabase Dashboard → 创建 brand-brain-generated storage bucket

可由 Codex 自动完成的事项：
  3. Storage 迁移代码修改（Phase 3）
  4. Yedao Full Mode 验证（Phase 4）

建议：先完成 1 和 2（人工，~20 分钟），再让 Codex 执行 3 和 4。
```

---

*本文档不修改代码、不直接重构 Generation Layer、不接入云存储。*
*仅提供方案分析。*

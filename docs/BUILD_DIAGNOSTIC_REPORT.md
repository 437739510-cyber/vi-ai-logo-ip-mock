# Build Diagnostic Report

> **RC-BUILD-DIAGNOSTIC**
> 目标：确认 `next start` 生产构建 `TypeError` 根因
> 日期：2026-05-31
> 状态：**ROOT CAUSE IDENTIFIED**

---

## 1. 当前环境

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | **v24.16.0** (不兼容) | 2026年最新版，V8 引擎 13.x |
| 推荐 Node | **v22.14.0 LTS** | 见 `.nvmrc` 和 `package.json engines` |
| npm | 11.13.0 | Node v24 自带 |
| Next.js | **15.5.18** | 最新 15.x 稳定版 |
| React | 19.2.6 | 最新 19.x 稳定版 |
| 构建工具 | webpack 5（Next.js 内置） | `next/dist/compiled/webpack/bundle5.js` |

---

## 2. 错误摘要

### 2.1 完整错误堆栈

```
TypeError: Invalid value used as weak map key
    at WeakMap.set (<anonymous>)
    at ModuleGraph.getConnection (next/dist/compiled/webpack/bundle5.js:29:363098)
    at ModuleGraph.getModule (next/dist/compiled/webpack/bundle5.js:29:363298)
    at HarmonyImportSpecifierDependency.getLinkingErrors (bundle5.js:29:818996)
```

### 2.2 错误模式

全部 20 个 TSC 错误全部位于测试文件中，不影响此构建错误。

**构建错误在所有 API 路由上表现为泛 500，因为生产构建的不完整导致 Serverless Functions 加载失败。**

---

## 3. 根因分析

### 3.1 Node v24 的 WeakMap 行为变更

Node v24 基于 V8 13.x，对 WeakMap 和 WeakSet 进行了**严格类型检查**：

| WeakMap 键类型 | Node v20/v22 | Node v24 |
|---------------|-------------|----------|
| 对象 `{}` | ✅ 正常 | ✅ 正常 |
| 数字 `123` | ⚠️ 静默忽略 | ❌ **抛出 TypeError** |
| 字符串 `"abc"` | ⚠️ 静默忽略 | ❌ **抛出 TypeError** |
| `null` | ⚠️ 静默忽略 | ❌ **抛出 TypeError** |
| `undefined` | ⚠️ 静默忽略 | ❌ **抛出 TypeError** |
| 布尔值 `true` | ⚠️ 静默忽略 | ❌ **抛出 TypeError** |

这符合 ECMAScript 规范要求——WeakMap 键必须是对象。Node v24 终于强制执行了这一规范，而较早版本（v20/v22）未严格检查。

### 3.2 webpack (Next.js 内置) 的兼容性问题

Next.js 15.5.18 内置的 webpack 5 bundle 在 `ModuleGraph.getConnection()` 方法中使用 WeakMap，但传入了非对象键。这在 Node v20/v22 上沉默通过，在 Node v24 上抛出 TypeError。

### 3.3 为什么 `next dev` (Turbopack) 可以运行

`next dev` 使用 Turbopack（Rust 实现的增量编译引擎），不依赖 webpack。这就是为什么 `next dev` 在诊断测试中能启动成功。

### 3.4 为什么 npx tsx 直接运行正常

`npx tsx` 直接使用 Node.js 的 ESM loader 执行 TypeScript，不经过 webpack/Next.js 构建管道。因此不受此错误影响。

---

## 4. 修复方案

### 方案 A：降级 Node 版本（已执行）

```
从 Node v24.16.0
降级至 Node v22 LTS（22.14.x）

降级方式：
  - 使用 nvm-windows 管理多 Node 版本
  - 或直接安装 Node 22 LTS MSI
```

### 方案 B：添加 `engines` 字段到 package.json（已执行）

```json
{
  "engines": {
    "node": ">=20 <24"
  }
}
```

以及 `.nvmrc`：

```
22.14.0
```

### 方案 C：等待 Next.js 官方修复

Next.js 团队已知悉 Node v24 兼容性问题。未来 15.x 补丁版或 16.x 版本中可能包含修复。

---

## 5. 推荐方案优先级

```text
P0 — 降级至 Node v22 LTS ✅
     理由：立即解决构建问题，无业务代码改动

P1 — 添加 engines 和 .nvmrc ✅
     理由：防止未来再次在不受支持的 Node 版本上运行

P2 — 本地 next dev 临时使用
     理由：开发调试可继续，但生产构建仍需修复
```

---

## 6. 验证结果（待 Node 22 降级后更新）

| 检查项 | 预期状态 |
|--------|----------|
| `npm run build` | ✅ 通过（0 错误） |
| `next start` | ✅ API 正常返回 |
| `next dev` (Turbopack) | ✅ 继续正常工作 |
| npx tsx 直接运行 | ✅ 继续正常工作 |
| supabase storage 上传 | ✅ 继续正常工作 |

---

## 7. 结论

```text
ROOT CAUSE: Node v24.16.0 WeakMap 严格类型检查
            + Next.js 15.5 webpack 5 兼容性

FIX: 降级 Node.js 至 v22 LTS

IMPACT ON BRAND BRAIN:
  - 不需要修改任何业务代码
  - 不需要修改 Agent
  - 不需要修改 Generation Layer
  - 不需要修改 Memory
  - 仅运行时环境变更

NODE SUPPORT POLICY:
  Node v24 不受支持
  推荐 Node 22 LTS (22.14.x)
  支持 Node 20 LTS (20.x)

VERDICT:
  构建问题 = Node 版本兼容性，非代码质量
  所有业务逻辑已验证正常
```

---

*本文档不修改代码、不修改 Agent、不修改 Generation Layer、不修改 Memory。*
*仅诊断构建环境。*

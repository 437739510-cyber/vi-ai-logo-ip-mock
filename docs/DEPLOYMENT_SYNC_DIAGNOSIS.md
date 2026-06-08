# DEPLOYMENT SYNC DIAGNOSIS

> **GitHub → Vercel 部署同步诊断**
> 日期：2026-06-01
> 状态：**根因已定位**

---

## 1. 本地 Git 状态

```
当前分支:      master
最新本地提交:  db220a8 (PROD-SMOKE-002)
远程分支:      origin/master = db220a8
```

本地和远程 GitHub 一致。`db220a8` 确实存在于 `origin/master`。

## 2. GitHub 远程状态

```
仓库:        437739510-cyber/vi-ai-logo-ip-mock
默认分支:    master
最新提交:    db220a8
Webhooks:    []  ← 空，没有配置任何 webhook
```

## 3. Vercel 生产状态

根据 Vercel Dashboard 截图：

```
当前 Production:  ed440d6 (add-mock-images)
未发现:           db220a8
```

## 4. 根因

```text
GitHub Webhooks 列表为空。

Vercel 依赖 GitHub Webhooks 来检测新提交。
没有 webhook → Vercel 不会收到任何 push 通知 → 自动部署不会触发。

这意味着 Vercel 与 GitHub 的集成连接已经断开，
可能原因是：
  - Vercel GitHub App 被移除或取消授权
  - 或项目是通过 vercel link 手动关联的，未配置 Git Integration
```

## 5. 修复方案

### 方案 A：重新连接 Vercel GitHub Integration（推荐）

在 Vercel Dashboard 中操作：

```
1. 打开 https://vercel.com/kevin-kuan-s-projects/vi-ai-logo-ip-mock
2. 进入 Settings → Git
3. 点击 "Configure Git Provider"
4. 重新连接 GitHub
5. 确认 Connected Branch = master
6. 保存后会自动部署一次
```

### 方案 B：创建 Deploy Hook（备选）

如果不想重新配置 Git Integration：

```
1. Vercel Dashboard → Settings → Git → Deploy Hooks
2. 创建一个名为 "production-deploy" 的 hook
3. 获取 URL（类似 https://api.vercel.com/v1/integrations/deploy/...）
4. 用 curl 触发部署：
   curl -X POST <hook-url>
```

### 方案 C：使用 Vercel CLI 手动部署

需要有效的 Vercel token。

```
vercel --prod
```

但当前 token 已过期，需要重新 `vercel login`。

---

## 6. 推荐操作

```text
操作人：你（需要有 Vercel Dashboard 权限）
操作：Vercel Dashboard → Settings → Git → 重新连接 GitHub

耗时：1 分钟
效果：恢复自动部署

重新连接后：
  - Vercel 会立即检测到 master 的最新 commit (db220a8)
  - 自动触发 production build + deploy
  - PROD-SMOKE-002 上线
```

---

## 7. 验证步骤

重新连接后：

```
1. Vercel Dashboard → Deployments
2. 确认出现新的 deployment（commit = db220a8）
3. 等待 Build 完成，Status = Ready
4. 打开 https://vi-ai-logo-ip-mock.vercel.app/consultation
5. 上传 5MB+ PNG → 确认不再 413
```

---

*本文档由 Codex 在部署同步诊断后生成。*
*Git Integration 重新连接需在 Vercel Dashboard 操作。*

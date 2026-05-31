# Codex Handover

> 生成时间：2026-05-31
> 项目：Brand Brain (vi-ai-logo-ip-mock)
> 版本：v0.7-alpha

---

## 当前任务

实现 WanxiangProvider — 接入通义万相（DashScope）真实图片生成 API

## 当前状态

**v0.7-alpha** — 已打 tag，项目已具备分析 → 决策 → Sandbox → Provider → 记忆 → 评分的完整闭环。真实图片生成链已搭建完毕，仅需开通 DashScope 账户即可启用。

## 最新提交

| 字段 | 值 |
|------|-----|
| Commit | `e5bb8e0` |
| Tag | `v0.7-alpha` |
| Message | `feat(wanxiang): WanxiangProvider V1 — real image generation via DashScope API` |
| 分支 | `master` |

## 修改文件（本次任务）

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/ip-image-provider/wanxiang-provider.ts` | 新增 | 完整 WanxiangProvider 实现 |
| `src/lib/wanxiang-cost.ts` | 新增 | 成本估算（turbo 80, plus 200） |
| `src/lib/__tests__/wanxiang-provider.test.ts` | 新增 | 35 项单元测试 |
| `src/lib/__tests__/wanxiang-e2e-test.ts` | 新增 | E2E 测试脚本 |
| `src/lib/ip-image-provider/provider.ts` | 修改 | 注册 WanxiangProvider（priority 10） |
| `src/lib/ip-image-provider/index.ts` | 修改 | 导出 WanxiangProvider |
| `.env.example` | 修改 | 新增 WANXIANG_API_KEY 文档 |
| `docs/AI_COLLABORATION_PROTOCOL.md` | 修改 | 新增双端同步切换对话机制 |

## 新增测试

| 测试文件 | 测试项 | 数量 |
|----------|--------|------|
| `wanxiang-provider.test.ts` | 成本估算、Provider 逻辑、Registry 注册、Metrics 包裹 | 35 |
| `wanxiang-e2e-test.ts` | 真实 API 调用（需 DashScope 开通） | 1 |

## 测试结果

| 测试 | 结果 |
|------|------|
| 单元测试（35 项） | ✅ 全部通过 |
| npm run build | ✅ 零错误 |
| E2E 真实调用 | ⚠ API 连接成功，返回 403（账户未开通 DashScope 服务），错误已正确识别为 INSUFFICIENT_BALANCE |

## 已知问题

1. **DashScope 服务未开通** — 环境变量 `ALIYUN_API_KEY=sk-1337...` 已存在，但该账户未在阿里云开通通义万相服务。需要登录阿里云控制台激活。
2. **WANXIANG_API_KEY 别名** — Provider 支持 `WANXIANG_API_KEY` 和 `ALIYUN_API_KEY` 两种环境变量名。前者优先。
3. **图片临时链接** — 通义万相返回的图片 URL 为 OSS 临时链接（有效期约 1 小时）。V1 直接用，V2 需下载到自有存储。
4. **MockProvider 始终可用** — 当 Wanxiang 不可用时，ProviderRegistry 自动回退到 MockProvider，Sandbox 和 UI 不受影响。

## 环境变量

```env
WANXIANG_API_KEY=sk-xxx    # 可选。不设置则回退到 MockProvider
ALIYUN_API_KEY=sk-xxx       # 可选，作为 WANXIANG_API_KEY 的备选
```

## 下一步建议

ChatGPT 决定。候选方向：
- 开通 DashScope 后验证真实图片生成
- IP Sandbox UI 优化（当前已可用但可改进）
- Knowledge Hub / Style Extractor（中远期规划）

## 不要做的事项

- ❌ 不要修改现有生成层（PAGE_DEFS、generate-manual-pages-stream）
- ❌ 不要修改 SVG / 封面 / 字体
- ❌ 不要删除 Asset Guardian
- ❌ 不要做批量图片生成（V2 规划）
- ❌ 不要做 Image Quality Score V2
- ❌ 不要做 Style Extractor
- ❌ 在没有 ChatGPT 确认前，不要进入下一阶段

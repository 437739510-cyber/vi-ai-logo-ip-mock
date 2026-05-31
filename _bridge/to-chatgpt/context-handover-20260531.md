# 给 ChatGPT — 项目恢复上下文

## 项目

Brand Brain（AI品牌顾问系统），仓库 `vi-ai-logo-ip-mock`

GitHub: https://github.com/437739510-cyber/vi-ai-logo-ip-mock.git

## 当前状态：Brand Brain v0.6 Preview

### 已完成的七层架构

1. **Analysis Layer** — Brand Analyzer + Industry Knowledge
2. **Knowledge Layer** — Font Safety System, Industry Knowledge
3. **Decision Layer** — 5步向导（品牌分析 → 商业信息 → IP策略 → 推荐模块 → 确认生成）
4. **Memory Layer** — ClientMemory / IndustryMemory / ProjectMemory（JSON存储）
5. **Billing Layer** — 余额追踪、消耗统计、Dashboard
6. **Sandbox Layer** — IP Sandbox，逐张生成/确认/计费，53/53 测试通过
7. **Provider Layer** — ProviderRegistry + MetricsProvider（装饰器统计），MockProvider 可用

### 最新两个提交

| Commit | 内容 |
|--------|------|
| `fa6fe1d` | Provider Metrics V1 — 透明调用统计（totalCalls/successCalls/failedCalls/totalCost/avgLatencyMs） |
| `50d99d4` | Wanxiang Provider Design V1 设计文档（docs/WANXIANG_PROVIDER_DESIGN.md） |

### Wanxiang Design 文档核心内容

- API：DashScope text2image（`wanx2.1-t2i-turbo` / `wanx2.1-t2i-plus`）
- 成本：turbo ~80 Credits/张，plus ~200 Credits/张
- 重试策略：指数退避（429/500/503），不可重试（401/403/400）直接报错
- 实现计划：4 步（generateImage → 成本估算 → 注册 Registry → 端到端测试），预估 5-6 天

### 三份关键文档

```
PROJECT_MASTER.md — 项目圣经
AI_CONTEXT.md — 快速上下文
WANXIANG_PROVIDER_DESIGN.md — 通义万相接入口设计
docs 目录: https://github.com/437739510-cyber/vi-ai-logo-ip-mock/tree/master/docs
```

## 关于下一步的决定（上次我们讨论的）

上一轮结束时的共识是：

**不要急着实现 Wanxiang Provider。**

先请审阅 WANXIANG_PROVIDER_DESIGN.md，确认设计没有问题后，再进入实现。

实现范围：
1. `src/lib/ip-image-provider/wanxiang-provider.ts` — generateImage() + generateVariant()
2. `src/lib/wanxiang-cost.ts` — 成本估算
3. 注册到 ProviderRegistry
4. 端到端测试（真实调用 1 次，确认图片返回 + 扣费正确）

当前不做的：
- 图片下载到本地/CDN（V2）
- 批量队列（V2）
- Image Quality Score V2
- Style Extractor

## 给 Codex 的指令

等 ChatGPT 审阅完 Wanxiang Design 文档后，告诉我下一步做什么。如果设计通过，就开始实现 WanxiangProvider。

# Codex Handover — 切换准备

> 生成时间：2026-05-31
> 项目：Brand Brain (vi-ai-logo-ip-mock)
> 版本：v0.7-alpha + Knowledge Documentation V1
> 切换触发：ChatGPT 发出【上下文提醒】，建议启动收口流程

---

## 当前任务

无进行中的任务。Wanxiang Provider 实现 + Knowledge Documentation V1 均已落盘。

## 当前状态

**已满足切换条件。** 技术层（Provider）和知识层（Knowledge Docs）双线完成。

## 最新提交

| 字段 | 值 |
|------|-----|
| 最新 Commit | `43b5923` — `docs: add 00_KNOWLEDGE_SOURCES.md` |
| Wanxiang Commit | `e5bb8e0` — `feat(wanxiang): WanxiangProvider V1` |
| Tag | `v0.7-alpha` |
| 分支 | `master` |

## 修改文件（Wanxiang 阶段）

| 文件 | 操作 |
|------|------|
| `src/lib/ip-image-provider/wanxiang-provider.ts` | 新增 — 完整 WanxiangProvider |
| `src/lib/wanxiang-cost.ts` | 新增 — 成本估算 |
| `src/lib/__tests__/wanxiang-provider.test.ts` | 新增 — 35 项单元测试 |
| `src/lib/__tests__/wanxiang-e2e-test.ts` | 新增 — E2E 测试脚本 |
| `src/lib/ip-image-provider/provider.ts` | 修改 — 注册 WanxiangProvider（priority 10） |
| `src/lib/ip-image-provider/index.ts` | 修改 — 导出 WanxiangProvider |

## 修改文件（Knowledge Documentation 阶段）

| 文件 | 操作 |
|------|------|
| `docs/knowledge/00_KNOWLEDGE_SOURCES.md` | 新增 — 9 个来源追溯 + 知识治理原则 |
| `docs/knowledge/01_TEACHER_PRINCIPLES.md` | 新增 — 教师课件核心原则 |
| `docs/knowledge/02_BRAND_METHOD.md` | 新增 — 品牌方法论 |
| `docs/knowledge/03_VI_KNOWLEDGE.md` | 新增 — VI 手册规范知识 |
| `docs/knowledge/04_MASCOT_KNOWLEDGE.md` | 新增 — IP 公仔设计知识 |
| `docs/knowledge/05_ANTI_PATTERN_LIBRARY.md` | 新增 — 反面案例库 |
| `docs/knowledge/06_BRAND_BRAIN_PHILOSOPHY.md` | 新增 — 项目哲学与宪法 |
| `docs/knowledge/反面案例/` | 新增 — 2 个原始反面 PDF |

## 新增测试

| 测试 | 结果 |
|------|------|
| wanxiang-provider.test.ts（35 项） | ✅ 全部通过 |
| wanxiang-e2e-test.ts（1 次真实调用） | ⚠ 连接成功，返回 403（账户未开通 DashScope） |
| npm run build | ✅ 零错误 |

## 已知问题

1. **DashScope 未开通** — `ALIYUN_API_KEY=sk-1337...` 已存在，需要登录阿里云开通通义万相服务
2. **图片临时链接** — 通义万相返回的 OSS 链接有效期约 1 小时，V1 直接使用，V2 需下载到自有存储
3. **Sandbox 测试仍用 Mock** — Wanxiang 不可用时自动回退 MockProvider

## 环境变量

```env
WANXIANG_API_KEY=sk-xxx    # 可选。不设置则回退 MockProvider
ALIYUN_API_KEY=sk-1337...   # 已存在，可作为备选
```

## 下一步建议（ChatGPT 决定）

ChatGPT 建议方向：**Knowledge Hub Architecture V1** — 从文档体系升级为可查询的知识系统。

## 不要做的事项

- ❌ 不修改现有生成层（PAGE_DEFS、generate-manual-pages-stream）
- ❌ 不修改 SVG / 封面 / 字体
- ❌ 不删除 Asset Guardian
- ❌ 不做批量图片生成
- ❌ 不做 Style Extractor
- ❌ 不做 Case Memory / Anti-Pattern Memory
- ❌ 没有 ChatGPT 确认，不进入下一阶段

## 关键链接

- GitHub: https://github.com/437739510-cyber/vi-ai-logo-ip-mock
- docs 目录: https://github.com/437739510-cyber/vi-ai-logo-ip-mock/tree/master/docs
- knowledge 目录: https://github.com/437739510-cyber/vi-ai-logo-ip-mock/tree/master/docs/knowledge
- PROJECT_MASTER: https://github.com/437739510-cyber/vi-ai-logo-ip-mock/blob/master/docs/PROJECT_MASTER.md
- PROJECT_HANDOVER: https://github.com/437739510-cyber/vi-ai-logo-ip-mock/blob/master/docs/PROJECT_HANDOVER.md
- AI_CONTEXT: https://github.com/437739510-cyber/vi-ai-logo-ip-mock/blob/master/docs/AI_CONTEXT.md

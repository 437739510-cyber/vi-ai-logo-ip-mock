# Brand Brain — Handover Document

> 最后更新：2026-05-31
> 当前负责人：Codex + ChatGPT + 用户协作

---

## 项目状态

**Brand Brain Beta** — 核心闭环已完成。

| 维度 | 状态 |
|------|------|
| 品牌分析 | ✅ |
| 商业信息 | ✅ |
| 套餐推荐 | ✅ |
| 模块规划 | ✅ |
| 生成管道 | ✅（现有，未修改） |
| 质量评分 | ✅ |
| 记忆系统 | ✅ |
| Agent 架构 | ✅ |
| Decision Layer UI | ✅ |
| GitHub 提交 | ✅（master, 82df88a） |

---

## 测试项目

**椰岛工坊** (`VI-20260528-NDKW`)

- 品牌类型：consumer（消费品牌）
- 行业：food_beverage（餐饮）
- 属性：有 Logo、有 IP 公仔"椰小匠"
- 商业信息：连锁品牌 + 招商加盟 + 高级版
- 推荐套餐：brand_ip（品牌+IP）
- 推荐模块：12 个模块 / 20 页
- Quality Score：83/100
- Memory: clients.json ✅ industries.json ✅ projects.json ✅

---

## 项目来源

原项目名 `vi-ai-logo-ip-mock`，最初是一个 VI 手册 SVG 生成 + 通义万相图片生成工具。
经过以下演化阶段：

1. **纯生成工具** — 11 页固定模板，AI 生成图片
2. **加入品牌分析** — Brand Analyzer + Industry Knowledge
3. **加入套餐系统** — basic_vi / brand_vi / brand_ip
4. **加入商业信息** — Business Profile 双因子评分
5. **Agent 架构** — 6 Agent + Orchestrator
6. **Memory 系统** — 长期记忆 JSON 存储
7. **质量评分** — 5 维度自动化评分

---

## 代码仓库

- **GitHub**: https://github.com/437739510-cyber/vi-ai-logo-ip-mock.git
- **分支**: master (commit 82df88a)
- **提交信息**: "feature: Memory Adapter V1 - Brand Brain now remembers"

---

## 开发环境

- **框架**: Next.js 15.5.18 (Turbopack)
- **端口**: 3003
- **ngrok 域名**: defensive-clump-bonnet.ngrok-free.dev
- **API Keys** (`.env.local`):
  - `DEEPSEEK_API_KEY=sk-f10a2e2e846f4b50982de464795e6149`
  - `ALIYUN_API_KEY=sk-1337d8b2d6944fd792f0650c004aa43a`

---

## 目录结构

```
vi-ai-logo-ip-mock/
├── docs/                         # 项目文档（新增）
├── src/
│   ├── agents/                   # Agent 架构 (6 agents)
│   ├── lib/                      # 核心逻辑
│   │   ├── memory/               # 记忆系统
│   │   ├── brand-analyzer.ts     # 品牌分析
│   │   ├── industry-knowledge.ts # 行业知识
│   │   ├── module-planner.ts     # 模块规划
│   │   ├── module-to-page.ts     # 模块→页面桥
│   │   ├── manual-packages.ts    # 套餐系统
│   │   ├── business-profile.ts   # 商业信息
│   │   └── manual-quality-score.ts # 质量评分
│   ├── components/admin/
│   │   └── DecisionLayer.tsx     # 4 步决策向导
│   └── app/api/
│       └── brand/analyze/route.ts # 品牌分析 API
├── public/
│   └── memory/                   # JSON 记忆存储
├── _patch_temp/                  # ChatGPT 补丁暂存（可清理）
└── .env.local                    # API Keys
```

---

## 下一步任务

### P0 — Mascot Designer Agent（已批准，待实现）

新增 `src/agents/mascot-designer.ts`，支持两种模式：
- `protect_existing` — 客户已有 IP（如椰岛工坊）
- `create_new` — 客户无 IP，基于品牌分析推荐 IP 策略

插入 Orchestrator 的 brand-planner → design-director 之间。

### P1 — Memory 验证（通过后确认稳定）

已通过端到端测试，Memory Adapter V1 正常工作。

### P2 — Decision Layer 优化（等 Mascot Designer 完成）

当前 Step 3 确认模块 / Step 4 确认生成按钮偶发不能点击，需修复。

### P3 — Quality Score 集成

当前评分逻辑完成，但在生成管道中尚未自动触发。需集成到 generate-manual-pages-stream 完成回调中。

### P4 — Style Extractor

从参考手册提取风格特征。需等 Mascot Designer 完成后再进入。

---

## 注意事项

1. **中文编码**：所有文件使用 UTF-8。PowerShell 显示中文可能乱码，但文件内容正确。
2. **生成层稳定性**：`PAGE_DEFS` 和 `generate-manual-pages-stream` 不要修改。新功能通过 module-to-page 桥接。
3. **受保护资产**：Logo 和 IP 在任何 AI 生成调用中都不应出现在背景 prompt 中。
4. **增量开发**：新增功能请新增文件，不要修改旧文件。
5. **沟通模式**：用户负责在 Codex 和 ChatGPT 之间传递信息。Codex 输出结构化摘要给 ChatGPT 评审。

---

## 参考资源

- **参考手册 PDF**: `public/uploads/` 下 11 份 VI 手册（含华为坤灵、智方增长科技、智方增长IP）
- **课程课件**: `C:\Users\Administrator\Documents\Codex\2026-05-25\new-chat\` （4 份）

## 待清理文件

- `_patch_temp/` — ChatGPT 补丁产物，稳定后可删除
- `.bak` 文件 — page.tsx.bak, route.ts.bak，确认旧代码没问题后可删除
**Brand Brain Beta+** — 完整闭环（含 IP 策略）已完成。
| 品牌分析 | ✅ |
| 商业信息 | ✅ |
| IP 策略 | ✅ |
| IP 提示词生成 | ✅ |
| IP 策略预览 UI | ✅ |
| 套餐推荐 | ✅ |
| 模块规划 | ✅ |
| 生成管道 | ✅（现有，未修改） |
| 质量评分 | ✅ |
| 记忆系统 | ✅ |
| Agent 架构 | ✅（7 agents + orchestrator） |
| Decision Layer UI | ✅（5 步向导） |
| GitHub 提交 | ✅（master, 021c7e6） |

### P0 — 文档完善（当前）

完成文档体系更新，固化项目知识。

### P1 — IP Creation Plan

调用通义万相/图片 API 实际生成 IP 形象图。

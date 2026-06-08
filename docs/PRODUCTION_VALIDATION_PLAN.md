# Production Validation Plan — V4

## Brand Brain v0.7-alpha

> 目标：Brand Brain 首个真实项目验证方案。
> 候选项目：椰岛工坊（VI-20260528-NDKW）
> 状态：Planning
> 批准人：Architecture Review

---

## 1. Validation Scope

### 1.1 Pipeline Coverage

验证 `executeBrandBrainPipeline` 在真实品牌上的完整执行路径：

| 阶段 | 模式 | Agent | 验证内容 |
|------|------|-------|----------|
| 品牌分析 | `analyze-only` | Brand Analyst | 品牌定位、行业匹配、视觉方向 |
| 品牌规划 | `plan-only` | Brand Planner | 模块推荐、页面规划、套餐建议 |
| 生成 | `generate-only` | Asset Guardian → Manual Composer | 资产合规、手册生成 |
| 全流程 | `full` | 全部 Agent | 端到端一致性 |

### 1.2 In-Scope

- 椰岛工坊完整品牌分析
- VI 手册模块推荐与规划
- 手册页面生成（至少封面 + 核心内页）
- Supabase Memory 读写验证（真实品牌数据）
- Quality Score 评审
- 人工交付物评审

### 1.3 Out-of-Scope

- 新 Agent 开发
- UI 重构
- Provider 替换（Flux / Midjourney）
- SVG / Cover / Font 系统重构
- Asset Guardian 修改
- 生产部署到 `main` 分支

---

## 2. Success Metrics

### 2.1 Quantitative Metrics

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| Pipeline 成功率 | 100% | `result.success === true` |
| Pipeline 执行时间 | < 120s | 端到端计时（plan-only） |
| Memory 写入成功率 | 100% | `saveClient` + `saveProject` 无错误 |
| BrainResult 完整性 | 5/5 | brandProfile, modulePlan, designDirection, assetGuardResult, mascotProfile |
| 页面生成成功率 | > 80% | 成功页面 / 总计划页面 |
| Quality Score | > 70 | `qualityCheck` 总分 |

### 2.2 Qualitative Metrics

| 指标 | 评审方式 |
|------|----------|
| 品牌定位准确度 | 人工评审 + 客户反馈 |
| 设计风格匹配度 | 人工评审 |
| VI 手册完整性 | 交付物清单检查 |
| 视觉质量（Logo / Mascot / Cover） | 人工评审 |

---

## 3. Quality Score Criteria

Quality Score 已存在于代码中（`src/lib/quality-check.ts`），但尚未强制集成到 Pipeline 输出。此验证阶段将人工执行 Quality Score 评审。

### 3.1 Scoring Dimensions

| 维度 | 权重 | 评分范围 | 检查项 |
|------|------|----------|--------|
| 品牌定位 | 25% | 0-100 | industryCategory 匹配、brandStage 判断、targetAudience 准确性 |
| 视觉方向 | 20% | 0-100 | designDirection 完整性、色板合理性、字体建议 |
| 模块规划 | 20% | 0-100 | modulePlan 覆盖率、pageRange 合理性、模块选择策略 |
| 资产合规 | 15% | 0-100 | Asset Guardian 约束遵守、上传资产使用率 |
| 生成质量 | 20% | 0-100 | 页面渲染质量、Logo/Mascot 合理性 |

### 3.2 Scoring Formula

```
Total = Σ(dimension_score × weight)

PASS:  total >= 70
REVIEW: total >= 50 AND < 70
FAIL:   total < 50
```

### 3.3 Quality Gate

目前 Quality Score 仅为人工评审参考。未来 V1.1 将纳入 Pipeline 强制门禁：

```text
Quality Score < 70
→ Pipeline 输出 WARNING
→ 标记为 REVIEW
```

---

## 4. Manual Review Checklist

### 4.1 Brand Analysis Review

| # | 检查项 | 通过标准 |
|---|--------|----------|
| 4.1.1 | Industry Category 匹配 | 椰岛工坊 → food_beverage / beverage / coconut |
| 4.1.2 | Brand Stage 判断 | 合理（初创 / 成长 / 成熟） |
| 4.1.3 | Target Audience 定义 | 明确、可执行 |
| 4.1.4 | Brand Personality 描述 | 与椰岛工坊品牌调性一致 |
| 4.1.5 | Visual Keywords | 至少 5 个与行业相关的关键词 |

### 4.2 Module Plan Review

| # | 检查项 | 通过标准 |
|---|--------|----------|
| 4.2.1 | 模块列表完整性 | 包含 Logo / Color / Typography 等基础模块 |
| 4.2.2 | 页面范围合理 | 椰岛工坊建议 12-20 页 |
| 4.2.3 | 套餐匹配 | Starter / Professional / Enterprise 选择合理 |
| 4.2.4 | Mascot 判断 | Mascot Designer 是否建议 IP 公仔 |

### 4.3 Asset Review

| # | 检查项 | 通过标准 |
|---|--------|----------|
| 4.3.1 | Logo 合规 | Asset Guardian 无违规报告 |
| 4.3.2 | 上传资产使用 | 至少使用 1 个用户上传资产 |
| 4.3.3 | 字体建议 | 中文字体 + 英文字体组合合理 |

### 4.4 Generation Review

| # | 检查项 | 通过标准 |
|---|--------|----------|
| 4.4.1 | 封面页 | 品牌名称 + Logo + 行业标识完整 |
| 4.4.2 | 内页 | 内容可读、布局一致性 |
| 4.4.3 | 色板页面 | 主色 / 辅助色完整 |

---

## 5. Brand Deliverable Checklist

### 5.1 Analysis Deliverables

- [ ] Brand Profile（品牌画像）
- [ ] Industry Profile（行业定位）
- [ ] Visual Direction（视觉方向建议）
- [ ] Color Palette（色板）
- [ ] Typography Suggestions（字体建议）

### 5.2 Planning Deliverables

- [ ] Module Plan（模块清单）
- [ ] Page Plan（页面规划）
- [ ] Package Recommendation（套餐建议）
- [ ] Mascot Decision（IP 公仔判定）

### 5.3 Generation Deliverables

- [ ] VI Manual Cover（VI 手册封面）
- [ ] Core Inner Pages（核心内页）
- [ ] Logo Usage Page（Logo 使用规范）
- [ ] Color System Page（色彩系统）
- [ ] Typography Page（字体规范）
- [ ] Application Pages（应用页）

### 5.4 Memory Deliverables

- [ ] ClientMemory 写入 Supabase
- [ ] ProjectMemory 写入 Supabase
- [ ] BrainResultSnapshot 完整
- [ ] MemoryIndex 更新

---

## 6. Risk Assessment

### 6.1 Risk Register

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|------|------|----------|
| R1 | AI API 调用失败（DeepSeek / 阿里云） | Medium | High | 配置 retry + fallback provider |
| R2 | Supabase 写入失败（网络 / 权限） | Low | High | 已验证 V3-P0a/P0b/P0c，写入路径稳定 |
| R3 | 生成质量不达预期 | Medium | Medium | Quality Score 作为门禁 |
| R4 | 椰岛工坊客户反馈负面 | Low | Low | 预期为 Beta 质量 |
| R5 | Vercel 生产环境变量缺失 | Low | High | V3-P0c 已验证 Preview |
| R6 | Brand Brain 输出与客户期望不符 | Medium | Medium | 人工评审 + 反馈收集 |

### 6.2 Accepted Risks

| 风险 | 原因 |
|------|------|
| Quality Score 未强制集成 | 当前为人工评审，V1.1 再纳入 Pipeline |
| Delta Snapshot 未实现 | 当前数据量小，Full Snapshot + max=10 足够 |
| Industry Learning 未闭环 | V1.1 Knowledge Accumulation 阶段处理 |

### 6.3 Deferred Risks

| 风险 | 预计处理阶段 |
|------|-------------|
| 并发写入冲突 | Vercel Serverless 环境下 read→modify→write 不安全 → V1.1 |
| Memory Index 实时性 | `updateIndex()` 每次写入都调用，性能待优化 → V1.1 |
| 客户 ID 旧格式迁移 | orchestrator 仍用旧 clientId 格式 → V1.0 Roadmap |

---

## 7. Feedback Collection Plan

### 7.1 Feedback Dimensions

| 维度 | 收集方式 | 问题示例 |
|------|----------|----------|
| 品牌分析准确度 | 问卷 | "AI 对品牌的描述是否准确？" (1-5) |
| 设计方向匹配度 | 问卷 | "推荐的视觉风格是否符合品牌调性？" (1-5) |
| 手册完整性 | 问卷 | "手册内容是否完整？缺少什么？" (自由文本) |
| 使用体验 | 问卷 | "整个流程的体验如何？" (1-5) |
| 改进建议 | 面谈 | "你最希望改进的是什么？" |

### 7.2 Scoring Template

```json
{
  "brandAccuracy": 0,
  "designMatch": 0,
  "manualCompleteness": 0,
  "userExperience": 0,
  "freeText": "",
  "submittedAt": ""
}
```

### 7.3 Feedback Integration

收集到的反馈将进入：

```
PROJECT_HANDOVER.md
→ Lessons Learned 章节

ARCHITECTURE_SSOT.md
→ 需要修正的架构决策
```

---

## 8. Exit Criteria

### 8.1 Prerequisites

- [ ] Supabase 表已创建（`docs/MEMORY_SUPABASE_SCHEMA.sql` 已执行）
- [ ] Vercel Preview 环境变量已配置（`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SERVICE_KEY`, `MEMORY_ADAPTER=supabase`）
- [ ] DeepSeek API Key 可用
- [ ] 椰岛工坊品牌资料已收集
- [ ] `docs/PRODUCTION_VALIDATION_PLAN.md` 已评审通过

### 8.2 Pass Criteria

全部以下条件满足：

- [ ] Pipeline plan-only 模式成功运行（成功率 100%）
- [ ] ClientMemory + ProjectMemory 写入 Supabase 成功
- [ ] BrainResultSnapshot 包含 5 个核心字段
- [ ] Quality Score >= 70
- [ ] Manual Review Checklist 通过率 >= 80%
- [ ] Brand Deliverable Checklist 完成率 >= 80%
- [ ] 无 P0 架构违规（冻结区未被修改）
- [ ] 测试数据已清理
- [ ] 反馈已收集并记录

### 8.3 Exit Actions

| 结果 | 操作 |
|------|------|
| PASS | 关闭 V4，进入 V1.0 Roadmap 规划 |
| PASS WITH CONDITIONS | 记录待改进项，关闭 V4，挂载 Backlog |
| FAIL | 记录失败原因，退回 V3.x 修复阶段 |

---

## Appendix A: Test Execution Record

| 日期 | 测试内容 | 结果 | 评审人 |
|------|----------|------|--------|
| — | Pipeline plan-only | Pending | — |
| — | Memory write | Pending | — |
| — | Quality Score | Pending | — |
| — | Manual Review | Pending | — |

---

## Appendix B: Revision History

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v1 | 2026-05-31 | 初始版本 | Architecture Governance |

# Brand Brain — Product Roadmap

## 阶段总览

```
Alpha ─── Beta ─── Gamma ─── Delta ─── V1.0
  │         │        │         │         │
  ▼         ▼        ▼         ▼         ▼
分析     记忆+评分  IP创建   案例学习   商业发布
```

---

## Alpha — 品牌分析

**状态：✅ 完成**

目标：让系统学会"你是谁"

- [x] Brand Analyzer — 品牌类型、人格、定位、原型
- [x] Industry Knowledge — 10+ 行业分类与视觉特征
- [x] Brand Dictionary — 品牌关键词匹配系统
- [x] Basic Analyzer API

---

## Beta — 记忆 + 评分

**状态：✅ 完成**

目标：让系统"会记住"、"会判断"

### 商业信息

- [x] Business Profile (stage / goal / budget)
- [x] 双因子评分 (brand 60% + business 40%)
- [x] Decision Layer 4 步向导 UI

### 套餐系统

- [x] ManualPackageType (basic_vi / brand_vi / brand_ip)
- [x] Package 到 Module 的映射表
- [x] Module-to-Page 转换桥

### Agent 架构

- [x] 5 agents + 1 orchestrator
- [x] Agent 契约 (Agent<TInput, TOutput>)
- [x] Orchestrator plan-only / full 模式

### 记忆系统

- [x] ClientMemory — 客户资料存储
- [x] IndustryMemory — 行业知识存储
- [x] ProjectMemory — 项目决策存储
- [x] JSON Adapter 持久化
- [x] Memory 初始化和预载

### 质量评分

- [x] ManualQualityScore — 5 维度评分
- [x] Per-package 必要模块检查
- [x] 3 种风险标记 (needs_revision / critical_asset_risk / fake_guideline_risk)

---

## Gamma — IP Creation System

**状态：🔜 开发中**

目标：让系统"能创造 IP"

- [ ] Mascot Designer Agent — 客户无 IP 时自动推荐 IP 策略
- [ ] 两种模式：protect_existing / create_new / not_needed
- [ ] 行业推荐矩阵
- [ ] Memory 扩展 (ClientMemory.latestMascotProfile)
- [ ] Module Planner 联动 (自动添加 IP 模块)

---

## Delta — Case Learning System

**状态：📋 规划中**

目标：让系统"越做越聪明"

- [ ] Style Extractor — 从参考手册提取风格
- [ ] Case Memory — 优秀案例知识库
- [ ] Anti-Pattern Memory — 常见错误模式库
- [ ] Design Director 引用案例库做决策
- [ ] Quality Score V2 — 引入图像识别的自动评分

---

## V1.0 — 商业发布

**状态：📋 规划中**

目标：可商用交付

- [ ] Business Profile V1.5 — 更多维度商业信息
- [ ] 用户反馈系统
- [ ] 管理员后台
- [ ] 套餐定价逻辑
- [ ] 项目管理面板
- [ ] 数据导出
- [ ] 多语言支持
- [ ] 部署文档

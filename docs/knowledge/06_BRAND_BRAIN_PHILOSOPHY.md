# 06 — Brand Brain 哲学（BRAND_BRAIN_PHILOSOPHY）

> 更新：2026-05-31
> 版本：v0.7-alpha

---

## 定位声明

```
Brand Brain
≠ AI Logo Generator
≠ AI Image Generator
≠ AI Design Tool

Brand Brain
= AI Brand Consultant System
```

Brand Brain 不是帮用户"画一张图"的工具。它是帮用户把品牌从"模糊的想法"变成"可执行的规范体系"的顾问系统。

---

## 架构优先级

```
Decision Layer  >  Knowledge Layer  >  Generation Layer
```

| 层级 | 职责 | 优先级 |
|------|------|--------|
| Decision Layer | 判断应该做什么 | P0 — 必须先于一切 |
| Knowledge Layer | 知道应该怎么做 | P1 — 指导生成 |
| Generation Layer | 实际执行生成 | P2 — 最后才执行 |

**核心原则：先判断，再生成。**

---

## 不可违反的七条原则

### 1. Logo 永不重绘

Logo 是品牌的核心资产。AI 只能：
- 缩放
- 移动
- 排版（围绕 Logo 布局）

AI 不能：
- 重绘 ❌
- 改色 ❌
- 加效果 ❌
- 替换字体 ❌

### 2. 已有 IP 永不重绘

客户品牌已有 IP（如椰岛工坊的"椰小匠"），AI 只能：
- 识别
- 保护
- 规范化
- 应用延展

AI 不能：
- 改脸型 ❌
- 改颜色 ❌
- 改材质 ❌
- 改比例 ❌
- 换角色设定 ❌

### 3. Asset Guardian 必须存在

Asset Guardian 是品牌资产的守门员。它在每一个生成决策中检查：
- 是否引用了受保护资产的源文件
- 是否在 prompt 中禁止重绘
- 是否在 SVG 层使用 `<image>` 引用原图
- 页面描述中是否有高风险词（redraw / recreate / redesign）

### 4. Memory 是核心资产

Brand Brain 最值钱的资产不是生成模型，而是：
- 客户案例库（ClientMemory）
- 行业知识库（IndustryMemory）
- 品牌知识库（ProjectMemory）

这些是长期积累的护城河。

### 5. Quality Score 是质量守门员

所有生成输出必须经过评分。

| 评分 < 75 | 标记为 needs_revision |
|-----------|----------------------|
| assetProtection < 15 | critical_asset_risk |
| guidelineCompleteness < 15 | fake_guideline_risk |

### 6. 用户确认优先于 AI 生成

任何生成之前，用户必须经过：
1. ✅ 品牌分析确认
2. ✅ 商业信息确认
3. ✅ IP 策略确认
4. ✅ 模块确认
5. ✅ 生成计划确认

### 7. 可落地比好看更重要

一本优秀 VI 手册的标准：
- 设计师能照着做物料
- 供应商能照着生产
- 新员工能照着用

不是：
- 页面看起来漂亮
- AI 生成了好看的图

---

## 六层架构（v0.7-alpha）

```
Analyze      →  Brand Analyzer + Industry Knowledge
Decide       →  Business Profile + Mascot Strategy + Package System
Plan         →  IP Creation Plan + Module Planner
Sandbox      →  Step-by-step approval with billing
Provider     →  ProviderRegistry + Mock/Wanxiang
Remember     →  Memory System + Quality Score
```

---

## 产品路线图

| 版本 | 状态 | 核心能力 |
|------|------|---------|
| v0.1 - v0.5 | Alpha | 基础 VI 生成 |
| v0.5-beta-plus | 已完成 | 分析 + 记忆 |
| v0.6-preview | 已完成 | 商业决策 + IP 策略 + Sandbox |
| v0.7-alpha | **当前** | Provider Layer + Metrics |
| v0.7.x | 待定 | Knowledge Documentation V1 |
| v0.8 | 待定 | 真实图片生成（DashScope 开通后） |
| v1.0 | 待定 | 商业发布 |

---

## 不要做的事项（永久禁止）

1. ❌ 不要删除或绕过 Asset Guardian
2. ❌ 不要修改现有生成层的 PAGE_DEFS
3. ❌ 不要用 AI 重绘已有 Logo 或 IP
4. ❌ 不要在没有用户确认的情况下生成
5. ❌ 不要在 Memory 写入前跳过分析
6. ❌ 不要让 Quality Score 成为可选流程

---

## 项目宪法（一句话版）

**先判断，再生成；先保护，再延展；先记忆，再优化。**

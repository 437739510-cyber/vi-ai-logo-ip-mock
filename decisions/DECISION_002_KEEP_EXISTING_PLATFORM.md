# DECISION_002: KEEP_EXISTING_PLATFORM

## 日期
2026-06-01

## 决策
不推倒重来。保留现有 Next.js / Supabase / Admin / Billing / Memory / PDF / Upload 系统底座。

## 原因
08 审计评分 92 分，证明现有架构设计正确、基础设施稳定。
需要的不是重建，而是改造接入层（Discovery → Brief → Manus）。

## 来源
08_EXISTING_SYSTEM_VALUE_AUDIT.md 审计结论

## 影响范围
- 保留：12 个核心模块
- 冻结：10 个模块（代码保留，停止开发）
- 改造：6 个模块（低到中成本）

## 状态
已执行

## 关联文档
- 08_EXISTING_SYSTEM_VALUE_AUDIT.md

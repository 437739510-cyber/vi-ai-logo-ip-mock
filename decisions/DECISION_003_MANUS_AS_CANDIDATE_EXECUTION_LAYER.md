# DECISION_003: MANUS_AS_CANDIDATE_EXECUTION_LAYER

## 日期
2026-06-02

## 决策
Brand Brain 负责 Discovery + Diagnosis + Brand Brief，
Manus（通过 REST API v2）作为 **候选** VI 手册生成执行层。

## 原因
Manus API v2 已正式开放，支持程序化任务创建、文件上传、结构化输出、Webhook 回调。
具备作为执行层的技术条件，但输出质量尚未验证。

## 前提条件
Manus PoC（10_MANUS_POC_PLAN.md）三个案例均达到 ≥ 70 分。
PoC 通过后，新增 DECISION_004 确认 Manus 为正式执行层。

## 影响范围
- Brand Brain 新路线：Interview → Diagnosis → Brief → Manus（候选）→ VI
- Manus 不替代 Brand Brain，Brand Brain 保留诊断 + 资产保护职责
- 已有自研生成管道始终作为备选方案

## 状态
待 PoC 验证

## 关联文档
- 09_MANUS_INTEGRATION_FEASIBILITY.md
- 10_MANUS_POC_PLAN.md

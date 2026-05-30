# Brand Brain — Manual Quality Score

## 概述

Manual Quality Score 是 Brand Brain 的"质检员"，在 VI 手册生成后自动评估质量。

**文件位置**: `src/lib/manual-quality-score.ts`

---

## 评分维度（共 5 维，总分 100）

| 维度 | 满分 | 评估内容 |
|------|------|----------|
| brandLogic | 20 | 是否符合行业、品牌人格、套餐定位、客户业务目标 |
| visualConsistency | 20 | 页面风格是否统一，色彩/字体层级是否稳定 |
| assetProtection | 20 | Logo/IP 是否被重绘、改色、拉伸变形 |
| guidelineCompleteness | 25 | 规范完整度（按套餐类型检查必要模块） |
| productionReadiness | 15 | 是否有真实落地信息（尺寸、色值、比例、工艺） |
| **总分** | **100** | |

---

## 数据结构

```typescript
interface ManualQualityScore {
  totalScore: number;
  dimensions: {
    brandLogic: number;
    visualConsistency: number;
    assetProtection: number;
    guidelineCompleteness: number;
    productionReadiness: number;
  };
  issues: QualityIssue[];
  suggestions: string[];
  flags: string[];
}

interface QualityIssue {
  severity: "low" | "medium" | "high";
  category: "brand_logic" | "visual" | "asset" | "guideline" | "production";
  message: string;
  affectedPages?: string[];
}
```

---

## 风险标记

| 触发条件 | 标记 |
|----------|------|
| totalScore < 75 | `needs_revision` |
| assetProtection < 15 | `critical_asset_risk` |
| guidelineCompleteness < 15 | `fake_guideline_risk` |

---

## 按套餐的必要模块检查

### basic_vi 必须包含
- cover（封面）
- logo-specs（Logo 规范）
- logo-safe-area（Logo 保护空间）
- brand-colors（品牌色）
- typography（字体系统）
- logo-misuse（错误用法）
- closing（封底）

### brand_vi 在 basic_vi 基础上增加
- brand-story（品牌故事）
- office-apps（办公应用）
- marketing-collateral（宣传物料）

### brand_ip 在 brand_vi 基础上增加
- mascot-profile（IP 角色设定）
- mascot-three-view（IP 三视图）
- mascot-colors（IP 标准色）
- mascot-expression（IP 表情）
- mascot-usage（IP 使用原则）
- 至少一个应用模块（packaging / social / store）

---

## 评分逻辑

### brandLogic (0-20)
- 检查品牌类型与行业是否匹配
- 检查品牌人格是否在页面中体现
- 检查套餐定位是否匹配客户需求

### visualConsistency (0-20)
- 页面间颜色一致性
- 字体层级一致性
- 版式风格一致性

### assetProtection (0-20)
- **检查原始图片引用**：页面是否使用 `protectedAssetUrl`
- **背景 prompt 检查**：是否出现 logo/mascot/character 等关键词
- **SVG 合成层检查**：是否使用 `<image>` 引用原图
- **高风险词检测**：redraw / recreate / redesign mascot / redesign logo

### guidelineCompleteness (0-25)
- 按 packageType 分层检查
- 不同套餐有不同的必要模块清单
- 检查模块是否存在，而非只检查页面数量

### productionReadiness (0-15)
- 有 SVG metadata 时：检查尺寸、色值、比例字段
- 无 SVG metadata 时：检查 PageBlueprint / page description 中是否包含：
  - 尺寸、色值、比例、材质、工艺、应用规则

---

## 与 Memory 的集成

```typescript
// ProjectMemory.qualityScore 字段
qualityScore: {
  total: number;
  dimensions: Record<string, number>;
  issues: QualityIssue[];
  flags: string[];
  checkedAt: string;
}
```

每次生成结束后调用 Quality Score，结果写入 ProjectMemory。

---

## V1 限制

- 基于规则检查，不涉及图像识别
- 暂时不在 Decision Layer 展示评分结果
- 不触发自动重新生成

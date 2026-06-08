# 02 — 系统架构 (System Architecture)

> 更新：2026-06-01
> 作用：回答「怎么做」——完整调用链与模块关系

---

## 最终架构（设计目标）

```
品牌资料（行业 / 店名 / 产品 / 理念 / 图片）
  ↓
Brand Interview Engine      ← 品牌问诊（收集信息）
  ↓
Brand DNA Engine            ← 品牌人格提取（12原型 + 气质标签）
  ↓
Industry Engine             ← 行业视觉语言匹配
  ↓
Brand Maturity Engine       ← 品牌等级识别（L1~L5）
  ↓
Asset Completeness Engine   ← 资产完整性评估
  ↓
Chapter Engine              ← 章节组织（3 章结构）
  ↓
Layout Engine               ← 布局选择 + 内容适配 + 样式解析
  ↓
Pattern Library             ← 具体布局模式
  ↓
Asset Guard + Scorer        ← 资产保护 + 质量评分
  ↓
输出：VI 手册（PNG / PDF）
```

## 当前实际架构

```
用户
  ↓ Next.js 前端
ConsultationForm.tsx（上传 Logo / IP / 参考 PDF）
  ↓ 浏览器直传 Supabase Storage
/api/submit（存储提交信息）
  ↓
/admin/projects → 项目列表
  ↓
/admin/manual-pages/[projectId] → 生成流程

Step 1: Brand Analyzer（/api/brand/analyze → DeepSeek）
Step 2: Business Profile（前端本地）
Step 3: IP Strategy（前端本地 — generateMascotPromptSet）
Step 4: Module Planner（前端本地 — planModules）
Step 5: 确认生成（余额 + 费用估算）
  ↓
/api/ai/generate-manual-pages-stream
  for each page (11 pages):
    DeepSeek → 页面背景描述
    通义万相 → 背景图生成（可选）
    assemblePage() → SVG 合成
    Sharp → PNG 渲染
    上传 Supabase Storage
  ↓
vi_manuals 表写入
  ↓
PDF 导出（/api/ai/export-pdf → pdf-lib）
```

## 数据库表

| 表 | 用途 |
|----|------|
| submissions | 客户提交信息 |
| projects | 项目记录 |
| vi_manuals | 已生成手册（pages[], pdf_url） |
| memory_clients | 客户记忆（Schema 已建） |
| memory_industries | 行业知识（Schema 已建） |
| memory_projects | 项目分析历史（Schema 已建） |

## 核心 API

| API | 用途 | 调用 AI |
|-----|------|---------|
| /api/brand/analyze | 品牌分析 | DeepSeek |
| /api/ai/generate-manual-pages-stream | 页面生成 | DeepSeek + 通义万相 |
| /api/ai/export-pdf | PDF 导出 | 无 |
| /api/billing/dashscope-balance | 通义万相余额 | 无 |
| /api/billing/deepseek-balance | DeepSeek 余额 | 无 |
| /api/submit | 提交表单 | 无 |

## 存储结构

```
Supabase Storage:
  brand-brain-generated/
    uploads/form-assets/     ← 用户上传素材
    {projectId}/             ← 生成页面 PNG
    manuals/                 ← PDF 文件
```

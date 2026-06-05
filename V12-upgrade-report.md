# Brand Brain V12 升级报告

## 升级时间
2026年6月6日

## 升级概述

本次V12升级包含以下6个主要功能点：

---

### 1. Vercel部署配置

**文件**: `vercel.json`

**内容**:
- 配置 Next.js 框架部署参数
- 设置环境变量（SUPABASE、DEEPSEEK、ALIYUN等）
- 配置构建和开发命令

**部署步骤**:
1. 登录 Vercel: `vercel login`
2. 连接 GitHub 仓库
3. 配置环境变量（从 Vercel Dashboard）
4. 部署: `vercel --prod`

---

### 2. PDF导出修复

**文件**: `src/app/api/ai/export-pdf/route.ts`

**改进**:
- 添加 Storage 上传的 try-catch 容错
- 当 Storage bucket 不存在时，返回 base64 编码的 PDF
- 保留缓存机制（pdf_url）

**API 返回格式**:
```json
{
  "success": true,
  "url": "https://...",
  "base64": "...(当Storage不可用时)",
  "storageWarning": "PDF generated but Storage upload failed"
}
```

---

### 3. 生成过程可视化

**新增文件**:
- `src/app/api/ai/get-project-status/route.ts` - 查询项目状态
- `src/app/api/ai/update-project-status/route.ts` - 更新项目状态
- `src/components/client/GenerationProgress.tsx` - 进度组件
- `src/app/(client)/generation-progress/page.tsx` - 进度页面

**状态流程**:
```
pending → brand_analyzing → logo_generating → logo_selecting → scene_rendering → pptx_assembling → completed
```

**前端轮询**:
- 每2秒轮询一次 `/api/ai/get-project-status`
- 显示当前步骤和进度百分比
- 完成后自动跳转到预览页面

---

### 4. Logo智能选优

**文件**: `src/app/api/ai/select-logo/route.ts`

**功能**:
- 手动选择模式: `POST { projectId, logoImageUrl, logoIndex }`
- AI智能选优模式: `POST { projectId, logoUrls: [...], autoSelect: true }`

**AI选优流程**:
1. 调用 DeepSeek API 对4张Logo评分
2. 评分维度: 品牌契合度、视觉辨识度、行业适配性
3. 选择总分最高的Logo
4. 自动保存到 Storage

**评分Prompt**:
```
从品牌契合度、视觉辨识度、行业适配性三个维度对每个Logo评分（1-10分）
选择得分最高的Logo作为最终选择
```

---

### 5. 版面升级（V12风格）

**文件**: `src/lib/vi-page-renderer.ts`

**改进页面**:

#### 标识诠释页
- 增加故事性叙事段落（品牌故事）
- 根据行业自动生成品牌故事文案
- 保留设计理念和视觉符号解读

#### 色彩页
- 圆形色卡替代方形色块
- 增加色彩心理学解读
- 三栏式展示主色、辅助色、强调色

#### 基础规范页
- 增加 Logo 安全间距图示
- 添加最小使用尺寸规范（印刷20mm/数字60px/大型100mm）
- 完善禁止使用方式说明

---

### 6. 品牌资产包

**文件**: `src/app/api/ai/generate-brand-pack/route.ts`

**功能**:
- 生成品牌色HEX/RGB值表(JSON)
- 返回 Logo 源文件信息
- 提供社交媒体适配版尺寸建议

**API响应**:
```json
{
  "success": true,
  "projectId": "...",
  "brandName": "品牌名称",
  "colorJSON": "{...}",
  "colors": {
    "primary": "#1A73E8",
    "secondary": "#34A853",
    "accent": "#FBBC04"
  },
  "files": {
    "colorGuide": "brand-colors.json",
    "logoSource": "logo-source.png",
    "socialAvatar": "social-avatar.png",
    "socialCover": "social-cover.png"
  }
}
```

---

## 技术细节

### 环境变量
```bash
NEXT_PUBLIC_SUPABASE_URL=https://fzoscrutqhdfzwnjgjvs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
DEEPSEEK_API_KEY=sk-f10a2e2e846f4b50982de464795e6149
ALIYUN_API_KEY=sk-1337d8b2d6944fd792f0650c004aa43a
```

### Supabase Storage Buckets
- `brand-brain-generated` - 生成的文件（图片、PDF）
- `form-assets` - 表单上传文件
- `processed-assets` - 处理后的资产

### 成本估算
- DeepSeek API: ¥0.001/千token
- 通义万相: ¥0.04/张图
- 预估单次生成成本: ¥1.2元

---

## 验证测试

### 测试1: 获取项目状态
```bash
curl -X GET "http://localhost:3000/api/ai/get-project-status?projectId=test-id"
```

### 测试2: Logo智能选优
```bash
curl -X POST "http://localhost:3000/api/ai/select-logo" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-id",
    "logoUrls": ["url1", "url2", "url3", "url4"],
    "autoSelect": true
  }'
```

### 测试3: 生成品牌资产包
```bash
curl -X POST "http://localhost:3000/api/ai/generate-brand-pack" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test-id"}'
```

---

## 下一步计划

1. **Vercel部署**: 需要手动登录Vercel并连接GitHub仓库
2. **Storage Bucket创建**: 在Supabase Dashboard创建brand-brain-generated bucket
3. **ZIP打包**: 前端实现完整的ZIP打包下载功能
4. **社交媒体图片生成**: 集成图片裁剪API生成各平台适配尺寸

---

## 版本信息

- **当前版本**: V12
- **上一个版本**: V11 (commit: f21062e)
- **升级日期**: 2026-06-06

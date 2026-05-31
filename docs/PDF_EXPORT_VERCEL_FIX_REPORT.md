# PDF Export Vercel Compatibility Fix (PROD-PDF-002)

> 修复 `/api/ai/export-pdf` 在 Vercel Production 中不可用的问题
> 日期：2026-06-01

---

## 根因

原 `/api/ai/export-pdf` 依赖：

- Python (`exec("python _gen_pdf.py ...")`) — Vercel Serverless 无 Python
- Pillow (`PIL`) — Vercel 环境未安装
- 本地路径 (`C:\Users\...`) — Vercel 路径不同
- 本地文件读取 (`public/mock/`) — Vercel 文件系统只读
- 本地文件写入 (`public/generated/`) — Vercel 文件系统只读

## 修改文件

| 文件 | 操作 |
|------|------|
| `src/app/api/ai/export-pdf/route.ts` | 重写 |
| `package.json` | 新增依赖 `pdf-lib` |
| `package-lock.json` | 自动更新 |

## 新增依赖

- `pdf-lib` — 纯 Node.js PDF 库，无原生依赖，兼容 Vercel Serverless

## 数据流（新方案）

```
POST /api/ai/export-pdf { projectId }
  ↓
查询 Supabase vi_manuals 表获取页面数据
  ↓
按 11 页标准顺序排序
  ↓
fetch 每张页面图片 URL (HTTP)
  ↓
pdf-lib 创建 A4 PDF，嵌入图片
  ↓
上传 PDF 到 Supabase Storage
  brand-brain-generated/{projectId}/manual-{projectId}.pdf
  ↓
返回 public URL
```

## 兼容性

返回字段与原前端兼容：

- `url` — PDF public URL
- `pdfUrl` — 同上
- `downloadUrl` — 同上
- `success` — boolean
- `message` — 生成信息
- `totalPages` — 嵌入的页数

## Build 结果

```
✓ Compiled successfully in 10.4s
✓ Generating static pages (38/38)
0 errors
```

## Freeze Zone 影响

| 模块 | 影响 |
|------|------|
| Agent Layer | 无 ❌ |
| Memory Layer | 无 ❌ |
| Generation Layer | 无 ❌ |
| Provider Layer | 无 ❌ |
| Database Schema | 无 ❌ |
| Quality Score | 无 ❌ |

## Verdict

```text
PROD-PDF-002

修改范围：最小，仅 export-pdf route
新增依赖：pdf-lib（纯 JS，无原生依赖）
Freeze Zone：0 violations
Build：PASS

Go / No-Go: GO

等待 Vercel 部署完成后进行生产验证。
```

**Font Safety System V1 设计完成，npm run build 零错误。**

新增 `src/lib/font-library.ts`，包含：

**10 个字体档案（全部商用安全）：**

| 字体 | 类型 | 授权 | 适用行业 |
|------|------|------|----------|
| 思源黑体 | multi/sans | open-source | 科技、企业、教育 |
| 思源宋体 | multi/serif | open-source | 出版、媒体、文化 |
| 阿里巴巴普惠体 | zh/sans | free-commercial | 电商、零售、消费 |
| HarmonyOS Sans | zh/sans | free-commercial | 科技、IoT、企业 |
| OPPO Sans | zh/sans | free-commercial | 科技、年轻、时尚 |
| Inter | en/sans | open-source | 科技、SaaS、设计 |
| Montserrat | en/sans | open-source | 时尚、生活、创意 |
| Poppins | en/sans | open-source | 教育、年轻、社媒 |
| IBM Plex | en/sans | open-source | 企业、金融、咨询 |
| Roboto | en/sans | open-source | 科技、移动、媒体 |

**API：**
- `getAllFonts()` / `getFontById()` / `getFontsByLanguage()` / `getFontsByCategory()`
- `getFontsByIndustry()` / `getCommercialSafeFonts()` / `getFontAlternatives()`
- `recommendFonts({ industries, language, category, requireCommercialSafe })` — 按匹配度排序

**当前不做：** 不改生成层、不改 SVG、不改 Sandbox、不改 Billing。V1 仅做字体知识库。

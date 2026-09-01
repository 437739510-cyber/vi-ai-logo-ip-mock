/**
 * API Route: POST /api/ai/brand-analysis
 *
 * AI 品牌分析引擎 — 补全"信息断层"的核心层
 * 
 * V55优化：Supabase查询从7次→4次
 * - 合并Query1+2: 一次查projects获取client_info+submission_id
 * - 消除Query5: 复用已有的existingCI数据，不再重复查询
 * - 合并Query6+7: status和client_info一次update写入
 * 
 * 输入：客户原始信息（公司名、行业、地理位置、品牌愿景等）
 * 处理：DeepSeek 分析 → 行业洞察、地理环境、竞品格局、品牌定位
 * 输出：品牌档案 JSON → 存入 projects.client_info (JSONB)
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { guardedDeepSeekCall, DEEPSEEK_MODEL } from '@/lib/core/billing/deepseek-guard';
import { getIndustryType, getIndustryDefaults, buildIndustryContextParagraph, INDUSTRY_COLOR_RULES } from "@/lib/brand/industry-types";
import { getIndustryKnowledge } from "@/lib/brand/industry-knowledge";

// 工单 023：品牌分析提示词模板版本（与 scripts/worker.mjs 的 LOGO_PROMPT_TEMPLATE_VERSION 对齐）
const BRAND_ANALYSIS_TEMPLATE_VERSION = "024-connotation-1";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submissionId, projectId, clientInfo } = body;

    if (!projectId || !clientInfo) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // V55: 一次查询获取 client_info + submission_id（合并原Query1+2）
    const { data: existingProject } = await supabaseAdmin
      .from("projects").select("client_info, submission_id, client_name, industry").eq("id", projectId).single();
    const existingCI = (existingProject?.client_info as Record<string, any>) || {};
    const existingBP = existingCI.brandProfile;
    
    if (existingBP?.brandToneKeywords?.length > 0) {
      console.log("[brand-analysis] Reusing existing brand analysis — skipped DeepSeek call");
      return NextResponse.json({
        success: true,
        profile: { ...existingBP, submissionId, projectId },
        reused: true,
      });
    }

    console.log("[brand-analysis] Analyzing:", clientInfo.companyName, "| Industry:", clientInfo.industry);

    // Auto-fill from submission if clientInfo is incomplete
    if (!clientInfo.companyName || !clientInfo.industry) {
      if (existingProject?.submission_id) {
        const { data: sub } = await supabaseAdmin.from("submissions").select("*").eq("id", existingProject.submission_id).single();
        if (sub) {
          clientInfo.companyName = clientInfo.companyName || sub.company_name || existingProject.client_name || "";
          clientInfo.industry = clientInfo.industry || sub.industry || existingProject.industry || "";
          clientInfo.province = clientInfo.province || sub.province || "";
          clientInfo.city = clientInfo.city || sub.city || "";
          clientInfo.brandVision = clientInfo.brandVision || sub.brand_vision || "";
          clientInfo.coreValues = clientInfo.coreValues || sub.core_values || "";
          clientInfo.targetMarket = clientInfo.targetMarket || sub.target_market || "";
          clientInfo.description = clientInfo.description || sub.description || "";
          clientInfo.mainProducts = clientInfo.mainProducts || sub.main_products || "";
          clientInfo.brandPersonality = clientInfo.brandPersonality || sub.brand_personality || "";
          clientInfo.logoUsage = clientInfo.logoUsage || sub.logo_usage || "";
          clientInfo.logoStyle = clientInfo.logoStyle || sub.logo_style || "";
          clientInfo.avoidElements = clientInfo.avoidElements || sub.avoid_elements || "";
          clientInfo.existingSignagePain = clientInfo.existingSignagePain || sub.existing_signage_pain || "";
          clientInfo.competitorReference = clientInfo.competitorReference || sub.competitor_reference || "";
          clientInfo.customerProfile = clientInfo.customerProfile || sub.customer_profile || "";
          clientInfo.existingBrandColor = clientInfo.existingBrandColor || sub.existing_brand_color || "";
          clientInfo.brandHighlight = clientInfo.brandHighlight || sub.brand_highlight || "";
          clientInfo.businessForm = clientInfo.businessForm || sub.business_form || "";
          clientInfo.budgetRange = clientInfo.budgetRange || sub.budget_range || "";
          clientInfo.businessYears = clientInfo.businessYears || sub.business_years;
        }
      }
    }
    // 更新项目状态为"品牌分析中"
    await supabaseAdmin.from("projects").update({ status: "brand_analyzing", updated_at: new Date().toISOString() }).eq("id", projectId);

    // TICKET-143 Phase A：行业知识层注入（与 worker 同款），模板版本不变、不触发存量重跑
    const industryContext = buildIndustryContextParagraph(
      getIndustryKnowledge(getIndustryType(clientInfo.industry)),
      getIndustryDefaults(clientInfo.industry),
      Boolean(clientInfo.brandColors || clientInfo.existingBrandColor),
    );

    // 构建分析prompt
    const analysisPrompt = buildAnalysisPrompt(clientInfo);

    // 调用 DeepSeek
    const resp = await guardedDeepSeekCall({
      route: "ai/brand-analysis",
      body: {model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: `你是一位资深的品牌战略分析师，精通中国本土市场的品牌定位与VI策略。

你的任务是：根据客户提供的品牌基础信息，进行深度分析，输出品牌档案。

${industryContext}

## 分析框架

### 1. 行业洞察
- 该行业的市场趋势、增长方向
- 行业痛点与机会
- 技术变革对行业的影响

### 2. 地理环境分析
- 所在地区的商业环境与资源优势
- 地域文化对品牌的影响
- 区域市场的特殊性

### 3. 竞品格局
- 主要竞品及其市场定位
- 竞品的视觉风格与传播策略
- 差异化机会

### 4. 品牌定位建议
- 基于以上分析的差异化定位方向
- 品牌独特价值主张(UVP)
- 品牌调性关键词（3-5个形容词）

### 5. 文案补全
- 如果客户没有填写品牌愿景、核心价值、目标市场，请根据行业和公司信息代写
- 如果客户已填写，请优化润色，保留客户原意

### 6. 视觉方向建议
- 【必填】colorPalette必须输出3个完整色值（含hex/rgb/cmyk/pantone）。如果用户已自定义品牌色（见输入中的品牌色字段），colorPalette必须100%使用用户提供的hex值，禁止修改或替换。若用户未提供品牌色，根据行业特征生成（主色、辅助色、强调色），如果客户已有品牌色则必须优先使用客户品牌色。cmyk值必须是印刷适配值（非RGB数学转换），pantone按哑光铜版纸标准。每个色的meaning必须说明该色与品牌定位/行业特征的关联（如"深墨绿呼应中医经络的专业与沉稳"），不可写泛泛的"温暖""活力"等空话
- 推荐的视觉风格（如极简、国潮、科技感等）
- VI应用效果图建议（5个场景，必须是品牌Logo/视觉元素印在该行业真实使用的品牌物料上的效果图，场景品类根据客户行业动态决定，中英文对照；每条en必须是行业定制的完整生图提示词，包含该行业真实物料+使用场景、品牌色hex、视觉风格关键词与LOGO呈现要求，禁止固定句式只换物料名词；对应zh必须是与en逐句对应的完整中文生图提示词（物料+使用场景、品牌色hex与中文色名、视觉风格关键词、LOGO呈现要求），禁止只写物料短标题或场景短描述）
- sceneSectionTitles：3个场景页的中文标题，必须根据客户行业动态生成（如餐饮→"餐饮应用系统/餐饮包装系统/餐饮营销系统"，水果→"生鲜应用系统/生鲜包装系统/生鲜营销系统"，洗车→"洗车应用系统/洗车包装系统/洗车营销系统"）

### 7. Logo设计建议（为客户没有Logo的情况）
- 根据品牌名称、行业特征、地域文化特色，设计4个不同方向的Logo方案
- 每个方案必须是完整中文生图提示词：把客户品牌名（公司名称字段）原样写入提示词并以品牌中文清晰为主视觉；默认现代简约/扁平/白色背景；若品牌调性适合，允许传统印章/篆书/仿古风格选项，但品牌中文必须逐字清晰正确（无错字无叠字）并过核字门；明确要求每个字只出现一次、无重复、无多余文字、无错字；模板中的 XXX 必须替换为真实品牌名，不得原样输出 XXX
- Logo需简洁、辨识度高、适合各种尺寸应用

## 颜色与行业绑定（强制）
${INDUSTRY_COLOR_RULES}

## 品牌内涵推导链（核心，必须逐条推导，不是填空）
请按以下推理链推导品牌内涵；每一条都必须有商业理由，且与行业/人群/定位强绑定。
1. 定位推导：从 产品 + 行业 + 人群 + 卖点，推导出品牌定位（不是复述客户输入）。
2. 符号系统：选 4-6 个核心图形符号，每个必须给出商业理由（呼应品牌名/产地/工艺/人群/卖点）。
3. 颜色含义：每个颜色说明「为什么是它」（行业关联 + 情感/卖点绑定），不是配色好看就选。
4. 字体分级：按用途分级（品牌标识字 / 口号副标语字 / 正文通用字），并说明分级理由。
5. 故事钩子：提炼 1-2 句记忆点 / 卖点叙事。
6. 场景对准：每个应用场景说明对准的人群 / 卖点。
颜色一致性（硬约束）：colorSystem 的颜色必须与 colorPalette 及 logoSpecs.logoColors 完全一致（同一客户同一色值），禁止互相矛盾。
输出纪律（硬约束）：必须输出完整合法的 JSON——字符串值内禁止未转义换行、禁止截断；控制字段篇幅（品牌本质/故事钩子各 1 句、符号理由/颜色含义/用途各 1 句、logoConcept 3 句以内），宁可精炼，不可残缺。

## 输出格式
返回严格JSON，不要markdown包裹：
【强制要求】sceneImageSuggestions的每条en提示词必须逐条体现：该行业真实使用场景与物料、品牌色（用hex值，来自colorPalette或用户品牌色）、视觉风格（用visualStyleSuggestion中的风格词）与品牌LOGO呈现要求；下方模板句式仅作结构参考，禁止直接复用示例文本，示例中的[行业物料+使用场景]必须替换为具体且贴合的物料+场景描述（如修脚店→'foot spa membership card on a clean wooden counter'）；zh字段必须是与en内容逐句对应的完整中文生图提示词：行业物料+使用场景、品牌色（hex值与中文色名，来自colorPalette，如 #2F5233 深绿、#8C6B3F 暖棕、#C9A227 金橙）、视觉风格关键词（取自visualStyleSuggestion）与品牌LOGO呈现要求（清晰印制），供管理员在AI档案区阅读核签；禁止只写物料短标题或场景短描述。
{
  "analysisTemplateVersion": "024-connotation-1",
  "brandEssence": "品牌本质：定位+个性+人群的高度凝练，一句话（不是行业词堆砌）",
  "storyHook": "故事钩子：1-2 句能让人记住的卖点叙事/记忆点（产地背书/工艺/人群情绪）",
  "symbolSystem": [
    {"symbol": "核心图形符号（如：椰树/海浪/太阳/哑铃）", "businessReason": "商业理由：为什么要这个符号"}
  ],
  "colorSystem": [
    {"name": "品牌主色", "hex": "#RRGGBB", "role": "主色/辅助/强调", "meaning": "商业含义（为什么是它）", "usage": "用在哪（主标识/背景/点缀）"}
  ],
  "fontHierarchy": {
    "display": "品牌标识字（如：定制手绘笔触体）",
    "subhead": "口号/副标语字（如：现代圆体，亲和）",
    "body": "正文/通用（思源黑体 / Montserrat）",
    "usage": "字体分级理由（为什么这样分级）"
  },
  "logoConcept": "从品牌定位推导出的 LOGO 概念：主图形符号 + 构图形式 + 为什么这样设计（商业理由），非模板套话",
  "industryInsight": "行业洞察内容，2-3句话",
  "geoEnvironment": "地理环境分析，2-3句话",
  "competitiveLandscape": "竞品格局，2-3句话",
  "brandPositioning": "品牌定位建议，2-3句话",
  "refinedBrandVision": "AI提炼/补充的品牌愿景，一句话",
  "refinedCoreValues": "AI提炼/补充的核心价值，逗号分隔",
  "refinedTargetMarket": "AI细化/补充的目标市场，一句话",
  "brandToneKeywords": ["关键词1", "关键词2", "关键词3"],
  "visualStyleSuggestion": "视觉风格建议，2-3句话",
  "sceneImageSuggestions": [
    {"zh": "专业品牌应用摄影：【行业物料+使用场景，必须替换为具体贴合描述，如 足浴会员卡放在干净木柜台上、筷子套摆在餐桌上、水果贴纸贴在果篮上】，品牌色（品牌色hex与中文色名，取自colorPalette，如 #2F5233 深绿、#8C6B3F 暖棕、#C9A227 金橙），【视觉风格关键词，取自visualStyleSuggestion，如 中式养生、温润禅意、专业可信的实景风格】，品牌 LOGO 清晰印制，影棚灯光，产品完整可见", "en": "Professional brand application photography of a [行业物料+使用场景，必须替换为具体贴合描述，如 foot spa membership card on a clean wooden counter], in brand colors (品牌色hex，取自colorPalette), [视觉风格关键词，取自visualStyleSuggestion], with the brand logo printed clearly, studio lighting, product fully visible", "targetAudience": "该场景对准的人群/卖点"},
    {"zh": "专业品牌应用摄影：【行业物料+使用场景，必须替换为具体贴合描述，如 社区门店招牌、外卖袋、手提袋】，品牌色（品牌色hex与中文色名，取自colorPalette，如 #2F5233 深绿、#8C6B3F 暖棕、#C9A227 金橙），【视觉风格关键词，取自visualStyleSuggestion，如 中式养生、温润禅意、专业可信的实景风格】，品牌 LOGO 清晰印制，影棚灯光，产品完整可见", "en": "Professional brand application photography of a [行业物料+使用场景，必须替换为具体贴合描述], in brand colors (品牌色hex，取自colorPalette), [视觉风格关键词，取自visualStyleSuggestion], with the brand logo printed clearly, studio lighting, product fully visible", "targetAudience": "该场景对准的人群/卖点"},
    {"zh": "专业品牌应用摄影：【行业物料+使用场景，必须替换为具体贴合描述，如 足疗宣传海报贴在店内墙面、果篮包装、甲油瓶贴】，品牌色（品牌色hex与中文色名，取自colorPalette，如 #2F5233 深绿、#8C6B3F 暖棕、#C9A227 金橙），【视觉风格关键词，取自visualStyleSuggestion，如 中式养生、温润禅意、专业可信的实景风格】，品牌 LOGO 清晰印制，影棚灯光，产品完整可见", "en": "Professional brand application photography of a [行业物料+使用场景，必须替换为具体贴合描述], in brand colors (品牌色hex，取自colorPalette), [视觉风格关键词，取自visualStyleSuggestion], with the brand logo printed clearly, studio lighting, product fully visible", "targetAudience": "该场景对准的人群/卖点"},
    {"zh": "专业品牌应用摄影：【行业物料+使用场景，必须替换为具体贴合描述，如 前台价目表、桌牌、店面招牌】，品牌色（品牌色hex与中文色名，取自colorPalette，如 #2F5233 深绿、#8C6B3F 暖棕、#C9A227 金橙），【视觉风格关键词，取自visualStyleSuggestion，如 中式养生、温润禅意、专业可信的实景风格】，品牌 LOGO 清晰印制，影棚灯光，产品完整可见", "en": "Professional brand application photography of a [行业物料+使用场景，必须替换为具体贴合描述], in brand colors (品牌色hex，取自colorPalette), [视觉风格关键词，取自visualStyleSuggestion], with the brand logo printed clearly, studio lighting, product fully visible", "targetAudience": "该场景对准的人群/卖点"},
    {"zh": "专业品牌应用摄影：【行业物料+使用场景，必须替换为具体贴合描述，如 技师工服/员工围裙、员工围裙、营销海报】，品牌色（品牌色hex与中文色名，取自colorPalette，如 #2F5233 深绿、#8C6B3F 暖棕、#C9A227 金橙），【视觉风格关键词，取自visualStyleSuggestion，如 中式养生、温润禅意、专业可信的实景风格】，品牌 LOGO 清晰印制，影棚灯光，产品完整可见", "en": "Professional brand application photography of a [行业物料+使用场景，必须替换为具体贴合描述], in brand colors (品牌色hex，取自colorPalette), [视觉风格关键词，取自visualStyleSuggestion], with the brand logo printed clearly, studio lighting, product fully visible", "targetAudience": "该场景对准的人群/卖点"}
  ],
  "sceneSectionTitles": {
    "stationery": "【该行业应用系统标题，如餐饮→餐饮应用系统、水果→生鲜应用系统、洗车→洗车应用系统】",
    "packaging": "【该行业包装系统标题，如餐饮→餐饮包装系统、水果→生鲜包装系统、洗车→洗车包装系统】",
    "marketing": "【该行业营销系统标题，如餐饮→餐饮营销系统、水果→生鲜营销系统、洗车→洗车营销系统】"
  },
  "logoDesignSuggestions": {
    "note": "IMPORTANT: 四条 prompts 必须全部用中文撰写，每条提示词都必须把客户品牌名（公司名称字段）原样写入并以品牌中文清晰为主视觉；默认现代简约/扁平/白色背景；若品牌调性适合，允许传统印章/篆书/仿古风格选项，但品牌中文必须逐字清晰正确（无错字无叠字）并过核字门；必须明确要求每个字只出现一次、无重复、无多余文字、无错字；严禁使用“大字”“粗壮”“横平竖直”等强调放大文字的措辞。模板中的 XXX 必须替换为公司名称字段中的真实品牌名，不得原样输出 XXX。禁止把地名或行业词当作品牌标识，品牌名是唯一主角。",
    "concept": "Logo设计理念详述：3-5句话，需说明（1）品牌名含义与视觉转化逻辑（2）核心图形元素的选择理由（3）造型与品牌调性的呼应关系（4）整体传达的情感与识别价值",
    "style": "设计风格（如：传统书法、现代简约、国潮、手绘等）",
    "elements": "建议包含的设计元素（图形、符号、字体风格）",
    "colorGuidance": "配色建议，需与品牌色协调",
    "prompts": [
      "品牌Logo设计：现代简约品牌标志，中文品牌名「XXX」清晰写在画面中央为主视觉，简洁扁平风格，字距均匀、每个字只出现一次、无错字无重复，干净白色背景，居中构图，默认现代简约/扁平；若品牌调性适合可选用传统印章/篆书风格，但品牌中文必须逐字清晰正确、无错字无叠字，且无多余装饰文字",
      "品牌Logo设计：极简现代品牌标志，中央清晰呈现中文品牌名「XXX」，简洁扁平、易识别，文字清晰完整、无重叠无重复，白色背景居中排版，默认现代简约/扁平；若品牌调性适合可选用传统印章/篆书风格，但品牌中文必须逐字清晰正确、无错字无叠字，且无环形排列与多余文字",
      "品牌Logo设计：现代扁平品牌标志，中文品牌名「XXX」为画面主体，简单干净、留白充足，字字独立、笔画完整、不重复不多字，白色背景，居中构图，默认现代简约/扁平；若品牌调性适合可选用传统印章/篆书风格，但品牌中文必须逐字清晰正确、无错字无叠字，且无多余仿古装饰",
      "品牌Logo设计：简洁扁平风格的中文品牌标志，画面中央清晰展示中文品牌名「XXX」，字迹清楚、无重复无多余文字，白色背景，居中构图，默认现代简约/扁平；若品牌调性适合可选用传统印章/篆书风格，但品牌中文必须逐字清晰正确、无错字无叠字，且无多余装饰"
    ]
  },
  "fontSuggestions": {
    "chinese": {
      "title": {"font": "思源黑体", "weight": "Bold"},
      "body": {"font": "思源黑体", "weight": "Regular"}
    },
    "english": {
      "title": {"font": "Montserrat", "weight": "Bold"},
      "body": {"font": "Montserrat", "weight": "Regular"}
    },
    "numbersAndPrices": {"font": "思源黑体", "weight": "Bold"},
    "copyrightInfo": "字体版权声明，中文推荐思源黑体/阿里巴巴普惠体等免费商用字体，英文推荐Montserrat/Inter等SIL Open Font License字体"
  },
  "colorPalette": [
    {"name": "品牌主色", "nameEn": "Primary", "hex": "#37474F", "oklch": "oklch(0.40 0.02 220)", "rgb": "rgb(55,71,79)", "cmyk": "cmyk(0,0,0,70)", "pantone": "Pantone 432 C", "meaning": "该色彩与品牌定位/行业特征的关联说明，1-2句话"},
    {"name": "辅助色", "nameEn": "Secondary", "hex": "#78909C", "oklch": "oklch(0.55 0.04 220)", "rgb": "rgb(120,144,156)", "cmyk": "cmyk(20,5,0,40)", "pantone": "Pantone 5493 C", "meaning": "该色彩与品牌定位/行业特征的关联说明，1-2句话"},
    {"name": "强调色", "nameEn": "Accent", "hex": "#FF6F00", "oklch": "oklch(0.70 0.18 60)", "rgb": "rgb(255,111,0)", "cmyk": "cmyk(0,55,100,0)", "pantone": "Pantone 151 C", "meaning": "该色彩与品牌定位/行业特征的关联说明，1-2句话"}
  ],
  "aiGeneratedFields": {
    "brandVision": "如果客户没写，AI代写的品牌愿景；如果已写，留空",
    "coreValues": "如果客户没写，AI代写的核心价值；如果已写，留空",
    "targetMarket": "如果客户没写，AI代写的目标市场；如果已写，留空"
  },
  "regionalAssets": {
    "regionalMindset": "提炼1-3个大众认知最强地域标签，如北纬18度黄金产区、千年瓷都、天府粮仓等，不能是通用套话",
    "visualSymbols": [
      {"element": "地域标志元素名", "style": "视觉风格（如简约线条风/水彩渐变/剪影）", "applyTo": "落位VI模块（辅助图形/包装底纹/Logo装饰元素）"}
    ],
    "endorsementCopy": [
      "产地背书文案，可直接用于包装/宣传",
      "第二句背书文案"
    ],
    "applicationScenarios": ["辅助图形", "包装卖点区", "营销物料背书"]
  },
}`,
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 16384,},
      timeoutMs: 45000,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`DeepSeek error: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    // 解析JSON
    let profile: any;
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      profile = JSON.parse(cleaned);
    } catch {
      console.warn("[brand-analysis] Failed to parse AI response:", content.substring(0, 200));
      return NextResponse.json({ error: "Failed to parse AI analysis" }, { status: 422 });
    }

    console.log("[brand-analysis] Analysis complete:", profile.brandToneKeywords);

    // V55: 复用existingCI（已在开头查询），不再重复查projects
    const updatedInfo = {
      ...existingCI,
      // 原始客户信息
      companyName: clientInfo.companyName || existingCI.companyName,
      industry: clientInfo.industry || existingCI.industry,
      province: clientInfo.province || existingCI.province,
      city: clientInfo.city || existingCI.city,
      brandVision: clientInfo.brandVision || existingCI.brandVision,
      coreValues: clientInfo.coreValues || existingCI.coreValues,
      targetMarket: clientInfo.targetMarket || existingCI.targetMarket,
      logoPhilosophy: clientInfo.logoPhilosophy || existingCI.logoPhilosophy,
      mascotPhilosophy: clientInfo.mascotPhilosophy || existingCI.mascotPhilosophy,
      description: clientInfo.description || existingCI.description,
      // AI品牌档案
      brandProfile: {
        // Preserve existing brandProfile fields (e.g. logoGenerationResults) before overwriting
        ...(existingCI.brandProfile || {}),
        industryInsight: profile.industryInsight || "",
        geoEnvironment: profile.geoEnvironment || "",
        competitiveLandscape: profile.competitiveLandscape || "",
        brandPositioning: profile.brandPositioning || "",
        refinedBrandVision: profile.refinedBrandVision || "",
        refinedCoreValues: profile.refinedCoreValues || "",
        refinedTargetMarket: profile.refinedTargetMarket || "",
        brandToneKeywords: profile.brandToneKeywords || [],
        visualStyleSuggestion: profile.visualStyleSuggestion || "",
        sceneImageSuggestions: profile.sceneImageSuggestions || [],
        sceneSectionTitles: profile.sceneSectionTitles || null,
        logoDesignSuggestions: profile.logoDesignSuggestions || null,
        analysisTemplateVersion: BRAND_ANALYSIS_TEMPLATE_VERSION,
        fontSuggestions: profile.fontSuggestions || null,
        colorPalette: profile.colorPalette || null,  // V103: 保存AI色彩方案
        aiGeneratedFields: profile.aiGeneratedFields || {},
        regionalAssets: profile.regionalAssets || null,
        analysisStatus: "completed",
        analyzedAt: new Date().toISOString(),
      },
    };

    // V55: 合并status和client_info为一次update（原Query6+7→1次）
    const { error: dbError } = await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, status: "brand_analyzed", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (dbError) {
      console.warn("[brand-analysis] DB save failed:", dbError.message);
      return NextResponse.json({ error: "Failed to save brand analysis to database" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        submissionId,
        projectId,
      },
    });
  } catch (error) {
    console.error("[brand-analysis] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Brand analysis failed",
    }, { status: 500 });
  }
}

function buildAnalysisPrompt(clientInfo: any): string {
  const parts = [
    `## 客户品牌基础信息`,
    ``,
    `公司名称：${clientInfo.companyName || "未提供"}`,
    `所属行业：${clientInfo.industry || "未提供"}`,
  ];

  if (clientInfo.province || clientInfo.city) {
    parts.push(`所在地：${clientInfo.province || ""}${clientInfo.city || ""}`);
  }

  parts.push("");
  parts.push("### 客户已填写的品牌信息（有则保留润色，无则AI代写）：");

  if (clientInfo.subIndustry) {
    parts.push("细分业态：" + clientInfo.subIndustry);
  }
  if (clientInfo.brandVision) {
    parts.push(`品牌愿景：${clientInfo.brandVision}`);
  } else {
    parts.push(`品牌愿景：（客户未填写，请AI代写）`);
  }

  if (clientInfo.coreValues) {
    parts.push(`核心价值：${clientInfo.coreValues}`);
  } else {
    parts.push(`核心价值：（客户未填写，请AI代写）`);
  }

  if (clientInfo.targetMarket) {
    parts.push(`目标市场：${clientInfo.targetMarket}`);
  } else {
    parts.push(`目标市场：（客户未填写，请AI代写）`);
  }

  if (clientInfo.logoPhilosophy) {
    parts.push(`LOGO设计理念：${clientInfo.logoPhilosophy}`);
  }

  if (clientInfo.mascotPhilosophy) {
    parts.push(`IP公仔设计理念：${clientInfo.mascotPhilosophy}`);
  }

  if (clientInfo.brandColors) {
    const bc = clientInfo.brandColors;
    parts.push(`品牌色：${bc.primary || "未定"} / ${bc.secondary || "未定"} / ${bc.accent || "未定"}`);
  }

  if (clientInfo.brandPersonality) {
    parts.push(`品牌个性：${clientInfo.brandPersonality}`);
  }
  if (clientInfo.logoStyle) {
    parts.push(`Logo图形偏好：${clientInfo.logoStyle}`);
  }
  if (clientInfo.logoUsage) {
    parts.push(`Logo主要用途：${clientInfo.logoUsage}`);
  }
  if (clientInfo.avoidElements) {
    parts.push(`设计禁忌（避免出现）：${clientInfo.avoidElements}`);
  }
  if (clientInfo.existingSignagePain) {
    parts.push(`现有门头最不满意：${clientInfo.existingSignagePain}`);
  }
  if (clientInfo.existingBrandColor) {
    parts.push(`现有门头颜色：${clientInfo.existingBrandColor}`);
  }
  if (clientInfo.competitorReference) {
    parts.push(`喜欢的竞品/参考品牌：${clientInfo.competitorReference}`);
  }
  if (clientInfo.customerProfile) {
    parts.push(`常见客户群体：${clientInfo.customerProfile}`);
  }
  if (clientInfo.brandHighlight) {
    parts.push(`品牌独特点：${clientInfo.brandHighlight}`);
  }
  if (clientInfo.businessForm) {
    parts.push(`经营形态：${clientInfo.businessForm}`);
  }
  if (clientInfo.budgetRange) {
    parts.push(`预算范围：${clientInfo.budgetRange}`);
  }
  if (clientInfo.businessYears) {
    parts.push(`经营年限：${clientInfo.businessYears}年`);
  }
  if (clientInfo.mainProducts) {
    parts.push(`主营产品：${clientInfo.mainProducts}`);
  }
  if (clientInfo.description) {
    parts.push(`补充描述：${clientInfo.description}`);
  }

  parts.push("");
  parts.push("请基于以上信息，进行深度品牌分析，输出品牌档案JSON。");

  return parts.join("\n");
}

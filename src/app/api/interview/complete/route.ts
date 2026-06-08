// API Route: POST /api/interview/complete
// 访谈结束后提取结构化数据 → 写入Supabase → 返回submissionId
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

const EXTRACTION_PROMPT = `你是品牌分析师。根据以下品牌访谈对话记录，提取结构化品牌信息。

必须以JSON格式返回，字段如下：
{
  "companyName": "店铺/公司名称",
  "industry": "行业（格式：一级大类:二级分类，从以下选择：美食:中餐厅、美食:火锅、美食:小吃快餐、美食:烧烤、美食:面包甜点、美食:海鲜、美食:茶餐厅、美食:外国餐厅、美食:清真、美食:其他美食、饮品:奶茶/茶饮、饮品:咖啡、饮品:酒/酒吧、饮品:果汁/冷饮、饮品:其他饮品、丽人:美容SPA、丽人:美发、丽人:美甲美睫、丽人:瘦身纤体、丽人:其他丽人、购物:服装鞋帽、购物:便利店/超市、购物:母婴儿童、购物:珠宝饰品、购物:数码家电、购物:家居建材、购物:其他购物、生活服务:婚庆摄影、生活服务:家政维修、生活服务:宠物服务、生活服务:中介/咨询、生活服务:洗衣/维修、生活服务:其他生活服务、休闲娱乐:KTV/酒吧、休闲娱乐:网吧/棋牌、休闲娱乐:洗浴足疗、休闲娱乐:电影院、休闲娱乐:其他休闲娱乐、运动健身:健身中心、运动健身:瑜伽/舞蹈、运动健身:球类场馆、运动健身:武术搏击、运动健身:其他运动健身、教育培训:课外辅导、教育培训:才艺培训、教育培训:职业培训、教育培训:幼儿教育、教育培训:其他教育、医疗保健:诊所/中医馆、医疗保健:药店、医疗保健:养生馆、医疗保健:体检/口腔、医疗保健:其他医疗、汽车服务:汽修/洗车、汽车服务:汽车美容、汽车服务:驾校、汽车服务:其他汽车服务、公司企业:工厂/制造、公司企业:公司/办公、公司企业:农林牧渔、公司企业:其他公司企业、其他）",
  "businessForm": "经营形态（从以下选择：路边摊/档口、小店/夫妻店、门店/商铺、连锁/品牌、高端/精品，无法判断则填空字符串）",
  "province": "省份（如：四川省）",
  "city": "城市（如：成都市）",
  "brandVision": "品牌愿景（基于访谈内容提炼，50-200字）",
  "coreValues": "核心价值（基于访谈内容提炼，50-500字）",
  "targetMarket": "目标市场（基于访谈内容提炼，50-500字）",
  "brandColors": {"primary": "#hex或null", "secondary": "#hex或null", "accent": "#hex或null"},
  "logoPhilosophy": "LOGO设计理念（如有提及）",
  "mascotPhilosophy": "IP公仔设计理念（如有提及）",
  "description": "访谈摘要（200字以内，包含经营年限、特色、品牌色倾向等关键信息）",
  "mainProducts": "主营产品/服务（如：汉堡、奶茶、川菜、少儿英语培训）"
}

规则：
1. 行业必须从给定选项中选择，格式为"一级:二级"，不要自创
2. 经营形态根据对话推断，如提到"路边摊"或"档口"则选路边摊/档口，提到"开了个小店"选小店/夫妻店
3. 省市从对话中推断（如提到"我的面馆在成都开了20年"→四川省、成都市），无法推断则填空字符串
3. 品牌色根据对话中提到的颜色倾向推断，未提及则填null
4. 只返回JSON，不要任何其他文字`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || messages.length < 2) {
      return NextResponse.json({ error: "对话记录不足" }, { status: 400 });
    }

    let extracted: Record<string, any> = {};

    // Try DeepSeek extraction
    if (DEEPSEEK_API_KEY) {
      try {
        const chatMessages = [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: JSON.stringify(messages) },
        ];

        const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: chatMessages,
            max_tokens: 800,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || "";
          // Extract JSON from response (may have markdown code block)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extracted = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (e) {
        console.warn("[INTERVIEW-COMPLETE] DeepSeek extraction failed:", e);
      }
    }

    // Build submission data with fallbacks
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const submissionId = `SBM-${dateStr}-${String(Date.now()).slice(-4)}`;
    const projectId = `VI-${dateStr}-${rand}`;
    const isoNow = now.toISOString();

    const submissionData = {
      id: submissionId,
      client_name: extracted.companyName || "",
      company_name: extracted.companyName || "",
      brand_vision: extracted.brandVision || "",
      core_values: extracted.coreValues || "",
      target_market: extracted.targetMarket || "",
      logo_philosophy: extracted.logoPhilosophy || "",
      mascot_philosophy: extracted.mascotPhilosophy || "",
      phone: "",
      wechat: "",
      email: "",
      industry: extracted.industry || "",
      businessForm: extracted.businessForm || "",
      budget_range: "",
      province: extracted.province || "",
      city: extracted.city || "",
      description: extracted.description || "",
      logo_assets: [],
      mascot_assets: [],
      submitted_at: isoNow,
      status: "submitted", // 标记为访谈来源
    };

    const viewPassword = generateViewPassword();
    const projectData = {
      id: projectId,
      submission_id: submissionId,
      status: "submitted",
      brand_colors: extracted.brandColors || null,
      client_info: {
        viewPassword,
        mainProducts: extracted.mainProducts || "",
      },
      created_at: isoNow,
      updated_at: isoNow,
    };

    // Write to Supabase
    let supabaseOk = false;
    try {
      const { error: subErr } = await supabaseAdmin.from("submissions").insert(submissionData);
      if (subErr) {
        console.warn("[INTERVIEW-COMPLETE] Supabase submission error:", subErr.message);
      } else {
        const { error: projErr } = await supabaseAdmin.from("projects").insert(projectData);
        if (projErr) console.warn("[INTERVIEW-COMPLETE] Supabase project error:", projErr.message);
        else supabaseOk = true;
      }
    } catch (e) {
      console.warn("[INTERVIEW-COMPLETE] Supabase write failed:", e);
    }

    return NextResponse.json({
      success: true,
      submissionId,
      projectId,
      extracted,
      viewPassword,
      supabaseOk,
    });
  } catch (error) {
    console.error("[INTERVIEW-COMPLETE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// Generate 6-digit view password for client
function generateViewPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pwd = "";
  for (let i = 0; i < 6; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

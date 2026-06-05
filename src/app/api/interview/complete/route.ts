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
  "industry": "行业（从以下选择：科技/互联网、餐饮/食品、零售/电商、教育/培训、医疗/健康、金融/法律、文化/传媒、制造业、其他）",
  "province": "省份（如：四川省）",
  "city": "城市（如：成都市）",
  "brandVision": "品牌愿景（基于访谈内容提炼，50-200字）",
  "coreValues": "核心价值（基于访谈内容提炼，50-500字）",
  "targetMarket": "目标市场（基于访谈内容提炼，50-500字）",
  "brandColors": {"primary": "#hex或null", "secondary": "#hex或null", "accent": "#hex或null"},
  "logoPhilosophy": "LOGO设计理念（如有提及）",
  "mascotPhilosophy": "IP公仔设计理念（如有提及）",
  "description": "访谈摘要（200字以内，包含经营年限、特色、品牌色倾向等关键信息）"
}

规则：
1. 行业必须从给定选项中选择，不要自创
2. 省市从对话中推断（如提到"我的面馆在成都开了20年"→四川省、成都市），无法推断则填空字符串
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
      budget_range: "",
      province: extracted.province || "",
      city: extracted.city || "",
      description: extracted.description || "",
      logo_assets: [],
      mascot_assets: [],
      submitted_at: isoNow,
      status: "interviewed", // 标记为访谈来源
    };

    const projectData = {
      id: projectId,
      submission_id: submissionId,
      status: "interviewed",
      brand_colors: extracted.brandColors || null,
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

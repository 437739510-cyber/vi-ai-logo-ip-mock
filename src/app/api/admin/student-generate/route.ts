// API Route: POST /api/admin/student-generate
// 大学生为老板的内容触发AI文案生成
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { cookies } from "next/headers";
import { guardedDeepSeekCall } from '@/lib/core/billing/deepseek-guard';

const ALIYUN_API = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get("admin_role")?.value;
    const userId = cookieStore.get("admin_user_id")?.value;

    if (role !== "student" || !userId) {
      return NextResponse.json({ success: false, error: "仅大学生可操作" }, { status: 403 });
    }

    const { contentId, platform = "xiaohongshu" } = await req.json();
    if (!contentId) {
      return NextResponse.json({ success: false, error: "缺少contentId" }, { status: 400 });
    }

    // 获取内容记录（只允许操作自己创建的）
    const { data: content } = await supabaseAdmin
      .from("member_contents")
      .select("*")
      .eq("id", contentId)
      .eq("student_id", userId)
      .single();

    if (!content) {
      return NextResponse.json({ success: false, error: "内容不存在" }, { status: 404 });
    }

    // 更新状态为"生成中"
    await supabaseAdmin.from("member_contents").update({ status: "processing" }).eq("id", contentId);

    // Step 1: 识别照片内容
    const imageUrls: string[] = content.images || [];
    let photoDescriptions: string[] = [];
    let vlCost = 0;  // V89: qwen-vl成本累计

    if (imageUrls.length > 0 && process.env.ALIYUN_API_KEY) {
      for (const url of imageUrls.slice(0, 6)) {
        if (url.startsWith("pending_")) continue;
        try {
          const { desc, cost } = await analyzeImage(url);
          if (desc) photoDescriptions.push(desc);
          vlCost += cost;
        } catch (e) {
          console.error("[student-generate] Vision error for", url, e);
        }
      }
    }

    // Step 2: 获取品牌数据（通过member_id -> phone -> submissions）
    const { data: member } = await supabaseAdmin
      .from("members")
      .select("id, phone")
      .eq("id", content.member_id)
      .single();

    let brand = null;
    if (member?.phone) {
      const { data: submissions } = await supabaseAdmin
        .from("submissions")
        .select("company_name, industry, brand_highlight, target_market, core_values, customer_profile, main_products, existing_brand_color")
        .eq("phone", member.phone)
        .limit(5);
      brand = submissions && submissions.length > 0 ? submissions[0] : null;
    }

    // Step 3: 生成文案
    const caption = await generateCaption(brand, photoDescriptions, content.note, platform);

    // 更新内容记录
    await supabaseAdmin.from("member_contents").update({
      caption: caption.text,
      status: "ready",
      platform: platform,
    }).eq("id", contentId);

    // V89: 写入qwen-vl成本到api_usage_log
    if (vlCost > 0) {
      supabaseAdmin.from("api_usage_log").insert({
        route: "admin/student-generate",
        method: "POST",
        model: "qwen-vl-plus",
        cost_cny: vlCost,
        request_summary: `${photoDescriptions.length}张图片识别`,
        response_status: 200,
      }).then(() => {}, () => {});
    }

    return NextResponse.json({
      success: true,
      caption: caption.text,
      tags: caption.tags,
      photoDescriptions,
      platform,
    });
  } catch (err: any) {
    console.error("[student-generate] Error:", err);
    return NextResponse.json({ success: false, error: "生成失败" }, { status: 500 });
  }
}

async function analyzeImage(imageUrl: string): Promise<{desc: string; cost: number}> {
  const apiKey = process.env.ALIYUN_API_KEY;
  const res = await fetch(ALIYUN_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "qwen-vl-plus",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          { type: "text", text: "请简洁描述这张照片的内容，包括：场景、人物、产品、氛围。50字以内。" },
        ],
      }],
      max_tokens: 150,
    }),
  });

  const data = await res.json();
  // V89: qwen-vl-plus成本追踪 (输入¥0.003/1K + 输出¥0.006/1K)
  const usage = data?.usage;
  const inputCost = ((usage?.prompt_tokens || 300) / 1000) * 0.003;
  const outputCost = ((usage?.completion_tokens || 80) / 1000) * 0.006;
  const cost = parseFloat((inputCost + outputCost).toFixed(6));
  return { desc: data.choices?.[0]?.message?.content || "", cost };
}

async function generateCaption(
  brand: any,
  photoDescs: string[],
  note: string,
  platform: string
): Promise<{ text: string; tags: string[] }> {
  const brandContext = brand
    ? `品牌名：${brand.company_name || "未知"}\n行业：${brand.industry || "未知"}\n主营产品：${brand.main_products || "未知"}\n品牌亮点：${brand.brand_highlight || "未知"}\n目标客户：${brand.customer_profile || "未知"}\n核心价值：${brand.core_values || "未知"}`
    : "暂无品牌数据";

  const photoContext = photoDescs.length > 0
    ? `\n\n照片内容描述：\n${photoDescs.map((d, i) => `图${i + 1}: ${d}`).join("\n")}`
    : "\n\n（无照片描述）";

  const platformStyle: Record<string, string> = {
    xiaohongshu: "小红书风格：活泼、emoji丰富、种草感强、标题吸睛、结尾加话题标签#",
    wechat: "朋友圈风格：亲切口语化、像朋友分享、简短有温度",
    douyin: "抖音风格：短平快、有节奏感、适合短视频配文",
  };

  const prompt = `你是一个专业的社交媒体文案写手，帮实体店铺老板写推广文案。

品牌信息：
${brandContext}
${photoContext}

老板备注：${note || "无"}

请生成一段${platformStyle[platform] || platformStyle.xiaohongshu}的文案。
要求：
1. 紧贴照片实际内容和店铺特色
2. 有吸引力，让人想来
3. 文案80-200字
4. 返回JSON格式：{"text": "文案内容", "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"]}

只返回JSON，不要其他内容。`;

  try {
    const res = await guardedDeepSeekCall({
      route: "admin/student-generate",
      body: {
        model: "deepseek-v4-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      },
      timeoutMs: 60000,
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
      return { text: parsed.text || text, tags: parsed.tags || [] };
    } catch {
      return { text, tags: [] };
    }
  } catch (e) {
    console.error("[student-generate] DeepSeek error:", e);
    const name = brand?.company_name || "我们店";
    const product = brand?.main_products || "招牌好物";
    return {
      text: `✨${name}来啦！\n\n${note || "今日推荐"}——${product}，${brand?.brand_highlight || "品质保证"}！\n\n每一口都是用心做的味道😋\n\n#${name} #${product} #好店推荐 #探店 #必吃榜`,
      tags: [name, product, "好店推荐", "探店", "必吃榜"],
    };
  }
}

export const dynamic = "force-dynamic"
// API Route: POST /api/member/generate
// AI文案生成：照片识别(qwen-vl) + 品牌数据 + DeepSeek生成社交媒体文案
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { cookies } from "next/headers";
import { guardedDeepSeekCall, DEEPSEEK_MODEL } from '@/lib/core/billing/deepseek-guard';
import { checkMemberQuota, consumeMemberQuota } from "@/lib/brand-steward";

const ALIYUN_API = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    // 验证登录
    const cookieStore = await cookies();
    const token = cookieStore.get("member_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });

    const { data: session } = await supabaseAdmin
      .from("member_sessions").select("member_id").eq("token", token).single();
    if (!session) return NextResponse.json({ success: false, error: "session无效" }, { status: 401 });

    const { data: member } = await supabaseAdmin
      .from("members").select("id, phone, plan, quota_used, quota_total").eq("id", session.member_id).single();
    if (!member) return NextResponse.json({ success: false, error: "用户不存在" }, { status: 401 });

    // 检查配额（TICKET-122-R23：订阅状态机接入——到期/暂停直接拒绝）
    const quota = await checkMemberQuota(supabaseAdmin, member.id);
    if (!quota.allowed) {
      const isFree = quota.member?.plan === "free" || !quota.member?.plan;
      return NextResponse.json({
        success: false,
        error: quota.reason === "exhausted"
          ? (isFree ? "免费体验已用完，开通会员¥199/月" : "本月配额已用完")
          : quota.message,
        needUpgrade: quota.needUpgrade,
      }, { status: 400 });
    }

    const body = await req.json();
    const { contentId, platform = "xiaohongshu" } = body;
    if (!contentId) return NextResponse.json({ success: false, error: "缺少contentId" }, { status: 400 });

    // 获取内容记录
    const { data: content } = await supabaseAdmin
      .from("member_contents").select("*").eq("id", contentId).eq("member_id", member.id).single();
    if (!content) return NextResponse.json({ success: false, error: "内容不存在" }, { status: 404 });

    // 更新状态为"制作中"
    await supabaseAdmin.from("member_contents").update({ status: "processing" }).eq("id", contentId);

    // Step 1: 识别照片内容（qwen-vl）
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
          console.error("[member/generate] Vision error for", url, e);
        }
      }
    }

    // Step 2: 获取品牌数据
    const { data: submissions } = await supabaseAdmin
      .from("submissions")
      .select("company_name, industry, brand_highlight, target_market, core_values, customer_profile, main_products, existing_brand_color")
      .eq("phone", member.phone)
      .limit(5);

    const brand = submissions && submissions.length > 0 ? submissions[0] : null;

    // Step 3: 生成文案（DeepSeek）
    const caption = await generateCaption(brand, photoDescriptions, content.note, platform);

    // 更新内容记录
    await supabaseAdmin.from("member_contents").update({
      caption: caption.text,
      status: "ready",
      platform: platform,
    }).eq("id", contentId);

    // 扣配额（TICKET-122-R23：走订阅感知服务层，保持既有扣减语义）
    await consumeMemberQuota(supabaseAdmin, member.id);

    // V89: 写入qwen-vl成本到api_usage_log
    if (vlCost > 0) {
      supabaseAdmin.from("api_usage_log").insert({
        route: "member/generate",
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
    console.error("[member/generate] Error:", err);
    return NextResponse.json({ success: false, error: "生成失败" }, { status: 500 });
  }
}

// 用qwen-vl识别照片内容
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

// 用DeepSeek生成社交媒体文案
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
      route: "member/generate",
      body: {model: DEEPSEEK_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.8,},
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
    console.error("[member/generate] DeepSeek error:", e);
    return fallbackCaption(brand, note, photoDescs, platform);
  }
}

function fallbackCaption(brand: any, note: string, photoDescs: string[], platform: string): { text: string; tags: string[] } {
  const name = brand?.company_name || "我们店";
  const product = brand?.main_products || "招牌好物";
  const highlight = brand?.brand_highlight || "品质保证";
  const tags = [name, product, "好店推荐", "探店", "必吃榜"];

  if (platform === "wechat") {
    return { text: `今天${note || "新鲜出炉"}🤤 ${name}的${product}，${highlight}！`, tags };
  }
  if (platform === "douyin") {
    return { text: `${name}｜${product} ${highlight}🔥 ${note || "限时推荐"}`, tags };
  }
  return {
    text: `✨${name}来啦！\n\n${note || "今日推荐"}——${product}，${highlight}！\n\n每一口都是用心做的味道😋\n\n${tags.map(t => `#${t}`).join(" ")}`,
    tags,
  };
}

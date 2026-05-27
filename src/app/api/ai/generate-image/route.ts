// API Route: POST /api/ai/generate-image - wan2.6 sync via multimodal-generation
import { NextRequest, NextResponse } from "next/server";

// 閫氫箟涓囩浉 wan2.6 - 鍚屾璋冪敤
const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ALIYUN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ALIYUN_API_KEY not set" }, { status: 500 });
    }

    const params = await req.json();
    const prompt = params.prompt || "test";
    const size = params.size || "1024*1024";
    const seed = Math.floor(Math.random() * 999999);

    const body = {
      model: "wan2.6-t2i",
      input: {
        messages: [{
          role: "user",
          content: [{ text: prompt }]
        }]
      },
      parameters: {
        size: size,
        n: 1,
        seed: seed,
      },
    };

    const resp = await fetch(DASHSCOPE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const rawText = await resp.text();

    if (!resp.ok) {
      return NextResponse.json({ error: `DashScope ${resp.status}`, detail: rawText.substring(0, 500) }, { status: 500 });
    }

    let data;
    try { data = JSON.parse(rawText); } catch {
      return NextResponse.json({ error: "JSON parse failed", detail: rawText.substring(0, 500) }, { status: 500 });
    }

    // Sync result (wan2.6 returns choices format)
    const imgUrl = data.output?.choices?.[0]?.message?.content?.find((c: any) => c.type === "image")?.image;
    if (imgUrl) return NextResponse.json({ images: [imgUrl], seed });
    
    // Alternative: results format (wan2.5)
    if (data.output?.results) {
      const images = data.output.results
        .map((r: any) => r.image_url || r.b64_image)
        .filter(Boolean);
      if (images.length > 0) return NextResponse.json({ images, seed });
    }

    // Fallback: async polling (if wan2.6 falls back to async)
    if (data.output?.task_id) {
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const tr = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${data.output.task_id}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!tr.ok) continue;
          const td = JSON.parse(await tr.text());
          if (td.output?.task_status === "SUCCEEDED") {
            const u = td.output?.results?.[0]?.image_url;
            if (u) return NextResponse.json({ images: [u], seed });
          }
          if (td.output?.task_status === "FAILED") break;
        } catch { continue; }
      }
      return NextResponse.json({ error: "Task timeout", raw: rawText.substring(0, 200) }, { status: 500 });
    }

    return NextResponse.json({ error: "Unexpected response", raw: rawText.substring(0, 300) }, { status: 500 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Exception", detail: msg }, { status: 500 });
  }
}

import { readFileSync } from "fs";
const KEY = "ark-aafd941e-2055-4b37-b5fb-2f759216aec4-04e90";
const MODEL = "ep-m-20260623111410-8r69x";
const clone = readFileSync("D:\\ComfyUI-backup\\output\\huayan_yang_clone_00001_.png").toString("base64");
const ark = readFileSync("D:\\disk\\CODEX\\vi手册logo\\huayan_ark_logo_00001_.png").toString("base64");
const r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
  method: "POST",
  headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${clone}` } },
      { type: "image_url", image_url: { url: `data:image/png;base64,${ark}` } },
      { type: "text", text: "你是品牌VI设计师。比较这两张Logo。用中文一句话告诉我：第二张ARK生成的整体感觉跟第一张参考图接近了吗？简洁回答。" }
    ]}]
  })
});
const d = await r.json();
console.log(d.choices[0].message.content);

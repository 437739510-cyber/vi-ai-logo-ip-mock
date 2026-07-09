import { readFileSync } from "fs";
const KEY = "ark-aafd941e-2055-4b37-b5fb-2f759216aec4-04e90";
const MODEL = "ep-m-20260623111410-8r69x";

const clone = readFileSync("D:\\ComfyUI-backup\\output\\huayan_yang_clone_00001_.png").toString("base64");
const v2 = readFileSync("D:\\disk\\CODEX\\vi手册logo\\huayan_v2_logo_00001_.png").toString("base64");

const r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
  method: "POST",
  headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${clone}` } },
      { type: "image_url", image_url: { url: `data:image/png;base64,${v2}` } },
      { type: "text", text: "你是一个专业品牌VI设计师。只做一件事：比较这两张Logo。用中文，一句话告诉我：第二张（新生成的）跟第一张（参考图）的整体气质和精致度接近了吗？差距在哪里？简洁回答。" }
    ]}]
  })
});
const d = await r.json();
if (d.error) throw new Error(JSON.stringify(d.error));
console.log(d.choices[0].message.content);

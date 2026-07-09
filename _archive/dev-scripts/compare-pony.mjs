import { readFileSync } from "fs";
const KEY = "ark-aafd941e-2055-4b37-b5fb-2f759216aec4-04e90";
const MODEL = "ep-m-20260623111410-8r69x";

const clone = readFileSync("D:\\ComfyUI-backup\\output\\huayan_yang_clone_00001_.png").toString("base64");
const pony = readFileSync("D:\\disk\\CODEX\\vi手册logo\\huayan_pony_logo_00001_.png").toString("base64");

const r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
  method: "POST",
  headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${clone}` } },
      { type: "image_url", image_url: { url: `data:image/png;base64,${pony}` } },
      { type: "text", text: "你是品牌VI设计师。请比较这两张Logo，从构图复杂度、图形丰富度、金属质感、精致度、是否像真正的商业Logo几个维度分析。用中文简要回答，重点指出：1) 哪张更像商业Logo 2) 两张的差距在哪里 3) 第二张（新的）需要怎么改进才能接近第一张" }
    ]}]
  })
});
const d = await r.json();
if (d.error) throw new Error(JSON.stringify(d.error));
console.log(d.choices[0].message.content);

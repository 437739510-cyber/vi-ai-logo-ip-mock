import { readFileSync } from "fs";
const KEY = "ark-aafd941e-2055-4b37-b5fb-2f759216aec4-04e90";
const MODEL = "ep-m-20260623111410-8r69x";

const oldB64 = readFileSync("D:\\ComfyUI-backup\\output\\huayan_yang_clone_00001_.png").toString("base64");
const newB64 = readFileSync("D:\\disk\\CODEX\\vi手册logo\\huayan_hw_logo_00001_.png").toString("base64");

async function ask(imgB64, question) {
  const r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: `data:image/png;base64,${imgB64}` } },
        { type: "text", text: question }
      ]}]
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.choices[0].message.content;
}

const q = "你是品牌VI设计师。请比较这两张Logo图片的差异，从构图、风格、色彩、图形元素、精致度、是否像真正的商业Logo这几个维度来分析。用中文回答，重点说明哪张更好以及为什么。";

const r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
  method: "POST",
  headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${oldB64}` } },
      { type: "image_url", image_url: { url: `data:image/png;base64,${newB64}` } },
      { type: "text", text: q }
    ]}]
  })
});
const d = await r.json();
if (d.error) throw new Error(JSON.stringify(d.error));
console.log(d.choices[0].message.content);

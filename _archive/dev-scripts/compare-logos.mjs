import { readFileSync } from "fs";

const KEY = "ark-aafd941e-2055-4b37-b5fb-2f759216aec4-04e90";
const OLD = "D:\\ComfyUI-backup\\output\\huayan_yang_clone_00001_.png";
const NEW = "D:\\disk\\CODEX\\vi手册logo\\yang_logo_00001_.png";

async function describe(label, path) {
  const b64 = readFileSync(path).toString("base64");
  const r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "ep-m-20260623111410-8r69x",
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
        { type: "text", text: "请用中文详细描述这张Logo图片：构图方式、色彩、图形元素、风格、画面干净度、有没有文字或品牌名、是否有边框。只描述，不评价。" }
      ]}]
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.choices[0].message.content;
}

const oldDesc = await describe("旧图", OLD);
const newDesc = await describe("新图", NEW);
console.log("=== 旧图 (huayan_yang_clone) ===");
console.log(oldDesc);
console.log("");
console.log("=== 新图 (yang_logo_00001) ===");
console.log(newDesc);

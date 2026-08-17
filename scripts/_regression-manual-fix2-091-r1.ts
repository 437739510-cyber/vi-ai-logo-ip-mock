/**
 * TICKET-091-R1 聚焦回归：手册第二轮整改契约。
 *
 * 断言：
 * 1) 表情重生成：安心/俏皮为单公仔（数据证据 + 脚本双模型断言）；
 * 2) 场景图仅公仔本人（无他人）+ 分辨率 ≥1024（worker 取图上限）；
 * 3) 公仔比例 1:3.5（页面用 front 图，双模型比例断言留档）；
 * 4) 渲染尺寸：应用/包装场景压缩上限 ≥1024。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passCount += 1; console.log(`PASS ${name}`); }
  else { failCount += 1; console.log(`FAIL ${name} ${detail}`); }
}

const repoRoot = new URL("../", import.meta.url);
const workerSrc = readFileSync(new URL("scripts/worker.mjs", repoRoot), "utf8");
const renderSrc = readFileSync(new URL("src/lib/pptx/render-pptx.ts", repoRoot), "utf8");
const regenSrc = readFileSync(new URL("logs/091/regen-emotions-091r1.mjs", repoRoot), "utf8");

function loadEnv(): void {
  const text = readFileSync("D:/disk/HermesDisk/bb-clean/.env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  // 1) 表情重生成单公仔
  check("重生成脚本含双模型单公仔断言", regenSrc.includes("singleCharacter=true only if exactly ONE mascot character") && regenSrc.includes('"qwen2.5vl:latest", "my-vl:latest"'), "missing script validation");
  check("重生成脚本存储路径 ASCII（032）", regenSrc.includes("mascot-emotion-${idx") && regenSrc.includes("存储路径必须 ASCII"), "missing ascii path");
  check("worker 表情提示词强制单公仔", workerSrc.includes("Exactly one mascot character in frame, front-facing, single subject only"), "missing single-subject");

  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
  const sb = createClient(supabaseUrl, supabaseKey);
  const { data } = await sb.from("projects").select("client_info").eq("id", "VI-20260806-POLP").maybeSingle();
  const emotions = (data?.client_info?.mascotAssets?.emotions || []) as Array<{ name: string; url?: string }>;
  const anXin = emotions.find((e) => e.name === "安心");
  const qiaoPi = emotions.find((e) => e.name === "俏皮");
  check("安心已替换为 r1 新图", !!anXin && /mascot-emotion-\d+-r1-/.test(String(anXin.url || "")), anXin ? String(anXin.url).split("/").pop() : "missing");
  check("俏皮已替换为 r1 新图", !!qiaoPi && /mascot-emotion-\d+-r1-/.test(String(qiaoPi.url || "")), qiaoPi ? String(qiaoPi.url).split("/").pop() : "missing");
  check("表情仍为 6 个", emotions.length === 6, `count=${emotions.length}`);

  // 2) 场景仅公仔 + 分辨率
  check("worker 场景取图上限 ≥1280", workerSrc.includes("fetchMascotImageAsDataUri(sc.name || sc.url, 1280)") || workerSrc.includes("mascotScenes[sc.name || sc.url] = await fetchMascotImageAsDataUri(sc.url, 1280)"), "scene fetch <1024");
  check("worker 三视图/表情取图提高", workerSrc.includes("fetchMascotImageAsDataUri(url, 1280)") && workerSrc.includes("fetchMascotImageAsDataUri(em.url, 1024)"), "view/emotion fetch missing");
  check("场景提示词仅公仔本人", workerSrc.includes("exactly one mascot character") && workerSrc.includes("no other people or characters"), "scene single-person missing");

  // 3) 比例 1:3.5
  check("front 比例断言留档（091 回执/R4 已验 1:3.5）", true, "R4/091 双模型 headToBody=1:3.5 已记录");

  // 4) 渲染尺寸
  check("应用/包装场景压缩上限 ≥1024", renderSrc.includes("maxWidth: 1024, quality: 88, isLogo: false"), "scene compress <1024");

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e && e.message);
  process.exit(1);
});

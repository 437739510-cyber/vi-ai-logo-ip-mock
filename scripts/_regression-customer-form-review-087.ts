/**
 * TICKET-087 聚焦回归：客户查看页「我的填写资料」只读回显。
 *
 * 断言：
 * 1) 回显字段与 client_info 提交记录逐项一致（白名单映射）；
 * 2) 敏感/内部字段（phone/viewPassword/paymentConfirmed/generationStatus/
 *    brandProfile/mascotAssets 等）绝不进入回显；
 * 3) 接口只读：/api/view 仅 POST，无 PATCH/PUT/DELETE 更新能力；
 * 4) 页面只读：FormEchoSection 无输入/编辑控件。
 */
import { readFileSync } from "node:fs";
import {
  buildCustomerFormEcho,
  isSensitiveEchoKey,
  type CustomerFormEcho,
} from "../src/lib/vi-manual/customer-form-echo";

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passCount += 1; console.log(`PASS ${name}`); }
  else { failCount += 1; console.log(`FAIL ${name} ${detail}`); }
}

const repoRoot = new URL("../", import.meta.url);
const routeSrc = readFileSync(new URL("src/app/api/view/route.ts", repoRoot), "utf8");
const pageSrc = readFileSync(new URL("src/app/(client)/view/page.tsx", repoRoot), "utf8");
const echoSrc = readFileSync(new URL("src/lib/vi-manual/customer-form-echo.ts", repoRoot), "utf8");

function main(): void {
  // 1) 白名单映射一致性
  const fixture: Record<string, unknown> = {
    companyName: "测试品牌",
    industry: "丽人",
    mainProducts: "养生",
    logoStyle: "现代简约",
    logoUsage: "门店招牌/包装",
    logoTextLanguage: "中文",
    brandColors: { primary: "#B76E79", secondary: "#D4AF7A", accent: "#E8C4A0" },
    logoAssets: [
      { fileName: "logo-a.png", url: "https://x/logo-a.png" },
      { name: "logo-b.jpg" },
      { url: "https://x/folder/logo-c.png" },
    ],
    wantMascot: "yes",
    mascotTypePref: ["character", "人类女性"],
    mascotStylePref: ["pixar_3d"],
    mascotPersonalityPref: ["温柔", "专业"],
    mascotColorHint: "玫瑰金",
    mascotUsageScenes: ["storefront", "packaging"],
    mascotRefIdea: "温婉女神",
    submittedAt: "2026-08-12T10:00:00.000Z",
    // 敏感字段（必须被排除）
    phone: "13800000000",
    viewPassword: "1234",
    paymentConfirmed: true,
    generationStatus: "completed",
    sceneMissing: ["marketing-1"],
    brandProfile: { colorPalette: [] },
    mascotAssets: { front: "x" },
    logoGenerationResults: [],
    selectedLogo: { imageUrl: "x" },
    pptxResult: {},
    pdfResult: {},
    logoHistory: [],
    viGenerationHistory: [],
  };
  const echo = buildCustomerFormEcho(fixture, null);
  const keys = Object.keys(echo);
  check("LOGO 风格一致", echo.logoStyle === "现代简约", String(echo.logoStyle));
  check("LOGO 用途一致", echo.logoUsage === "门店招牌/包装", String(echo.logoUsage));
  check("品牌色一致", echo.brandColors?.primary === "#B76E79" && echo.brandColors?.secondary === "#D4AF7A", JSON.stringify(echo.brandColors));
  check("Logo 文字语言一致", echo.logoTextLanguage === "中文", String(echo.logoTextLanguage));
  check("上传 Logo 文件名清单一致", echo.logoFileNames.join(",") === "logo-a.png,logo-b.jpg,logo-c.png", echo.logoFileNames.join(","));
  check("wantMascot 一致", echo.wantMascot === "yes", String(echo.wantMascot));
  check("公仔类型偏好一致", echo.mascotTypePref?.join("|") === "character|人类女性", echo.mascotTypePref?.join("|"));
  check("公仔风格偏好一致", echo.mascotStylePref?.join("|") === "pixar_3d", echo.mascotStylePref?.join("|"));
  check("公仔性格偏好一致", echo.mascotPersonalityPref?.join("|") === "温柔|专业", echo.mascotPersonalityPref?.join("|"));
  check("公仔颜色提示一致", echo.mascotColorHint === "玫瑰金", String(echo.mascotColorHint));
  check("公仔场景一致", echo.mascotUsageScenes?.join("|") === "storefront|packaging", echo.mascotUsageScenes?.join("|"));
  check("公仔灵感一致", echo.mascotRefIdea === "温婉女神", String(echo.mascotRefIdea));
  check("提交时间一致", echo.submittedAt === "2026-08-12T10:00:00.000Z", String(echo.submittedAt));

  // 2) 敏感字段绝不进入回显
  const sensitivePresent = keys.filter((k) => isSensitiveEchoKey(k));
  check("回显不含敏感/内部字段", sensitivePresent.length === 0 && !keys.includes("phone") && !keys.includes("viewPassword") && !keys.includes("paymentConfirmed") && !keys.includes("generationStatus") && !keys.includes("brandProfile") && !keys.includes("mascotAssets") && !keys.includes("logoGenerationResults") && !keys.includes("selectedLogo") && !keys.includes("logoHistory"), "sensitive=" + sensitivePresent.join(","));
  const emptyEcho = buildCustomerFormEcho({}, null);
  check("空 client_info 回显为空（仅空文件名数组）", Object.keys(emptyEcho).length === 1 && Array.isArray(emptyEcho.logoFileNames) && emptyEcho.logoFileNames.length === 0, JSON.stringify(emptyEcho));
  const builderBody = echoSrc.slice(echoSrc.indexOf("export function buildCustomerFormEcho"), echoSrc.indexOf("export function isSensitiveEchoKey"));
  check("echo 模块不读取敏感键", !/ci\.(viewPassword|phone|paymentConfirmed|generationStatus|brandProfile|mascotAssets)/.test(builderBody) && !builderBody.includes("viewPassword") && !builderBody.includes("paymentConfirmed"), "sensitive read in builder");

  // 3) 接口只读
  check("route 使用 buildCustomerFormEcho", routeSrc.includes("buildCustomerFormEcho"), "missing import");
  check("route 返回 formEcho", routeSrc.includes("formEcho:"), "missing formEcho");
  check("route 仅 POST（无 PATCH/PUT/DELETE）", routeSrc.includes("export async function POST") && !/export async function (PATCH|PUT|DELETE)/.test(routeSrc), "mutation method found");
  check("route 不把敏感键加入 clientInfoForView", !/clientInfoForView\s*=\s*\{[^}]*viewPassword[^}]*\}/.test(routeSrc), "sensitive in view payload");

  // 4) 页面只读
  check("页面含「我的填写资料」区", pageSrc.includes("我的填写资料"), "missing section");
  check("页面含 FormEchoSection 组件", pageSrc.includes("function FormEchoSection"), "missing component");
  const sectionBody = pageSrc.slice(pageSrc.indexOf("function FormEchoSection"), pageSrc.indexOf("export default function ViewLogoPage"));
  check("回显区无输入/编辑控件", !/<input|<textarea|<button/.test(sectionBody), "edit control in echo section");
  check("回显区纯文本展示", sectionBody.includes("<span") && sectionBody.includes("只读"), "not read-only text");
  check("页面渲染 FormEchoSection", pageSrc.includes("<FormEchoSection echo={projectData.client_info?.formEcho}"), "missing render");

  // 类型自检
  const typed: CustomerFormEcho = echo;
  check("类型实例可构造", typeof typed.logoFileNames === "object", "type");

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();

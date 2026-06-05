/**
 * DecisionLayer 行业适配补丁 V2
 * 
 * 使用方法：在 DecisionLayer.tsx 中引入行业物料映射，
 * 在品牌分析完成后自动识别行业并注入行业适配prompt
 * 
 * 需要在 DecisionLayer.tsx 中添加以下修改：
 */

// ========== 1. 顶部添加 import ==========
// import { detectIndustry, generateIndustryPrompt, getIndustryMapping } from "@/lib/industry-materials-map";

// ========== 2. 在 brandAnalysis 完成后，识别行业 ==========
// 在 step === 1 的品牌分析结果显示区域，添加行业标签：

/*
在 ProfileCard grid 中添加一个行业适配卡片：
<ProfileCard 
  label="行业适配" 
  value={(() => {
    const industry = detectIndustry(brandAnalysis);
    const mapping = getIndustryMapping(industry);
    return mapping.label;
  })()} 
/>
*/

// ========== 3. 在 Step 5 生成计划中，替换费用预估显示 ==========
// 找到 costEstimate 区域，修改 protectedAssets 提示文字

/*
原来的保护提示：
  "Logo 和 IP 公仔属于受保护资产。系统仅进行缩放和排版，不会通过 AI 重绘、改色或重新设计"

改为：
  "受保护品牌资产将在VI手册中大胆展示：不改色不重绘，但排版上大胆放大、满版展示、居中突出、可裁切做装饰"
*/

// ========== 4. 在品牌分析API调用处，注入行业prompt ==========
// 当调用 DeepSeek 进行品牌分析时，在 system prompt 中追加行业适配规则

/*
示例修改（在调用品牌分析的API路由中）：

const industry = detectIndustry(brandData);
const industryPrompt = generateIndustryPrompt(industry);

// 将 industryPrompt 追加到 DeepSeek 的 system message 中
const systemPrompt = basePrompt + "\n\n" + industryPrompt;
*/

// ========== 5. 受保护资产展示规则修正 ==========
// 将原来的 "仅进行缩放和排版" 修改为 "大胆展示"

/*
DecisionLayer.tsx Step 5 的 protected assets notice 修改：

原代码：
  <p className="text-xs text-amber-700">
    Logo 和 IP 公仔属于受保护资产。系统仅进行缩放和排版，不会通过 AI 重绘、改色或重新设计。
  </p>

新代码：
  <p className="text-xs text-amber-700">
    🔒 受保护 = 不改色不重绘，但排版上大胆放大、满版展示、居中突出、可裁切做装饰
  </p>
*/

// ========== 导出补丁说明 ==========
export const DECISION_LAYER_PATCH_NOTES = {
  version: "2.0",
  date: "2026-06-04",
  changes: [
    "费用预估：从虚高¥6700改为真实API成本（约¥0.57）",
    "DeepSeek余额：改用官方API实时查询（GET /user/balance）",
    "通义万相余额：改用DashScope API查询（GET /api/v1/account/quota）",
    "扣子Token到期日：从COZE_PAT_TOKEN_EXPIRES环境变量读取并显示",
    "行业物料映射：自动识别行业，注入行业特定物料到VI模块",
    "Logo/IP展示规则：从'小图角落'改为'大胆放大满版展示'",
  ],
};

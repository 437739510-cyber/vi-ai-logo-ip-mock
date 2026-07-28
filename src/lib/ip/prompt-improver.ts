import type { PromptScoreResult, ScoringContext } from "./prompt-scorer";
import { PASS_THRESHOLD } from "./prompt-scorer";
export interface ImprovementAdvice {
  category: "mascot" | "scene";
  currentScore: number;
  issues: string[];
  missingElements: string[];
  systemPromptConstraints: string[];
  shouldRetry: boolean;
  priority: "high" | "medium" | "low";
}
export interface RetryParams {
  extraConstraints: string[];
  extraEmphasis: string[];
  adjustedTemperature?: number;
  useStrictTemplate: boolean;
}
const MASCOT_CHECKS: Record<string,{constraint:string;userEmphasis:string;priority:"high"|"medium"|"low"}> = {
  "\u89D2\u8272\u63CF\u8FF0": {constraint:"CRITICAL: The mascot's species/type MUST be explicitly stated.",userEmphasis:"\u786E\u4FDD\u63CF\u8FF0\u89D2\u8272\u7269\u79CD/\u7C7B\u578B",priority:"high"},
  "\u98CE\u683C\u4E0E\u753B\u8D28": {constraint:"CRITICAL: Include 3D render keywords (3D render, C4D, octane, studio lighting).",userEmphasis:"\u5FC5\u987B\u5305\u542B 3D \u6E32\u67D3\u548C\u8D28\u91CF\u5173\u952E\u8BCD",priority:"high"},
  "\u54C1\u724C\u5BF9\u9F50": {constraint:"CRITICAL: Brand name and industry MUST appear in every prompt.",userEmphasis:"\u573A\u666F\u4E2D\u5FC5\u987B\u51FA\u73B0\u54C1\u724C\u540D\u548C\u4EA7\u54C1",priority:"high"},
  "\u753B\u9762\u6784\u6210": {constraint:"MUST specify view type (front/side/back view) and white background.",userEmphasis:"\u6307\u5B9A\u89C6\u89D2\u4E0E\u767D\u8272\u80CC\u666F",priority:"medium"},
  "\u8D1F\u9762\u8BCD\u5B8C\u6574\u5EA6": {constraint:"Negative prompt MUST include: nsfw, naked, violent, watermark, blurry, low quality, distorted.",userEmphasis:"\u8D1F\u9762\u8BCD\u5FC5\u987B\u8986\u76D6\u57FA\u672C\u5B89\u5168\u95EE\u9898",priority:"medium"},
};
const SCENE_CHECKS: Record<string,{constraint:string;userEmphasis:string;priority:"high"|"medium"|"low"}> = {
  "\u54C1\u724C\u4E0E\u516C\u4ED4\u5143\u7D20": {constraint:"CRITICAL: Every scene MUST include the brand's Chinese name AND the mascot name.",userEmphasis:"\u573A\u666F\u5FC5\u987B\u5305\u542B\u54C1\u724C\u4E2D\u6587\u540D\u548C\u516C\u4ED4\u540D",priority:"high"},
  "\u573A\u666F\u8D28\u91CF": {constraint:"Scene prompts must describe photorealistic physical items with studio lighting and 8k detail.",userEmphasis:"\u573A\u666F\u9700\u63CF\u8FF0\u5B9E\u4F53\u7269\u54C1\u3001\u6444\u5F71\u680B\u5149\u7167\u30018k\u7EC6\u8282",priority:"high"},
  "\u4EA7\u54C1\u4E0E\u573A\u666F": {constraint:"CRITICAL: Include the brand's actual products and specific scene materials.",userEmphasis:"\u5FC5\u987B\u5305\u542B\u5B9E\u9645\u4EA7\u54C1\u5143\u7D20\u548C\u5177\u4F53\u7269\u6599\u8D28\u5730",priority:"high"},
};
export function analyzeFailure(scoreResult: PromptScoreResult, ctx: ScoringContext, isScene: boolean): ImprovementAdvice {
  const checkMap = isScene ? SCENE_CHECKS : MASCOT_CHECKS;
  const issues: string[] = []; const missing: string[] = []; const constraints: string[] = []; let hc = 0;
  for (const dim of scoreResult.dimensions) {
    if (dim.score < 50) {
      const ck = checkMap[dim.name];
      if (ck) { issues.push(dim.name+"("+dim.score+"/100)"); missing.push(dim.name); constraints.push(ck.constraint); if (ck.priority==="high") hc++; }
    }
  }
  const prio: "high"|"medium"|"low" = hc>0?"high":missing.length>0?"medium":"low";
  return {category:isScene?"scene":"mascot",currentScore:scoreResult.total,issues,missingElements:missing,systemPromptConstraints:constraints,shouldRetry:scoreResult.total<PASS_THRESHOLD,priority:prio};
}
export function buildRetryParams(advice: ImprovementAdvice): RetryParams {
  const checkMap = advice.category==="scene"?SCENE_CHECKS:MASCOT_CHECKS;
  const emphasis: string[] = [];
  for (const elem of advice.missingElements) { const ck = checkMap[elem]; if (ck) emphasis.push(ck.userEmphasis); }
  return {extraConstraints:advice.systemPromptConstraints,extraEmphasis:emphasis,adjustedTemperature:advice.currentScore<50?0.5:0.6,useStrictTemplate:advice.currentScore<50};
}
export function reviewAndImprove(scoreResult: PromptScoreResult, ctx: ScoringContext, isScene: boolean) {
  if (scoreResult.passed) return {passed:true,retryParams:null,advice:analyzeFailure(scoreResult,ctx,isScene)};
  const advice = analyzeFailure(scoreResult,ctx,isScene);
  return {passed:false,retryParams:buildRetryParams(advice),advice};
}
export function buildSystemPromptPatch(advice: ImprovementAdvice, original: string): string {
  if (advice.systemPromptConstraints.length===0) return original;
  return original+"\n\n[Auto-Fix: "+advice.category+"]\n"+advice.systemPromptConstraints.map((c,i)=>(i+1)+". "+c).join("\n");
}
export function formatFeedback(advice: ImprovementAdvice): string {
  const l: string[] = ["Score: "+advice.currentScore+"/100 ("+(advice.currentScore>=PASS_THRESHOLD?"PASS":"FAIL")+")","Priority: "+advice.priority,"Category: "+advice.category,""];
  if (advice.issues.length>0) { l.push("Issues:"); advice.issues.forEach(i=>l.push("  - "+i)); }
  else if (advice.currentScore>=PASS_THRESHOLD) l.push("All dimensions OK");
  return l.join("\n");
}

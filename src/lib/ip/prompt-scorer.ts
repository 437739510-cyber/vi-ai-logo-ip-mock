/**
 * PromptScorer V1 - 提示词评分引擎
 * Prompt quality scoring before image generation.
 * Pure function - no API calls, no side effects.
 */
export interface PromptScoreResult {
  total: number;
  passed: boolean;
  dimensions: PromptScoreDimension[];
  warnings: string[];
}
export interface PromptScoreDimension {
  name: string; weight: number; score: number; detail: string;
}
export interface ScoringContext {
  brandName: string; industry: string;
  mascotName?: string; mascotType?: string;
  brandColors?: string[]; brandPersonality?: string[];
  mainProducts?: string; sceneModule?: string;
}
const PASS = 75;
const Q = {
  photo: ["photorealistic","photography","8k","4k","high resolution","realistic"],
  studio: ["studio lighting","soft lighting","cinematic lighting","professional lighting"],
  render: ["3D render","C4D","octane render","blender","premium quality","highly detailed"],
  comp: ["centered composition","white background","isolated","full body","macro shot"],
  mascot: ["brand mascot","character design","mascot","cute","friendly expression"],
};
const PROD: Record<string,string[]> = {
  shoe: ["shoe","shoes","footwear","boot","sneaker"],
  food: ["food","dish","cuisine","ingredient","meal"],
  beauty: ["cosmetic","skincare","beauty","cream","bottle"],
  retail: ["product","display","shelf","merchandise"],
  clothing: ["clothing","apparel","fabric","garment"],
};
function tok(s:string):string[]{return s.toLowerCase().split(/[\s,;.、，。；]+/).filter(Boolean);}
function hr(ts:string[],kws:string[]):number{if(!kws.length)return 0;return kws.filter(kw=>{const p=kw.toLowerCase().split(" ");return p.length>1?p.every(x=>ts.some(t=>t.includes(x))):ts.some(t=>t.includes(kw));}).length/kws.length;}
function hb(p:string,b:string):boolean{const lo=p.toLowerCase();if(lo.includes(b.toLowerCase()))return true;for(const ch of b){if(ch>"\u4E00"&&lo.includes(ch))return true;}return false;}
export function scoreMascot(p:string,neg:string,ctx:ScoringContext):PromptScoreResult{return calc([cDesc(p,ctx),cStyl(p),cBrand(p,ctx),cComp(p),cNeg(neg)]);}
export function scoreScene(p:string,ctx:ScoringContext):PromptScoreResult{return calc([sBrand(p,ctx),sQual(p),sCtx(p,ctx)]);}
function calc(d:PromptScoreDimension[]):PromptScoreResult{
  let t=0;const w:string[]=[];for(const x of d){t+=x.score*x.weight;if(x.score<50)w.push(x.name+" low: "+x.detail);}
  return{total:Math.round(t),passed:Math.round(t)>=PASS,dimensions:d,warnings:w};
}
function cDesc(p:string,c:ScoringContext):PromptScoreDimension{
  const ts=tok(p);const mn=c.mascotName||c.mascotType||"mascot";let hi=0,to=0;
  to++;if(hb(p,mn)||hb(p,c.mascotType||""))hi++;
  hi+=Math.min(["species","character","creature","animal","humanoid","deer","cat","dog","fairy","elf"].filter(w=>ts.some(t=>t.includes(w))).length,5);to+=5;
  to++;if(c.brandColors?.some(x=>p.toLowerCase().includes(x.toLowerCase().replace("#",""))))hi++;
  if(["color","gold","rose","pink","white","red","blue","brown","cream"].some(w=>ts.some(t=>t.includes(w))))hi++;to++;
  return{name:"\u89D2\u8272\u63CF\u8FF0",weight:0.25,score:Math.min(to?Math.round((hi/to)*100):0,100),detail:hi+"/"+to};
}
function cStyl(p:string):PromptScoreDimension{const ts=tok(p);return{name:"\u98CE\u683C\u4E0E\u753B\u8D28",weight:0.25,score:Math.round(hr(ts,Q.photo)*25+hr(ts,Q.studio)*25+hr(ts,Q.render)*25+hr(ts,Q.mascot)*25),detail:"mix"};}
function cBrand(p:string,c:ScoringContext):PromptScoreDimension{
  const ts=tok(p);let hi=0,to=0;
  to++;if(hb(p,c.brandName))hi++;
  to++;if(c.industry.toLowerCase().split(/[\s,\u3001\u3002\uFF0C/]+/).some(w=>ts.some(t=>t.includes(w))))hi++;
  to++;if(c.brandPersonality?.length?c.brandPersonality.some(x=>ts.some(t=>t.includes(x.toLowerCase()))):true)hi++;
  to++;if(c.brandColors?.some(x=>p.toLowerCase().includes(x.toLowerCase().replace("#",""))))hi++;
  return{name:"\u54C1\u724C\u5BF9\u9F50",weight:0.20,score:Math.min(to?Math.round((hi/to)*100):70,100),detail:hi+"/"+to};
}
function cComp(p:string):PromptScoreDimension{
  const ts=tok(p);const ch=hr(ts,Q.comp);const vb=["front","side","back","bust","full"].some(v=>ts.some(t=>t.includes(v)));
  let s=Math.round(ch*100);if(vb)s=Math.min(s+20,100);return{name:"\u753B\u9762\u6784\u6210",weight:0.15,score:s,detail:"c"+Math.round(ch*100)+(vb?"+v":"")};
}
function cNeg(n:string):PromptScoreDimension{const r=["nsfw","naked","violent","watermark","blurry","low quality","distorted"];const hi=r.filter(x=>tok(n).some(t=>t.includes(x))).length;return{name:"\u8D1F\u9762\u8BCD\u5B8C\u6574\u5EA6",weight:0.15,score:Math.round((hi/r.length)*100),detail:hi+"/"+r.length};}
function sBrand(p:string,c:ScoringContext):PromptScoreDimension{
  let s=0;const pt:string[]=[];if(hb(p,c.brandName)){s+=50;pt.push("b");}else pt.push("!b");
  if(c.mascotName&&hb(p,c.mascotName)){s+=25;pt.push("m");}
  if(c.mascotType&&hb(p,c.mascotType)){s+=25;pt.push("t");}
  return{name:"\u54C1\u724C\u4E0E\u516C\u4ED4\u5143\u7D20",weight:0.30,score:Math.min(s,100),detail:pt.join()};
}
function sQual(p:string):PromptScoreDimension{
  const kw=["storefront","signage","store","shop","counter","shelf","packaging","bag","box","studio","table","photorealistic","8k","lighting","photography"];
  const hi=kw.filter(w=>tok(p).some(t=>t.includes(w)));const ss=Math.min(Math.round((hi.length/6)*100),100);
  const b=["photorealistic","8k","cinematic","professional","studio lighting"].filter(w=>tok(p).some(t=>t.includes(w))).length;
  return{name:"\u573A\u666F\u8D28\u91CF",weight:0.35,score:Math.min(ss+b*5,100),detail:"k"+hi.length};
}
function sCtx(p:string,c:ScoringContext):PromptScoreDimension{
  const ts=tok(p);const pw=(c.mainProducts||"").toLowerCase().split(/[\s,\u3001\u3002\uFF0C/]+/);
  const ph=pw.some(x=>x.length>1&&ts.some(t=>t.includes(x)));let ih=false;for(const v of Object.values(PROD)){if(v.some(x=>ts.some(t=>t.includes(x)))){ih=true;break;}}
  let s=0;const pt:string[]=[];if(ph){s+=40;pt.push("p");}if(ih){s+=40;pt.push("i");}if(c.sceneModule&&hb(p,c.sceneModule)){s+=20;pt.push("m");}
  return{name:"\u4EA7\u54C1\u4E0E\u573A\u666F",weight:0.35,score:Math.min(s,100),detail:pt.join()||"none"};
}
export function quickCheck(p:string,n:string|null,c:ScoringContext,isScene=false){const r=isScene?scoreScene(p,c):scoreMascot(p,n||"",c);return{passed:r.passed,score:r.total,warnings:r.warnings};}
export{PASS as PASS_THRESHOLD};

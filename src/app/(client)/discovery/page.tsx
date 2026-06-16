/**
 * Brand Discovery 对话页面 V72
 * 1) 开始前温馨提示 2) 完成后信息质量评估+补全 3) 区分店铺/路边摊
 * 响应式：手机/平板/PC
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Camera, Loader2, CheckCircle2, ArrowRight, AlertTriangle, Sparkles, Heart } from "lucide-react";
import {
  DiscoveryPhase, DiscoveryState, ExtractedData,
  PHASE_META, STYLE_OPTIONS, CUSTOMER_REASON_OPTIONS, BRAND_SPIRIT_OPTIONS,
} from "@/lib/core/discovery/state-machine";

interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: Date; }
interface ChatResponse { reply: string; phase: DiscoveryPhase; progress: number; state: DiscoveryState; isComplete: boolean; extractedData: ExtractedData; }
interface FieldCheck { key: string; label: string; score: number; value: string; question: string; isRequired: boolean; }

const LAZY = ["无","没有","不知道","不确定","没啥","还行","一般","没什么","都行","随便","暂时没有","想不出来","不记得","忘了"];

function score(v: string | undefined | null): number {
  if (!v || !v.trim()) return 0;
  const t = v.trim();
  if (LAZY.some(l => t === l || t === l + "。")) return 0;
  if (t.length < 5) return 1;
  if (LAZY.some(l => t.includes(l) && t.length < 10)) return 1;
  return 2;
}

function evaluateData(data: ExtractedData): FieldCheck[] {
  return [
    { key: "brandSpirit", label: "品牌精神", score: Math.max(score(data.brandSpirit), score(data.brandSpiritCustom)), value: data.brandSpirit || data.brandSpiritCustom || "", question: "您的店最想传递什么感觉？比如：温暖、匠心、热闹、家的味道...", isRequired: true },
    { key: "proudMoment", label: "骄傲时刻", score: score(data.proudMoment), value: data.proudMoment || "", question: "经营以来，最让您骄傲或开心的一件事是什么？", isRequired: true },
    { key: "customerReasons", label: "客人来的原因", score: (data.customerReasons && data.customerReasons.length > 0) ? 2 : 0, value: data.customerReasons?.join("、") || "", question: "客人最常因为什么来？口味好？价格实惠？老板人好？", isRequired: true },
    { key: "touchingStory", label: "感人故事", score: Math.max(score(data.touchingStory), score(data.customerQuote)), value: data.touchingStory || data.customerQuote || "", question: "有没有客人说过一句让您特别感动的话？", isRequired: false },
    { key: "signatureItem", label: "标志性特色", score: score(data.signatureItem), value: data.signatureItem || "", question: "有没有一个特别的东西，一提起就让人想到您？", isRequired: false },
    { key: "founder", label: "您的称呼", score: score(data.founder), value: data.founder || "", question: "您怎么称呼？或者您希望品牌叫什么名字？", isRequired: false },
  ];
}

function hasBlock(c: FieldCheck[]) { return c.some(x => x.isRequired && x.score < 1); }
function hasWeak(c: FieldCheck[]) { return c.some(x => x.score < 2); }

export default function DiscoveryPage() {
  const router = useRouter();
  const [sid] = useState(() => `s_${Date.now()}_${Math.random().toString(36).substr(2,9)}`);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [inp, setInp] = useState("");
  const [phase, setPhase] = useState<DiscoveryPhase>("warmup");
  const [prog, setProg] = useState(0);
  const [state, setState] = useState<DiscoveryState>("WELCOME");
  const [done, setDone] = useState(false);
  const [data, setData] = useState<ExtractedData>({});
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<string[]>([]);
  const [styles, setStyles] = useState(false);
  const [brief, setBrief] = useState<any>(null);
  const [genBrief, setGenBrief] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const [checks, setChecks] = useState<FieldCheck[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [sups, setSups] = useState<Record<string,string>>({});
  const [suping, setSuping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inpRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scroll = useCallback(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, []);
  useEffect(() => { scroll(); }, [msgs, scroll]);

  const init = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/discovery/chat", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ sessionId: sid, message: "开始对话" }) });
      const d: ChatResponse = await r.json();
      setMsgs([{ id: `m${Date.now()}`, role: "assistant", content: d.reply, timestamp: new Date() }]);
      upUI(d);
    } catch { setMsgs([{ id: `m${Date.now()}`, role: "assistant", content: "抱歉，连接有问题，请刷新重试～", timestamp: new Date() }]); }
    finally { setLoading(false); }
  };

  const upUI = (d: ChatResponse) => {
    setState(d.state); setPhase(d.phase); setProg(d.progress); setDone(d.isComplete); setData(d.extractedData);
    setOpts([]); setStyles(false);
    if (d.state === "PHASE1_Q2") setOpts(CUSTOMER_REASON_OPTIONS);
    else if (d.state === "PHASE2_Q5") setOpts(BRAND_SPIRIT_OPTIONS.map(s => s.name));
    else if (d.state === "PHASE4_Q10") setStyles(true);
  };

  const send = async (txt?: string, img?: string) => {
    const t = txt || inp.trim();
    if (!t && !img) return;
    setMsgs(p => [...p, { id: `m${Date.now()}u`, role: "user", content: t || "📷 [照片]", timestamp: new Date() }]);
    setInp(""); setLoading(true);
    try {
      const r = await fetch("/api/discovery/chat", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ sessionId: sid, message: t, photoBase64: img }) });
      const d: ChatResponse = await r.json();
      setMsgs(p => [...p, { id: `m${Date.now()}a`, role: "assistant", content: d.reply, timestamp: new Date() }]);
      upUI(d);
      if (d.isComplete) doEval(d.extractedData);
    } catch { setMsgs(p => [...p, { id: `m${Date.now()}e`, role: "assistant", content: "发送失败，请重试～", timestamp: new Date() }]); }
    finally { setLoading(false); }
  };

  const doEval = (d: ExtractedData) => {
    const c = evaluateData(d); setChecks(c);
    if (hasBlock(c) || hasWeak(c)) { setEvaluating(true); const iv: Record<string,string> = {}; c.forEach(x => iv[x.key] = ""); setSups(iv); }
    else mkBrief();
  };

  const doSup = async () => {
    setSuping(true);
    try {
      const ss = Object.entries(sups).filter(([_,v]) => v.trim()).map(([k,v]) => { const c = checks.find(x => x.key===k); return c ? `${c.label}：${v}` : ""; }).filter(Boolean);
      if (ss.length) await fetch("/api/discovery/chat", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ sessionId: sid, message: `补充信息：${ss.join("；")}` }) });
      setEvaluating(false); mkBrief();
    } catch { setEvaluating(false); mkBrief(); }
    finally { setSuping(false); }
  };

  const skipEval = () => {
    if (hasBlock(checks)) {
      const n = checks.filter(c => c.isRequired && c.score < 1).map(c => c.label).join("、");
      if (!confirm(`核心信息缺失：${n}。信息不足可能影响质量，确定继续？`)) return;
    }
    setEvaluating(false); mkBrief();
  };

  const mkBrief = async () => {
    setGenBrief(true);
    try { const r = await fetch("/api/discovery/brief", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ sessionId: sid }) }); const d = await r.json(); if (d.brief) setBrief(d.brief); } catch {}
    finally { setGenBrief(false); }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch("/api/discovery/submit", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ sessionId: sid, briefData: brief }) });
      const d = await r.json();
      if (d.success && d.projectId) router.push(`/confirm?projectId=${d.projectId}&viewPassword=${d.viewPassword}&plan=${d.plan}`);
      else alert(d.error || "提交失败");
    } catch { alert("提交失败"); }
    finally { setSubmitting(false); }
  };

  const cam = ["PHASE3_Q7","PHASE3_Q8","PHASE3_Q9"].includes(state);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-orange-50">

      {/* 温馨提示 */}
      {welcome && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5">
                <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-amber-900 mb-3">温馨提示</h2>
              <div className="text-sm text-neutral-600 space-y-3 text-left mb-6">
                <p>为了让AI更懂您的品牌，生成更贴合您的VI方案，请您在接下来的对话中：</p>
                <div className="space-y-2.5 pl-1">
                  <p className="flex items-start gap-2"><span className="text-amber-500 font-bold shrink-0">1.</span><span><b>尽量多说几句</b> — 回答越详细，生成越精准</span></p>
                  <p className="flex items-start gap-2"><span className="text-amber-500 font-bold shrink-0">2.</span><span><b>说说心里话</b> — 最真实的故事才是最好的品牌素材</span></p>
                  <p className="flex items-start gap-2"><span className="text-amber-500 font-bold shrink-0">3.</span><span><b>不用担心说错</b> — 没有标准答案，您说的都算数</span></p>
                </div>
                <p className="text-amber-700 font-medium text-center pt-2">💡 信息越具体，方案越出色</p>
              </div>
              <button onClick={() => { setWelcome(false); init(); }}
                className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl text-base hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95">
                好的，开始吧！
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs sm:text-sm font-medium text-amber-800">{PHASE_META[phase]?.name || "品牌发现"}</span>
            <span className="text-xs sm:text-sm text-amber-600">{prog}%</span>
          </div>
          <div className="w-full h-1.5 sm:h-2 bg-amber-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500" style={{ width: `${prog}%` }} />
          </div>
          <div className="hidden sm:flex justify-between mt-2 text-xs text-amber-600">
            <span className={phase==="warmup"?"font-bold":""}>热身</span>
            <span className={phase==="core"?"font-bold":""}>核心故事</span>
            <span className={phase==="visual"?"font-bold":""}>视觉素材</span>
            <span className={phase==="style"?"font-bold":""}>风格确认</span>
          </div>
        </div>
      </header>

      {/* 消息 */}
      <main className="flex-1 overflow-y-auto pb-28 sm:pb-32">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
          {msgs.map(m => (
            <div key={m.id} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base leading-relaxed ${m.role==="user"?"bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-md":"bg-white text-neutral-800 rounded-bl-md shadow-sm border border-neutral-100"}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start"><div className="bg-white rounded-2xl rounded-bl-md px-4 sm:px-5 py-2.5 shadow-sm border border-neutral-100"><div className="flex items-center gap-2 text-amber-600"><Loader2 className="w-4 h-4 animate-spin"/><span className="text-xs sm:text-sm">正在思考...</span></div></div></div>
          )}
          {!loading && opts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">{opts.map(o=><button key={o} onClick={()=>send(o)} className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white border-2 border-amber-200 text-amber-800 rounded-full text-xs sm:text-sm font-medium hover:border-amber-400 hover:bg-amber-50 transition-all active:scale-95">{o}</button>)}</div>
          )}
          {!loading && styles && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-3">
              {STYLE_OPTIONS.map(s=><button key={s.id} onClick={()=>send(`${s.emoji} ${s.name}`)} className="p-3 sm:p-4 bg-white border-2 border-amber-200 rounded-xl text-left hover:border-amber-400 hover:shadow-md transition-all"><div className="text-xl sm:text-2xl mb-1">{s.emoji}</div><div className="font-medium text-amber-900 text-xs sm:text-sm">{s.name}</div><div className="text-[10px] sm:text-xs text-amber-600 mt-0.5 hidden sm:block">{s.desc}</div></button>)}
            </div>
          )}

          {/* 评估补全 */}
          {evaluating && (
            <div className="mt-4 p-4 sm:p-5 bg-white rounded-2xl shadow-lg border border-amber-300">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500"/><h3 className="text-base sm:text-lg font-bold text-amber-900">品牌信息补充</h3></div>
              <p className="text-xs sm:text-sm text-neutral-500 mb-3 sm:mb-4">补充后能让生成结果更贴合您的品牌</p>
              <div className="space-y-3 sm:space-y-4">
                {checks.map(c => {
                  if (c.score >= 2) return null;
                  const bl = c.isRequired && c.score < 1;
                  return (
                    <div key={c.key}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded ${bl?"bg-red-50 text-red-600":"bg-amber-50 text-amber-600"}`}>{bl?"⚠️ 必填":"建议补充"}</span>
                        <span className="text-xs sm:text-sm font-medium text-neutral-800">{c.label}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-amber-600 mb-1.5">{c.question}</p>
                      <input type="text" value={sups[c.key]||""} onChange={e=>setSups(p=>({...p,[c.key]:e.target.value}))} placeholder="请输入..."
                        className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 sm:mt-5 flex gap-2 sm:gap-3">
                <button onClick={doSup} disabled={suping} className="flex-1 flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl text-sm sm:text-base hover:shadow-lg transition-all disabled:opacity-60">
                  {suping?<Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin"/>:<Sparkles className="w-4 h-4 sm:w-5 sm:h-5"/>}
                  {suping?"提交中...":"补充完成，继续生成"}
                </button>
                {!hasBlock(checks) && <button onClick={skipEval} className="px-3 sm:px-4 py-2.5 sm:py-3 bg-neutral-100 text-neutral-600 rounded-xl text-xs sm:text-sm hover:bg-neutral-200">跳过</button>}
              </div>
            </div>
          )}

          {/* 简报 */}
          {done && brief && (
            <div className="mt-4 p-4 sm:p-5 bg-white rounded-2xl shadow-lg border border-amber-200">
              <div className="flex items-center gap-2 mb-3 sm:mb-4"><CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-500"/><h3 className="text-base sm:text-lg font-bold text-amber-900">品牌档案已生成</h3></div>
              <div className="space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-start gap-2"><span className="text-amber-600 font-medium min-w-[60px] sm:min-w-[70px] shrink-0">品牌精神：</span><span className="text-neutral-700">{brief.brand_story?.brand_spirit}</span></div>
                <div className="flex items-start gap-2"><span className="text-amber-600 font-medium min-w-[60px] sm:min-w-[70px] shrink-0">视觉风格：</span><span className="text-neutral-700">{brief.visual_dna?.style}</span></div>
                <div className="flex items-start gap-2"><span className="text-amber-600 font-medium min-w-[60px] sm:min-w-[70px] shrink-0">推荐口号：</span><span className="text-neutral-700">{brief.slogan_candidates?.[0]}</span></div>
                <div className="flex items-start gap-2"><span className="text-amber-600 font-medium min-w-[60px] sm:min-w-[70px] shrink-0">推荐套餐：</span><span className="text-neutral-700">{brief.package_recommendation?.package}（¥{brief.package_recommendation?.price}）</span></div>
              </div>
              <button onClick={doSubmit} disabled={submitting} className="w-full mt-4 sm:mt-5 flex items-center justify-center gap-2 py-2.5 sm:py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl text-sm sm:text-base hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-60">
                {submitting?<><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin"/><span>正在提交...</span></>:<><span>开始生成VI手册</span><ArrowRight className="w-4 h-4 sm:w-5 sm:h-5"/></>}
              </button>
            </div>
          )}
          {genBrief && (
            <div className="mt-4 p-4 sm:p-5 bg-white rounded-2xl shadow-lg border border-amber-200 text-center">
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-amber-500 mx-auto mb-2"/><p className="text-amber-700 font-medium text-sm sm:text-base">正在生成品牌档案...</p>
            </div>
          )}
          <div ref={endRef}/>
        </div>
      </main>

      {/* 底部输入 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-neutral-100 z-40">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {cam && <button onClick={()=>fileRef.current?.click()} className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full hover:bg-amber-200"><Camera className="w-5 h-5 sm:w-6 sm:h-6"/></button>}
            <div className="flex-1"><input ref={inpRef} type="text" value={inp} onChange={e=>setInp(e.target.value)} onKeyPress={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder="输入您的回答..." className="w-full px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base bg-neutral-100 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-300" disabled={loading||done}/></div>
            <button onClick={()=>send()} disabled={!inp.trim()||loading||done} className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full hover:shadow-lg disabled:opacity-50 transition-all active:scale-95">
              {loading?<Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin"/>:<Send className="w-4 h-4 sm:w-5 sm:h-5"/>}
            </button>
          </div>
          <p className="text-center text-[10px] sm:text-xs text-amber-500 mt-1.5 sm:mt-2">{done?"品牌发现已完成":"品牌顾问 小Brand 为您服务～"}</p>
        </div>
      </footer>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=async ev=>await send(undefined,ev.target?.result as string);r.readAsDataURL(f);e.target.value="";}} className="hidden"/>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

const QUESTIONS = [
  '您好！我是品牌大脑的AI顾问。请先告诉我，您的店铺叫什么名字？',
  '您的店铺开了多少年了？当初为什么会选择开这家店？',
  '您觉得您的店最大的特色是什么？顾客最常夸您什么？',
  '您的目标客户主要是哪些人？他们有什么特点？',
  '目前店里的视觉形象（招牌、包装、宣传物料）是谁帮您设计的？您满意吗？',
  '如果让您用一个词形容您店铺的气质，您会用哪个词？',
  '您有没有自己画过或者想象中的品牌形象？比如颜色、图案、吉祥物？',
  '您希望品牌化之后，店铺给顾客的第一印象是什么？',
];

function InterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'basic';
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: QUESTIONS[0] },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 访谈完成后保存数据并跳转
  const handleComplete = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.submissionId) {
          router.push(`/consultation?from=interview&sid=${data.submissionId}&plan=${plan}`);
          return;
        }
      }
    } catch (e) {
      console.warn('Interview save failed, going to consultation directly');
    }
    setSaving(false);
    router.push(`/consultation?from=interview&plan=${plan}`);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const nextStep = step + 1;

    if (nextStep >= QUESTIONS.length) {
      setCompleted(true);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '感谢您的分享！AI已为您提取品牌信息，接下来请补充联系方式和素材即可提交。点击下方按钮继续。',
        },
      ]);
      setLoading(false);
      setStep(nextStep);
      return;
    }

    // Try AI-powered follow-up via API
    try {
      const res = await fetch('/api/interview/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMsg }],
          questionIndex: nextStep,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.message || QUESTIONS[nextStep] },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: QUESTIONS[nextStep] },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: QUESTIONS[nextStep] },
      ]);
    }

    setStep(nextStep);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI 品牌访谈</h1>
          <p className="text-gray-500 mt-2">和AI顾问聊聊，发现您店铺的品牌潜力</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl text-sm text-gray-400">
                  正在思考...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {!completed ? (
            <div className="p-4 border-t flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="请输入您的回答..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-orange-400 text-sm"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                发送
              </button>
            </div>
          ) : (
            <div className="p-6 text-center border-t">
              <p className="text-green-600 font-medium mb-4">访谈已完成！</p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/"
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm"
                >
                  返回首页
                </Link>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="px-6 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? '正在保存...' : '填写详细资料'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            ⿛度：{Math.min(step + 1, QUESTIONS.length)}/{QUESTIONS.length} 题
          </p>
        </div>
      </div>
    </div>
  );
}


export default function InterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">加载中...</div>
      </div>
    }>
      <InterviewContent />
    </Suspense>
  );
}

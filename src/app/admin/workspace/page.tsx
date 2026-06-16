"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ExternalLink, Plus, Loader2, Send } from "lucide-react";

interface Member {
  id: string;
  brand_name: string;
  phone: string;
  plan: string;
  created_at: string;
}

interface PendingContent {
  id: string;
  brand_name: string;
  status: string;
  caption: string;
  confirmed: boolean;
  created_at: string;
}

export default function WorkspacePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingContents, setPendingContents] = useState<PendingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [generateNote, setGenerateNote] = useState("");
  const [generatePlatform, setGeneratePlatform] = useState("xiaohongshu");
  const [generateLoading, setGenerateLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me").then((r) => r.json()).then((d) => {
      if (!d.success || d.role !== "student") {
        window.location.href = "/admin/login";
        return;
      }
      setUserName(d.name || "合伙人");
    });

    // 获取客户列表
    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.clients || d.members || []);
      })
      .catch(() => {});

    // 获取自己生成的待确认内容
    fetch("/api/admin/my-contents")
      .then((r) => r.json())
      .then((d) => {
        setPendingContents(d.contents || []);
      })
      .catch(() => {});

    setLoading(false);
  }, []);

  const handleGenerate = async () => {
    if (!selectedMember) return;
    setGenerateLoading(true);
    try {
      const res = await fetch("/api/admin/generate-for-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMember,
          note: generateNote,
          platform: generatePlatform,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowGenerate(false);
        setGenerateNote("");
        setSelectedMember("");
        // 刷新内容列表
        const cr = await fetch("/api/admin/my-contents");
        const cd = await cr.json();
        setPendingContents(cd.contents || []);
        alert("已为客户创建内容，请继续生成文案和图片");
      } else {
        alert(data.error || "创建失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setGenerateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingCount = pendingContents.filter(c => !c.confirmed).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">我的客户</h1>
            <p className="text-xs text-neutral-500">{userName}，管理你服务的品牌</p>
          </div>
        </div>
        <button onClick={() => setShowGenerate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800"
        >
          <Plus className="w-3.5 h-3.5" />为客户生成内容
        </button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-neutral-900">{members.length}</div>
          <div className="text-xs text-neutral-500 mt-1">服务客户</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{pendingContents.length}</div>
          <div className="text-xs text-neutral-500 mt-1">已生成内容</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-xs text-neutral-500 mt-1">待老板确认</div>
        </div>
      </div>

      {/* 生成内容弹窗 */}
      {showGenerate && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h3 className="font-bold text-neutral-900 mb-4">为客户生成内容</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-neutral-600 mb-1 block">选择客户</label>
              <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
              >
                <option value="">选择客户...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.brand_name || m.phone}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-neutral-600 mb-1 block">内容平台</label>
              <div className="flex gap-2">
                {[
                  { value: "xiaohongshu", label: "小红书" },
                  { value: "wechat", label: "朋友圈" },
                  { value: "douyin", label: "抖音" },
                ].map(p => (
                  <button key={p.value} onClick={() => setGeneratePlatform(p.value)}
                    className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${
                      generatePlatform === p.value
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-neutral-600 mb-1 block">备注（可选）</label>
              <textarea value={generateNote} onChange={e => setGenerateNote(e.target.value)}
                placeholder="描述内容需求，如：新菜品推广、节日活动..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleGenerate} disabled={generateLoading || !selectedMember}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-2"
              >
                {generateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {generateLoading ? "创建中..." : "创建内容"}
              </button>
              <button onClick={() => setShowGenerate(false)}
                className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-lg text-sm hover:bg-neutral-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 客户列表 */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">我的客户</h3>
        {members.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200">
            <Briefcase className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">暂无客户</p>
            <p className="text-neutral-400 text-xs mt-1">请联系管理员分配客户</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map(m => (
              <div key={m.id} className="bg-white rounded-2xl border border-neutral-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-neutral-900">{m.brand_name || "未命名品牌"}</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">{m.phone}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    m.plan === "manager" ? "bg-green-50 text-green-600" :
                    m.plan === "standard" ? "bg-blue-50 text-blue-600" :
                    "bg-neutral-100 text-neutral-500"
                  }`}>
                    {m.plan === "manager" ? "品牌管家" : m.plan === "standard" ? "标准版" : "基础版"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 待确认内容 */}
      {pendingContents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">已生成的内容</h3>
          <div className="space-y-3">
            {pendingContents.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-700">{c.brand_name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{c.caption ? c.caption.slice(0, 50) + "..." : "内容生成中"}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    c.confirmed ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {c.confirmed ? "已确认" : "待确认"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

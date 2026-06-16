"use client";

import { useEffect, useState, useRef } from "react";
import { Briefcase, Plus, Loader2, Send, Sparkles, Camera, ChevronDown, ChevronUp, Copy, Check, Image as ImageIcon } from "lucide-react";

interface Member {
  id: string;
  brand_name: string;
  phone: string;
  plan: string;
  created_at: string;
}

interface ContentItem {
  id: string;
  member_id: string;
  brand_name: string;
  caption: string;
  status: string;
  confirmed: boolean;
  platform: string;
  created_at: string;
  note: string;
  images?: string[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待生成", color: "text-yellow-600 bg-yellow-50" },
  processing: { label: "生成中", color: "text-blue-600 bg-blue-50" },
  ready: { label: "已完成", color: "text-green-600 bg-green-50" },
  published: { label: "已发布", color: "text-neutral-600 bg-neutral-50" },
};

const PLATFORM_OPTIONS = [
  { value: "xiaohongshu", label: "小红书" },
  { value: "wechat", label: "朋友圈" },
  { value: "douyin", label: "抖音" },
];

export default function WorkspacePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [generateNote, setGenerateNote] = useState("");
  const [generatePlatform, setGeneratePlatform] = useState("xiaohongshu");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingPlatform, setGeneratingPlatform] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/me").then((r) => r.json()).then((d) => {
      if (!d.success || d.role !== "student") {
        window.location.href = "/admin/login";
        return;
      }
      setUserName(d.name || "合伙人");
    });

    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then((d) => setMembers(d.clients || d.members || []))
      .catch(() => {});

    refreshContents();
  }, []);

  const refreshContents = async () => {
    try {
      const r = await fetch("/api/admin/my-contents");
      const d = await r.json();
      // 额外获取images字段
      if (d.contents && d.contents.length > 0) {
        // my-contents API已经返回了基本字段，我们需要images
        // 检查是否已有images
        const needsImages = d.contents.filter((c: any) => !c.images);
        if (needsImages.length > 0) {
          // 补查images
          const ids = needsImages.map((c: any) => c.id);
          // 简单方案：直接用返回的数据，images可能为undefined
        }
      }
      setContents(d.contents || []);
    } catch {} finally {
      setLoading(false);
    }
  };

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
        await refreshContents();
      } else {
        alert(data.error || "创建失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleAIGenerate = async (contentId: string, platform: string) => {
    setGeneratingId(contentId);
    setGeneratingPlatform(platform);
    try {
      const res = await fetch("/api/admin/student-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, platform }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshContents();
      } else {
        alert(data.error || "生成失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setGeneratingId(null);
      setGeneratingPlatform(null);
    }
  };

  const handleUploadPhotos = async (contentId: string, files: FileList) => {
    setUploadingId(contentId);
    try {
      const formData = new FormData();
      formData.append("contentId", contentId);
      for (let i = 0; i < files.length; i++) {
        formData.append("photos", files[i]);
      }
      const res = await fetch("/api/admin/student-upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        await refreshContents();
      } else {
        alert(data.error || "上传失败");
      }
    } catch {
      alert("上传失败");
    } finally {
      setUploadingId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const triggerUpload = (contentId: string) => {
    setUploadTargetId(contentId);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && uploadTargetId) {
      handleUploadPhotos(uploadTargetId, e.target.files);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingCount = contents.filter(c => !c.confirmed).length;
  const readyCount = contents.filter(c => c.confirmed && c.status === "ready").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 隐藏的文件输入 */}
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={onFileChange} />

      {/* 头部 */}
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
          <div className="text-2xl font-bold text-blue-600">{contents.length}</div>
          <div className="text-xs text-neutral-500 mt-1">已创建内容</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-xs text-neutral-500 mt-1">待老板确认</div>
        </div>
      </div>

      {/* ⭐ 内容列表 — 核心区域，放在客户列表前面 */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">📝 我生成的内容</h3>
        {contents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200">
            <ImageIcon className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">还没有内容</p>
            <p className="text-neutral-400 text-xs mt-1">点击右上角「为客户生成内容」开始</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contents.map((c) => {
              const statusInfo = STATUS_MAP[c.status] || STATUS_MAP.pending;
              const isExpanded = expandedContent === c.id;
              const isGenerating = generatingId === c.id;
              const isUploading = uploadingId === c.id;
              const hasImages = c.images && c.images.length > 0 && c.images.some(img => !img.startsWith("pending_"));
              const imageCount = c.images?.filter(img => !img.startsWith("pending_")).length || 0;

              return (
                <div key={c.id} className={`bg-white rounded-xl border p-4 ${!c.confirmed ? "border-amber-200" : "border-neutral-200"}`}>
                  {/* 顶部：品牌+状态+展开按钮 */}
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedContent(isExpanded ? null : c.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900">{c.brand_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                          {isGenerating ? "生成中..." : statusInfo.label}
                        </span>
                        {!c.confirmed && c.status === "ready" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">待老板确认</span>
                        )}
                        {c.confirmed && c.status === "ready" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">老板已确认 ✓</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {PLATFORM_OPTIONS.find(p => p.value === c.platform)?.label || c.platform} · {new Date(c.created_at).toLocaleDateString("zh-CN")}
                        {imageCount > 0 && ` · ${imageCount}张照片`}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                  </div>

                  {/* 预览文字（收起时） */}
                  {!isExpanded && c.caption && (
                    <p className="text-xs text-neutral-500 mt-2 line-clamp-1">{c.caption}</p>
                  )}

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
                      {/* 照片 */}
                      <div>
                        <p className="text-xs text-neutral-500 mb-2">📷 照片</p>
                        {hasImages ? (
                          <div className="grid grid-cols-4 gap-2">
                            {c.images?.filter(img => !img.startsWith("pending_")).map((img, i) => (
                              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-neutral-100">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-neutral-400">暂无照片</p>
                        )}
                        <button
                          onClick={() => triggerUpload(c.id)}
                          disabled={isUploading}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 border border-dashed border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
                        >
                          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                          {isUploading ? "上传中..." : "上传照片"}
                        </button>
                      </div>

                      {/* 备注 */}
                      {c.note && (
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">📝 备注</p>
                          <p className="text-sm text-neutral-700">{c.note}</p>
                        </div>
                      )}

                      {/* AI生成文案按钮 — pending状态 */}
                      {c.status === "pending" && !isGenerating && (
                        <div>
                          <p className="text-xs text-neutral-500 mb-2">✨ 生成AI文案</p>
                          <div className="flex gap-2">
                            {PLATFORM_OPTIONS.map((p) => (
                              <button key={p.value} onClick={() => handleAIGenerate(c.id, p.value)}
                                className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800"
                              >
                                <Sparkles className="w-3.5 h-3.5" />{p.label}文案
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 生成中 */}
                      {isGenerating && (
                        <div className="flex items-center gap-2 py-3 justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                          <span className="text-sm text-blue-600">正在生成{PLATFORM_OPTIONS.find(p => p.value === generatingPlatform)?.label || ""}文案...</span>
                        </div>
                      )}

                      {/* 已生成的文案 */}
                      {c.caption && (
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">📄 文案</p>
                          <div className="p-3 bg-neutral-50 rounded-lg relative">
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap pr-8">{c.caption}</p>
                            <button onClick={() => handleCopy(c.caption, c.id)}
                              className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600"
                            >
                              {copied === c.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 重新生成按钮（ready状态） */}
                      {c.status === "ready" && !isGenerating && (
                        <div>
                          <p className="text-xs text-neutral-500 mb-2">🔄 重新生成</p>
                          <div className="flex gap-2">
                            {PLATFORM_OPTIONS.map((p) => (
                              <button key={p.value} onClick={() => handleAIGenerate(c.id, p.value)}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                              >
                                <Sparkles className="w-3 h-3" />{p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 客户列表 */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">👥 我的客户</h3>
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
                {PLATFORM_OPTIONS.map(p => (
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
    </div>
  );
}

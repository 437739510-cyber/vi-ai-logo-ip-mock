"use client";

import { useEffect, useState, useRef } from "react";
import { Briefcase, Plus, Loader2, Send, Sparkles, Camera, ChevronDown, ChevronUp, Copy, Check, Image as ImageIcon, UserPlus, Link2, Share2, Upload, ExternalLink } from "lucide-react";

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
  publish_link?: string;
  publish_proof?: { url?: string; note?: string };
  published_at?: string;
}

interface Assignment {
  studentId: string;
  projectId: string;
  status: string;
  source: string | null;
  brandName: string;
  phone: string;
  createdAt: string;
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
  // 发布闭环（TICKET-122-R21）
  const [publishTargetId, setPublishTargetId] = useState<string | null>(null);
  const [publishPlatform, setPublishPlatform] = useState("xiaohongshu");
  const [publishLink, setPublishLink] = useState("");
  const [publishProofNote, setPublishProofNote] = useState("");
  const [publishProofFile, setPublishProofFile] = useState<File | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showBind, setShowBind] = useState(false);
  const [bindMode, setBindMode] = useState<"submit" | "claim">("submit");
  const [bindPhone, setBindPhone] = useState("");
  const [bindCompanyName, setBindCompanyName] = useState("");
  const [bindWechat, setBindWechat] = useState("");
  const [bindIndustry, setBindIndustry] = useState("");
  const [bindClientName, setBindClientName] = useState("");
  const [bindLoading, setBindLoading] = useState(false);
  const [bindMsg, setBindMsg] = useState("");

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

    refreshAssignments();
    refreshContents();
  }, []);

  const refreshAssignments = async () => {
    try {
      const r = await fetch("/api/admin/student-assignments");
      const d = await r.json();
      setAssignments(d.mine || []);
      // 同步刷新客户列表，确认归属后学生立即可服务
      const cr = await fetch("/api/admin/clients");
      const cd = await cr.json();
      setMembers(cd.clients || cd.members || []);
    } catch {
      setAssignments([]);
    }
  };

  const confirmedPhones = new Set(
    assignments.filter((a) => a.status === "confirmed" && a.phone).map((a) => a.phone),
  );

  const handleSubmitLead = async () => {
    if (!bindPhone) {
      setBindMsg("请填写客户手机号");
      return;
    }
    setBindLoading(true);
    setBindMsg("");
    try {
      const res = await fetch("/api/admin/student-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submitLead",
          phone: bindPhone,
          companyName: bindCompanyName || bindClientName,
          clientName: bindClientName || bindCompanyName,
          wechat: bindWechat,
          industry: bindIndustry,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBindMsg(`线索已提交，待管理员确认归属（项目 ${data.projectId}）`);
        setBindPhone(""); setBindCompanyName(""); setBindWechat(""); setBindIndustry(""); setBindClientName("");
        await refreshAssignments();
      } else {
        setBindMsg(data.error || "提交失败");
      }
    } catch {
      setBindMsg("网络错误");
    } finally {
      setBindLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!bindPhone) {
      setBindMsg("请填写客户手机号");
      return;
    }
    setBindLoading(true);
    setBindMsg("");
    try {
      const res = await fetch("/api/admin/student-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", phone: bindPhone }),
      });
      const data = await res.json();
      if (data.success) {
        setBindMsg(`认领成功，待管理员确认归属（项目 ${data.projectId}）`);
        setBindPhone("");
        await refreshAssignments();
      } else {
        setBindMsg(data.error || "认领失败");
      }
    } catch {
      setBindMsg("网络错误");
    } finally {
      setBindLoading(false);
    }
  };

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

  const startPublish = (c: ContentItem) => {
    setPublishTargetId(c.id);
    setPublishPlatform(c.platform || "xiaohongshu");
    setPublishLink(c.publish_link || "");
    setPublishProofNote(c.publish_proof?.note || "");
    setPublishProofFile(null);
    setPublishMsg("");
  };

  const cancelPublish = () => {
    setPublishTargetId(null);
    setPublishLink("");
    setPublishProofNote("");
    setPublishProofFile(null);
    setPublishMsg("");
  };

  const handlePublishProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPublishProofFile(e.target.files[0]);
      e.target.value = "";
    }
  };

  const handlePublishSubmit = async () => {
    if (!publishTargetId) return;
    if (!publishLink.trim()) {
      setPublishMsg("请填写发布链接");
      return;
    }
    setPublishLoading(true);
    setPublishMsg("");
    try {
      let proofUrl = "";
      if (publishProofFile) {
        const formData = new FormData();
        formData.append("contentId", publishTargetId);
        formData.append("proof", publishProofFile);
        const up = await fetch("/api/admin/upload-publish-proof", { method: "POST", body: formData });
        const upData = await up.json();
        if (!upData.success) {
          setPublishMsg(upData.error || "凭证上传失败");
          setPublishLoading(false);
          return;
        }
        proofUrl = upData.url || "";
      }

      const res = await fetch("/api/admin/publish-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: publishTargetId,
          platform: publishPlatform,
          link: publishLink.trim(),
          proofUrl,
          proofNote: publishProofNote.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishMsg("已提交发布");
        cancelPublish();
        await refreshContents();
      } else {
        setPublishMsg(data.error || "发布失败");
      }
    } catch {
      setPublishMsg("网络错误");
    } finally {
      setPublishLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingAssignments = assignments.filter(a => a.status === "pending").length;
  const confirmedAssignments = assignments.filter(a => a.status === "confirmed").length;

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
          <div className="text-2xl font-bold text-neutral-900">{confirmedAssignments}</div>
          <div className="text-xs text-neutral-500 mt-1">已确认归属</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{pendingAssignments}</div>
          <div className="text-xs text-neutral-500 mt-1">待确认归属</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{contents.length}</div>
          <div className="text-xs text-neutral-500 mt-1">已创建内容</div>
        </div>
      </div>

      {/* ⭐ 获客入口：提交线索 / 认领客户 */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-neutral-700" />
            <h3 className="font-semibold text-neutral-900">获客</h3>
            <span className="text-xs text-neutral-400">提交你拉来的商家线索，或认领已提交的客户</span>
          </div>
          <button onClick={() => setShowBind(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800">
            {showBind ? "收起" : "提交线索 / 认领客户"}
          </button>
        </div>

        {showBind && (
          <div className="space-y-3 border-t border-neutral-100 pt-4">
            <div className="flex gap-2">
              <button onClick={() => { setBindMode("submit"); setBindMsg(""); setBindPhone(""); }}
                className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${bindMode === "submit" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                提交新线索
              </button>
              <button onClick={() => { setBindMode("claim"); setBindMsg(""); setBindPhone(""); }}
                className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${bindMode === "claim" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                认领已有客户
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm text-neutral-600 mb-1 block">客户手机号 *</label>
                <input type="tel" value={bindPhone} onChange={e => setBindPhone(e.target.value)}
                  placeholder="11位手机号" maxLength={11}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
              </div>

              {bindMode === "submit" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-neutral-600 mb-1 block">店名 / 公司名</label>
                      <input type="text" value={bindCompanyName} onChange={e => setBindCompanyName(e.target.value)}
                        placeholder="商家名称" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-600 mb-1 block">联系人</label>
                      <input type="text" value={bindClientName} onChange={e => setBindClientName(e.target.value)}
                        placeholder="老板称呼" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-neutral-600 mb-1 block">微信</label>
                      <input type="text" value={bindWechat} onChange={e => setBindWechat(e.target.value)}
                        placeholder="可选" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-600 mb-1 block">行业</label>
                      <input type="text" value={bindIndustry} onChange={e => setBindIndustry(e.target.value)}
                        placeholder="如：餐饮/烘焙/美容" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
                    </div>
                  </div>
                </>
              )}

              <button onClick={bindMode === "submit" ? handleSubmitLead : handleClaim}
                disabled={bindLoading || !bindPhone}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-2 justify-center">
                {bindLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : bindMode === "submit" ? <UserPlus className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {bindLoading ? "提交中..." : bindMode === "submit" ? "提交线索" : "申请认领"}
              </button>

              {bindMsg && (
                <p className={`text-sm ${bindMsg.includes("成功") || bindMsg.includes("已提交") || bindMsg.includes("认领成功") ? "text-green-600" : "text-red-500"}`}>{bindMsg}</p>
              )}
            </div>
          </div>
        )}

        {/* 归属记录 */}
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <p className="text-sm font-semibold text-neutral-700 mb-2">我的归属记录</p>
          {assignments.length === 0 ? (
            <p className="text-xs text-neutral-400">暂无归属记录，提交线索或认领客户后显示</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div key={a.projectId} className="flex items-center justify-between text-sm py-2 border-b border-neutral-50">
                  <div className="min-w-0">
                    <p className="text-neutral-900 truncate">{a.brandName || a.phone || a.projectId}</p>
                    <p className="text-xs text-neutral-400">{a.phone} · {a.source === "submit" ? "提交线索" : "认领"} · {a.projectId}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === "confirmed" ? "bg-green-100 text-green-700" : a.status === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {a.status === "confirmed" ? "已确认" : a.status === "rejected" ? "已拒绝" : "待确认"}
                  </span>
                </div>
              ))}
            </div>
          )}
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

                      {/* 发布闭环（TICKET-122-R21）：已发布记录展示 */}
                      {c.status === "published" && (
                        <div className="p-3 bg-neutral-50 rounded-lg space-y-1.5">
                          <p className="text-xs text-neutral-500 mb-1">🚀 发布记录</p>
                          <p className="text-sm text-neutral-700">
                            平台：{PLATFORM_OPTIONS.find(p => p.value === c.platform)?.label || c.platform}
                          </p>
                          {c.publish_link && (
                            <a href={c.publish_link} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-sm text-blue-600 hover:underline break-all">
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />{c.publish_link}
                            </a>
                          )}
                          {c.published_at && (
                            <p className="text-xs text-neutral-400">发布时间：{new Date(c.published_at).toLocaleString("zh-CN")}</p>
                          )}
                          {c.publish_proof?.note && (
                            <p className="text-xs text-neutral-500">凭证说明：{c.publish_proof.note}</p>
                          )}
                          {c.publish_proof?.url && (
                            <a href={c.publish_proof.url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <Upload className="w-3 h-3" />查看凭证截图
                            </a>
                          )}
                        </div>
                      )}

                      {/* 发布入口：仅在已确认且就绪时可发布 */}
                      {c.status === "ready" && c.confirmed && !isGenerating && (
                        <div>
                          {publishTargetId === c.id ? (
                            <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 space-y-3">
                              <p className="text-xs font-semibold text-neutral-700">🚀 填写发布信息</p>
                              <div>
                                <label className="text-xs text-neutral-600 mb-1 block">发布平台</label>
                                <div className="flex gap-2">
                                  {PLATFORM_OPTIONS.map(p => (
                                    <button key={p.value} onClick={() => setPublishPlatform(p.value)}
                                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
                                        publishPlatform === p.value ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                                      }`}>
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-neutral-600 mb-1 block">发布链接 *</label>
                                <input type="text" value={publishLink} onChange={e => setPublishLink(e.target.value)}
                                  placeholder="发布后的链接" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
                              </div>
                              <div>
                                <label className="text-xs text-neutral-600 mb-1 block">凭证截图（可选）</label>
                                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-neutral-300 rounded-lg cursor-pointer hover:bg-neutral-50 text-xs text-neutral-500">
                                  <Upload className="w-3.5 h-3.5" />{publishProofFile ? publishProofFile.name : "点击选择截图"}
                                  <input type="file" className="hidden" accept="image/*" onChange={handlePublishProofChange} />
                                </label>
                              </div>
                              <div>
                                <label className="text-xs text-neutral-600 mb-1 block">凭证说明（可选）</label>
                                <textarea value={publishProofNote} onChange={e => setPublishProofNote(e.target.value)}
                                  placeholder="如：已发布到小红书，账号 xx" rows={2}
                                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20 resize-none" />
                              </div>
                              {publishMsg && (
                                <p className={`text-xs ${publishMsg.includes("已提交") || publishMsg.includes("成功") ? "text-green-600" : "text-red-500"}`}>{publishMsg}</p>
                              )}
                              <div className="flex gap-2">
                                <button onClick={handlePublishSubmit} disabled={publishLoading}
                                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-50">
                                  {publishLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                                  {publishLoading ? "提交中..." : "确认已发布"}
                                </button>
                                <button onClick={cancelPublish}
                                  className="px-3 py-2 text-xs text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200">
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => startPublish(c)}
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                              <Share2 className="w-3.5 h-3.5" />发布
                            </button>
                          )}
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
        {confirmedPhones.size === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200">
            <Briefcase className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">暂无客户</p>
            <p className="text-neutral-400 text-xs mt-1">提交线索或认领客户，待管理员确认后即可服务</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.filter(m => m.phone && confirmedPhones.has(m.phone)).map(m => (
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

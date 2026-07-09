"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/core/supabase";
import { Loader2, MessageCircle, X, Send, ImageUp, Check, ChevronRight } from "lucide-react";
import { STORAGE_BUCKET } from "@/config/storage";

// ===== 常量 =====
const STORAGE_BUCKET = STORAGE_BUCKET;
const STORAGE_PREFIX = "uploads/form-assets";
const MAX_PHOTO_SIZE = 20 * 1024 * 1024;

// 常见行业快捷选择（前8个）
const QUICK_INDUSTRIES = [
  "餐饮:火锅", "餐饮:小吃快餐", "餐饮:奶茶/茶饮",
  "购物:服装鞋帽", "丽人:美发", "生活服务:宠物服务",
  "教育培训", "公司企业",
];

const BUSINESS_FORMS = [
  "路边摊/档口", "小店/夫妻店", "门店/商铺", "连锁/品牌", "高端/精品",
];

// ===== 消息类型 =====
interface ChatMessage {
  role: "bot" | "user";
  text: string;
  type?: "text" | "upload" | "buttons" | "result";
}

type ChatStep =
  | "greeting"
  | "ask_name"
  | "ask_phone"
  | "ask_industry"
  | "ask_city"
  | "ask_products"
  | "ask_business_form"
  | "ask_vision"
  | "ask_photos"
  | "ask_logo"
  | "submit"
  | "done";

// ===== 组件 =====
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ChatStep>("greeting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [storePhotoList, setStorePhotoList] = useState<File[]>([]);
  const [logoFileList, setLogoFileList] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  // 用户收集的数据
  const answers = useRef<Record<string, string>>({});

  // 自动滚动到底部
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 打开时显示迎客语
  useEffect(() => {
    if (open && messages.length === 0) {
      setTimeout(() => {
        addBotMsg("您好！欢迎来到 BrandBrain 🎉\n\n我是您的品牌助手，来帮您生成专业的VI品牌手册！先问您几个简单问题，几分钟就好~");
        setStep("ask_name");
      }, 500);
    }
  }, [open]);

  function addBotMsg(text: string, type?: ChatMessage["type"]) {
    setMessages((prev) => [...prev, { role: "bot", text, type: type || "text" }]);
  }

  function addUserMsg(text: string) {
    setMessages((prev) => [...prev, { role: "user", text }]);
  }

  function goTo(nextStep: ChatStep, botText: string) {
    setStep(nextStep);
    setTimeout(() => addBotMsg(botText), 300);
  }

  // ===== 处理用户输入 =====
  function handleSend() {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    addUserMsg(text);
    processInput(text);
  }

  function handleQuickPick(value: string, label: string) {
    addUserMsg(label);
    processInput(value);
  }

  function processInput(value: string) {
    switch (step) {
      case "ask_name":
        answers.current.companyName = value;
        goTo("ask_phone", `「${value}」好名字！那您的手机号是？方便后续接收查看密码和通知📱`);
        break;

      case "ask_phone":
        if (!/^1[3-9]\d{9}$/.test(value)) {
          addBotMsg("手机号格式不对哦，请输11位手机号，例如 13800138000 📱");
          return;
        }
        answers.current.phone = value;
        goTo("ask_industry", "好的！您做什么生意的呀？选一个行业👇");
        break;

      case "ask_industry":
        answers.current.industry = value;
        goTo("ask_city", `了解了！您在哪个城市经营呢？`);
        break;

      case "ask_city":
        answers.current.city = value;
        goTo("ask_products", `好的，${value}是个好地方！您店里主要卖什么产品或者提供什么服务？`);
        break;

      case "ask_products":
        answers.current.mainProducts = value;
        goTo("ask_business_form", "明白了！那您的经营形态是哪种？👇");
        break;

      case "ask_business_form":
        answers.current.businessForm = value;
        {const isStall = value === "路边摊/档口";
        addBotMsg(isStall
          ? `收到！流动摊的话，上传1张摊位照片就行 📸`
          : `好的！那请上传含门头在内的5张店内照片，方便AI为您匹配配色风格 📸`);
        setStep("ask_photos");
        setTimeout(() => {
          addBotMsg(isStall
            ? "请点击下方按钮上传1张照片👇"
            : "请点击下方按钮上传5张店内照片👇",
            "upload");
        }, 500);}
        break;

      case "ask_vision":
        answers.current.brandVision = value;
        // 检查照片是否已上传
        if (storePhotoList.length === 0) {
          setStep("ask_photos");
          addBotMsg("谢谢！最后一步，请上传店内照片（含门头）👇", "upload");
        } else {
          handleSubmitFlow();
        }
        break;

      default:
        // 其他步骤等待按钮操作
        break;
    }
  }

  // ===== 照片上传处理 =====
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const isStall = answers.current.businessForm === "路边摊/档口";
    const maxPhotos = isStall ? 1 : 5;

    const validFiles = files.filter((f) => {
      if (f.size > MAX_PHOTO_SIZE) {
        addBotMsg(`「${f.name}」超过20MB，已跳过`);
        return false;
      }
      return true;
    });

    const newList = [...storePhotoList, ...validFiles].slice(0, maxPhotos);
    setStorePhotoList(newList);

    const count = newList.length;
    addUserMsg(`📸 已上传 ${count}/${maxPhotos} 张`);

    if (count >= maxPhotos) {
      addBotMsg(`✅ 照片够了！`);
      // 问品牌愿景（选填）
      if (step === "ask_photos") {
        goTo("ask_logo", `您有没有现成的Logo想一起用？也可以之后上传，或者我们AI帮您生成😊\n\n（有的话点上传，没有点"跳过"）👇`);
      }
    } else {
      addBotMsg(`还差 ${maxPhotos - count} 张，继续上传👇`);
    }
    // 清空input以便重新选
    if (fileInput.current) fileInput.current.value = "";
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setLogoFileList(files);
    addUserMsg(`🖼️ 已选 ${files.length} 个Logo文件`);
    setTimeout(() => handleSubmitFlow(), 500);
  }

  function skipLogo() {
    addUserMsg("跳过，AI帮我生成");
    setTimeout(() => handleSubmitFlow(), 500);
  }

  // ===== 提交 =====
  async function handleSubmitFlow() {
    setStep("submit");
    addBotMsg("好的！信息都齐了，正在提交... ⏳");
    setSubmitting(true);

    try {
      // 上传照片
      const storeAssets: { fileName: string; url: string; size: number }[] = [];
      for (const file of storePhotoList) {
        const ext = file.name.split(".").pop() || "";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const storagePath = `${STORAGE_PREFIX}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(`照片上传失败: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
        storeAssets.push({ fileName: file.name, url: urlData.publicUrl, size: file.size });
      }

      // 上传Logo（如果有）
      const logoAssets: { fileName: string; url: string; size: number }[] = [];
      for (const file of logoFileList) {
        const ext = file.name.split(".").pop() || "";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const storagePath = `${STORAGE_PREFIX}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
          logoAssets.push({ fileName: file.name, url: urlData.publicUrl, size: file.size });
        }
      }

      // 构建提交数据
      const payload: Record<string, any> = {
        clientName: answers.current.phone,
        companyName: answers.current.companyName,
        phone: answers.current.phone,
        industry: answers.current.industry,
        city: answers.current.city,
        province: "",
        mainProducts: answers.current.mainProducts,
        businessForm: answers.current.businessForm,
        businessYears: 1,
        brandVision: answers.current.brandVision || "",
        storePhotos: storeAssets,
        logoFiles: logoAssets,
        mascotItems: [],
        referenceFile: null,
        referenceEnabled: false,
        description: `通过AI聊天引导提交（${answers.current.industry}，${answers.current.businessForm}）`,
      };

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "提交失败");
      }

      const result = await res.json();
      setStep("done");
      addBotMsg(
        `✅ **提交成功！**\n\n您的项目编号：**${result.projectId}**\n查看密码：**${result.viewPassword}**\n\n我们将在1-2个工作日内为您完成品牌设计！🎉\n\n📱 请截图保存项目编号和密码，后续可查看进度`,
        "result"
      );
    } catch (err: any) {
      setSubmitError(err.message);
      addBotMsg(`❌ 提交出错了：${err.message}\n请稍后再试，或联系客服`);
    } finally {
      setSubmitting(false);
    }
  }

  // ===== 渲染 =====
  return (
    <>
      {/* 浮动气泡 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* 聊天窗口 */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-neutral-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">B</div>
              <div>
                <p className="text-sm font-semibold">BrandBrain 助手</p>
                <p className="text-[10px] text-white/70">在线帮您设计品牌</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-white border border-neutral-100 text-neutral-800 rounded-bl-md shadow-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* 上传按钮（照片） */}
            {(step === "ask_photos") && (
              <div className="flex justify-start">
                <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-md p-3 shadow-sm space-y-2">
                  <p className="text-xs text-neutral-500">
                    已选 {storePhotoList.length}/{answers.current.businessForm === "路边摊/档口" ? 1 : 5} 张
                  </p>
                  {storePhotoList.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {storePhotoList.map((f, i) => (
                        <div key={i} className="text-[10px] bg-neutral-100 rounded px-1.5 py-0.5 text-neutral-600 truncate max-w-[120px]">
                          📷 {f.name.slice(0, 15)}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl hover:bg-amber-100 transition-colors"
                  >
                    <ImageUp className="w-4 h-4" />
                    {storePhotoList.length === 0 ? "选择照片" : "继续添加"}
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </div>
              </div>
            )}

            {/* 上传按钮（Logo） */}
            {(step === "ask_logo") && (
              <div className="flex justify-start">
                <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-md p-3 shadow-sm space-y-2">
                  <button
                    onClick={() => logoInput.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    <ImageUp className="w-4 h-4" />
                    上传Logo
                  </button>
                  <button
                    onClick={skipLogo}
                    className="w-full text-xs text-neutral-400 hover:text-neutral-600 py-1"
                  >
                    跳过，AI帮我生成
                  </button>
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleLogoSelect}
                  />
                </div>
              </div>
            )}

            {/* 快捷选择按钮 */}
            {(step === "ask_industry") && (
              <div className="flex justify-start">
                <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-md p-2 shadow-sm">
                  <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                    {QUICK_INDUSTRIES.map((ind) => (
                      <button
                        key={ind}
                        onClick={() => handleQuickPick(ind, ind)}
                        className="px-3 py-1.5 text-xs border border-neutral-200 rounded-full hover:bg-primary hover:text-white hover:border-primary transition-colors"
                      >
                        {ind}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setStep("ask_industry");
                        addUserMsg("其他");
                        setTimeout(() => addBotMsg("请打字告诉我您做什么生意的👇"), 300);
                      }}
                      className="px-3 py-1.5 text-xs border border-neutral-200 rounded-full hover:bg-primary hover:text-white hover:border-primary transition-colors"
                    >
                      其他
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 经营形态按钮 */}
            {(step === "ask_business_form") && (
              <div className="flex justify-start">
                <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-md p-2 shadow-sm">
                  <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                    {BUSINESS_FORMS.map((bf) => (
                      <button
                        key={bf}
                        onClick={() => handleQuickPick(bf, bf)}
                        className="px-3 py-1.5 text-xs border border-neutral-200 rounded-full hover:bg-primary hover:text-white hover:border-primary transition-colors"
                      >
                        {bf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 提交中 */}
            {submitting && (
              <div className="flex justify-start">
                <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              </div>
            )}

            <div ref={chatEnd} />
          </div>

          {/* 输入区域 */}
          {step !== "done" && step !== "ask_photos" && step !== "ask_logo" && step !== "ask_industry" && step !== "ask_business_form" && !submitting && (
            <div className="border-t border-neutral-100 p-3 flex items-center gap-2 bg-white shrink-0">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="输入您的回答..."
                className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark disabled:opacity-40 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 完成后的按钮 */}
          {step === "done" && (
            <div className="border-t border-neutral-100 p-3 bg-white shrink-0">
              <button
                onClick={() => {
                  setOpen(false);
                  // 重置
                  setTimeout(() => {
                    setMessages([]);
                    setStep("greeting");
                    setStorePhotoList([]);
                    setLogoFileList([]);
                    answers.current = {};
                    setSubmitError("");
                  }, 300);
                }}
                className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors"
              >
                ✅ 我知道了
              </button>
            </div>
          )}

          {/* 提交失败 */}
          {submitError && step !== "done" && (
            <div className="px-3 py-2 bg-red-50 text-red-600 text-xs text-center border-t border-red-100">
              {submitError}
            </div>
          )}
        </div>
      )}
    </>
  );
}

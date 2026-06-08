/**
 * Brand Discovery 对话状态机 v0.2
 * 
 * 实现完整的10问题品牌发现流程，支持分支逻辑
 * 状态流转: WELCOME → Q1-Q10 → COMPLETE
 */

// ============================================
// 类型定义
// ============================================

/** 问题答案类型 */
export type AnswerType = 
  | "open"           // 开放式问答
  | "multi-choice"   // 多选题
  | "single-choice"  // 单选题
  | "photo";         // 拍照上传

/** 对话阶段 */
export type DiscoveryPhase = 
  | "warmup"         // 热身阶段 (Q1-Q3)
  | "core"           // 核心故事 (Q4-Q6)
  | "visual"         // 视觉素材 (Q7-Q9)
  | "style";         // 风格确认 (Q10)

/** 对话状态 */
export type DiscoveryState =
  | "WELCOME"
  | "PHASE1_Q1"      // 开店年限
  | "PHASE1_Q2"      // 谁开的店
  | "PHASE1_Q3"      // 客人来的原因(多选)
  | "PHASE2_Q4"      // 最骄傲的事
  | "PHASE2_Q5"      // 感动的话
  | "PHASE2_Q6"      // 品牌精神
  | "PHASE3_Q7"      // 标志性物件
  | "PHASE3_Q8"      // 招牌拍照
  | "PHASE3_Q9"      // 店面照
  | "PHASE4_Q10"     // 风格选择
  | "COMPLETE";      // 完成

/** 状态节点配置 */
export interface StateNode {
  state: DiscoveryState;
  phase: DiscoveryPhase;
  question: string;
  hint?: string;                          // 可选的提示文字
  answerType: AnswerType;
  options?: string[];                     // 选择题选项
  extractionPrompt: string;               // LLM提取信息的prompt
  branchLogic: (data: ExtractedData) => DiscoveryState;  // 分支逻辑
  progress: number;                       // 进度百分比 (0-100)
}

/** 提取的数据结构 */
export interface ExtractedData {
  // Q1: 基本信息
  yearsInBusiness?: number;                // 开店年限
  founder?: string;                       // 创始人
  isOldStore?: boolean;                   // 是否是老店(>=10年)
  
  // Q2: 店铺历史
  storeHistory?: string;                 // 店铺历史故事
  familyStory?: string;                   // 家族传承故事
  
  // Q3: 客人来的原因(多选)
  customerReasons?: string[];             // 口味/手艺、价格实惠、老板人好、习惯/情怀、独家秘方、其他
  
  // Q4: 最骄傲的事
  proudMoment?: string;                  // 最骄傲的事
  
  // Q5: 感动的话
  touchingStory?: string;                // 感动的故事
  customerQuote?: string;                // 顾客的原话
  
  // Q6: 品牌精神
  brandSpirit?: string;                  // 品牌精神
  brandSpiritCustom?: string;            // 自定义品牌精神
  
  // Q7: 标志性物件
  signatureItem?: string;                // 标志性物件描述
  signatureItemPhoto?: string;           // 标志性物件照片(base64)
  
  // Q8: 招牌
  signboardPhoto?: string;              // 招牌照片(base64)
  
  // Q9: 店面照
  storefrontPhoto?: string;             // 店面照片(base64)
  
  // Q10: 风格选择
  selectedStyle?: string;                // 选择的风格
  styleNotes?: string;                  // 风格备注
}

/** 完整对话会话 */
export interface DiscoverySession {
  sessionId: string;
  currentState: DiscoveryState;
  extractedData: ExtractedData;
  conversationHistory: ConversationTurn[];
  createdAt: Date;
  updatedAt: Date;
  isComplete: boolean;
}

/** 对话轮次 */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  state?: DiscoveryState;
}

// ============================================
// 阶段配置
// ============================================

/** 阶段元信息 */
export const PHASE_META: Record<DiscoveryPhase, { name: string; progressStart: number; progressEnd: number }> = {
  warmup: { name: "热身", progressStart: 0, progressEnd: 30 },
  core: { name: "核心故事", progressStart: 30, progressEnd: 60 },
  visual: { name: "视觉素材", progressStart: 60, progressEnd: 90 },
  style: { name: "风格确认", progressStart: 90, progressEnd: 100 },
};

/** 风格选项 */
export const STYLE_OPTIONS = [
  { id: "traditional", name: "传统中国风", desc: "古典韵味、书法、水墨、传统纹样", emoji: "🏮" },
  { id: "vintage", name: "老味道", desc: "复古怀旧、年代感、时光质感", emoji: "📼" },
  { id: "nature", name: "清新自然", desc: "自然简约、绿色生态、清爽干净", emoji: "🌿" },
  { id: "lively", name: "热闹接地气", desc: "烟火气息、亲切热情、热闹红火", emoji: "🎉" },
  { id: "minimal", name: "简约高级", desc: "极简设计、高级质感、现代精致", emoji: "✨" },
  { id: "trendy", name: "年轻潮流", desc: "新锐个性、年轻活力、时尚前沿", emoji: "🔥" },
];

/** 客人来的原因选项 */
export const CUSTOMER_REASON_OPTIONS = [
  "口味/手艺好",
  "价格实惠",
  "老板人好",
  "习惯/情怀",
  "独家秘方",
  "其他",
];

/** 品牌精神选项 */
export const BRAND_SPIRIT_OPTIONS = [
  { id: "踏实做事", name: "踏实做事", desc: "老老实实做产品，一步一个脚印" },
  { id: "祖传手艺", name: "祖传手艺", desc: "代代相传的手艺，传承与坚守" },
  { id: "街坊情谊", name: "街坊情谊", desc: "和街坊邻居的情谊，社区归属感" },
  { id: "独家秘方", name: "独家秘方", desc: "独一无二的配方，特色与差异化" },
  { id: "日夜坚守", name: "日夜坚守", desc: "早出晚归的坚持，勤劳与付出" },
  { id: "custom", name: "自定义", desc: "用自己的话描述" },
];

// ============================================
// 状态机定义
// ============================================

/**
 * 获取下一个状态
 */
function getNextState(currentState: DiscoveryState): DiscoveryState {
  const stateOrder: DiscoveryState[] = [
    "WELCOME",
    "PHASE1_Q1",
    "PHASE1_Q2",
    "PHASE1_Q3",
    "PHASE2_Q4",
    "PHASE2_Q5",
    "PHASE2_Q6",
    "PHASE3_Q7",
    "PHASE3_Q8",
    "PHASE3_Q9",
    "PHASE4_Q10",
    "COMPLETE",
  ];

  const currentIndex = stateOrder.indexOf(currentState);
  if (currentIndex === -1 || currentIndex >= stateOrder.length - 1) {
    return "COMPLETE";
  }

  return stateOrder[currentIndex + 1];
}

/** 状态机节点定义 */
const STATE_MACHINE_CONFIG: Record<DiscoveryState, Omit<StateNode, "state">> = {
  WELCOME: {
    phase: "warmup",
    question: "您好！欢迎来到品牌发现之旅～\n\n我是您的品牌顾问，想和您聊聊天，了解一下您的店铺故事。\n\n咱们先从简单的开始：您的店开了多久啦？",
    answerType: "open",
    extractionPrompt: "从用户回复中提取店铺开业的大致年限，用数字表示。如果用户说'十几年'则提取为15左右，'没多久'则提取为2-3左右。如果用户没有提到具体时间，根据语境合理估计一个数字。",
    branchLogic: () => "PHASE1_Q1",
    progress: 5,
  },

  PHASE1_Q1: {
    phase: "warmup",
    question: "好的，大约{{years}}年了！\n\n那您是自己开的这家店，还是从家里人手里接过来的呢？",
    answerType: "open",
    extractionPrompt: "从回复中提取：1) 店铺是谁开的（自己/家人继承）；2) 简要描述店铺历史或传承情况",
    branchLogic: () => "PHASE1_Q2",
    progress: 15,
  },

  PHASE1_Q2: {
    phase: "warmup",
    question: "明白了～原来{{founder}}就开了这家店，真是有故事啊！\n\n那我想问问，客人们都是怎么找到您这儿的呀？是因为什么愿意来您这儿的呢？（可以多选哦～）",
    answerType: "multi-choice",
    options: CUSTOMER_REASON_OPTIONS,
    extractionPrompt: "从用户回复中识别客人来店的原因，可多选。选项包括：口味/手艺好、价格实惠、老板人好、习惯/情怀、独家秘方、其他。注意识别用户回复中对应的选项，即使表述不同也要识别出相近的含义。",
    branchLogic: () => "PHASE2_Q4",
    progress: 25,
  },

  PHASE1_Q3: {
    phase: "warmup",
    question: "原来如此！客人来您这儿主要是因为{{reasons}}。\n\n说起来，您开店这么多年，有没有什么让您觉得特别骄傲的事情呀？",
    answerType: "open",
    extractionPrompt: "从回复中提取让店家骄傲的事情，可以是获得的荣誉、客人的认可、某个特别的成就等。尽量保留原话。",
    branchLogic: () => "PHASE2_Q5",
    progress: 35,
  },

  PHASE2_Q4: {
    phase: "core",
    question: "太棒了！{{proudMoment}}\n\n经营这么多年，一定有很多感人的时刻吧？有没有哪位客人说过什么让您特别感动的话？",
    answerType: "open",
    extractionPrompt: "从回复中提取：1) 感人的故事或时刻；2) 客人说过的具体话语（引用），如果能提取到原话最好。",
    branchLogic: () => "PHASE2_Q6",
    progress: 45,
  },

  PHASE2_Q5: {
    phase: "core",
    question: "听了这些故事，真的很温暖呢～\n\n如果让您用一句话来概括您这个店的'精神'，您会怎么说？比如是'踏踏实实做事'，还是'传承老手艺'，或者其他什么？",
    answerType: "single-choice",
    options: BRAND_SPIRIT_OPTIONS.map(s => s.name),
    extractionPrompt: "从回复中提取店家认同的品牌精神。如果用户选择了预设选项（踏实做事、祖传手艺、街坊情谊、独家秘方、日夜坚守），提取选项名称；如果用户自定义，用用户的原话。",
    branchLogic: () => "PHASE3_Q7",
    progress: 55,
  },

  PHASE2_Q6: {
    phase: "core",
    question: "{{brandSpirit}}——这个精神真的很棒！\n\n现在我们聊聊店铺的样子～\n\n您的店里有什么特别的东西或物件吗？比如一个老招牌、一件老器具，或者某个有故事的装饰品？",
    answerType: "open",
    extractionPrompt: "从回复中提取店里标志性物件的描述，尽量详细一些，包括外观、材质、背后的故事等。",
    branchLogic: () => "PHASE3_Q7",
    progress: 65,
  },

  PHASE3_Q7: {
    phase: "visual",
    question: "{{signatureItem}}——这个物件真有意义！\n\n能拍照给我看看这个物件吗？这样我能更好地感受它的样子～",
    answerType: "photo",
    hint: "📷 拍照上传标志性物件",
    extractionPrompt: "记录用户是否上传了照片。如果上传了，记录照片描述为'已上传照片'。",
    branchLogic: () => "PHASE3_Q8",
    progress: 75,
  },

  PHASE3_Q8: {
    phase: "visual",
    question: "太好了！谢谢您的照片～\n\n接下来，能给我拍一张您店门口的照片吗？我想看看店面的整体样子～",
    answerType: "photo",
    hint: "📷 拍照上传店面",
    extractionPrompt: "记录用户是否上传了店面照片。",
    branchLogic: () => "PHASE3_Q9",
    progress: 82,
  },

  PHASE3_Q9: {
    phase: "visual",
    question: "太感谢了！照片都收到了，看起来很有感觉～\n\n最后啦！您希望您的店铺给年轻人的感觉是什么样的呢？我给您几个风格参考：",
    answerType: "single-choice",
    options: STYLE_OPTIONS.map(s => `${s.emoji} ${s.name}`),
    extractionPrompt: "从回复中提取用户选择的风格偏好。风格选项：传统中国风、老味道、清新自然、热闹接地气、简约高级、年轻潮流。注意识别用户回复中的选择，可以是序号、数字或文字描述。",
    branchLogic: () => "COMPLETE",
    progress: 90,
  },

  PHASE4_Q10: {
    phase: "style",
    question: "好的！您选择了{{selectedStyle}}风格，这个选择很棒～\n\n我已经收集了您店铺的很多故事啦！感谢您分享这么多宝贵的信息～\n\n正在为您整理品牌档案，请稍候...",
    answerType: "open",
    extractionPrompt: "记录用户的额外备注或补充信息（如果有的话）。",
    branchLogic: () => "COMPLETE",
    progress: 100,
  },

  COMPLETE: {
    phase: "warmup",
    question: "🎉 恭喜完成品牌发现之旅！\n\n根据您分享的故事，我们已经整理出您的品牌档案。点击下方按钮，开始生成专属VI手册吧～",
    answerType: "open",
    extractionPrompt: "",
    branchLogic: () => "COMPLETE",
    progress: 100,
  },
};

/** 构建完整的状态机 */
export const STATE_MACHINE: Record<DiscoveryState, StateNode> = Object.entries(STATE_MACHINE_CONFIG).reduce(
  (acc, [state, config]) => ({
    ...acc,
    [state]: { state: state as DiscoveryState, ...config } as StateNode,
  }),
  {} as Record<DiscoveryState, StateNode>
);

// ============================================
// 状态机工具函数
// ============================================

/**
 * 根据当前状态获取下一个状态
 */
export function getNextStateFromCurrent(
  currentState: DiscoveryState,
  data: ExtractedData
): DiscoveryState {
  return STATE_MACHINE[currentState]?.branchLogic(data) || getNextState(currentState);
}

/**
 * 根据状态获取进度百分比
 */
export function getProgressFromState(state: DiscoveryState): number {
  return STATE_MACHINE[state]?.progress || 0;
}

/**
 * 根据状态获取阶段信息
 */
export function getPhaseFromState(state: DiscoveryState): DiscoveryPhase {
  return STATE_MACHINE[state]?.phase || "warmup";
}

/**
 * 创建新的会话
 */
export function createNewSession(sessionId: string): DiscoverySession {
  return {
    sessionId,
    currentState: "WELCOME",
    extractedData: {},
    conversationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isComplete: false,
  };
}

/**
 * 更新会话状态
 */
export function updateSessionState(
  session: DiscoverySession,
  newState: DiscoveryState,
  newData: Partial<ExtractedData>
): DiscoverySession {
  return {
    ...session,
    currentState: newState,
    extractedData: { ...session.extractedData, ...newData },
    updatedAt: new Date(),
    isComplete: newState === "COMPLETE",
  };
}

/**
 * 添加对话记录
 */
export function addConversationTurn(
  session: DiscoverySession,
  role: "user" | "assistant",
  content: string,
  state?: DiscoveryState
): DiscoverySession {
  return {
    ...session,
    conversationHistory: [
      ...session.conversationHistory,
      {
        role,
        content,
        timestamp: new Date(),
        state,
      },
    ],
    updatedAt: new Date(),
  };
}

/**
 * 格式化问题文本，替换变量
 */
export function formatQuestion(state: DiscoveryState, data: ExtractedData): string {
  let question = STATE_MACHINE[state]?.question || "";
  
  // 替换变量
  if (data.yearsInBusiness) {
    question = question.replace("{{years}}", `${data.yearsInBusiness}年`);
  }
  if (data.founder) {
    question = question.replace("{{founder}}", data.founder);
  }
  if (data.customerReasons && data.customerReasons.length > 0) {
    question = question.replace("{{reasons}}", data.customerReasons.join("、"));
  }
  if (data.proudMoment) {
    question = question.replace("{{proudMoment}}", data.proudMoment);
  }
  if (data.brandSpirit) {
    question = question.replace("{{brandSpirit}}", data.brandSpirit);
  }
  if (data.signatureItem) {
    question = question.replace("{{signatureItem}}", data.signatureItem);
  }
  if (data.selectedStyle) {
    question = question.replace("{{selectedStyle}}", data.selectedStyle);
  }
  
  return question;
}

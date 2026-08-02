/**
 * IP 公仔素材统一契约（工单 006G）
 *
 * 平台唯一权威的素材完整性判定：
 *   name 非空 + front/side/back 三张独立视图 + emotions>=8 + scenes>=4。
 * Worker、公仔生成 API、手册 API、PagePlanner、PPTX Renderer 与离线测试
 * 全部复用本模块，避免各自维护一套阈值。
 */

export const MASCOT_VIEW_MIN = 3;
export const MASCOT_EMOTIONS_MIN = 8;
export const MASCOT_SCENES_MIN = 4;

/** 完整公仔生成器统一使用的 8 个通用中文表情。 */
export const MASCOT_EMOTION_NAMES = [
  "微笑",
  "欢迎",
  "专注",
  "惊喜",
  "安心",
  "开心",
  "引导",
  "俏皮",
] as const;

/** 完整公仔生成器统一使用的 4 类真实品牌触点。 */
export const MASCOT_SCENE_NAMES = [
  "门店迎宾",
  "包装应用",
  "会员互动",
  "社媒互动",
] as const;

export interface MascotEmotionItem {
  name?: string;
  url?: string;
}

export interface MascotSceneItem {
  name?: string;
  url?: string;
}

/** client_info.mascotAssets 的规范结构（数组或 Record 均可归一化）。 */
export interface MascotAssetSet {
  name?: string | null;
  front?: string | null;
  side?: string | null;
  back?: string | null;
  /** 组合三视图仅作展示素材，不得替代 front/side/back 三个独立视图。 */
  threeView?: string | null;
  emotions?: MascotEmotionItem[] | Record<string, string> | null;
  scenes?: MascotSceneItem[] | Record<string, string> | null;
}

export interface MascotValidationResult {
  ready: boolean;
  missing: string[];
  counts: {
    views: number;
    emotions: number;
    scenes: number;
  };
}

export interface MascotAssetValidationInput {
  assets?: MascotAssetSet | null;
  /** 仅保留向后兼容；永远不作为绕过真实字段校验的真源（工单 006G 3）。 */
  mascotAssetsReady?: boolean;
}

/** data URL 与 public URL 使用同一「存在/有效」判定，不因存储形态不同而结果相反。 */
export function isUsableImageRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  return /^data:image\//i.test(v) || /^https?:\/\//i.test(v);
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** 把任意来源（client_info.mascotAssets / 已加载的 data URL 集合）归一化为规范结构。 */
export function normalizeMascotAssetSet(raw: unknown): MascotAssetSet {
  const src = asObject(raw);
  return {
    name: normalizeName(src.name ?? src.mascotName),
    front: typeof src.front === "string" ? src.front : "",
    side: typeof src.side === "string" ? src.side : "",
    back: typeof src.back === "string" ? src.back : "",
    threeView: typeof src.threeView === "string" ? src.threeView : "",
    emotions: src.emotions == null ? undefined : (src.emotions as MascotAssetSet["emotions"]),
    scenes: src.scenes == null ? undefined : (src.scenes as MascotAssetSet["scenes"]),
  };
}

/** 从 client_info 读取权威素材（mascotAssets 对象 + mascotName）。 */
export function buildMascotAssetSetFromClientInfo(clientInfo: unknown): MascotAssetSet {
  const ci = asObject(clientInfo);
  const raw = asObject(ci.mascotAssets);
  return normalizeMascotAssetSet({
    ...raw,
    name: normalizeName(ci.mascotName ?? raw.name),
  });
}

function countValidUniqueItems(items: unknown): number {
  if (items == null) return 0;
  if (Array.isArray(items)) {
    const seen = new Set<string>();
    for (const item of items) {
      const obj = asObject(item);
      const name = normalizeName(obj.name);
      if (name && isUsableImageRef(obj.url)) seen.add(name);
    }
    return seen.size;
  }
  if (typeof items === "object") {
    const rec = items as Record<string, unknown>;
    return Object.entries(rec).filter(([key, url]) => normalizeName(key) && isUsableImageRef(url)).length;
  }
  return 0;
}

/** 统计 Renderer 收到的 Record<string, dataUrl> 中可用项数量（Renderer 最后一道防线）。 */
export function countUsableRecordEntries(rec: Record<string, string> | null | undefined): number {
  if (!rec || typeof rec !== "object") return 0;
  return Object.entries(rec).filter(([key, url]) => key.trim() !== "" && isUsableImageRef(url)).length;
}

/**
 * 素材完整性校验——唯一权威实现。
 *
 * 规则（工单 006G 3）：
 *   - front/side/back 必须分别存在且有效，threeView 不能凑数；
 *   - 角色名非空；
 *   - 表情至少 8 个，只统计 name、url 均有效且名称不重复的项目；
 *   - 应用场景至少 4 个，只统计 name、url 均有效且名称不重复的项目；
 *   - mascotAssetsReady / hasMascot / 非空对象或数组长度声明均不能绕过字段检查。
 * 本函数不抛错，只返回 ready / missing / counts；规划期门禁由 PagePlanner 决定是否抛出领域错误。
 */
export function validateMascotAssets(input: MascotAssetValidationInput): MascotValidationResult {
  const assets = input?.assets || {};
  const missing: string[] = [];

  const views = [assets.front, assets.side, assets.back].filter((v) => isUsableImageRef(v)).length;
  const emotions = countValidUniqueItems(assets.emotions);
  const scenes = countValidUniqueItems(assets.scenes);

  if (!normalizeName(assets.name)) missing.push("mascot.name");
  if (!isUsableImageRef(assets.front)) missing.push("mascot.front");
  if (!isUsableImageRef(assets.side)) missing.push("mascot.side");
  if (!isUsableImageRef(assets.back)) missing.push("mascot.back");
  if (emotions < MASCOT_EMOTIONS_MIN) missing.push(`mascot.emotions(>=${MASCOT_EMOTIONS_MIN})`);
  if (scenes < MASCOT_SCENES_MIN) missing.push(`mascot.scenes(>=${MASCOT_SCENES_MIN})`);

  return {
    ready: missing.length === 0,
    missing,
    counts: { views, emotions, scenes },
  };
}

/**
 * 规划期 IP 门禁错误：请求了 IP 但素材不完整。
 * 必须由 PagePlanner 在规划前抛出，携带 missing 清单与 counts，供 API/Worker 原样返回。
 */
export class MascotAssetsIncompleteError extends Error {
  readonly code = "MASCOT_ASSETS_INCOMPLETE";
  readonly missing: string[];
  readonly counts: MascotValidationResult["counts"];

  constructor(result: MascotValidationResult) {
    super(
      `IP 素材不完整，无法生成 IP 手册。缺失资产类别: ${result.missing.join(", ")}` +
        ` | counts: views=${result.counts.views}, emotions=${result.counts.emotions}, scenes=${result.counts.scenes}`,
    );
    this.name = "MascotAssetsIncompleteError";
    this.missing = result.missing;
    this.counts = result.counts;
  }
}

/**
 * Brand name normalization + semantic resolution for VI manual generation.
 *
 * 本模块是「品牌名」语义解析的单一入口（整改 #006 / 工单 006 3.1、3.3）。
 * IP 素材完整性契约已移入 ./mascot-assets（工单 006G），此处仅做兼容再导出，
 * 保持既有 import 路径可用；所有纯函数、无网络、无数据库副作用。
 */

/**
 * 旧的高置信度修复：仅处理明显错别字（如「荼店」→「奶茶店」），
 * 不破坏合法含数字品牌名，不删除测试前缀/数字后缀。
 */
export function normalizeBrandName(name: string): string {
  if (typeof name !== "string") return "";
  return name
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/荼店/g, "奶茶店");
}

// ============ 正式品牌名解析（工单 006 3.1 / 3.3） ============

export interface BrandNameSources {
  /** 显式正式品牌名（优先） */
  formalBrandName?: string | null;
  /** 既有收单/兼容字段（兜底） */
  companyName?: string | null;
}

/**
 * 解析「对客户展示的正式品牌名」——唯一入口。
 *
 * 优先级：
 *   1. formalBrandName（显式正式品牌名）
 *   2. companyName（既有收单/兼容字段）
 *   3. "品牌"（兜底）
 *
 * 安全处理：仅做 trim 与空白规范化（多个空白折叠为一个空格）。
 * 严禁（工单 006 3.2）：
 *   - 删除测试前缀（如「无公仔测试-」「无IP回归测试」）
 *   - 删除末尾数字（如 102652 / 889900 / 778800）
 *   - 针对具体品牌（暖喵茶饮/老碗香/山禾面馆/青柚饮品）写条件分支
 *   - 用宽泛正则破坏合法含数字品牌名（如「7分甜」「茶里8号」）
 *
 * projectDisplayName 永远不参与解析（仅内部追踪，不得进入成品品牌展示位）。
 */
export function resolveFormalBrandName(src: BrandNameSources): string {
  const formal = ((src?.formalBrandName ?? "").toString()).trim().replace(/\s+/g, " ");
  if (formal) return formal;
  const legacy = ((src?.companyName ?? "").toString()).trim().replace(/\s+/g, " ");
  if (legacy) return legacy;
  return "品牌";
}

// ============ IP 素材完整性契约（工单 006G，权威实现在 ./mascot-assets） ============

export {
  MASCOT_VIEW_MIN,
  MASCOT_EMOTIONS_MIN,
  MASCOT_SCENES_MIN,
  MASCOT_EMOTION_NAMES,
  MASCOT_SCENE_NAMES,
  isUsableImageRef,
  normalizeMascotAssetSet,
  buildMascotAssetSetFromClientInfo,
  countUsableRecordEntries,
  validateMascotAssets,
  MascotAssetsIncompleteError,
} from "./mascot-assets";

export type {
  MascotEmotionItem,
  MascotSceneItem,
  MascotAssetSet,
  MascotValidationResult,
  MascotAssetValidationInput,
} from "./mascot-assets";

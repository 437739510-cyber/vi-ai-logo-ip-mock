/**
 * 工单 036：客户可见 Logo 过滤（展示数据层 SSOT）。
 *
 * 客户查看页只应展示可交付方案：needs_review（校验不合格、不静默交付）与
 * failed/error 项不展示；skipped（未初检）与 passed/retried 保留展示。
 * 后台管理查看不受影响（本模块仅客户展示路径使用）。
 */
export interface CustomerLogoLike {
  imageUrl?: string | null;
  error?: string | null;
  vision?: { status?: string; reason?: string } | null;
}

const HIDDEN_VISION_STATUSES = new Set(["needs_review", "failed", "error"]);

export function filterCustomerLogos<T extends CustomerLogoLike>(logos: T[]): T[] {
  return (logos || []).filter((r) => {
    if (!r.imageUrl) return false;
    if (r.error) return false;
    const vs = r.vision?.status;
    if (vs && HIDDEN_VISION_STATUSES.has(vs)) return false;
    return true;
  });
}

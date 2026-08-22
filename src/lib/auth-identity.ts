// TICKET-122-R25：统一登录面板「按手机号识别身份」的纯逻辑层。
// 只判断手机号归属（student_accounts / members），不校验密码、不创建会话；
// 登录本身仍复用现有 /api/member/login 与 /api/admin/login（student 分支）。

export type LoginIdentity = "student" | "member" | "none";

export const PHONE_RE = /^1[3-9]\d{9}$/;

/**
 * 按手机号判断登录身份：
 * - 手机号在 student_accounts → "student"（大学生/合伙人面板）
 * - 手机号在 members → "member"（商家/会员面板）
 * - 都不在 → "none"（提示注册/申请入口）
 * 两表同时存在时优先判为 student。
 */
export async function resolveLoginIdentity(
  db: { from: (table: string) => any },
  phone: string
): Promise<LoginIdentity> {
  if (!phone || !PHONE_RE.test(phone)) {
    throw new Error("INVALID_PHONE");
  }

  const { data: student } = await db
    .from("student_accounts")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (student) return "student";

  const { data: member } = await db
    .from("members")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (member) return "member";

  return "none";
}

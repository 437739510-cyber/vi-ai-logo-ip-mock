// TICKET-122-R19：学生申请审核服务层（GAP-B）。
// 与 HTTP 路由分离，业务逻辑可注入 Supabase 客户端，便于离线 mock 回归验证。
// 关联方案：students（申请）表新增 student_account_id 关联到 student_accounts(id)，
// 并在审核时回写 status（approved/rejected）与 rejection_reason 备注。

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPassword } from "./password";

export interface PendingApplication {
  id: string;
  name: string;
  phone: string;
  school: string;
  major: string;
  wechat: string;
  intro: string;
  status: string;
  created_at: string;
}

export interface ApproveResult {
  studentAccountId: string;
  initialPassword: string;
}

// 生成 10 位初始随机密码，避免易混淆字符（0/O、1/l/I）。
function generateInitialPassword(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

export async function listPendingApplications(
  db: SupabaseClient,
): Promise<PendingApplication[]> {
  const { data, error } = await db
    .from("students")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.real_name ?? ""),
    phone: String(row.phone ?? ""),
    school: String(row.university ?? ""),
    major: String(row.major ?? ""),
    wechat: String(row.wechat ?? ""),
    intro: String(row.bio ?? ""),
    status: String(row.status ?? ""),
    created_at: String(row.created_at ?? ""),
  }));
}

export async function approveApplication(
  db: SupabaseClient,
  applicationId: string,
): Promise<ApproveResult> {
  const { data: app, error: readError } = await db
    .from("students")
    .select("id, real_name, phone, status")
    .eq("id", applicationId)
    .single();

  if (readError || !app) throw new Error("申请不存在");
  if (app.status !== "pending") throw new Error("该申请已处理，请刷新列表");

  const initialPassword = generateInitialPassword();
  const passwordHash = hashPassword(initialPassword);

  // 一键创建大学生账号（提成默认 72% = 新手档，R24 统一口径），手机号唯一冲突时返回 23505。
  const { data: account, error: insertError } = await db
    .from("student_accounts")
    .insert({
      phone: app.phone,
      name: app.real_name,
      password_hash: passwordHash,
      commission_rate: 72,
    })
    .select("id, phone, name, level, commission_rate, active, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") throw new Error("该手机号已注册");
    throw new Error(insertError.message);
  }
  if (!account) throw new Error("创建账号失败");

  // 回写关联：students.status=approved + student_account_id（拒绝备注清空）。
  const { error: updateError } = await db
    .from("students")
    .update({
      status: "approved",
      student_account_id: account.id,
      rejection_reason: null,
    })
    .eq("id", applicationId);
  if (updateError) throw new Error(updateError.message);

  return { studentAccountId: account.id, initialPassword };
}

export async function rejectApplication(
  db: SupabaseClient,
  applicationId: string,
  reason?: string,
): Promise<void> {
  const { data: app, error: readError } = await db
    .from("students")
    .select("id, status")
    .eq("id", applicationId)
    .single();

  if (readError || !app) throw new Error("申请不存在");
  if (app.status !== "pending") throw new Error("该申请已处理，请刷新列表");

  const { error: updateError } = await db
    .from("students")
    .update({
      status: "rejected",
      rejection_reason: reason || null,
    })
    .eq("id", applicationId);
  if (updateError) throw new Error(updateError.message);
}

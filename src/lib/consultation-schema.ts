import { z } from "zod";

export const consultationSchema = z.object({
  clientName: z
    .string()
    .min(2, "请输入联系人姓名（至少 2 个字符）")
    .max(20, "姓名不超过 20 个字符"),
  companyName: z
    .string()
    .min(2, "请输入公司名称")
    .max(100, "公司名称不超过 100 个字符"),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入正确的手机号（11 位数字）"),
  wechat: z
    .string()
    .max(50, "微信号不超过 50 个字符")
    .optional()
    .or(z.literal("")),
  industry: z.string().min(1, "请选择所属行业"),
  budgetRange: z.string().optional(),
  description: z
    .string()
    .max(500, "需求描述不超过 500 个字符")
    .optional()
    .or(z.literal("")),
});

export type ConsultationFormData = z.infer<typeof consultationSchema>;

export const INDUSTRY_OPTIONS = [
  "科技/互联网",
  "餐饮/食品",
  "零售/电商",
  "教育/培训",
  "医疗/健康",
  "金融/法律",
  "文化/传媒",
  "制造业",
  "其他",
] as const;

export const BUDGET_OPTIONS = [
  "3000以下",
  "3000-5000",
  "5000-10000",
  "10000-30000",
  "30000以上",
  "待定",
] as const;

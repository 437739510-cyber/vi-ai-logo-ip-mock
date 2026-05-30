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
  email: z
    .string()
    .email("请输入正确的邮箱地址")
    .optional()
    .or(z.literal("")),
  wechat: z
    .string()
    .max(50, "微信号不超过 50 个字符")
    .optional()
    .or(z.literal("")),
  industry: z.string().min(1, "请选择所属行业"),
  budgetRange: z.string().optional(),
  brandVision: z
    .string()
    .min(4, "请输入品牌愿景（至少 4 个字符）")
    .max(200, "品牌愿景不超过 200 个字符"),
  coreValues: z
    .string()
    .min(4, "请输入核心价值（至少 4 个字符）")
    .max(500, "核心价值不超过 500 个字符"),
  targetMarket: z
    .string()
    .min(4, "请输入目标市场（至少 4 个字符）")
    .max(500, "目标市场不超过 500 个字符"),

  brandColors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional(),
    }).optional(),

  logoPhilosophy: z
    .string()
    .max(500, "LOGO 设计理念不超过 500 个字符")
    .optional()
    .or(z.literal("")),
  mascotPhilosophy: z
    .string()
    .max(500, "IP 公仔设计理念不超过 500 个字符")
    .optional()
    .or(z.literal("")),
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
];

export const BUDGET_OPTIONS = [
  "3000以下",
  "3000-5000",
  "5000-10000",
  "10000-20000",
  "20000以上",
];

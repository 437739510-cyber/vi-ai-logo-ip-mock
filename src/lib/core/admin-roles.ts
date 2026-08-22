/**
 * 管理后台角色权限配置
 * admin: 管理员（KEVIN），全部页面
 * student: 大学生合伙人，只看工作相关页面
 */
export type AdminRole = "admin" | "student";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: AdminRole[];
}

export const NAV_CONFIG: NavItem[] = [
  { href: "/admin/dashboard", label: "工作台", icon: "LayoutDashboard", roles: ["admin", "student"] },
  { href: "/admin/projects", label: "项目列表", icon: "FolderKanban", roles: ["admin", "student"] },
  { href: "/admin/favorites", label: "收藏", icon: "Star", roles: ["admin"] },
  { href: "/admin/clients", label: "客户管理", icon: "Users", roles: ["admin"] },
  { href: "/admin/student-applications", label: "学生申请审核", icon: "ShieldAlert", roles: ["admin"] },
  { href: "/admin/students", label: "大学生管理", icon: "GraduationCap", roles: ["admin"] },
  { href: "/admin/templates", label: "模板库", icon: "Grid3X3", roles: ["admin"] },
  { href: "/admin/logo-library", label: "Logo素材库", icon: "Palette", roles: ["admin"] },
  { href: "/admin/prompt-gate", label: "提示词门拦截", icon: "ShieldAlert", roles: ["admin"] },
  { href: "/admin/billing", label: "消耗明细", icon: "Wallet", roles: ["admin"] },
  { href: "/admin/pricing", label: "定价管理", icon: "Tag", roles: ["admin"] },
  { href: "/admin/basic-info", label: "基本信息", icon: "Settings", roles: ["admin"] },
  { href: "/admin/workspace", label: "我的客户", icon: "Briefcase", roles: ["student"] },
  { href: "/admin/earnings", label: "我的收入", icon: "Coins", roles: ["student"] },
];

export function getNavForRole(role: AdminRole): NavItem[] {
  return NAV_CONFIG.filter((item) => item.roles.includes(role));
}

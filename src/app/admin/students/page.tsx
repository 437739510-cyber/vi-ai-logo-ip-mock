"use client";

import { useState } from "react";
import { GraduationCap, Phone, MapPin, TrendingUp } from "lucide-react";

interface Student {
  id: string;
  realName: string;
  phone: string;
  university: string;
  major: string;
  grade: string;
  wechat: string;
  serviceArea: string;
  status: "active" | "pending" | "suspended";
  clientCount: number;
  totalEarnings: number;
  createdAt: string;
}

const MOCK_STUDENTS: Student[] = [
  {
    id: "STU-001",
    realName: "张晓明",
    phone: "138****5678",
    university: "武汉大学",
    major: "视觉传达设计",
    grade: "大三",
    wechat: "zxm_design",
    serviceArea: "武昌区",
    status: "active",
    clientCount: 5,
    totalEarnings: 750,
    createdAt: "2026-05-20",
  },
  {
    id: "STU-002",
    realName: "李思雨",
    phone: "139****1234",
    university: "华中科技大学",
    major: "数字媒体艺术",
    grade: "大二",
    wechat: "lsy_art",
    serviceArea: "洪山区",
    status: "active",
    clientCount: 3,
    totalEarnings: 450,
    createdAt: "2026-05-22",
  },
  {
    id: "STU-003",
    realName: "王鹏飞",
    phone: "137****9876",
    university: "湖北美术学院",
    major: "平面设计",
    grade: "大四",
    wechat: "wpf_design",
    serviceArea: "江岸区",
    status: "pending",
    clientCount: 0,
    totalEarnings: 0,
    createdAt: "2026-06-01",
  },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "已认证", color: "bg-green-100 text-green-700" },
  pending: { label: "待审核", color: "bg-amber-100 text-amber-700" },
  suspended: { label: "已暂停", color: "bg-red-100 text-red-700" },
};

export default function StudentsPage() {
  const [students] = useState<Student[]>(MOCK_STUDENTS);
  const [filter, setFilter] = useState<"all" | "active" | "pending">("all");

  const filtered = students.filter((s) => filter === "all" || s.status === filter);

  const stats = {
    total: students.length,
    active: students.filter((s) => s.status === "active").length,
    pending: students.filter((s) => s.status === "pending").length,
    totalEarnings: students.reduce((sum, s) => sum + s.totalEarnings, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">大学生管理</h2>
          <p className="text-sm text-neutral-500 mt-1">管理大学生代理，查看认证状态和佣金</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-neutral-500 text-sm">
            <GraduationCap className="w-4 h-4" />总人数
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <GraduationCap className="w-4 h-4" />已认证
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <GraduationCap className="w-4 h-4" />待审核
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-neutral-100">
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <TrendingUp className="w-4 h-4" />佣金总支出
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">&yen;{stats.totalEarnings}</div>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: "all", label: "全部" },
          { key: "active", label: "已认证" },
          { key: "pending", label: "待审核" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left px-4 py-3 font-medium text-neutral-500">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">学校/专业</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">服务区域</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">客户数</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">佣金</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">状态</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">注册时间</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{s.realName}</div>
                    <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />{s.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-neutral-900">{s.university}</div>
                    <div className="text-xs text-neutral-400">{s.major} · {s.grade}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-neutral-600">
                      <MapPin className="w-3 h-3" />{s.serviceArea}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{s.clientCount}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">&yen;{s.totalEarnings}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[s.status].color}`}>
                      {STATUS_MAP[s.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{s.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            暂无大学生数据
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        大学生通过客户端「大学生加入」注册，审核通过后可接单服务客户。标准版每单佣金 ¥150。
      </div>
    </div>
  );
}

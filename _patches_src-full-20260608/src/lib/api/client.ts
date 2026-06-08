/**
 * API 基础客户端
 *
 * 提供统一的 fetch 封装，自动读取环境变量中的 API 端点。
 * 所有请求走服务端（避免 CORS 问题），通过 Next.js API Routes 代理。
 *
 * 使用方式：import { apiClient } from "@/lib/api/client";
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000/api";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE}${endpoint}`;
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      return { success: false, error: `HTTP ${res.status}: ${errorText}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

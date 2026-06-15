/**
 * Discovery 会话存储
 * 
 * 使用内存存储会话数据（MVP阶段）
 * 后续可替换为 Supabase 或其他数据库
 */

import { DiscoverySession, createNewSession } from "./state-machine";

// ============================================
// 会话存储 (内存实现)
// ============================================

const sessionStore = new Map<string, DiscoverySession>();

/**
 * 获取会话，不存在则创建
 */
export function getOrCreateSession(sessionId: string): DiscoverySession {
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, createNewSession(sessionId));
  }
  return sessionStore.get(sessionId)!;
}

/**
 * 获取会话，如果不存在返回 null
 */
export function getSession(sessionId: string): DiscoverySession | null {
  return sessionStore.get(sessionId) || null;
}

/**
 * 保存会话
 */
export function saveSession(session: DiscoverySession): void {
  sessionStore.set(session.sessionId, session);
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/**
 * 获取所有会话数量（调试用）
 */
export function getSessionCount(): number {
  return sessionStore.size;
}

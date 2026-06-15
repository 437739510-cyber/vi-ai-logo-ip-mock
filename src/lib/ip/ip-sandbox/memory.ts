/**
 * IP Sandbox V1 — Memory Integration
 *
 * Saves and loads sandbox sessions from ProjectMemory.
 */

import type { IPSandboxSession } from "./types";

// ========== Storage Path ==========

const SANDBOX_DIR = "public/memory/sandbox";

function getSessionPath(sessionId: string): string {
  return `${process.cwd()}/${SANDBOX_DIR}/${sessionId}.json`;
}

// ========== File I/O ==========

async function readFile(path: string): Promise<string | null> {
  try {
    const fs = await import("fs/promises");
    return await fs.readFile(path, "utf-8");
  } catch {
    return null;
  }
}

async function writeFile(path: string, data: string): Promise<void> {
  const fs = await import("fs/promises");
  const pathMod = await import("path");
  await fs.mkdir(pathMod.dirname(path), { recursive: true });
  await fs.writeFile(path, data, "utf-8");
}

// ========== API ==========

/**
 * Save a sandbox session to memory.
 */
export async function saveSandboxSession(
  session: IPSandboxSession
): Promise<void> {
  const path = getSessionPath(session.sessionId);
  await writeFile(path, JSON.stringify(session, null, 2));
}

/**
 * Load a sandbox session from memory.
 */
export async function loadSandboxSession(
  sessionId: string
): Promise<IPSandboxSession | null> {
  const path = getSessionPath(sessionId);
  const data = await readFile(path);
  if (!data) return null;
  return JSON.parse(data) as IPSandboxSession;
}

/**
 * List all sandbox session IDs for a project.
 */
export async function listSandboxSessions(
  projectId: string
): Promise<string[]> {
  const fs = await import("fs/promises");
  const pathMod = await import("path");
  try {
    const files = await fs.readdir(
      pathMod.dirname(getSessionPath("")),
      { recursive: true }
    );
    return files
      .filter((f) => typeof f === "string" && f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

/**
 * Delete a sandbox session.
 */
export async function deleteSandboxSession(
  sessionId: string
): Promise<void> {
  try {
    const fs = await import("fs/promises");
    await fs.unlink(getSessionPath(sessionId));
  } catch {
    // File doesn't exist — ignore
  }
}

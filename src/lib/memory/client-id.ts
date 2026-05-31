/**
 * Brand Brain — Client ID Generator
 *
 * Generates a stable, deterministic, environment-independent client ID
 * from a company name using SHA-256 hashing.
 *
 * Rules:
 * 1. Trim whitespace
 * 2. Lowercase
 * 3. Unicode normalize (NFKC) — CJK stability across environments
 * 4. SHA-256 hash
 * 5. Prefix "cli_"
 * 6. First 16 hex characters
 */

import { createHash } from "crypto";

const CLIENT_ID_PREFIX = "cli_";
const HASH_LENGTH = 16; // 16 hex chars = 64 bits of collision resistance

/**
 * Generate a deterministic client ID from a company name.
 *
 * @param companyName - The client's company/brand name
 * @returns Stable hash-based client ID (e.g. "cli_a1b2c3d4e5f6g7h8")
 * @throws Error if companyName is empty or whitespace-only
 */
export function generateClientId(companyName: string): string {
  if (!companyName || companyName.trim().length === 0) {
    throw new Error("generateClientId: companyName must be a non-empty string");
  }

  const normalized = companyName
    .trim()
    .toLowerCase()
    .normalize("NFKC");

  const hash = createHash("sha256")
    .update(normalized, "utf-8")
    .digest("hex")
    .slice(0, HASH_LENGTH);

  return `${CLIENT_ID_PREFIX}${hash}`;
}

// src/server/audit.ts
// Shared helper for appending blocks to a mandate's SHA-256 audit chain.
// Used by manual state transitions (mandate revocation, bulk revoke) so the
// chain-linking logic lives in exactly one place.
import { eq } from "drizzle-orm";
import { generateAuditHash } from "@/lib/crypto";
import { db } from "./db";
import { auditLogs } from "./schema";

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Appends one block to a mandate's cryptographic audit chain: reads the
 * current head block, hashes (action + details + previousHash), and inserts.
 */
export async function appendAuditBlock(
  mandateId: string,
  action: string,
  details: Record<string, unknown>,
  transactionId?: string | null,
): Promise<string> {
  const lastLog = await db.query.auditLogs.findFirst({
    where: eq(auditLogs.mandateId, mandateId),
    orderBy: (auditLogs, { desc }) => [desc(auditLogs.createdAt)],
  });

  const previousHash = lastLog ? lastLog.currentHash : GENESIS_HASH;
  const currentHash = generateAuditHash(action, details, previousHash);

  await db.insert(auditLogs).values({
    mandateId,
    transactionId: transactionId ?? null,
    action,
    details,
    previousHash,
    currentHash,
  });

  return currentHash;
}

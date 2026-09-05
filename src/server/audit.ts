// src/server/audit.ts
// THE single shared implementation for appending blocks to a mandate's
// SHA-256 audit chain. Used by manual state transitions (mandate revocation,
// bulk revoke) AND by the Inngest audit writer via appendAuditBlock, so the
// chain-linking logic lives in exactly one place.
//
// FORK-PROOFING (why not just read-then-insert?):
// A naive read-head-then-insert has a race: two concurrent writers both read
// block N as head, both set previousHash = N's hash, and both insert — a
// fork. A transaction-scoped advisory lock cannot fix this on Neon's
// stateless HTTP driver (each statement is its own transaction, so the lock
// releases between statements). Instead we make forks impossible at the
// schema level:
//
//   UNIQUE INDEX (mandate_id, previous_hash)
//
// Two blocks claiming the SAME predecessor cannot coexist. Losers of the race
// get a 23505 conflict and retry against the new head. A reader computing the
// chain can therefore never see two blocks with the same previousHash, and
// verifyAuditChain's per-mandate sequential-link check stays sound under any
// concurrency.
//
// Ordering note: chain links follow createdAt DESC (with id tiebreak), which
// matches how both the verifier and every reader order blocks.
import { eq } from "drizzle-orm";
import { generateAuditHash } from "@/lib/crypto";
import { db } from "./db";
import { auditLogs } from "./schema";

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/** Bounded retries for the unique-index race. 3 is ample: the window between
 *  head-read and insert is single-digit milliseconds. */
const MAX_APPEND_ATTEMPTS = 3;

/**
 * Appends one block to a mandate's cryptographic audit chain: reads the
 * current head block, hashes (action + details + previousHash), and inserts.
 * Race-safe via the unique (mandate_id, previous_hash) index — see the header
 * comment. Throws after MAX_APPEND_ATTEMPTS conflicting attempts.
 */
export async function appendAuditBlock(
  mandateId: string,
  action: string,
  details: Record<string, unknown>,
  transactionId?: string | null,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt++) {
    try {
      // 1. Read current head (most recent block for this mandate).
      const lastLog = await db.query.auditLogs.findFirst({
        where: eq(auditLogs.mandateId, mandateId),
        orderBy: (auditLogs, { desc }) => [desc(auditLogs.createdAt), desc(auditLogs.id)],
      });

      const previousHash = lastLog ? lastLog.currentHash : GENESIS_HASH;
      const currentHash = generateAuditHash(action, details, previousHash);

      // 2. Insert. If another writer claimed the same predecessor first, the
      //    unique index rejects us and we retry against the new head.
      await db.insert(auditLogs).values({
        mandateId,
        transactionId: transactionId ?? null,
        action,
        details,
        previousHash,
        currentHash,
      });

      return currentHash;
    } catch (error) {
      lastError = error;
      const err = error as { code?: string; message?: string };
      const isUniqueViolation =
        err?.code === "23505" || /unique|duplicate/i.test(err?.message ?? "");
      if (!isUniqueViolation) throw error;
      // Fork detected — fall through and retry against the fresh head.
    }
  }

  throw new Error(
    `AUDIT_CHAIN_CONTENTION: Failed to append audit block for mandate ${mandateId} after ${MAX_APPEND_ATTEMPTS} attempts`,
    { cause: lastError },
  );
}

export { GENESIS_HASH };

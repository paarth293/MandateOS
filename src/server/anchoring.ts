// src/server/anchoring.ts
// Single implementation of cryptographic anchor publishing, shared by:
//  - POST /api/anchors   (on-demand, browser/trust explorer)
//  - the Inngest publish-audit-anchor cron + event handler
//  - the Settings "Force Audit Anchor" action
// Previously this logic was copy-pasted in two places and could drift.
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { canonicalStringify } from "@/lib/crypto";
import { db } from "./db";
import { anchors, auditLogs } from "./schema";

export interface AnchorPublishResult {
  published: boolean;
  anchor?: typeof anchors.$inferSelect;
  reason?: string;
}

/**
 * Computes and stores a cryptographic state anchor for one mandate,
 * linking the current audit-chain head block to the previous anchor.
 * No-op (returns the existing anchor) when the chain head has not advanced.
 */
export async function publishAnchorForMandate(mandateId: string): Promise<AnchorPublishResult> {
  // Fetch all audit logs for this mandate, oldest first.
  const logs = await db.query.auditLogs.findMany({
    where: eq(auditLogs.mandateId, mandateId),
    orderBy: (auditLogs, { asc }) => [asc(auditLogs.createdAt)],
  });

  if (logs.length === 0) {
    return { published: false, reason: "NO_AUDIT_BLOCKS" };
  }

  const lastBlock = logs[logs.length - 1];
  const blockCount = logs.length;
  const lastBlockHash = lastBlock.currentHash;

  // Check latest anchor and skip if the chain head is already anchored.
  const lastAnchor = await db.query.anchors.findFirst({
    where: eq(anchors.mandateId, mandateId),
    orderBy: (anchors, { desc }) => [desc(anchors.anchoredAt)],
  });

  if (
    lastAnchor &&
    lastAnchor.lastBlockHash === lastBlockHash &&
    lastAnchor.blockCount === blockCount
  ) {
    return { published: false, reason: "ALREADY_ANCHORED", anchor: lastAnchor };
  }

  const previousAnchorHash = lastAnchor
    ? lastAnchor.anchorHash
    : "0000000000000000000000000000000000000000000000000000000000000000";

  const timestamp = new Date();
  const payload = canonicalStringify({
    blockCount,
    lastBlockHash,
    mandateId,
    previousAnchorHash,
    timestamp: timestamp.toISOString(),
  });

  const anchorHash = crypto.createHash("sha256").update(payload).digest("hex");

  const [newAnchor] = await db
    .insert(anchors)
    .values({
      mandateId,
      anchorHash,
      previousAnchorHash,
      lastBlockHash,
      blockCount,
      anchoredAt: timestamp,
    })
    .returning();

  return { published: true, anchor: newAnchor };
}

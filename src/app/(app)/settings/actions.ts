"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { publishAnchorForMandate } from "@/server/anchoring";
import { appendAuditBlock } from "@/server/audit";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { mandates } from "@/server/schema";

export interface DangerZoneResult {
  ok: boolean;
  message: string;
}

/**
 * Revokes every ACTIVE mandate owned by the current user. Each revocation
 * appends a tamper-evident MANDATE_REVOKED block to that mandate's audit
 * chain, exactly as single-mandate revocation does.
 */
export async function revokeAllMandates(): Promise<DangerZoneResult> {
  const user = await requireRole(["OWNER", "ADMIN"]);

  const activeMandates = await db.query.mandates.findMany({
    where: and(eq(mandates.userId, user.id), eq(mandates.status, "ACTIVE")),
  });

  let revoked = 0;
  for (const mandate of activeMandates) {
    await db
      .update(mandates)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(eq(mandates.id, mandate.id));

    await appendAuditBlock(mandate.id, "MANDATE_REVOKED", {
      summary: `Mandate policy ${mandate.id} revoked via bulk action by ${user.name}. Agent purchases are now hard-blocked.`,
      confidenceScore: 1.0,
    });
    revoked++;
  }

  revalidatePath("/");
  return {
    ok: true,
    message:
      revoked > 0
        ? `Revoked ${revoked} active mandate${revoked === 1 ? "" : "s"}. Every policy change was appended to the audit chain.`
        : "No active mandates to revoke.",
  };
}

/**
 * Publishes a cryptographic state anchor for every mandate owned by the
 * current user whose audit-chain head has advanced past its last anchor.
 */
export async function publishAnchorsNow(): Promise<DangerZoneResult> {
  const user = await requireRole(["OWNER", "ADMIN"]);

  const userMandates = await db.query.mandates.findMany({
    where: eq(mandates.userId, user.id),
  });

  let published = 0;
  let alreadyAnchored = 0;
  for (const mandate of userMandates) {
    const result = await publishAnchorForMandate(mandate.id);
    if (result.published) {
      published++;
    } else {
      alreadyAnchored++;
    }
  }

  revalidatePath("/trust");
  return {
    ok: true,
    message:
      userMandates.length === 0
        ? "No mandates exist for your account yet."
        : `Published ${published} new anchor${published === 1 ? "" : "s"}${alreadyAnchored > 0 ? `; ${alreadyAnchored} already anchored at current head` : ""}.`,
  };
}

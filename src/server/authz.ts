// src/server/authz.ts
// Ownership helpers that scope data access to the authenticated user
// (multi-tenancy). Every dashboard / analytics / review query filters
// through these so no user can see another user's financial data.
import { eq } from "drizzle-orm";
import { db } from "./db";
import { mandates } from "./schema";

/**
 * Returns the IDs of all mandates owned by the given user.
 */
export async function getUserMandateIds(userId: string): Promise<string[]> {
  const rows = await db.query.mandates.findMany({
    where: eq(mandates.userId, userId),
    columns: { id: true },
  });
  return rows.map((row) => row.id);
}

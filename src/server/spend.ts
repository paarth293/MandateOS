// src/server/spend.ts
// Single source of truth for cumulative spend totals used by every policy
// enforcement path (purchase route, silent-retry recovery, policy simulator).
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { transactions } from "./schema";

/**
 * Canonical "committed spend" status set.
 *
 * Committed = settled (SUCCESS / RECOVERED) OR funds reserved for settlement
 * (ORDER_CREATED / PENDING). FAILED transactions never count — the money was
 * not taken. Using one definition everywhere prevents budget enforcement from
 * differing between the live purchase path and the silent-retry recovery path.
 */
export const COMMITTED_SPEND_STATUSES = [
  "SUCCESS",
  "RECOVERED",
  "ORDER_CREATED",
  "PENDING",
] as const;

/**
 * Computes daily (UTC) and lifetime cumulative committed spend for a mandate.
 */
export async function getCommittedSpendTotals(mandateId: string): Promise<{
  spentTodayPaise: number;
  spentLifetimePaise: number;
}> {
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);

  const [dailyTotalResult] = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.mandateId, mandateId),
        inArray(transactions.status, [...COMMITTED_SPEND_STATUSES]),
        gte(transactions.createdAt, startOfTodayUtc),
      ),
    );

  const [lifetimeTotalResult] = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.mandateId, mandateId),
        inArray(transactions.status, [...COMMITTED_SPEND_STATUSES]),
      ),
    );

  return {
    spentTodayPaise: Number(dailyTotalResult?.total ?? 0),
    spentLifetimePaise: Number(lifetimeTotalResult?.total ?? 0),
  };
}

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { purchaseAttempts, transactions } from "@/server/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics
 * Returns comprehensive financial analytics: burn rate, category breakdowns,
 * autonomous recovery savings, and agent policy utilization.
 */
export async function GET(_request: NextRequest) {
  try {
    const validSettledStatuses: (
      | "PENDING"
      | "ORDER_CREATED"
      | "SUCCESS"
      | "FAILED"
      | "RECOVERED"
    )[] = ["SUCCESS", "RECOVERED"];

    // 1. Overall Settled Spend Totals
    const [settledTotals] = await db
      .select({
        totalSettledPaise: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
        totalTransactions: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(inArray(transactions.status, validSettledStatuses));

    // 2. Breakdown by Status
    const statusCounts = await db
      .select({
        status: transactions.status,
        count: sql<number>`count(*)`,
        volumePaise: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .groupBy(transactions.status);

    const countsMap: Record<string, { count: number; volumePaise: number }> = {};
    for (const row of statusCounts) {
      countsMap[row.status] = {
        count: Number(row.count),
        volumePaise: Number(row.volumePaise),
      };
    }

    const successCount = countsMap.SUCCESS?.count ?? 0;
    const recoveredCount = countsMap.RECOVERED?.count ?? 0;
    const failedCount = countsMap.FAILED?.count ?? 0;
    const recoveredVolumePaise = countsMap.RECOVERED?.volumePaise ?? 0;

    // 3. Blocked Policy Attempts
    const [blockedAttempts] = await db
      .select({
        count: sql<number>`count(*)`,
        blockedVolumePaise: sql<number>`coalesce(sum(${purchaseAttempts.amountPaise}), 0)`,
      })
      .from(purchaseAttempts)
      .where(eq(purchaseAttempts.outcome, "BLOCKED"));

    // 4. Burn Rate - Last 7 Days Volume
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyVolume = await db
      .select({
        date: sql<string>`to_char(${transactions.createdAt}, 'YYYY-MM-DD')`,
        volumePaise: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.status, validSettledStatuses),
          gte(transactions.createdAt, sevenDaysAgo),
        ),
      )
      .groupBy(sql`to_char(${transactions.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${transactions.createdAt}, 'YYYY-MM-DD')`);

    // 5. Category Breakdown (from purchase attempts)
    const categoryStats = await db
      .select({
        category: purchaseAttempts.merchantCategory,
        attempts: sql<number>`count(*)`,
        totalPaise: sql<number>`coalesce(sum(${purchaseAttempts.amountPaise}), 0)`,
      })
      .from(purchaseAttempts)
      .groupBy(purchaseAttempts.merchantCategory)
      .orderBy(desc(sql`coalesce(sum(${purchaseAttempts.amountPaise}), 0)`));

    // 6. Per-Agent Policy Utilization (Optimized: 2 batch GROUP BY queries instead of 2N queries)
    const allMandates = await db.query.mandates.findMany({
      orderBy: (mandates, { desc }) => [desc(mandates.createdAt)],
    });

    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const [todayTotalsRows, lifetimeTotalsRows] = await Promise.all([
      db
        .select({
          mandateId: transactions.mandateId,
          total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            inArray(transactions.status, validSettledStatuses),
            gte(transactions.createdAt, startOfTodayUtc),
          ),
        )
        .groupBy(transactions.mandateId),
      db
        .select({
          mandateId: transactions.mandateId,
          total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(inArray(transactions.status, validSettledStatuses))
        .groupBy(transactions.mandateId),
    ]);

    const todayMap = new Map<string, number>();
    for (const row of todayTotalsRows) {
      todayMap.set(row.mandateId, Number(row.total));
    }

    const lifetimeMap = new Map<string, number>();
    for (const row of lifetimeTotalsRows) {
      lifetimeMap.set(row.mandateId, Number(row.total));
    }

    const agentMetrics = allMandates.map((mandate) => {
      const spentTodayPaise = todayMap.get(mandate.id) ?? 0;
      const spentLifetimePaise = lifetimeMap.get(mandate.id) ?? 0;

      const dailyUtilizationPercent = mandate.dailyLimitPaise
        ? Math.min(100, Math.round((spentTodayPaise / mandate.dailyLimitPaise) * 100))
        : null;

      const lifetimeUtilizationPercent = mandate.lifetimeLimitPaise
        ? Math.min(100, Math.round((spentLifetimePaise / mandate.lifetimeLimitPaise) * 100))
        : null;

      return {
        mandateId: mandate.id,
        agentName: mandate.agentName,
        status: mandate.status,
        maxAmountPerTransaction: mandate.maxAmountPerTransaction,
        dailyLimitPaise: mandate.dailyLimitPaise,
        lifetimeLimitPaise: mandate.lifetimeLimitPaise,
        spentTodayPaise,
        spentLifetimePaise,
        dailyUtilizationPercent,
        lifetimeUtilizationPercent,
      };
    });

    const totalAttempts = successCount + recoveredCount + failedCount;
    const recoveryRatePercent =
      recoveredCount + failedCount > 0
        ? Math.round((recoveredCount / (recoveredCount + failedCount)) * 100)
        : 100;

    return NextResponse.json({
      summary: {
        totalSettledPaise: Number(settledTotals?.totalSettledPaise ?? 0),
        totalTransactions: totalAttempts,
        successCount,
        recoveredCount,
        failedCount,
        blockedAttemptsCount: Number(blockedAttempts?.count ?? 0),
        blockedVolumePaise: Number(blockedAttempts?.blockedVolumePaise ?? 0),
        recoveredVolumePaise,
        recoveryRatePercent,
      },
      dailyVolume: dailyVolume.map((d) => ({
        date: d.date,
        volumePaise: Number(d.volumePaise),
        count: Number(d.count),
      })),
      categoryStats: categoryStats.map((c) => ({
        category: c.category || "Uncategorized",
        attempts: Number(c.attempts),
        totalPaise: Number(c.totalPaise),
      })),
      agentMetrics,
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ error: "Failed to compute financial analytics" }, { status: 500 });
  }
}

import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { inngest } from "@/server/inngest/client";
import { transactions, users } from "@/server/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/review
 * Retrieves quarantined and exhausted transactions awaiting human review.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "pending"; // "pending" | "reviewed" | "all"

    let conditions = eq(transactions.status, "FAILED");
    if (filter === "pending") {
      conditions = and(
        eq(transactions.status, "FAILED"),
        isNull(transactions.reviewedAt),
      ) as typeof conditions;
    } else if (filter === "reviewed") {
      conditions = and(
        eq(transactions.status, "FAILED"),
        isNotNull(transactions.reviewedAt),
      ) as typeof conditions;
    }

    const items = await db.query.transactions.findMany({
      where: conditions,
      orderBy: [desc(transactions.createdAt)],
      limit: 50,
      with: {
        mandate: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/review error:", error);
    return NextResponse.json({ error: "Failed to fetch review queue items" }, { status: 500 });
  }
}

/**
 * POST /api/review
 * Human review action: ACKNOWLEDGE, APPROVE_RETRY, or DISMISS.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { transactionId, action } = body as {
      transactionId?: string;
      action?: "ACKNOWLEDGE" | "APPROVE_RETRY" | "DISMISS";
    };

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }

    let user = await getSessionUser();
    if (!user) {
      user =
        (await db.query.users.findFirst({
          where: eq(users.role, "ADMIN"),
        })) ??
        (await db.query.users.findFirst()) ??
        null;
    }

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const reviewedAt = new Date();
    const reviewedBy = user?.id ?? null;

    if (action === "APPROVE_RETRY") {
      // Reset retry count and re-trigger recovery
      const [updated] = await db
        .update(transactions)
        .set({
          status: "PENDING",
          retryCount: 0,
          failureReason: null,
          reviewedAt,
          reviewedBy,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId))
        .returning();

      // Trigger Inngest recovery workflow
      await inngest.send({
        name: "payment/failed",
        data: {
          transactionId: tx.id,
          mandateId: tx.mandateId,
        },
      });

      return NextResponse.json({
        success: true,
        action: "RETRY_DISPATCHED",
        transaction: updated,
      });
    }

    // Default: ACKNOWLEDGE or DISMISS
    const [updated] = await db
      .update(transactions)
      .set({
        reviewedAt,
        reviewedBy,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId))
      .returning();

    return NextResponse.json({
      success: true,
      action: action || "ACKNOWLEDGE",
      transaction: updated,
    });
  } catch (error) {
    console.error("POST /api/review error:", error);
    return NextResponse.json({ error: "Failed to process review action" }, { status: 500 });
  }
}

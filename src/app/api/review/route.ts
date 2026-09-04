import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { getUserMandateIds } from "@/server/authz";
import { db } from "@/server/db";
import { inngest } from "@/server/inngest/client";
import { transactions } from "@/server/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/review
 * Retrieves quarantined and exhausted transactions awaiting human review,
 * scoped to the authenticated user's own mandates.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Multi-tenancy: only surface quarantine items belonging to the user.
    const mandateIds = await getUserMandateIds(user.id);

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "pending"; // "pending" | "reviewed" | "all"

    // Always: FAILED + owned by the user. Optional: review state filter.
    const conditions = [
      eq(transactions.status, "FAILED"),
      inArray(transactions.mandateId, mandateIds),
      ...(filter === "pending" ? [isNull(transactions.reviewedAt)] : []),
      ...(filter === "reviewed" ? [isNotNull(transactions.reviewedAt)] : []),
    ];

    const items = await db.query.transactions.findMany({
      where: and(...conditions),
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
 * Only the owning user may act on a quarantined transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "VIEWER") {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot perform review actions" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { transactionId, action } = body as {
      transactionId?: string;
      action?: "ACKNOWLEDGE" | "APPROVE_RETRY" | "DISMISS";
    };

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Multi-tenancy: a user may only review transactions on their own mandates.
    const mandateIds = await getUserMandateIds(user.id);
    if (!mandateIds.includes(tx.mandateId)) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const reviewedAt = new Date();
    const reviewedBy = user.id;

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

// src/server/recovery.ts
// The silent-retry recovery engine, extracted from the Inngest function so it
// is testable and shared. Fixes the historic bug where retries re-evaluated
// policy against a hardcoded "Office Supplies" category.
import { and, eq, lt, sql } from "drizzle-orm";
import { MandateOSPaymentGateway } from "@/lib/razorpay";
import { db } from "./db";
import { inngest } from "./inngest/client";
import { evaluateMandatePolicy, resolveRetryCategory } from "./policy";
import { mandates, merchants, transactions } from "./schema";
import { getCommittedSpendTotals } from "./spend";

export interface RecoveryResult {
  success: boolean;
  reason: string;
}

/**
 * Executes one silent-retry attempt for a failed transaction:
 * 1. Re-fetches fresh transaction + mandate state.
 * 2. Resolves the REAL merchant category the transaction was authorized under.
 * 3. Re-evaluates deterministic policy with live committed-spend totals.
 * 4. Atomically claims one retry from the mandate's budget (concurrency-safe).
 * 5. Dispatches to the gateway (mock or live Razorpay).
 */
export async function executeRetry(
  transactionId: string,
  mandateId: string,
): Promise<RecoveryResult> {
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
  });
  const mandate = await db.query.mandates.findFirst({
    where: eq(mandates.id, mandateId),
  });

  if (!tx || !mandate) throw new Error("Data not found");

  // Resolve the category this transaction was originally authorized under
  // (denormalized on the row; merchant business category as legacy fallback).
  const merchant = tx.merchantId
    ? await db.query.merchants.findFirst({
        where: eq(merchants.id, tx.merchantId),
      })
    : undefined;

  const category = resolveRetryCategory(
    { merchantCategory: tx.merchantCategory ?? null },
    merchant ?? null,
  );

  if (!category) {
    // Fail CLOSED: without the true category we cannot safely re-authorize.
    return {
      success: false,
      reason:
        "CATEGORY_UNRESOLVED: Transaction has no merchant category and merchant lookup failed. Quarantined for human review.",
    };
  }

  // Re-check deterministic policy with live committed-spend totals
  const totals = await getCommittedSpendTotals(mandate.id);
  const policyCheck = evaluateMandatePolicy(tx.amount, category, mandate, tx.retryCount, totals);

  if (!policyCheck.allowed) {
    return { success: false, reason: policyCheck.reason };
  }

  // ATOMIC RETRY BUDGET CLAIM:
  // Concurrency-safe atomic claim ensures parallel workers never exceed maxSilentRetries
  const maxRetries = mandate.maxSilentRetries ?? 3;
  const [claimedTx] = await db
    .update(transactions)
    .set({
      retryCount: sql`${transactions.retryCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(transactions.id, transactionId), lt(transactions.retryCount, maxRetries)))
    .returning();

  if (!claimedTx) {
    // Retry budget exhausted -> Quarantine transaction to FAILED for human review
    await db
      .update(transactions)
      .set({
        status: "FAILED",
        failureReason: "RETRY_BUDGET_EXHAUSTED",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId));

    await inngest.send({
      name: "audit/generate",
      data: {
        transactionId: tx.id,
        mandateId: mandate.id,
        failureReason: "RETRY_BUDGET_EXHAUSTED",
        retryCount: tx.retryCount,
        action: "RETRY_EXHAUSTED_QUARANTINED",
      },
    });

    return {
      success: false,
      reason: `Retry budget exhausted (${tx.retryCount}/${maxRetries}). Quarantined for review.`,
    };
  }

  // Try gateway again using the atomically claimed transaction
  try {
    const isMock = process.env.GATEWAY_MODE === "mock" || !process.env.RAZORPAY_KEY_ID;
    if (isMock) {
      if (claimedTx.nextRetryOutcome === "FAIL") {
        throw new Error("MOCK_GATEWAY: Retried payment failed deterministically");
      }

      // Mock mode: Settle to RECOVERED immediately
      await db
        .update(transactions)
        .set({ status: "RECOVERED" })
        .where(eq(transactions.id, claimedTx.id));

      return {
        success: true,
        reason: "Payment recovered after silent retry.",
      };
    }

    // Live mode: Dispatch order to Razorpay and transition to ORDER_CREATED
    const newOrder = await MandateOSPaymentGateway.createOrder(claimedTx.amount, mandate.id);

    await db
      .update(transactions)
      .set({
        status: "ORDER_CREATED",
        razorpayOrderId: newOrder.id,
      })
      .where(eq(transactions.id, claimedTx.id));

    return {
      success: true,
      reason: "Retry order created at gateway; awaiting webhook settlement.",
    };
  } catch (_error) {
    if (claimedTx.retryCount >= maxRetries) {
      await db
        .update(transactions)
        .set({ status: "FAILED", failureReason: "MAX_RETRIES_EXCEEDED" })
        .where(eq(transactions.id, claimedTx.id));
    }

    return { success: false, reason: "Retry failed at gateway." };
  }
}

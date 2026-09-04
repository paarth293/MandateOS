import { randomUUID } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { canonicalStringify, verifySignature } from "@/lib/crypto";
import { shouldRateLimit } from "@/lib/rateLimit";
import { MandateOSPaymentGateway } from "@/lib/razorpay";
import { db } from "@/server/db";
import { evaluateMandatePolicy } from "@/server/policy";
import { mandates, purchaseAttempts, transactions } from "@/server/schema";
import { getCommittedSpendTotals } from "@/server/spend";
import { purchaseRequestSchema } from "@/server/validation";

// DB-backed sliding-window rate limiter (60 req/min per mandate).
// Attempts are counted from the purchase_attempts table, which is the same
// durable store used for replay protection, so the limit survives restarts and
// is shared across server instances (unlike the old in-memory Map).
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

export async function POST(req: Request) {
  let attemptId: string | null = null;

  try {
    // 1. Parse & validate request body
    const body = await req.json().catch(() => null);
    const parsedBody = purchaseRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsedBody.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { mandateId, amountPaise, category } = parsedBody.data;

    // 2. Parse cryptographic headers
    const signature = req.headers.get("x-mandate-signature");
    const timestampStr = req.headers.get("x-timestamp");
    const nonce = req.headers.get("x-nonce");

    if (!signature || !timestampStr || !nonce) {
      return NextResponse.json(
        {
          error:
            "Missing cryptographic authorization headers (x-mandate-signature, x-timestamp, x-nonce)",
        },
        { status: 401 },
      );
    }

    // 3. Check Mandate Existence & Status
    const mandate = await db.query.mandates.findFirst({
      where: eq(mandates.id, mandateId),
    });

    if (mandate?.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Invalid, Revoked, or Inactive Mandate ID" },
        { status: 401 },
      );
    }

    // 4. Validate Timestamp Drift (300s window to prevent delayed playback)
    const timestamp = Number(timestampStr);
    if (Number.isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 300_000) {
      return NextResponse.json(
        {
          error:
            "STALE_REQUEST: Request timestamp is outside the allowed 300-second verification window",
        },
        { status: 401 },
      );
    }

    // 5. Verify Ed25519 Cryptographic Signature
    const canonicalPayload = canonicalStringify({
      amountPaise,
      category,
      mandateId,
      nonce,
      timestamp,
    });

    const isSignatureValid = verifySignature(canonicalPayload, signature, mandate.publicKey);
    if (!isSignatureValid) {
      return NextResponse.json(
        { error: "INVALID_SIGNATURE: Asymmetric cryptographic signature mismatch" },
        { status: 401 },
      );
    }

    // 6. Nonce Replay Shield Check (Database Unique Constraint).
    //    Every SIGNED request inserts an attempt row first: the unique nonce
    //    blocks replays (23505 -> 409) and the row doubles as the rate-limit
    //    event log and firewall telemetry. Unsigned junk never reaches the DB.
    attemptId = randomUUID();
    try {
      await db.insert(purchaseAttempts).values({
        id: attemptId,
        mandateId: mandate.id,
        merchantCategory: category,
        amountPaise,
        nonce,
        outcome: "PENDING",
      });
    } catch (insertError: unknown) {
      const err = insertError as { code?: string; message?: string };
      if (err?.code === "23505" || err?.message?.includes("unique")) {
        return NextResponse.json(
          {
            error:
              "REPLAY_DETECTED: This unique nonce has already been utilized in a prior request.",
          },
          { status: 409 },
        );
      }
      throw insertError;
    }

    // 7. DB-backed Per-Mandate Sliding-Window Rate Limit.
    //    Enforced AFTER signature verification, so only signed requests count
    //    and unsigned junk never consumes budget or touches the DB.
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentAttempts = await db
      .select({ createdAt: purchaseAttempts.createdAt })
      .from(purchaseAttempts)
      .where(
        and(
          eq(purchaseAttempts.mandateId, mandate.id),
          gte(purchaseAttempts.createdAt, windowStart),
        ),
      );

    if (
      shouldRateLimit(
        recentAttempts.map((attempt) => attempt.createdAt.getTime()),
        Date.now(),
        RATE_LIMIT_WINDOW_MS,
        MAX_REQUESTS_PER_WINDOW,
      )
    ) {
      await db
        .update(purchaseAttempts)
        .set({
          outcome: "RATE_LIMITED",
          reason: `RATE_LIMIT_EXCEEDED: More than ${MAX_REQUESTS_PER_WINDOW} requests per minute for this mandate.`,
        })
        .where(eq(purchaseAttempts.id, attemptId));

      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: `Too many purchase requests for this mandate. Limit is ${MAX_REQUESTS_PER_WINDOW} req/min.`,
        },
        { status: 429 },
      );
    }

    // 8. Calculate Cumulative Committed Spend Totals (Daily UTC & Lifetime)
    const totals = await getCommittedSpendTotals(mandate.id);

    // 9. Deterministic Policy Evaluation (Single swipe + Daily + Lifetime limits)
    const policyCheck = evaluateMandatePolicy(amountPaise, category, mandate, 0, totals);

    if (!policyCheck.allowed) {
      if (attemptId) {
        await db
          .update(purchaseAttempts)
          .set({ outcome: "BLOCKED", reason: policyCheck.reason })
          .where(eq(purchaseAttempts.id, attemptId));
      }

      return NextResponse.json(
        {
          error: "Policy Violation Blocked by MandateOS",
          reason: policyCheck.reason,
        },
        { status: 403 },
      );
    }

    // 10. Fetch Merchant
    const merchant = await db.query.merchants.findFirst();
    if (!merchant) throw new Error("No merchants configured");

    // 11. Gateway Order Creation (Mock or Live)
    const order = await MandateOSPaymentGateway.createOrder(amountPaise, mandate.id);

    // 12. Transaction Row Insertion.
    //     Denormalizes the merchant category so silent-retry recovery can
    //     re-evaluate policy against the category this purchase was truly
    //     authorized under (fixes the hardcoded "Office Supplies" bug).
    const txId = randomUUID();
    await db.insert(transactions).values({
      id: txId,
      mandateId: mandate.id,
      merchantId: merchant.id,
      amount: amountPaise,
      status: "ORDER_CREATED",
      razorpayOrderId: order.id,
      merchantCategory: category,
    });

    // 13. Update Purchase Attempt with Approval & Transaction Reference
    if (attemptId) {
      await db
        .update(purchaseAttempts)
        .set({ outcome: "ALLOWED", transactionId: txId, reason: "POLICY_PASSED" })
        .where(eq(purchaseAttempts.id, attemptId));
    }

    return NextResponse.json({
      success: true,
      transactionId: txId,
      razorpayOrderId: order.id,
      message: "Purchase mathematically authorized and signed by MandateOS.",
    });
  } catch (error) {
    console.error("Agent Purchase Error:", error);
    return NextResponse.json({ error: "Internal Gateway Error" }, { status: 500 });
  }
}

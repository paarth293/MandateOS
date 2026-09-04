import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { canonicalStringify, verifySignature } from "@/lib/crypto";
import { MandateOSPaymentGateway } from "@/lib/razorpay";
import { db } from "@/server/db";
import { evaluateMandatePolicy } from "@/server/policy";
import { mandates, purchaseAttempts, transactions } from "@/server/schema";
import { purchaseRequestSchema } from "@/server/validation";

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

    // 6. Nonce Replay Shield Check (Database Unique Constraint)
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

    // 7. Calculate Cumulative Spend Totals (Daily UTC & Lifetime)
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const validStatuses = ["SUCCESS", "RECOVERED", "PENDING"] as const;

    const [dailyTotalResult] = await db
      .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.mandateId, mandate.id),
          inArray(transactions.status, validStatuses),
          gte(transactions.createdAt, startOfTodayUtc),
        ),
      );

    const [lifetimeTotalResult] = await db
      .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(eq(transactions.mandateId, mandate.id), inArray(transactions.status, validStatuses)),
      );

    const spentTodayPaise = Number(dailyTotalResult?.total ?? 0);
    const spentLifetimePaise = Number(lifetimeTotalResult?.total ?? 0);

    // 8. Deterministic Policy Evaluation (Single swipe + Daily + Lifetime limits)
    const policyCheck = evaluateMandatePolicy(amountPaise, category, mandate, 0, {
      spentTodayPaise,
      spentLifetimePaise,
    });

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

    // 9. Fetch Merchant
    const merchant = await db.query.merchants.findFirst();
    if (!merchant) throw new Error("No merchants configured");

    // 10. Gateway Order Creation (Mock or Live)
    const order = await MandateOSPaymentGateway.createOrder(amountPaise, mandate.id);

    // 11. Transaction Row Insertion
    const txId = randomUUID();
    await db.insert(transactions).values({
      id: txId,
      mandateId: mandate.id,
      merchantId: merchant.id,
      amount: amountPaise,
      status: "ORDER_CREATED",
      razorpayOrderId: order.id,
    });

    // 12. Update Purchase Attempt with Approval & Transaction Reference
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

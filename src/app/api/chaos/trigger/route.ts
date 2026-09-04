// src/app/api/chaos/trigger/route.ts

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { inngest } from "@/server/inngest/client";
import { transactions } from "@/server/schema";

export async function POST(req: Request) {
  try {
    // 1. Parse the injected chaos from the frontend
    const { transactionId, mandateId, failureReason } = await req.json();

    if (!transactionId || !mandateId || !failureReason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Force the database state to FAILED and set deterministic recovery outcome
    // BANK_TIMEOUT -> recoverable (SUCCESS on retry)
    // INSUFFICIENT_FUNDS / CARD_EXPIRED -> non-recoverable (FAIL on retry)
    const nextRetryOutcome = failureReason === "BANK_TIMEOUT" ? "SUCCESS" : "FAIL";

    await db
      .update(transactions)
      .set({
        status: "FAILED",
        failureReason: failureReason,
        nextRetryOutcome,
      })
      .where(eq(transactions.id, transactionId));

    console.log(`🔥 CHAOS INJECTED: Forced ${failureReason} on TX ${transactionId}`);

    // 3. Trigger the Recovery Engine & AI Audit Log
    // This perfectly mimics our real webhook architecture, proving that
    // the system responds to failures exactly the same way, whether they
    // happen naturally or are artificially injected.
    await inngest.send([
      {
        name: "payment/failed", // Wakes up the 30-second silent retry worker
        data: {
          transactionId,
          mandateId,
        },
      },
      {
        name: "audit/generate", // Wakes up Gemini to explain the failure
        data: {
          transactionId,
          mandateId,
          failureReason,
          retryCount: 0, // It's the first failure
        },
      },
    ]);

    return NextResponse.json({ success: true, message: "Chaos injected successfully" });
  } catch (error) {
    console.error("Chaos Injection Error:", error);
    return NextResponse.json({ error: "Failed to inject chaos" }, { status: 500 });
  }
}

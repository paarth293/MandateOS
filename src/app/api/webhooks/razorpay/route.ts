// src/app/api/webhooks/razorpay/route.ts

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { transactions } from "@/server/schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // In a production app, we would cryptographically verify the Razorpay signature here.
    // For our hackathon demo/Chaos Console, we allow raw events to pass through.

    const eventType = body.event; // e.g., 'payment.captured' or 'payment.failed'
    const payload = body.payload.payment.entity;
    const orderId = payload.order_id;

    // 1. Find the transaction in our database
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.razorpayOrderId, orderId),
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // 2. Handle the event
    if (eventType === "payment.failed") {
      // Update transaction status in Postgres
      await db
        .update(transactions)
        .set({
          status: "FAILED",
          failureReason: payload.error_code || "BANK_TIMEOUT",
        })
        .where(eq(transactions.id, tx.id));

      console.log(`❌ Webhook: Payment failed for Order ${orderId}`);

      // (Later in Phase 6, we will trigger Inngest here to run the recovery AI)
    } else if (eventType === "payment.captured") {
      await db.update(transactions).set({ status: "SUCCESS" }).where(eq(transactions.id, tx.id));

      console.log(`✅ Webhook: Payment captured for Order ${orderId}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

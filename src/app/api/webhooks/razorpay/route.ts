// src/app/api/webhooks/razorpay/route.ts

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { inngest } from "@/server/inngest/client"; // <-- 1. Import our Durable Client
import { transactions } from "@/server/schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const eventType = body.event;
    const payload = body.payload.payment.entity;
    const orderId = payload.order_id;

    // Find the original transaction
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.razorpayOrderId, orderId),
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (eventType === "payment.failed") {
      const failureReason = payload.error_code || "BANK_TIMEOUT";

      // Update the database to reflect the initial failure
      await db
        .update(transactions)
        .set({ status: "FAILED", failureReason })
        .where(eq(transactions.id, tx.id));

      console.log(`❌ Webhook: Payment failed for Order ${orderId}`);

      // 2. THE MAGIC: Wake up the AI and Recovery Engine!
      // We send an array of events to trigger multiple background jobs simultaneously.
      await inngest.send([
        {
          name: "payment/failed", // Triggers recoverFailedPayment in functions.ts
          data: {
            transactionId: tx.id,
            mandateId: tx.mandateId,
          },
        },
        {
          name: "audit/generate", // Triggers generateAuditLog in functions.ts
          data: {
            transactionId: tx.id,
            mandateId: tx.mandateId,
            failureReason: failureReason,
            retryCount: tx.retryCount,
          },
        },
      ]);
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

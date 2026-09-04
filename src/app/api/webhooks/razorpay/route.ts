import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { db } from "@/server/db";
import { inngest } from "@/server/inngest/client";
import { transactions } from "@/server/schema";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify HMAC-SHA256 signature in live mode (or whenever secret is configured)
    if (process.env.GATEWAY_MODE !== "mock" && webhookSecret) {
      if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
      }
    }

    const body = JSON.parse(rawBody);
    const eventType = body.event;
    const payload = body.payload?.payment?.entity;
    const orderId = payload?.order_id;

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id in webhook payload" }, { status: 400 });
    }

    // Find the correlated transaction
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.razorpayOrderId, orderId),
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (eventType === "payment.failed") {
      const failureReason = payload.error_code || payload.error_description || "BANK_TIMEOUT";

      await db
        .update(transactions)
        .set({ status: "FAILED", failureReason })
        .where(eq(transactions.id, tx.id));

      console.log(`❌ Webhook: Payment failed for Order ${orderId} (Reason: ${failureReason})`);

      await inngest.send([
        {
          name: "payment/failed",
          data: {
            transactionId: tx.id,
            mandateId: tx.mandateId,
          },
        },
        {
          name: "audit/generate",
          data: {
            transactionId: tx.id,
            mandateId: tx.mandateId,
            failureReason: failureReason,
            retryCount: tx.retryCount,
          },
        },
      ]);
    } else if (eventType === "payment.captured") {
      // Finite state machine transition:
      // If transaction was previously FAILED (retried by Inngest and captured), transition to RECOVERED.
      // If transaction was ORDER_CREATED or PENDING, transition to SUCCESS.
      const resolvedStatus = tx.status === "FAILED" ? "RECOVERED" : "SUCCESS";

      await db
        .update(transactions)
        .set({ status: resolvedStatus })
        .where(eq(transactions.id, tx.id));

      console.log(
        `✅ Webhook: Payment captured for Order ${orderId} -> Transitioned to ${resolvedStatus}`,
      );

      await inngest.send({
        name: "audit/generate",
        data: {
          transactionId: tx.id,
          mandateId: tx.mandateId,
          failureReason: "NONE",
          retryCount: tx.retryCount,
          action: resolvedStatus === "RECOVERED" ? "SILENT_RETRY_SUCCESS" : "PAYMENT_CAPTURED",
        },
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

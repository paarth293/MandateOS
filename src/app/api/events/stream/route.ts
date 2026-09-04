import { desc } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { purchaseAttempts, transactions } from "@/server/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/stream
 * Server-Sent Events (SSE) endpoint providing a real-time event stream
 * of purchase attempts, firewall decisions, and transaction state changes.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      let lastCheck = new Date(Date.now() - 30_000); // look back 30 seconds initially

      req.signal.addEventListener("abort", () => {
        isClosed = true;
        controller.close();
      });

      // Send initial connection event
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({
            status: "CONNECTED",
            timestamp: new Date().toISOString(),
          })}\n\n`,
        ),
      );

      // Event loop
      const interval = setInterval(async () => {
        if (isClosed) {
          clearInterval(interval);
          return;
        }

        try {
          // Poll recent attempts since lastCheck
          const newAttempts = await db.query.purchaseAttempts.findMany({
            where: (attempts, { gt }) => gt(attempts.createdAt, lastCheck),
            orderBy: [desc(purchaseAttempts.createdAt)],
            limit: 10,
          });

          // Poll recent transactions since lastCheck
          const newTx = await db.query.transactions.findMany({
            where: (tx, { gt }) => gt(tx.createdAt, lastCheck),
            orderBy: [desc(transactions.createdAt)],
            limit: 10,
          });

          lastCheck = new Date();

          for (const attempt of newAttempts) {
            controller.enqueue(
              encoder.encode(
                `event: attempt\ndata: ${JSON.stringify({
                  type: "PURCHASE_ATTEMPT",
                  id: attempt.id,
                  mandateId: attempt.mandateId,
                  amountPaise: attempt.amountPaise,
                  category: attempt.merchantCategory,
                  outcome: attempt.outcome,
                  reason: attempt.reason,
                  createdAt: attempt.createdAt,
                })}\n\n`,
              ),
            );
          }

          for (const tx of newTx) {
            controller.enqueue(
              encoder.encode(
                `event: transaction\ndata: ${JSON.stringify({
                  type: "TRANSACTION_UPDATE",
                  id: tx.id,
                  mandateId: tx.mandateId,
                  amount: tx.amount,
                  status: tx.status,
                  retryCount: tx.retryCount,
                  failureReason: tx.failureReason,
                  createdAt: tx.createdAt,
                })}\n\n`,
              ),
            );
          }

          // Send heartbeat
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch (_err) {
          // Ignore polling errors during connection close
        }
      }, 2000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

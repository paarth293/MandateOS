import { and, eq, lt } from "drizzle-orm";
import { analyzeTransactionFailure } from "../ai";
import { publishAnchorForMandate } from "../anchoring";
import { appendAuditBlock } from "../audit";
import { db } from "../db";
import { executeRetry } from "../recovery";
import { authAttempts, mandates, purchaseAttempts, sessions, transactions } from "../schema";
import { inngest } from "./client";

export const recoverFailedPayment = inngest.createFunction(
  {
    id: "recover-failed-payment",
    triggers: [{ event: "payment/failed" }],
  },
  async ({ event, step }) => {
    const payload = event.data as { transactionId: string; mandateId: string };
    const { transactionId, mandateId } = payload;

    // Fetch mandate and transaction to calculate exponential backoff with jitter
    const retryConfig = await step.run("calculate-backoff-delay", async () => {
      const [m, tx] = await Promise.all([
        db.query.mandates.findFirst({ where: eq(mandates.id, mandateId) }),
        db.query.transactions.findFirst({
          where: eq(transactions.id, transactionId),
        }),
      ]);

      const baseDelay = m?.retryDelaySeconds || 30;
      const attempt = tx?.retryCount ?? 0;

      // Exponential backoff with full jitter: (base * 2^attempt) + random(0, base * 0.5)
      // Clamped to a maximum of 600 seconds to prevent indefinite delay
      const exponentialDelay = baseDelay * 2 ** attempt;
      const jitter = Math.floor(Math.random() * (baseDelay * 0.5));
      const calculatedDelay = Math.min(600, Math.max(5, exponentialDelay + jitter));

      return { delaySeconds: calculatedDelay, attempt };
    });

    // 1. THE COOLDOWN:
    // Put function to sleep dynamically based on exponential backoff with anti-thundering herd jitter
    await step.sleep("wait-for-cooldown", `${retryConfig.delaySeconds}s`);

    // 2. THE RECOVERY EXECUTION:
    // Delegated to the shared recovery engine (src/server/recovery.ts), which
    // re-evaluates policy with the transaction's REAL merchant category and
    // atomically claims retry budget before dispatching to the gateway.
    const recoveryResult = await step.run("execute-retry", () =>
      executeRetry(transactionId, mandateId),
    );

    return recoveryResult;
  },
);

export const generateAuditLog = inngest.createFunction(
  {
    id: "generate-audit-log",
    triggers: [{ event: "audit/generate" }],
  },
  async ({ event, step }) => {
    const payload = event.data as {
      transactionId: string;
      mandateId: string;
      failureReason: string;
      retryCount: number;
      action?: string;
    };

    // 1. Fetch mandate to read actual maxSilentRetries configuration (Defect A4a fix)
    const mandate = await step.run("fetch-mandate-config", async () => {
      return await db.query.mandates.findFirst({
        where: eq(mandates.id, payload.mandateId),
      });
    });

    const maxRetries = mandate?.maxSilentRetries ?? 3;

    // 2. Call Gemini for plain English explanation
    const aiAnalysis = await step.run("analyze-with-gemini", async () => {
      return await analyzeTransactionFailure(payload.failureReason, payload.retryCount, maxRetries);
    });

    // 3. Append to Cryptographic Hash Chain
    await step.run("write-secure-log", async () => {
      const action = payload.action || (payload.retryCount > 0 ? "SILENT_RETRY" : "PAYMENT_FAILED");

      // appendAuditBlock is the single shared chain writer; it is fork-proof
      // via the unique (mandate_id, previous_hash) index and retries against
      // the fresh head if a concurrent writer claimed the same predecessor.
      const currentHash = await appendAuditBlock(
        payload.mandateId,
        action,
        aiAnalysis,
        payload.transactionId,
      );

      return { currentHash, action };
    });

    // 4. Outbound Webhook Alert (if mandate has notifyUrl configured)
    if (mandate?.notifyUrl) {
      await step.run("dispatch-webhook-alert", async () => {
        try {
          const alertPayload = {
            event: "mandate.alert",
            mandateId: payload.mandateId,
            agentName: mandate.agentName,
            transactionId: payload.transactionId,
            action: payload.action || (payload.retryCount > 0 ? "SILENT_RETRY" : "PAYMENT_FAILED"),
            failureReason: payload.failureReason,
            retryCount: payload.retryCount,
            details: aiAnalysis,
            timestamp: new Date().toISOString(),
          };

          const res = await fetch(mandate.notifyUrl!, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "MandateOS-AlertBot/1.0",
            },
            body: JSON.stringify(alertPayload),
            signal: AbortSignal.timeout(5000),
          });

          return { dispatched: true, status: res.status };
        } catch (err) {
          console.error("Outbound webhook alert delivery failed:", err);
          return { dispatched: false, error: String(err) };
        }
      });
    }

    return { success: true };
  },
);

export const reconcileStaleOrders = inngest.createFunction(
  {
    id: "reconcile-stale-orders",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    // 1. Find all transactions stuck in ORDER_CREATED for > 15 minutes
    const staleCutoff = new Date(Date.now() - 15 * 60 * 1000);

    const staleOrders = await step.run("find-stale-orders", async () => {
      return await db.query.transactions.findMany({
        where: and(
          eq(transactions.status, "ORDER_CREATED"),
          lt(transactions.createdAt, staleCutoff),
        ),
        limit: 25,
      });
    });

    if (staleOrders.length === 0) {
      return { reconciled: 0 };
    }

    // 2. Reconcile each stale order
    let reconciledCount = 0;
    for (const tx of staleOrders) {
      await step.run(`reconcile-tx-${tx.id}`, async () => {
        const isMock = process.env.GATEWAY_MODE === "mock" || !process.env.RAZORPAY_KEY_ID;

        // In mock mode or if nextRetryOutcome is FAIL, transition to FAILED
        const nextStatus = isMock && tx.nextRetryOutcome === "FAIL" ? "FAILED" : "SUCCESS";
        const failureReason = nextStatus === "FAILED" ? "STALE_ORDER_EXPIRED" : null;

        await db
          .update(transactions)
          .set({
            status: nextStatus,
            failureReason,
          })
          .where(eq(transactions.id, tx.id));

        // Emit audit log entry
        await inngest.send({
          name: "audit/generate",
          data: {
            transactionId: tx.id,
            mandateId: tx.mandateId,
            failureReason: failureReason || "NONE",
            retryCount: tx.retryCount,
            action: nextStatus === "SUCCESS" ? "RECONCILIATION_CAPTURED" : "RECONCILIATION_EXPIRED",
          },
        });
      });
      reconciledCount++;
    }

    return { reconciled: reconciledCount };
  },
);

export const publishAuditAnchor = inngest.createFunction(
  {
    id: "publish-audit-anchor",
    triggers: [{ cron: "0 * * * *" }, { event: "audit/anchor.publish" }],
  },
  async ({ step }) => {
    // 1. Fetch active mandates
    const activeMandates = await step.run("fetch-mandates", async () => {
      return await db.query.mandates.findMany({
        where: eq(mandates.status, "ACTIVE"),
      });
    });

    let publishedCount = 0;

    for (const mandate of activeMandates) {
      await step.run(`anchor-mandate-${mandate.id}`, async () => {
        const result = await publishAnchorForMandate(mandate.id);
        if (result.published) publishedCount++;
      });
    }

    return { publishedAnchors: publishedCount };
  },
);

export const pruneStaleData = inngest.createFunction(
  {
    id: "prune-stale-data",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    // Bounds every high-volume table so it cannot grow without limit:
    // - purchase_attempts (nonce replay shield / rate limiter / telemetry):
    //   nonces are single-use and only meaningful inside the 60s rate window
    //   plus the 300s timestamp-drift window, so 1 hour of retention is ample.
    // - sessions: expired sessions are dead weight (login purges create new rows).
    // - auth_attempts: login brute-force telemetry only needs ~1 day.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const prunedAttempts = await step.run("prune-stale-purchase-attempts", async () => {
      const rows = await db
        .delete(purchaseAttempts)
        .where(lt(purchaseAttempts.createdAt, oneHourAgo))
        .returning({ id: purchaseAttempts.id });
      return rows.length;
    });

    const prunedSessions = await step.run("prune-expired-sessions", async () => {
      const rows = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, new Date()))
        .returning({ id: sessions.id });
      return rows.length;
    });

    const prunedAuthAttempts = await step.run("prune-stale-auth-attempts", async () => {
      const rows = await db
        .delete(authAttempts)
        .where(lt(authAttempts.createdAt, oneDayAgo))
        .returning({ id: authAttempts.id });
      return rows.length;
    });

    return {
      prunedPurchaseAttempts: prunedAttempts,
      prunedSessions,
      prunedAuthAttempts,
    };
  },
);

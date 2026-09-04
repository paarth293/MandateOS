import crypto from "node:crypto";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { canonicalStringify, generateAuditHash } from "@/lib/crypto";
import { MandateOSPaymentGateway } from "@/lib/razorpay";
import { analyzeTransactionFailure } from "../ai";
import { db } from "../db";
import { evaluateMandatePolicy } from "../policy";
import { anchors, auditLogs, mandates, transactions } from "../schema";
import { inngest } from "./client";

export const recoverFailedPayment = inngest.createFunction(
  {
    id: "recover-failed-payment",
    triggers: [{ event: "payment/failed" }],
  },
  async ({ event, step }) => {
    const payload = event.data as { transactionId: string; mandateId: string };
    const { transactionId, mandateId } = payload;

    // Fetch initial mandate to check dynamic cooldown settings
    const initialMandate = await step.run("fetch-mandate-cooldown", async () => {
      const m = await db.query.mandates.findFirst({ where: eq(mandates.id, mandateId) });
      return m ? { retryDelaySeconds: m.retryDelaySeconds } : { retryDelaySeconds: 30 };
    });

    // 1. THE COOLDOWN:
    // Put function to sleep dynamically based on mandate policy (default 30s)
    const delaySeconds = initialMandate.retryDelaySeconds || 30;
    await step.sleep("wait-for-cooldown", `${delaySeconds}s`);

    // 2. THE RECOVERY EXECUTION:
    const recoveryResult = await step.run("execute-retry", async () => {
      // Fetch fresh transaction and mandate state
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, transactionId),
      });
      const mandate = await db.query.mandates.findFirst({ where: eq(mandates.id, mandateId) });

      if (!tx || !mandate) throw new Error("Data not found");

      // Calculate cumulative spend totals
      const startOfTodayUtc = new Date();
      startOfTodayUtc.setUTCHours(0, 0, 0, 0);
      const validStatuses = ["SUCCESS", "RECOVERED", "ORDER_CREATED", "PENDING"] as const;

      const [dailyTotal] = await db
        .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.mandateId, mandate.id),
            inArray(transactions.status, validStatuses),
            gte(transactions.createdAt, startOfTodayUtc),
          ),
        );

      const [lifetimeTotal] = await db
        .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(eq(transactions.mandateId, mandate.id), inArray(transactions.status, validStatuses)),
        );

      // Check Deterministic Policy with live totals
      const policyCheck = evaluateMandatePolicy(
        tx.amount,
        "Office Supplies",
        mandate,
        tx.retryCount,
        {
          spentTodayPaise: Number(dailyTotal?.total ?? 0),
          spentLifetimePaise: Number(lifetimeTotal?.total ?? 0),
        },
      );

      if (!policyCheck.allowed) {
        return { success: false, reason: policyCheck.reason };
      }

      // Try gateway again
      try {
        const isMock = process.env.GATEWAY_MODE === "mock" || !process.env.RAZORPAY_KEY_ID;
        if (isMock) {
          if (tx.nextRetryOutcome === "FAIL") {
            throw new Error("MOCK_GATEWAY: Retried payment failed deterministically");
          }

          // Mock mode: Settle to RECOVERED immediately
          await db
            .update(transactions)
            .set({ status: "RECOVERED", retryCount: tx.retryCount + 1 })
            .where(eq(transactions.id, tx.id));

          return { success: true, reason: "Payment recovered after silent retry." };
        }

        // Live mode: Dispatch order to Razorpay and transition to ORDER_CREATED
        const newOrder = await MandateOSPaymentGateway.createOrder(tx.amount, mandate.id);

        await db
          .update(transactions)
          .set({
            status: "ORDER_CREATED",
            razorpayOrderId: newOrder.id,
            retryCount: tx.retryCount + 1,
          })
          .where(eq(transactions.id, tx.id));

        return {
          success: true,
          reason: "Retry order created at gateway; awaiting webhook settlement.",
        };
      } catch (_error) {
        await db
          .update(transactions)
          .set({ retryCount: tx.retryCount + 1 })
          .where(eq(transactions.id, tx.id));

        return { success: false, reason: "Retry failed at gateway." };
      }
    });

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
      // Fetch the most recent log for the mandate's hash chain
      const lastLog = await db.query.auditLogs.findFirst({
        where: eq(auditLogs.mandateId, payload.mandateId),
        orderBy: (auditLogs, { desc }) => [desc(auditLogs.createdAt)],
      });

      const previousHash = lastLog
        ? lastLog.currentHash
        : "0000000000000000000000000000000000000000000000000000000000000000";

      const action = payload.action || (payload.retryCount > 0 ? "SILENT_RETRY" : "PAYMENT_FAILED");

      const currentHash = generateAuditHash(action, aiAnalysis, previousHash);

      await db.insert(auditLogs).values({
        mandateId: payload.mandateId,
        transactionId: payload.transactionId,
        action,
        details: aiAnalysis,
        previousHash,
        currentHash,
      });
    });

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
        // Fetch all audit logs for this mandate
        const logs = await db.query.auditLogs.findMany({
          where: eq(auditLogs.mandateId, mandate.id),
          orderBy: (auditLogs, { asc }) => [asc(auditLogs.createdAt)],
        });

        if (logs.length === 0) return;

        const lastBlock = logs[logs.length - 1];
        const blockCount = logs.length;
        const lastBlockHash = lastBlock.currentHash;

        // Check latest anchor
        const lastAnchor = await db.query.anchors.findFirst({
          where: eq(anchors.mandateId, mandate.id),
          orderBy: (anchors, { desc }) => [desc(anchors.anchoredAt)],
        });

        // Skip if already anchored at this block
        if (
          lastAnchor &&
          lastAnchor.lastBlockHash === lastBlockHash &&
          lastAnchor.blockCount === blockCount
        ) {
          return;
        }

        const previousAnchorHash = lastAnchor
          ? lastAnchor.anchorHash
          : "0000000000000000000000000000000000000000000000000000000000000000";

        const timestamp = new Date();
        const payload = canonicalStringify({
          blockCount,
          lastBlockHash,
          mandateId: mandate.id,
          previousAnchorHash,
          timestamp: timestamp.toISOString(),
        });

        const anchorHash = crypto.createHash("sha256").update(payload).digest("hex");

        await db.insert(anchors).values({
          mandateId: mandate.id,
          anchorHash,
          previousAnchorHash,
          lastBlockHash,
          blockCount,
          anchoredAt: timestamp,
        });

        publishedCount++;
      });
    }

    return { publishedAnchors: publishedCount };
  },
);

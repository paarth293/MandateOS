import { eq } from "drizzle-orm";
import { generateAuditHash } from "@/lib/crypto";
import { MandateOSPaymentGateway } from "@/lib/razorpay";
import { analyzeTransactionFailure } from "../ai";
import { db } from "../db";
import { evaluateMandatePolicy } from "../policy";
import { auditLogs, mandates, transactions } from "../schema";
import { inngest } from "./client";

export const recoverFailedPayment = inngest.createFunction(
  {
    id: "recover-failed-payment",
    triggers: [{ event: "payment/failed" }],
  },
  async ({ event, step }) => {
    // We strictly type the incoming event data here to ensure TypeScript safety
    const payload = event.data as { transactionId: string; mandateId: string };
    const { transactionId, mandateId } = payload;

    // 1. THE COOLDOWN:
    // Safely put this serverless function to sleep for 30 seconds.
    await step.sleep("wait-for-cooldown", "30s");

    // 2. THE RECOVERY EXECUTION:
    const recoveryResult = await step.run("execute-retry", async () => {
      // Fetch the transaction and mandate
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, transactionId),
      });
      const mandate = await db.query.mandates.findFirst({ where: eq(mandates.id, mandateId) });

      if (!tx || !mandate) throw new Error("Data not found");

      // Check the Deterministic Policy
      const policyCheck = evaluateMandatePolicy(
        tx.amount,
        "Office Supplies",
        mandate,
        tx.retryCount,
      );

      if (!policyCheck.allowed) {
        return { success: false, reason: policyCheck.reason };
      }

      // If allowed, try Razorpay again
      try {
        await MandateOSPaymentGateway.createOrder(tx.amount, mandate.id);

        await db
          .update(transactions)
          .set({ status: "RECOVERED", retryCount: tx.retryCount + 1 })
          .where(eq(transactions.id, tx.id));

        return { success: true, reason: "Payment recovered after silent retry." };
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
    };

    // 1. Call Gemini (Durable Step)
    const aiAnalysis = await step.run("analyze-with-gemini", async () => {
      return await analyzeTransactionFailure(
        payload.failureReason,
        payload.retryCount,
        2, // Assuming max 2 silent retries for this demo
      );
    });

    // 2. Cryptographic Hash Chain
    await step.run("write-secure-log", async () => {
      // Fetch the most recent log for the hash chain
      const lastLog = await db.query.auditLogs.findFirst({
        orderBy: (auditLogs, { desc }) => [desc(auditLogs.createdAt)],
      });

      const previousHash = lastLog
        ? lastLog.currentHash
        : "0000000000000000000000000000000000000000000000000000000000000000";
      const action = payload.retryCount > 0 ? "SILENT_RETRY" : "PAYMENT_FAILED";

      const currentHash = generateAuditHash(action, aiAnalysis, previousHash);

      await db.insert(auditLogs).values({
        mandateId: payload.mandateId,
        transactionId: payload.transactionId,
        action,
        details: aiAnalysis, // The strict JSON from Gemini
        previousHash,
        currentHash,
      });
    });

    return { success: true };
  },
);

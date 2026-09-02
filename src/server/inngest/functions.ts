import { eq } from "drizzle-orm";
import { MandateOSPaymentGateway } from "@/lib/razorpay";
import { db } from "../db";
import { evaluateMandatePolicy } from "../policy";
import { mandates, transactions } from "../schema";
import { inngest } from "./client";

export const recoverFailedPayment = inngest.createFunction(
  {
    id: "recover-failed-payment",
    triggers: [{ event: "payment/failed" }], // Inngest v4 Syntax
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
      } catch (error) {
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

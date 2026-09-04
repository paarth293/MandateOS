"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { mandates, transactions } from "@/server/schema";

export async function createPendingTransaction(mandateId: string, amountPaise: number) {
  const txId = randomUUID();

  // We must fetch the mandate to get the merchantId for the transaction
  const mandate = await db.query.mandates.findFirst({
    where: eq(mandates.id, mandateId),
  });

  if (!mandate) throw new Error("Mandate not found");

  await db.insert(transactions).values({
    id: txId,
    mandateId,
    merchantId: mandate.merchantId,
    amount: amountPaise,
    status: "PENDING",
  });

  return txId;
}

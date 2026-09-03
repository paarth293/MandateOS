"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { transactions } from "@/server/schema";

export async function createPendingTransaction(mandateId: string, amountPaise: number) {
  const txId = randomUUID();

  await db.insert(transactions).values({
    id: txId,
    mandateId,
    amount: amountPaise,
    status: "PENDING",
  });

  return txId;
}

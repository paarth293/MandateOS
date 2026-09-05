"use server";

import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { transactions } from "@/server/schema";

export async function createPendingTransaction(mandateId: string, amountPaise: number) {
  await requireUser();

  const txId = randomUUID();

  // We must fetch a merchant for the transaction
  const merchant = await db.query.merchants.findFirst();
  if (!merchant) throw new Error("No merchant found");

  await db.insert(transactions).values({
    id: txId,
    mandateId,
    merchantId: merchant.id,
    amount: amountPaise,
    status: "PENDING",
    // Denormalize the category so the silent-retry recovery path can
    // re-evaluate policy with the real category (never a hardcoded value).
    merchantCategory: merchant.businessCategory,
  });

  return txId;
}

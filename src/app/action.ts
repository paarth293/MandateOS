// src/app/actions.ts
"use server"; // MAGIC: This tells Next.js this code runs securely on the backend!

import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { transactions } from "@/server/schema";

// This function can be called directly from a button click in the browser,
// but the database logic executes securely on the server.
export async function createPendingTransaction(
  mandateId: string,
  merchantId: string,
  amountPaise: number,
) {
  const txId = randomUUID();

  await db.insert(transactions).values({
    id: txId,
    mandateId,
    merchantId,
    amount: amountPaise,
    status: "PENDING",
  });

  return txId;
}

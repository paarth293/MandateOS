import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { mandates, merchants, transactions, users } from "./schema";

async function seed() {
  console.log("🌱 Initiating Enterprise Seed Sequence...");

  const userId = "00000000-0000-0000-0000-000000000001";
  const merchantId = "00000000-0000-0000-0000-000000000002";
  const mandateId = "00000000-0000-0000-0000-000000000003";

  await db
    .insert(users)
    .values({
      id: userId,
      name: "Priya Sharma",
      email: "priya@mandateos.dev",
    })
    .onConflictDoNothing();

  await db
    .insert(merchants)
    .values({
      id: merchantId,
      name: "TechSupply India",
      businessCategory: "Office Supplies",
      upiId: "techsupply@razorpay",
    })
    .onConflictDoNothing();

  await db
    .insert(mandates)
    .values({
      id: mandateId,
      userId: userId,
      agentName: "AutoGPT Procurement Agent",
      publicKey: "mock_pub_key",
      signature: "mock_signature",
      expiresAt: new Date(Date.now() + 10000000000),
      maxAmountPerTransaction: 500000,
      maxSilentRetries: 3,
      allowedCategories: ["Office Supplies", "Cloud Servers"],
      status: "ACTIVE",
    })
    .onConflictDoNothing();

  const statuses: ("SUCCESS" | "RECOVERED" | "FAILED" | "PENDING")[] = [
    "SUCCESS",
    "SUCCESS",
    "SUCCESS",
    "RECOVERED",
    "FAILED",
  ];

  for (let i = 0; i < 15; i++) {
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const randomAmount = Math.floor(Math.random() * 400000) + 100000;

    let failureReason = null;
    let retryCount = 0;

    if (randomStatus === "RECOVERED") {
      failureReason = "BANK_TIMEOUT";
      retryCount = 1;
    } else if (randomStatus === "FAILED") {
      failureReason = "INSUFFICIENT_FUNDS";
    }

    await db.insert(transactions).values({
      id: randomUUID(),
      mandateId: mandateId,
      merchantId: merchantId,
      amount: randomAmount,
      status: randomStatus,
      failureReason,
      retryCount,
      createdAt: new Date(Date.now() - Math.random() * 100000000 * 3),
    });
  }

  console.log("✅ Seed Complete: Dashboard populated with historical data.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

// src/server/seed.ts

import * as dotenv from "dotenv";
import { db } from "./db";
import { mandates, merchants, users } from "./schema";

// Load environment variables so the script can connect to Neon
dotenv.config();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create the Demo User (Priya from your pitch)
  const [priya] = await db
    .insert(users)
    .values({
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
    })
    .returning();
  console.log(`👤 Created user: ${priya.name} (${priya.id})`);

  // 2. Create the Demo Merchant (TechSupply from your pitch)
  const [techSupply] = await db
    .insert(merchants)
    .values({
      name: "TechSupply",
      businessCategory: "Office Supplies",
      upiId: "techsupply@razorpay",
    })
    .returning();
  console.log(`🏪 Created merchant: ${techSupply.name} (${techSupply.id})`);

  // 3. Create the Demo Mandate
  const [mandate] = await db
    .insert(mandates)
    .values({
      userId: priya.id,
      agentName: "Google-AP2",
      publicKey: "pubkey_demo_12345", // We will replace this with real crypto keys later
      signature: "sig_demo_abc987",
      status: "ACTIVE",
      maxAmountPerTransaction: 500000, // Stored in Paise (₹5,000.00)
      allowedCategories: ["Office Supplies", "Software"],
      maxSilentRetries: 2,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year from now
    })
    .returning();
  console.log(`📜 Created mandate for agent: ${mandate.agentName}`);

  console.log("✅ Seeding complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});

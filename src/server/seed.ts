import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { generateAuditHash, generateKeypair, signData } from "@/lib/crypto";
import { hashPassword } from "./auth";
import { db } from "./db";
import {
  anchors,
  auditLogs,
  mandates,
  merchants,
  purchaseAttempts,
  transactions,
  users,
} from "./schema";

async function seed() {
  console.log("🌱 Initiating MandateOS v2 Enterprise Seed Sequence...\n");

  const user1Id = "00000000-0000-0000-0000-000000000001";
  const user2Id = "00000000-0000-0000-0000-000000000011";

  const merchant1Id = "00000000-0000-0000-0000-000000000002";
  const merchant2Id = "00000000-0000-0000-0000-000000000022";

  const mandate1Id = "00000000-0000-0000-0000-000000000003";
  const mandate2Id = "00000000-0000-0000-0000-000000000004";

  // 1. Users with Scrypt Passwords & Roles
  console.log("👤 Seeding authenticated users...");
  await db
    .insert(users)
    .values([
      {
        id: user1Id,
        name: "Priya Sharma",
        email: "priya@mandateos.dev",
        passwordHash: hashPassword("MandateOS@2026"),
        role: "OWNER",
      },
      {
        id: user2Id,
        name: "Rahul Verma",
        email: "rahul@mandateos.dev",
        passwordHash: hashPassword("Viewer@2026"),
        role: "VIEWER",
      },
    ])
    .onConflictDoUpdate({
      target: users.id,
      set: {
        passwordHash: hashPassword("MandateOS@2026"),
        role: "OWNER",
      },
    });

  // 2. Merchants
  console.log("🏢 Seeding authorized merchants...");
  await db
    .insert(merchants)
    .values([
      {
        id: merchant1Id,
        name: "TechSupply India",
        businessCategory: "Office Supplies",
        upiId: "techsupply@razorpay",
      },
      {
        id: merchant2Id,
        name: "CloudCore Infrastructure",
        businessCategory: "Cloud Servers",
        upiId: "cloudcore@razorpay",
      },
    ])
    .onConflictDoNothing();

  // 3. Real Ed25519 Keypair Generation
  console.log("🔑 Generating cryptographic Ed25519 keypairs for AI Agents...");
  const agent1Keypair = generateKeypair();
  const agent2Keypair = generateKeypair();

  // Write agent1 secret key to gitignored agent.key file
  const keyFilePath = path.resolve(process.cwd(), "agent.key");
  fs.writeFileSync(keyFilePath, agent1Keypair.secretKey, { encoding: "utf8" });
  console.log(`📝 Wrote primary agent secret key to: ${keyFilePath}`);

  // 4. Mandates with Daily and Lifetime Caps
  console.log("📜 Seeding cryptographic mandates with spend caps...");
  await db
    .insert(mandates)
    .values([
      {
        id: mandate1Id,
        userId: user1Id,
        agentName: "AutoGPT Procurement Agent",
        publicKey: agent1Keypair.publicKey,
        signature: signData("AutoGPT Procurement Agent", agent1Keypair.secretKey),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
        maxAmountPerTransaction: 500000, // ₹5,000
        dailyLimitPaise: 1500000, // ₹15,000
        lifetimeLimitPaise: 5000000, // ₹50,000
        maxSilentRetries: 3,
        retryDelaySeconds: 30,
        allowedCategories: ["Office Supplies", "Cloud Servers"],
        status: "ACTIVE",
      },
      {
        id: mandate2Id,
        userId: user1Id,
        agentName: "CloudOps Auto-Scaler",
        publicKey: agent2Keypair.publicKey,
        signature: signData("CloudOps Auto-Scaler", agent2Keypair.secretKey),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180), // 6 months
        maxAmountPerTransaction: 1000000, // ₹10,000
        dailyLimitPaise: 3000000, // ₹30,000
        lifetimeLimitPaise: 10000000, // ₹100,000
        maxSilentRetries: 2,
        retryDelaySeconds: 30,
        allowedCategories: ["Cloud Servers"],
        status: "ACTIVE",
      },
    ])
    .onConflictDoUpdate({
      target: mandates.id,
      set: {
        publicKey: agent1Keypair.publicKey,
        maxAmountPerTransaction: 500000,
        dailyLimitPaise: 1500000,
        lifetimeLimitPaise: 5000000,
        status: "ACTIVE",
      },
    });

  // 5. Seed Historical Transactions with razorpayOrderId
  console.log("💳 Seeding historical transaction stream...");
  const statuses: ("SUCCESS" | "RECOVERED" | "FAILED")[] = [
    "SUCCESS",
    "SUCCESS",
    "RECOVERED",
    "FAILED",
  ];

  for (let i = 0; i < 12; i++) {
    const status = statuses[i % statuses.length];
    const amount = Math.floor(Math.random() * 300000) + 150000;
    const isRecovered = status === "RECOVERED";
    const isFailed = status === "FAILED";

    await db.insert(transactions).values({
      id: randomUUID(),
      mandateId: mandate1Id,
      merchantId: i % 2 === 0 ? merchant1Id : merchant2Id,
      amount,
      status,
      failureReason: isRecovered ? "BANK_TIMEOUT" : isFailed ? "INSUFFICIENT_FUNDS" : null,
      retryCount: isRecovered ? 1 : isFailed ? 3 : 0,
      razorpayOrderId: `order_seed_${randomUUID().slice(0, 12)}`,
      nextRetryOutcome: isRecovered ? "SUCCESS" : "FAIL",
      createdAt: new Date(Date.now() - (12 - i) * 3600 * 1000),
    });
  }

  // 6. Seed Purchase Attempts (Replay Shield history)
  console.log("🛡️ Seeding purchase attempt records...");
  for (let i = 0; i < 8; i++) {
    await db.insert(purchaseAttempts).values({
      id: randomUUID(),
      mandateId: mandate1Id,
      merchantCategory: i === 7 ? "Luxury Vehicles" : "Cloud Servers",
      amountPaise: i === 6 ? 99999999 : 250000,
      nonce: `seed_nonce_${randomUUID()}`,
      outcome: i < 6 ? "ALLOWED" : "BLOCKED",
      reason: i === 6 ? "LIMIT_EXCEEDED" : i === 7 ? "CATEGORY_BLOCKED" : "POLICY_PASSED",
      createdAt: new Date(Date.now() - (8 - i) * 1800 * 1000),
    });
  }

  // 7. Seed Clean SHA-256 Hash Chain Audit Logs
  console.log("⛓️ Seeding mathematically linked audit logs...");
  let currentHash = "0000000000000000000000000000000000000000000000000000000000000000";

  const auditEvents = [
    {
      action: "MANDATE_INITIALIZED",
      details: {
        summary: "Cryptographic policy initialized by Priya Sharma.",
        confidenceScore: 1.0,
      },
    },
    {
      action: "POLICY_PASSED",
      details: {
        summary: "AutoGPT agent authorized for ₹2,500 Cloud Servers purchase.",
        confidenceScore: 0.98,
      },
    },
    {
      action: "GATEWAY_ORDER_CREATED",
      details: { summary: "Razorpay order created with correlation ID.", confidenceScore: 0.99 },
    },
    {
      action: "PAYMENT_FAILED",
      details: {
        summary: "Bank timed out during authorization (HTTP 504).",
        requiresHumanIntervention: false,
      },
    },
    {
      action: "SILENT_RETRY_INITIATED",
      details: {
        summary: "Inngest scheduled silent retry after 30s cooldown.",
        confidenceScore: 0.95,
      },
    },
    {
      action: "SILENT_RETRY_SUCCESS",
      details: {
        summary: "Payment successfully recovered via secondary banking node.",
        confidenceScore: 0.99,
      },
    },
  ];

  for (let i = 0; i < auditEvents.length; i++) {
    const event = auditEvents[i];
    const previousHash = currentHash;
    currentHash = generateAuditHash(event.action, event.details, previousHash);

    await db.insert(auditLogs).values({
      id: randomUUID(),
      mandateId: mandate1Id,
      action: event.action,
      details: event.details,
      previousHash,
      currentHash,
      createdAt: new Date(Date.now() - (auditEvents.length - i) * 600 * 1000),
    });
  }

  // 8. Seed Initial Cryptographic Anchor
  console.log("⚓ Seeding out-of-band anchor verification checkpoint...");
  await db.insert(anchors).values({
    id: randomUUID(),
    mandateId: mandate1Id,
    anchorHash: generateAuditHash("ANCHOR_CHECKPOINT", { blocks: auditEvents.length }, currentHash),
    previousAnchorHash: "0000000000000000000000000000000000000000000000000000000000000000",
    lastBlockHash: currentHash,
    blockCount: auditEvents.length,
    anchoredAt: new Date(),
  });

  console.log("\n========================================================");
  console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
  console.log("========================================================");
  console.log("👤 Demo Login User:   priya@mandateos.dev");
  console.log("🔑 Demo Password:     MandateOS@2026");
  console.log("🤖 Agent Mandate ID:  00000000-0000-0000-0000-000000000003");
  console.log(`🔐 Agent Secret Key:  ${agent1Keypair.secretKey}`);
  console.log("========================================================\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

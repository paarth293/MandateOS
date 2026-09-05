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
  console.log("🌱 Initiating MandateOS v3 Enterprise Seed Sequence...\n");

  const user1Id = "00000000-0000-0000-0000-000000000001";
  const user2Id = "00000000-0000-0000-0000-000000000011";

  const merchant1Id = "00000000-0000-0000-0000-000000000002";
  const merchant2Id = "00000000-0000-0000-0000-000000000022";
  const merchant3Id = "00000000-0000-0000-0000-000000000033";
  const merchant4Id = "00000000-0000-0000-0000-000000000044";
  const merchant5Id = "00000000-0000-0000-0000-000000000055";
  const merchant6Id = "00000000-0000-0000-0000-000000000066";

  const mandate1Id = "00000000-0000-0000-0000-000000000003";
  const mandate2Id = "00000000-0000-0000-0000-000000000004";
  const mandate3Id = "00000000-0000-0000-0000-000000000005";

  // 1. Users with Scrypt Passwords & Roles
  console.log("👤 Seeding authenticated enterprise users...");
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

  // 2. Authorized Merchants
  console.log("🏢 Seeding authorized merchant catalog...");
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
      {
        id: merchant3Id,
        name: "DataStream Analytics Hub",
        businessCategory: "Data Services",
        upiId: "datastream@razorpay",
      },
      {
        id: merchant4Id,
        name: "NeuralSaaS Inference",
        businessCategory: "AI Inference",
        upiId: "neuralsaas@razorpay",
      },
      {
        id: merchant5Id,
        name: "ByteBridge Software",
        businessCategory: "Software",
        upiId: "bytebridge@razorpay",
      },
      {
        id: merchant6Id,
        name: "APIHub Developer Services",
        businessCategory: "APIs",
        upiId: "apihub@razorpay",
      },
    ])
    .onConflictDoNothing();

  // 3. Ed25519 Cryptographic Keypairs for Autonomous Agents
  console.log("🔑 Generating cryptographic Ed25519 keypairs for AI Agents...");
  const agent1Keypair = generateKeypair();
  const agent2Keypair = generateKeypair();
  const agent3Keypair = generateKeypair();

  const keyFilePath = path.resolve(process.cwd(), "agent.key");
  fs.writeFileSync(keyFilePath, agent1Keypair.secretKey, { encoding: "utf8" });
  console.log(`📝 Wrote primary agent secret key to: ${keyFilePath}`);

  // 4. Mandates with Spending Caps & Category Whitelists
  console.log("📜 Seeding cryptographic mandates with policy ceilings...");
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
      {
        id: mandate3Id,
        userId: user1Id,
        agentName: "DataPipeline Sync Agent",
        publicKey: agent3Keypair.publicKey,
        signature: signData("DataPipeline Sync Agent", agent3Keypair.secretKey),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), // 3 months
        maxAmountPerTransaction: 200000, // ₹2,000
        dailyLimitPaise: 800000, // ₹8,000
        lifetimeLimitPaise: 2500000, // ₹25,000
        maxSilentRetries: 3,
        retryDelaySeconds: 15,
        allowedCategories: ["Data Services", "Cloud Servers"],
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

  // 5. Historical Transactions Across 7-Day Timeline
  console.log("💳 Seeding varied 7-day transaction stream with chaos scenarios...");
  const transactionTemplates = [
    {
      mandateId: mandate1Id,
      merchantId: merchant1Id,
      status: "SUCCESS" as const,
      amount: 125000,
      failure: null,
      retries: 0,
      daysAgo: 6,
    },
    {
      mandateId: mandate1Id,
      merchantId: merchant2Id,
      status: "RECOVERED" as const,
      amount: 240000,
      failure: "BANK_TIMEOUT",
      retries: 1,
      daysAgo: 5,
    },
    {
      mandateId: mandate2Id,
      merchantId: merchant2Id,
      status: "SUCCESS" as const,
      amount: 450000,
      failure: null,
      retries: 0,
      daysAgo: 4,
    },
    {
      mandateId: mandate1Id,
      merchantId: merchant1Id,
      status: "FAILED" as const,
      amount: 490000,
      failure: "CARD_EXPIRED",
      retries: 3,
      daysAgo: 3,
    },
    {
      mandateId: mandate3Id,
      merchantId: merchant3Id,
      status: "SUCCESS" as const,
      amount: 85000,
      failure: null,
      retries: 0,
      daysAgo: 3,
    },
    {
      mandateId: mandate1Id,
      merchantId: merchant2Id,
      status: "SUCCESS" as const,
      amount: 195000,
      failure: null,
      retries: 0,
      daysAgo: 2,
    },
    {
      mandateId: mandate2Id,
      merchantId: merchant2Id,
      status: "RECOVERED" as const,
      amount: 320000,
      failure: "BANK_TIMEOUT",
      retries: 2,
      daysAgo: 2,
    },
    {
      mandateId: mandate3Id,
      merchantId: merchant3Id,
      status: "FAILED" as const,
      amount: 199000,
      failure: "INSUFFICIENT_FUNDS",
      retries: 3,
      daysAgo: 1,
    },
    {
      mandateId: mandate1Id,
      merchantId: merchant1Id,
      status: "SUCCESS" as const,
      amount: 80000,
      failure: null,
      retries: 0,
      daysAgo: 1,
    },
    {
      mandateId: mandate2Id,
      merchantId: merchant2Id,
      status: "SUCCESS" as const,
      amount: 500000,
      failure: null,
      retries: 0,
      daysAgo: 0,
    },
    {
      mandateId: mandate1Id,
      merchantId: merchant2Id,
      status: "ORDER_CREATED" as const,
      amount: 150000,
      failure: null,
      retries: 0,
      daysAgo: 0,
    },
    {
      mandateId: mandate3Id,
      merchantId: merchant3Id,
      status: "SUCCESS" as const,
      amount: 95000,
      failure: null,
      retries: 0,
      daysAgo: 0,
    },
  ];

  // Map each seeded merchant to its business category so seeded transactions
  // carry the denormalized merchantCategory used by the retry recovery path.
  const merchantCategoryById: Record<string, string> = {
    [merchant1Id]: "Office Supplies",
    [merchant2Id]: "Cloud Servers",
    [merchant3Id]: "Data Services",
  };

  for (const t of transactionTemplates) {
    const isRecovered = t.status === "RECOVERED";
    await db.insert(transactions).values({
      id: randomUUID(),
      mandateId: t.mandateId,
      merchantId: t.merchantId,
      merchantCategory: merchantCategoryById[t.merchantId],
      amount: t.amount,
      status: t.status,
      failureReason: t.failure,
      retryCount: t.retries,
      razorpayOrderId: `order_seed_${randomUUID().slice(0, 12)}`,
      nextRetryOutcome: isRecovered ? "SUCCESS" : "FAIL",
      createdAt: new Date(Date.now() - t.daysAgo * 86400 * 1000 - Math.random() * 3600 * 1000),
    });
  }

  // 6. Purchase Attempts (Telemetry Stream & Replay Shield history)
  console.log("🛡️ Seeding purchase attempt firewall history...");
  const attemptScenarios = [
    { cat: "Cloud Servers", amt: 250000, outcome: "ALLOWED", reason: "POLICY_PASSED" },
    { cat: "Office Supplies", amt: 120000, outcome: "ALLOWED", reason: "POLICY_PASSED" },
    { cat: "Luxury Watches", amt: 5000000, outcome: "BLOCKED", reason: "CATEGORY_BLOCKED" },
    { cat: "Cloud Servers", amt: 99999999, outcome: "BLOCKED", reason: "LIMIT_EXCEEDED" },
    {
      cat: "Cloud Servers",
      amt: 250000,
      outcome: "BLOCKED",
      reason: "REPLAY_DETECTED: Nonce already utilized",
    },
    { cat: "Data Services", amt: 85000, outcome: "ALLOWED", reason: "POLICY_PASSED" },
  ];

  for (let i = 0; i < attemptScenarios.length; i++) {
    const sc = attemptScenarios[i];
    await db.insert(purchaseAttempts).values({
      id: randomUUID(),
      mandateId: mandate1Id,
      merchantCategory: sc.cat,
      amountPaise: sc.amt,
      nonce: `seed_nonce_${randomUUID()}`,
      outcome: sc.outcome,
      reason: sc.reason,
      createdAt: new Date(Date.now() - (attemptScenarios.length - i) * 1800 * 1000),
    });
  }

  // 7. Clean SHA-256 Hash Chain Audit Trail
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

  let genesisBlockHash = "";
  for (let i = 0; i < auditEvents.length; i++) {
    const event = auditEvents[i];
    const previousHash = currentHash;
    currentHash = generateAuditHash(event.action, event.details, previousHash);
    if (i === 2) genesisBlockHash = currentHash;

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

  // 8. Chained Cryptographic Anchors (Genesis + Head Checkpoint)
  console.log("⚓ Seeding chained Merkle state anchors...");
  const genesisAnchorHash = generateAuditHash(
    "ANCHOR_GENESIS",
    { blocks: 3 },
    genesisBlockHash || currentHash,
  );

  await db.insert(anchors).values([
    {
      id: randomUUID(),
      mandateId: mandate1Id,
      anchorHash: genesisAnchorHash,
      previousAnchorHash: "0000000000000000000000000000000000000000000000000000000000000000",
      lastBlockHash: genesisBlockHash || currentHash,
      blockCount: 3,
      anchoredAt: new Date(Date.now() - 3600 * 1000),
    },
    {
      id: randomUUID(),
      mandateId: mandate1Id,
      anchorHash: generateAuditHash("ANCHOR_HEAD", { blocks: auditEvents.length }, currentHash),
      previousAnchorHash: genesisAnchorHash,
      lastBlockHash: currentHash,
      blockCount: auditEvents.length,
      anchoredAt: new Date(),
    },
  ]);

  console.log("\n========================================================");
  console.log("🎉 MANDATEOS V3 SEED COMPLETED SUCCESSFULLY!");
  console.log("========================================================");
  console.log("👤 Demo Login User:    priya@mandateos.dev");
  console.log("🔑 Demo Password:      MandateOS@2026");
  console.log("🤖 Primary Mandate ID: 00000000-0000-0000-0000-000000000003");
  console.log(`🔐 Agent Secret Key:   ${agent1Keypair.secretKey}`);
  console.log("========================================================\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed sequence error:", err);
  process.exit(1);
});

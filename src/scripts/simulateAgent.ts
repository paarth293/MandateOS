import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalStringify, signData } from "@/lib/crypto";

const API_URL = process.env.AGENT_API_URL || "http://localhost:3000/api/agent/purchase";
const MANDATE_ID = process.env.MANDATE_ID || "00000000-0000-0000-0000-000000000003";

// Read agent's private Ed25519 signing key
function getAgentSecretKey(): string {
  const keyPath = path.resolve(process.cwd(), "agent.key");
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, "utf8").trim();
  }
  // Fallback demo secret key matching seeded mandate
  return "98fbea28cd0e3585684023ec1decae60ec0ef4d7060eb5cf8dac3b47103088a399be9a9d65d34abfe9af0bdb87ee3395c39a690e750969b48420ce2dee272254";
}

const secretKey = getAgentSecretKey();

interface PurchaseOptions {
  category: string;
  amountPaise: number;
  overrideNonce?: string;
  overrideTimestamp?: number;
  overrideSignature?: string;
}

async function executeSignedPurchase(label: string, opts: PurchaseOptions) {
  console.log(`\n------------------------------------------------------------`);
  console.log(`🤖 Scenario: ${label}`);
  console.log(`   Item Category: ${opts.category}`);
  console.log(`   Amount: ₹${(opts.amountPaise / 100).toLocaleString("en-IN")}`);

  const nonce = opts.overrideNonce || `sim_nonce_${randomUUID()}`;
  const timestamp = opts.overrideTimestamp || Date.now();

  const canonicalPayload = canonicalStringify({
    amountPaise: opts.amountPaise,
    category: opts.category,
    mandateId: MANDATE_ID,
    nonce,
    timestamp,
  });

  const signature = opts.overrideSignature || signData(canonicalPayload, secretKey);

  console.log(`   Nonce:     ${nonce.slice(0, 24)}...`);
  console.log(`   Signature: ${signature.slice(0, 32)}...`);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mandate-signature": signature,
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
      },
      body: JSON.stringify({
        mandateId: MANDATE_ID,
        amountPaise: opts.amountPaise,
        category: opts.category,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      console.log(
        `✅ [HTTP ${res.status}] MANDATEOS AUTHORIZED: Payment successfully signed and created!`,
      );
      console.log(`   Transaction ID:  ${data.transactionId}`);
      console.log(`   Razorpay Order:  ${data.razorpayOrderId}`);
    } else {
      console.log(`❌ [HTTP ${res.status}] MANDATEOS BLOCKED: ${data.error || "Request rejected"}`);
      if (data.reason) console.log(`   Reason: ${data.reason}`);
    }

    return { nonce, timestamp, signature, status: res.status };
  } catch (_error) {
    console.error(
      "⚠️ Connection Error: Ensure Next.js dev server is running on http://localhost:3000",
    );
    return null;
  }
}

async function runSimulation() {
  console.log("============================================================");
  console.log("🛡️  MANDATEOS v2 — AUTONOMOUS AGENT INTEGRATION TEST SUITE");
  console.log("============================================================");

  // Scenario 1: Legitimate Authorized Purchase
  const firstTx = await executeSignedPurchase("1. Legitimate In-Policy Purchase", {
    category: "Cloud Servers",
    amountPaise: 250000, // ₹2,500
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Scenario 2: Per-Transaction & Daily Cap Violation
  await executeSignedPurchase("2. Spending Limit Exceeded (Malicious / Hallucinating Agent)", {
    category: "Cloud Servers",
    amountPaise: 99999999, // ₹999,999.99
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Scenario 3: Unauthorized Merchant Category
  await executeSignedPurchase("3. Unauthorized Category Violation", {
    category: "Luxury Sports Cars",
    amountPaise: 100000, // ₹1,000
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Scenario 4: Replay Attack Defense
  if (firstTx) {
    console.log(`\n🚨 SIMULATING MAN-IN-THE-MIDDLE REPLAY ATTACK...`);
    console.log(`   Re-submitting intercepted request with identical nonce and Ed25519 signature.`);
    await executeSignedPurchase("4. Replay Attack Interception", {
      category: "Cloud Servers",
      amountPaise: 250000,
      overrideNonce: firstTx.nonce,
      overrideTimestamp: firstTx.timestamp,
      overrideSignature: firstTx.signature,
    });
  }

  console.log("\n============================================================");
  console.log("🏁 AI AGENT SIMULATION COMPLETED.");
  console.log("============================================================\n");
}

runSimulation().catch((err) => {
  console.error("Simulation run error:", err);
  process.exit(1);
});

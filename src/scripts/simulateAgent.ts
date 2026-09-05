import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalStringify, signData } from "@/lib/crypto";
import { MandateOSClient } from "@/lib/sdk";

const API_URL = process.env.AGENT_API_URL || "http://localhost:3000/api/agent/purchase";
const BASE_URL = new URL(API_URL).origin;
const MANDATE_ID = process.env.MANDATE_ID || "00000000-0000-0000-0000-000000000003";
const AGENT_KEY_PATH = process.env.AGENT_KEY_PATH || path.resolve(process.cwd(), "agent.key");

// Read agent's private Ed25519 signing key. There is deliberately NO hardcoded
// fallback here: the key must come from the real agent.key written by
// `npm run seed` (or AGENT_SECRET_KEY). A well-known fallback key in source
// would let anyone forge signed purchases against a seeded mandate.
function getAgentSecretKey(): string | null {
  if (fs.existsSync(AGENT_KEY_PATH)) {
    const key = fs.readFileSync(AGENT_KEY_PATH, "utf8").trim();
    if (key) return key;
  }
  const envKey = process.env.AGENT_SECRET_KEY;
  return envKey && envKey.trim().length > 0 ? envKey.trim() : null;
}

/**
 * Loads the signing key or aborts with a clear message. The narrow return type
 * (string) keeps callers free of null checks.
 */
function loadAgentSecretKey(): string {
  const key = getAgentSecretKey();
  if (!key) {
    console.error(
      "\n❌ No agent signing key found. Run `npm run seed` first (it writes agent.key), " +
        "or set AGENT_KEY_PATH / AGENT_SECRET_KEY to the mandate's private key.\n",
    );
    process.exit(1);
  }
  return key;
}

const secretKey = loadAgentSecretKey();

// ---------------------------------------------------------------------------
// THE OFFICIAL INTEGRATION PATH (Scenario 1):
// LangChain / AutoGPT / custom agents secure their spend in three lines via
// the MandateOSClient SDK — signing, nonces and timestamps handled internally.
// ---------------------------------------------------------------------------
const client = new MandateOSClient({ baseUrl: BASE_URL, mandateId: MANDATE_ID, secretKey });

/** Captures the raw wire packet of the next purchase so it can be replayed verbatim. */
let capturedPacket: { headers: Record<string, string>; body: string } | null = null;

function installWireTap() {
  const realFetch = globalThis.fetch;
  const tappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/api/agent/purchase") && init?.headers && init.body) {
      const headers: Record<string, string> = {};
      new Headers(init.headers).forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      capturedPacket = { headers, body: String(init.body) };
    }
    return realFetch(input as Parameters<typeof realFetch>[0], init);
  };
  globalThis.fetch = tappedFetch as typeof fetch;
}

interface PurchaseOptions {
  label: string;
  category: string;
  amountPaise: number;
  overrideNonce?: string;
  overrideTimestamp?: number;
  overrideSignature?: string;
}

async function executeSignedPurchase(opts: PurchaseOptions) {
  console.log(`\n------------------------------------------------------------`);
  console.log(`🤖 Scenario: ${opts.label}`);
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
  console.log("🛡️  MANDATEOS — AUTONOMOUS AGENT INTEGRATION TEST SUITE");
  console.log("============================================================");

  // -------------------------------------------------------------------------
  // Scenario 1 (THE SDK PATH) — how a real agent integrates: 3 lines of code.
  // The wire tap records the exact signed packet for the replay attack later.
  // -------------------------------------------------------------------------
  console.log("\n🧩 SCENARIO 1 — SDK INTEGRATION (the only code an agent framework needs):");
  console.log('   import { MandateOSClient } from "mandateos";');
  console.log("   const client = new MandateOSClient({ mandateId, secretKey });");
  console.log('   await client.purchase({ amountPaise: 250000, category: "Cloud Servers" });');

  installWireTap();

  const sdkResult = await client.purchase({
    amountPaise: 250000, // ₹2,500
    category: "Cloud Servers",
  });

  console.log(
    `   -> SDK verdict: ${sdkResult.ok ? "✅ AUTHORIZED" : "❌ BLOCKED"} (HTTP ${sdkResult.status})`,
  );
  if (!sdkResult.ok) {
    console.log(
      "   ❌ SDK purchase unexpectedly blocked — is the dev server running with a seeded mandate?",
    );
    process.exit(1);
  }

  await new Promise((r) => setTimeout(r, 1500));

  // Scenario 2: Per-Transaction & Daily Cap Violation
  await executeSignedPurchase({
    label: "2. Spending Limit Exceeded (Malicious / Hallucinating Agent)",
    category: "Cloud Servers",
    amountPaise: 99999999, // ₹999,999.99
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Scenario 3: Unauthorized Merchant Category
  await executeSignedPurchase({
    label: "3. Unauthorized Category Violation",
    category: "Luxury Sports Cars",
    amountPaise: 100000, // ₹1,000
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Scenario 4: Stale Timestamp Attack (> 300s drift)
  await executeSignedPurchase({
    label: "4. Stale Timestamp Drift (> 300s Window)",
    category: "Cloud Servers",
    amountPaise: 150000,
    overrideTimestamp: Date.now() - 400 * 1000, // 400 seconds ago
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Scenario 5: Tampered Signature Forgery Attack
  await executeSignedPurchase({
    label: "5. Tampered Signature / Forgery Defense",
    category: "Cloud Servers",
    amountPaise: 150000,
    overrideSignature:
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Scenario 6: Replay Attack Defense — a TRUE man-in-the-middle replay:
  // the byte-perfect wire packet captured from the SDK's own signed request
  // (same nonce, same timestamp, same signature) is re-submitted verbatim.
  if (capturedPacket) {
    console.log("\n🚨 SCENARIO 6 — SIMULATING MAN-IN-THE-MIDDLE REPLAY ATTACK...");
    console.log("   Re-submitting the EXACT packet captured from the SDK's authorized purchase.");
    console.log(`   Nonce:     ${capturedPacket.headers["x-nonce"].slice(0, 24)}...`);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: capturedPacket.headers,
        body: capturedPacket.body,
      });
      const data = await res.json();
      if (res.status === 409) {
        console.log(`❌ [HTTP 409] REPLAY INTERCEPTED: ${data.error}`);
      } else if (res.ok) {
        console.log(`🚨 [HTTP ${res.status}] Replay was AUTHORIZED — this should never happen!`);
      } else {
        console.log(`❌ [HTTP ${res.status}] ${data.error || "Request rejected"}`);
      }
    } catch (_error) {
      console.error("⚠️ Connection Error during replay attempt.");
    }
  } else {
    console.log("\n⚠️ Skipping replay scenario: wire tap captured no packet.");
  }

  console.log("\n============================================================");
  console.log("🏁 AI AGENT SIMULATION COMPLETED.");
  console.log("   Scenario 1 used the official 3-line SDK integration path;");
  console.log("   scenarios 2-6 simulated real adversaries with raw crypto.");
  console.log("============================================================\n");
}

runSimulation().catch((err) => {
  console.error("Simulation run error:", err);
  process.exit(1);
});

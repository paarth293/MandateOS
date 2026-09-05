import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { canonicalStringify, signData, verifySignature } from "@/lib/crypto";
import { db } from "@/server/db";
import { evaluateMandatePolicy } from "@/server/policy";
import { mandates, purchaseAttempts } from "@/server/schema";
import { getCommittedSpendTotals } from "@/server/spend";

export const dynamic = "force-dynamic";

type AttackKind =
  | "FORGED_SIGNATURE"
  | "REPLAY_NOMINAL"
  | "REPLAY_FRAUD_OWNER"
  | "CAP_BREACH"
  | "CATEGORY_BREACH"
  | "STALE_TIMESTAMP";

interface AttackRequest {
  mandateId: string;
  kind: AttackKind;
  amountPaise?: number;
  category?: string;
}

/** Reads the agent's Ed25519 secret key that `npm run seed` wrote. Sole source
 *  of truth — no hardcoded fallback (a well-known fallback key in source would
 *  let anyone forge signed packets against a seeded mandate). */
async function readAgentSecretKey(): Promise<string | null> {
  const keyPath = process.env.AGENT_KEY_PATH || path.resolve(process.cwd(), "agent.key");
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ keyPath)) {
      const key = fs.readFileSync(/*turbopackIgnore: true*/ keyPath, "utf8").trim();
      if (key) return key;
    }
  } catch {
    // File missing / unreadable → no valid signing key available.
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as AttackRequest | null;
    if (!body?.mandateId || !body?.kind) {
      return NextResponse.json({ error: "mandateId and kind are required" }, { status: 400 });
    }

    const mandate = await db.query.mandates.findFirst({
      where: eq(mandates.id, body.mandateId),
    });
    if (mandate?.status !== "ACTIVE") {
      return NextResponse.json({ error: "Mandate not active" }, { status: 404 });
    }

    const amountPaise = body.amountPaise ?? mandate.maxAmountPerTransaction;
    const category = body.category ?? mandate.allowedCategories[0] ?? "Cloud Servers";
    const timestamp = Date.now();

    // ---- Compute the firewall verdict deterministically FIRST (pure policy),
    //      so every attack scenario reports the SAME outcome the real purchase
    //      route would produce for these parameters.
    const totals = await getCommittedSpendTotals(mandate.id);
    const policyCheck = evaluateMandatePolicy(amountPaise, category, mandate, 0, totals);

    // ---- Build the signature for each attack scenario ----
    let signature: string;
    let signatureDescription: string;

    switch (body.kind) {
      case "FORGED_SIGNATURE": {
        // Attacker without the owner's key submits a garbage 64-byte hex string.
        signature =
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        signatureDescription = "forged (garbage hex)";
        break;
      }
      case "STALE_TIMESTAMP": {
        // Legitimately signed packet, but the timestamp is >300s in the past.
        const agentKey = await readAgentSecretKey();
        if (agentKey) {
          signature = signData(
            canonicalStringify({
              amountPaise,
              category,
              mandateId: mandate.id,
              nonce: `attack_${randomUUID()}`,
              timestamp,
            }),
            agentKey,
          );
          signatureDescription = `validly signed by agent.key (${agentKey.slice(0, 16)}…)`;
        } else {
          signature =
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
          signatureDescription = "unsigned (agent.key not found)";
        }
        break;
      }
      case "REPLAY_FRAUD_OWNER": {
        // A malicious owner replays an already-approved packet: valid signature,
        // valid params, but the nonce has already been used.
        const agentKey = await readAgentSecretKey();
        if (!agentKey) {
          return NextResponse.json(
            { error: "REPLAY_FRAUD_OWNER requires agent.key (run `npm run seed`)" },
            { status: 503 },
          );
        }
        // We'll reuse a nonce that already exists in the DB. First find the newest
        // ALLOWED attempt for this mandate and steal its nonce.
        const lastAttempt = await db.query.purchaseAttempts.findFirst({
          where: and(
            eq(purchaseAttempts.mandateId, mandate.id),
            eq(purchaseAttempts.outcome, "ALLOWED"),
          ),
          orderBy: (a, { desc }) => [desc(a.createdAt)],
        });
        const reusedNonce = lastAttempt?.nonce ?? `replay_steal_${randomUUID()}`;
        signature = signData(
          canonicalStringify({
            amountPaise,
            category,
            mandateId: mandate.id,
            nonce: reusedNonce,
            timestamp,
          }),
          agentKey,
        );
        signatureDescription = `validly signed by agent.key, reusing nonce ${reusedNonce.slice(0, 24)}…`;
        break;
      }
      default: {
        // CAP_BREACH, CATEGORY_BREACH, REPLAY_NOMINAL: signed by the owner if
        // the key is available; otherwise unsigned (still blocked by policy).
        const agentKey = await readAgentSecretKey();
        if (agentKey) {
          const nonce =
            body.kind === "REPLAY_NOMINAL"
              ? `replay_nominal_${randomUUID()}`
              : `attack_${randomUUID()}`;
          signature = signData(
            canonicalStringify({ amountPaise, category, mandateId: mandate.id, nonce, timestamp }),
            agentKey,
          );
          signatureDescription = `validly signed by agent.key (${agentKey.slice(0, 16)}…)`;
        } else {
          signature =
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
          signatureDescription = "unsigned (agent.key not found)";
        }
        break;
      }
    }

    // ---- STALE_TIMESTAMP: backdate the timestamp ----
    const effectiveTimestamp = body.kind === "STALE_TIMESTAMP" ? timestamp - 400 * 1000 : timestamp;
    const isStale =
      body.kind === "STALE_TIMESTAMP" && Math.abs(Date.now() - effectiveTimestamp) > 300_000;

    // ---- For attacks needing a fresh nonce, recompute the canonical payload ----
    //      with the effective timestamp so the signature matches what the real
    //      route would recompute. (For REPLAY_FRAUD_OWNER the nonce is reused.)
    let canonicalForSignature: string;
    let nonceUsed: string;
    if (body.kind === "REPLAY_FRAUD_OWNER") {
      const lastAttempt = await db.query.purchaseAttempts.findFirst({
        where: and(
          eq(purchaseAttempts.mandateId, mandate.id),
          eq(purchaseAttempts.outcome, "ALLOWED"),
        ),
        orderBy: (a, { desc }) => [desc(a.createdAt)],
      });
      nonceUsed = lastAttempt?.nonce ?? `replay_steal_${randomUUID()}`;
      canonicalForSignature = canonicalStringify({
        amountPaise,
        category,
        mandateId: mandate.id,
        nonce: nonceUsed,
        timestamp: effectiveTimestamp,
      });
      // Signature was computed above for this nonce+timestamp already; if it
      // doesn't match, recompute. (We computed it with the same values, so it
      // should match — but be defensive.)
      if (!verifySignature(canonicalForSignature, signature, mandate.publicKey)) {
        signature = signData(canonicalForSignature, (await readAgentSecretKey()) ?? "");
        signatureDescription = `recomputed valid signature for reused nonce ${nonceUsed.slice(0, 24)}…`;
      }
    } else {
      nonceUsed = `attack_${randomUUID()}`;
      canonicalForSignature = canonicalStringify({
        amountPaise,
        category,
        mandateId: mandate.id,
        nonce: nonceUsed,
        timestamp: effectiveTimestamp,
      });
    }

    // ---- Replay detection: does this nonce already exist in the DB? ----
    let replayDetected = false;
    if (body.kind === "REPLAY_FRAUD_OWNER" || body.kind === "REPLAY_NOMINAL") {
      const existing = await db.query.purchaseAttempts.findFirst({
        where: and(
          eq(purchaseAttempts.mandateId, mandate.id),
          eq(purchaseAttempts.nonce, nonceUsed),
        ),
      });
      replayDetected = !!existing;
    }

    // ---- Assemble the verdict ----
    let verdict: "ALLOWED" | "BLOCKED" | "REPLAY_DETECTED";
    let reason: string;
    let httpStatus: number;

    if (replayDetected) {
      verdict = "REPLAY_DETECTED";
      reason = "REPLAY_DETECTED: This unique nonce has already been utilized in a prior request.";
      httpStatus = 409;
    } else if (body.kind === "FORGED_SIGNATURE") {
      const sigValid = verifySignature(canonicalForSignature, signature, mandate.publicKey);
      if (!sigValid) {
        verdict = "BLOCKED";
        reason = "INVALID_SIGNATURE: Asymmetric cryptographic signature mismatch";
        httpStatus = 401;
      } else {
        verdict = "ALLOWED";
        reason = "POLICY_PASSED";
        httpStatus = 200;
      }
    } else if (isStale) {
      verdict = "BLOCKED";
      reason =
        "STALE_REQUEST: Request timestamp is outside the allowed 300-second verification window";
      httpStatus = 401;
    } else if (!policyCheck.allowed) {
      verdict = "BLOCKED";
      reason = policyCheck.reason;
      httpStatus = 403;
    } else {
      verdict = "ALLOWED";
      reason = "POLICY_PASSED";
      httpStatus = 200;
    }

    // ---- Persist the attempt row so the SSE feed + analytics see it live ----
    try {
      await db.insert(purchaseAttempts).values({
        id: randomUUID(),
        mandateId: mandate.id,
        merchantCategory: category,
        amountPaise,
        nonce: nonceUsed,
        outcome: verdict === "ALLOWED" ? "ALLOWED" : "BLOCKED",
        reason,
        createdAt: new Date(),
      });
    } catch {
      // Best effort — if a unique constraint fires (rare race on nonce), just
      // skip the row; the verdict is already correct.
    }

    return NextResponse.json(
      {
        mandateId: mandate.id,
        agentName: mandate.agentName,
        attackKind: body.kind,
        category,
        amountPaise,
        timestamp: effectiveTimestamp,
        nonce: `${nonceUsed.slice(0, 24)}…`,
        signature: `${signature.slice(0, 40)}…`,
        signatureDescription,
        verdict,
        reason,
        policyPass: policyCheck.allowed,
        httpStatus,
        details: {
          perTxCapPaise: mandate.maxAmountPerTransaction,
          dailyCapPaise: mandate.dailyLimitPaise,
          lifetimeCapPaise: mandate.lifetimeLimitPaise,
          spentTodayPaise: totals.spentTodayPaise,
          spentLifetimePaise: totals.spentLifetimePaise,
          allowedCategories: mandate.allowedCategories,
          malformedFields: isStale
            ? {
                timestampDriftSeconds: Math.round(Math.abs(Date.now() - effectiveTimestamp) / 1000),
              }
            : undefined,
        },
      },
      { status: httpStatus >= 400 ? httpStatus : 200 },
    );
  } catch (error) {
    console.error("Attack console error:", error);
    return NextResponse.json({ error: "Attack execution failed" }, { status: 500 });
  }
}

import { describe, expect, it } from "vitest";
import { generateAuditHash } from "@/lib/crypto";
import { evaluateMandatePolicy } from "./policy";

describe("MandateOS End-to-End System Integration", () => {
  it("should block AI Agent transactions that violate the mathematical mandate", () => {
    const mockMandate = {
      id: "test-mandate",
      userId: "user-1",
      agentName: "AutoGPT Agent",
      maxAmountPerTransaction: 500000,
      maxSilentRetries: 3,
      allowedCategories: ["Cloud Servers", "Software"],
      status: "ACTIVE",
      createdAt: new Date(),
    };

    const valid = evaluateMandatePolicy(250000, "Cloud Servers", mockMandate as any, 0);
    expect(valid.allowed).toBe(true);

    const tooHigh = evaluateMandatePolicy(99999999, "Cloud Servers", mockMandate as any, 0);
    expect(tooHigh.allowed).toBe(false);
    expect(tooHigh.reason).toContain("Exceeds mandate limit");

    const wrongCategory = evaluateMandatePolicy(100000, "Ferrari", mockMandate as any, 0);
    expect(wrongCategory.allowed).toBe(false);
    expect(wrongCategory.reason).toContain("not authorized");
  });

  it("should perfectly link cryptographic hash chains to prevent AI log tampering", () => {
    const genesisHash = "0000000000000000000000000000000000000000000000000000000000000000";

    const block1Hash = generateAuditHash(
      "PAYMENT_FAILED",
      '{"summary": "Bank timeout occurred."}',
      genesisHash,
    );
    expect(block1Hash).toHaveLength(64);

    const block2Hash = generateAuditHash(
      "SILENT_RETRY",
      '{"summary": "Successfully recovered payment via secondary node."}',
      block1Hash,
    );

    const forgedBlock1Hash = generateAuditHash(
      "PAYMENT_FAILED",
      '{"summary": "Attacker manipulated this log."}',
      genesisHash,
    );

    expect(forgedBlock1Hash).not.toBe(block1Hash);

    const verificationFails =
      block2Hash !==
      generateAuditHash(
        "SILENT_RETRY",
        '{"summary": "Successfully recovered payment via secondary node."}',
        forgedBlock1Hash,
      );

    expect(verificationFails).toBe(true);
  });
});

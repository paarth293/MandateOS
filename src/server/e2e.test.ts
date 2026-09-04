// src/server/e2e.test.ts
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
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    };

    const valid = evaluateMandatePolicy(250000, "Cloud Servers", mockMandate as any, 0);
    expect(valid.allowed).toBe(true);

    const tooHigh = evaluateMandatePolicy(99999999, "Cloud Servers", mockMandate as any, 0);
    expect(tooHigh.allowed).toBe(false);
    expect(tooHigh.reason).toContain("LIMIT_EXCEEDED");

    const wrongCategory = evaluateMandatePolicy(100000, "Ferrari", mockMandate as any, 0);
    expect(wrongCategory.allowed).toBe(false);
    expect(wrongCategory.reason).toContain("CATEGORY_BLOCKED");
  });

  it("should perfectly link cryptographic hash chains to prevent AI log tampering", () => {
    const genesisHash = "0000000000000000000000000000000000000000000000000000000000000000";

    const block1Hash = generateAuditHash(
      "PAYMENT_FAILED",
      { summary: "Bank timeout occurred." },
      genesisHash,
    );
    expect(block1Hash).toHaveLength(64);

    const block2Hash = generateAuditHash(
      "SILENT_RETRY",
      { summary: "Successfully recovered payment via secondary node." },
      block1Hash,
    );

    const forgedBlock1Hash = generateAuditHash(
      "PAYMENT_FAILED",
      { summary: "Attacker manipulated this log." },
      genesisHash,
    );

    expect(forgedBlock1Hash).not.toBe(block1Hash);

    const verificationFails =
      block2Hash !==
      generateAuditHash(
        "SILENT_RETRY",
        { summary: "Successfully recovered payment via secondary node." },
        forgedBlock1Hash,
      );

    expect(verificationFails).toBe(true);
  });

  it("should canonically stringify objects regardless of key insertion order", async () => {
    const { canonicalStringify } = await import("@/lib/crypto");

    const objA = { z: 1, a: 2, m: { y: "hello", x: "world" } };
    const objB = { a: 2, m: { x: "world", y: "hello" }, z: 1 };

    expect(canonicalStringify(objA)).toBe(canonicalStringify(objB));
    expect(canonicalStringify(objA)).toBe('{"a":2,"m":{"x":"world","y":"hello"},"z":1}');
  });
});

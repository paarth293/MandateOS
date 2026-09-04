import { describe, expect, it } from "vitest";
import { generateAuditHash } from "@/lib/crypto";
import { CircuitBreaker } from "@/lib/razorpay";
import { evaluateMandatePolicy } from "./policy";

type MockMandate = Parameters<typeof evaluateMandatePolicy>[2];

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

    const valid = evaluateMandatePolicy(
      250000,
      "Cloud Servers",
      mockMandate as unknown as MockMandate,
      0,
    );
    expect(valid.allowed).toBe(true);

    const tooHigh = evaluateMandatePolicy(
      99999999,
      "Cloud Servers",
      mockMandate as unknown as MockMandate,
      0,
    );
    expect(tooHigh.allowed).toBe(false);
    expect(tooHigh.reason).toContain("LIMIT_EXCEEDED");

    const wrongCategory = evaluateMandatePolicy(
      100000,
      "Ferrari",
      mockMandate as unknown as MockMandate,
      0,
    );
    expect(wrongCategory.allowed).toBe(false);
    expect(wrongCategory.reason).toContain("CATEGORY_BLOCKED");
  });

  it("should test exact boundaries for per-transaction spending limit", () => {
    const boundaryMandate = {
      id: "boundary-mandate",
      userId: "user-1",
      agentName: "Boundary Agent",
      maxAmountPerTransaction: 500000, // ₹5,000
      maxSilentRetries: 3,
      allowedCategories: ["Cloud Servers"],
      status: "ACTIVE",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    };

    // Exactly at cap (500,000 paise == 500,000 max)
    const exactlyAtCap = evaluateMandatePolicy(
      500000,
      "Cloud Servers",
      boundaryMandate as unknown as MockMandate,
      0,
    );
    expect(exactlyAtCap.allowed).toBe(true);

    // Over cap by 1 paise (500,001 paise > 500,000 max)
    const overCapByOne = evaluateMandatePolicy(
      500001,
      "Cloud Servers",
      boundaryMandate as unknown as MockMandate,
      0,
    );
    expect(overCapByOne.allowed).toBe(false);
    expect(overCapByOne.reason).toContain("LIMIT_EXCEEDED");
  });

  it("should block transactions when mandate has expired or is inactive", () => {
    const expiredMandate = {
      id: "expired-mandate",
      userId: "user-1",
      agentName: "Expired Agent",
      maxAmountPerTransaction: 500000,
      maxSilentRetries: 3,
      allowedCategories: ["Cloud Servers"],
      status: "ACTIVE",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
    };

    const expiredResult = evaluateMandatePolicy(
      100000,
      "Cloud Servers",
      expiredMandate as unknown as MockMandate,
      0,
    );
    expect(expiredResult.allowed).toBe(false);
    expect(expiredResult.reason).toBe("MANDATE_EXPIRED");

    const revokedMandate = {
      ...expiredMandate,
      expiresAt: new Date(Date.now() + 100000),
      status: "REVOKED",
    };

    const revokedResult = evaluateMandatePolicy(
      100000,
      "Cloud Servers",
      revokedMandate as unknown as MockMandate,
      0,
    );
    expect(revokedResult.allowed).toBe(false);
    expect(revokedResult.reason).toBe("MANDATE_STATUS_REVOKED");
  });

  it("should enforce max silent retry thresholds", () => {
    const retryMandate = {
      id: "retry-mandate",
      userId: "user-1",
      agentName: "Retry Agent",
      maxAmountPerTransaction: 500000,
      maxSilentRetries: 3,
      allowedCategories: ["Cloud Servers"],
      status: "ACTIVE",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    };

    // Under retry limit (2 retries < 3 max)
    const withinRetries = evaluateMandatePolicy(
      100000,
      "Cloud Servers",
      retryMandate as unknown as MockMandate,
      2,
    );
    expect(withinRetries.allowed).toBe(true);

    // At or above retry limit (3 retries >= 3 max)
    const exceededRetries = evaluateMandatePolicy(
      100000,
      "Cloud Servers",
      retryMandate as unknown as MockMandate,
      3,
    );
    expect(exceededRetries.allowed).toBe(false);
    expect(exceededRetries.reason).toContain("MAX_RETRIES_EXCEEDED");
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

  it("should enforce daily and lifetime spend caps", () => {
    const cappedMandate = {
      id: "capped-mandate",
      userId: "user-1",
      agentName: "AutoGPT Capped Agent",
      maxAmountPerTransaction: 500000, // ₹5,000 max per swipe
      dailyLimitPaise: 1000000, // ₹10,000 max per day
      lifetimeLimitPaise: 2500000, // ₹25,000 max lifetime
      maxSilentRetries: 3,
      allowedCategories: ["Cloud Servers"],
      status: "ACTIVE",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    };

    // 1. Within daily limit
    const pass = evaluateMandatePolicy(
      300000,
      "Cloud Servers",
      cappedMandate as unknown as MockMandate,
      0,
      {
        spentTodayPaise: 500000,
        spentLifetimePaise: 1000000,
      },
    );
    expect(pass.allowed).toBe(true);

    // 2. Exceeds daily limit (7,000 + 4,000 = 11,000 > 10,000)
    const failDaily = evaluateMandatePolicy(
      400000,
      "Cloud Servers",
      cappedMandate as unknown as MockMandate,
      0,
      {
        spentTodayPaise: 700000,
        spentLifetimePaise: 1000000,
      },
    );
    expect(failDaily.allowed).toBe(false);
    expect(failDaily.reason).toContain("DAILY_LIMIT_EXCEEDED");

    // 3. Exceeds lifetime limit (22,000 + 4,000 = 26,000 > 25,000)
    const failLifetime = evaluateMandatePolicy(
      400000,
      "Cloud Servers",
      cappedMandate as unknown as MockMandate,
      0,
      {
        spentTodayPaise: 0,
        spentLifetimePaise: 2200000,
      },
    );
    expect(failLifetime.allowed).toBe(false);
    expect(failLifetime.reason).toContain("LIFETIME_LIMIT_EXCEEDED");
  });

  it("should verify Circuit Breaker state transitions and tripping threshold", () => {
    CircuitBreaker.reset();
    expect(CircuitBreaker.getStatus().state).toBe("CLOSED");
    expect(CircuitBreaker.canAttempt()).toBe(true);

    // 4 failures -> remains CLOSED
    for (let i = 0; i < 4; i++) {
      CircuitBreaker.recordFailure();
    }
    expect(CircuitBreaker.getStatus().state).toBe("CLOSED");
    expect(CircuitBreaker.getStatus().consecutiveFailures).toBe(4);

    // 5th failure -> trips to OPEN
    CircuitBreaker.recordFailure();
    expect(CircuitBreaker.getStatus().state).toBe("OPEN");
    expect(CircuitBreaker.getStatus().consecutiveFailures).toBe(5);

    // Attempting while OPEN throws error
    expect(() => CircuitBreaker.canAttempt()).toThrow(/CIRCUIT_BREAKER_OPEN/);

    // Recording success resets back to CLOSED
    CircuitBreaker.recordSuccess();
    expect(CircuitBreaker.getStatus().state).toBe("CLOSED");
    expect(CircuitBreaker.getStatus().consecutiveFailures).toBe(0);
    expect(CircuitBreaker.canAttempt()).toBe(true);
  });
});

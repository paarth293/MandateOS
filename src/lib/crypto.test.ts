import { describe, expect, it } from "vitest";
import { generateAuditHash, generateKeypair, signData, verifySignature } from "./crypto";

describe("Ed25519 Cryptography", () => {
  it("should generate a valid keypair in hex format", () => {
    const keypair = generateKeypair();
    expect(keypair).toHaveProperty("publicKey");
    expect(keypair).toHaveProperty("secretKey");
    expect(keypair.publicKey.length).toBe(64);
    expect(keypair.secretKey.length).toBe(128);
  });

  it("should sign data and verify it successfully", () => {
    const { publicKey, secretKey } = generateKeypair();
    const mandateData = JSON.stringify({ maxAmount: 5000, agent: "AP2" });

    const signature = signData(mandateData, secretKey);
    expect(typeof signature).toBe("string");

    const isValid = verifySignature(mandateData, signature, publicKey);
    expect(isValid).toBe(true);
  });

  it("should reject tampered data", () => {
    const { publicKey, secretKey } = generateKeypair();
    const mandateData = JSON.stringify({ maxAmount: 5000 });
    const signature = signData(mandateData, secretKey);

    const tamperedData = JSON.stringify({ maxAmount: 50000 });
    const isValid = verifySignature(tamperedData, signature, publicKey);
    expect(isValid).toBe(false);
  });
});

describe("Hash-Chained Audit Trail", () => {
  it("should generate a deterministic SHA-256 hash", () => {
    const action = "PAYMENT_FAILED";
    const details = { reason: "BANK_TIMEOUT", amount: 5000 };
    const previousHash = "0000000000000000000000000000000000000000000000000000000000000000";

    const hash1 = generateAuditHash(action, details, previousHash);
    const hash2 = generateAuditHash(action, details, previousHash);

    expect(hash1.length).toBe(64);
    expect(hash1).toBe(hash2);
  });

  it("should change completely if the previous hash is tampered with", () => {
    const action = "PAYMENT_FAILED";
    const details = { reason: "BANK_TIMEOUT", amount: 5000 };

    const originalPreviousHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const tamperedPreviousHash = "1000000000000000000000000000000000000000000000000000000000000000";

    const hash1 = generateAuditHash(action, details, originalPreviousHash);
    const hash2 = generateAuditHash(action, details, tamperedPreviousHash);

    expect(hash1).not.toBe(hash2);
  });
});

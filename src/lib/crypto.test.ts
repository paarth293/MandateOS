// src/lib/crypto.test.ts
import { describe, expect, it } from "vitest";
import { generateKeypair, signData, verifySignature } from "./crypto";

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

    // The exact mandate policy we want to protect
    const mandateData = JSON.stringify({ maxAmount: 5000, agent: "AP2" });

    // Priya signs the data with her secret ring
    const signature = signData(mandateData, secretKey);
    expect(typeof signature).toBe("string");

    // The system verifies the wax seal matches the public ring
    const isValid = verifySignature(mandateData, signature, publicKey);
    expect(isValid).toBe(true);
  });

  it("should reject tampered data", () => {
    const { publicKey, secretKey } = generateKeypair();
    const mandateData = JSON.stringify({ maxAmount: 5000 });
    const signature = signData(mandateData, secretKey);

    // 🚨 A hacker alters the database to give the agent more money
    const tamperedData = JSON.stringify({ maxAmount: 50000 });

    // The system attempts to verify the tampered data against the original signature
    const isValid = verifySignature(tamperedData, signature, publicKey);

    // The wax seal is broken. The math must return false!
    expect(isValid).toBe(false);
  });
});

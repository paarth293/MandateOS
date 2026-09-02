import { describe, expect, it } from "vitest";
import { generateKeypair } from "./crypto";

describe("Ed25519 Cryptography", () => {
  it("should generate a valid keypair in hex format", () => {
    const keypair = generateKeypair();

    // It should return an object with both keys
    expect(keypair).toHaveProperty("publicKey");
    expect(keypair).toHaveProperty("secretKey");

    // Ed25519 public keys are exactly 32 bytes (64 hex characters)
    expect(keypair.publicKey.length).toBe(64);

    // Ed25519 secret keys are exactly 64 bytes (128 hex characters)
    expect(keypair.secretKey.length).toBe(128);
  });
});

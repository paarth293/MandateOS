import crypto from "node:crypto";
import nacl from "tweetnacl";

/**
 * Generates an Ed25519 asymmetric cryptographic keypair for AI agent spend authorization.
 */
export function generateKeypair(): { publicKey: string; secretKey: string } {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(keypair.publicKey).toString("hex"),
    secretKey: Buffer.from(keypair.secretKey).toString("hex"),
  };
}

/**
 * Signs arbitrary data using the agent's Ed25519 secret key.
 */
export function signData(data: string, secretKeyHex: string): string {
  const messageBytes = new Uint8Array(Buffer.from(data, "utf8"));
  const secretKeyBytes = new Uint8Array(Buffer.from(secretKeyHex, "hex"));
  const signatureBytes = nacl.sign.detached(messageBytes, secretKeyBytes);
  return Buffer.from(signatureBytes).toString("hex");
}

/**
 * Verifies an Ed25519 signature against the mandate's public key.
 */
export function verifySignature(data: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const messageBytes = new Uint8Array(Buffer.from(data, "utf8"));
    const signatureBytes = new Uint8Array(Buffer.from(signatureHex, "hex"));
    const publicKeyBytes = new Uint8Array(Buffer.from(publicKeyHex, "hex"));
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Recursively sorts object keys alphabetically to guarantee deterministic JSON serialization
 * across diverse clients (AI agent scripts, SDKs, and backend verifiers).
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Generates an immutable SHA-256 hash chaining each audit log block to its predecessor.
 */
export function generateAuditHash(
  action: string,
  details: Record<string, unknown>,
  previousHash: string,
): string {
  const payload = canonicalStringify({ action, details, previousHash });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

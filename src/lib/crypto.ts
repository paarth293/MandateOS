import crypto from "crypto"; // Node's built-in crypto module for SHA-256
import nacl from "tweetnacl";

export function generateKeypair(): { publicKey: string; secretKey: string } {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(keypair.publicKey).toString("hex"),
    secretKey: Buffer.from(keypair.secretKey).toString("hex"),
  };
}

export function signData(data: string, secretKeyHex: string): string {
  const messageBytes = new Uint8Array(Buffer.from(data, "utf8"));
  const secretKeyBytes = new Uint8Array(Buffer.from(secretKeyHex, "hex"));
  const signatureBytes = nacl.sign.detached(messageBytes, secretKeyBytes);
  return Buffer.from(signatureBytes).toString("hex");
}

export function verifySignature(data: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const messageBytes = new Uint8Array(Buffer.from(data, "utf8"));
    const signatureBytes = new Uint8Array(Buffer.from(signatureHex, "hex"));
    const publicKeyBytes = new Uint8Array(Buffer.from(publicKeyHex, "hex"));
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    return false;
  }
}

export function generateAuditHash(action: string, details: any, previousHash: string): string {
  // 1. Serialize all the row data into a single string
  const payload = JSON.stringify({ action, details, previousHash });

  // 2. Generate a SHA-256 hash (64 hex characters) of that exact string
  return crypto.createHash("sha256").update(payload).digest("hex");
}

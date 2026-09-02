import crypto from "node:crypto"; // Fix 1: Added node: protocol
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
  } catch {
    // Fix 3: Removed the unused 'error' variable entirely
    return false;
  }
}

// Fix 2: Replaced 'any' with 'Record<string, unknown>' for strict JSON typing
export function generateAuditHash(
  action: string,
  details: Record<string, unknown>,
  previousHash: string,
): string {
  const payload = JSON.stringify({ action, details, previousHash });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

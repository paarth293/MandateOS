import nacl from "tweetnacl";

export function generateKeypair(): { publicKey: string; secretKey: string } {
  const keypair = nacl.sign.keyPair();

  return {
    publicKey: Buffer.from(keypair.publicKey).toString("hex"),
    secretKey: Buffer.from(keypair.secretKey).toString("hex"),
  };
}

export function signData(data: string, secretKeyHex: string): string {
  // 1. Convert our strings into pure Uint8Arrays (TweetNaCl strictly requires Uint8Array, not Buffer)
  const messageBytes = new Uint8Array(Buffer.from(data, "utf8"));
  const secretKeyBytes = new Uint8Array(Buffer.from(secretKeyHex, "hex"));

  // 2. Generate the detached signature
  const signatureBytes = nacl.sign.detached(messageBytes, secretKeyBytes);

  // 3. Convert back to hex
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

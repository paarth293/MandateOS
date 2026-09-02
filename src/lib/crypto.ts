// src/lib/crypto.ts
import nacl from "tweetnacl";

export function generateKeypair(): { publicKey: string; secretKey: string } {
  // 1. TweetNaCl generates the mathematically secure keypair
  // It returns them as raw Uint8Array bytes
  const keypair = nacl.sign.keyPair();

  // 2. We convert the raw bytes into readable Hex Strings
  // so we can easily store them in our Postgres database and display them on the UI
  return {
    publicKey: Buffer.from(keypair.publicKey).toString("hex"),
    secretKey: Buffer.from(keypair.secretKey).toString("hex"),
  };
}

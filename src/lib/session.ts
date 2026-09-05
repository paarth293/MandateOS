// src/lib/session.ts
// Pure, dependency-light session-token cryptography. Kept free of DB/Next.js
// imports so it is trivially unit-testable and reusable by any entrypoint.
//
// Threat model: the session cookie is a bearer token whose SHA-256 hash is
// stored in the `sessions` table. If an attacker gains read access to that
// table, raw tokens are not recoverable (good), but nothing stops a DB writer
// from INSERTING a row whose tokenHash matches a token they just made up.
// Binding the cookie to an HMAC over the token with a server-side
// SESSION_SECRET closes that vector: a forged DB row is useless without the
// secret, and the cookie itself cannot be minted without it.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TOKEN_SEPARATOR = ".";

/**
 * Binds a raw session token to the server secret:
 *   cookie value = <rawToken>.<hmac_sha256(rawToken, secret)>
 */
export function signSessionToken(rawToken: string, secret: string): string {
  if (!rawToken || !secret) {
    throw new Error("signSessionToken: rawToken and secret are required");
  }
  const mac = createHmac("sha256", secret).update(rawToken).digest("hex");
  return `${rawToken}${SESSION_TOKEN_SEPARATOR}${mac}`;
}

/**
 * Constant-time verification of a signed session token. Returns the raw token
 * when the HMAC matches, otherwise null. Also rejects malformed inputs so a
 * legacy unsigned cookie fails closed rather than crashing.
 */
export function verifySessionToken(signedToken: string, secret: string): string | null {
  if (!signedToken || !secret) return null;

  const separatorIndex = signedToken.lastIndexOf(SESSION_TOKEN_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === signedToken.length - 1) return null;

  const rawToken = signedToken.slice(0, separatorIndex);
  const providedMac = signedToken.slice(separatorIndex + 1);

  if (!/^[0-9a-f]{64}$/i.test(providedMac)) return null;

  const expectedMac = createHmac("sha256", secret).update(rawToken).digest("hex");

  const providedBuffer = Buffer.from(providedMac, "hex");
  const expectedBuffer = Buffer.from(expectedMac, "hex");

  return timingSafeEqual(providedBuffer, expectedBuffer) ? rawToken : null;
}

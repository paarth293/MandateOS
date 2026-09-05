import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "./session";

const SECRET = "test-secret-for-unit-tests-0123456789abcdef";

describe("signSessionToken / verifySessionToken", () => {
  it("round-trips a signed token back to the raw token", () => {
    const raw = "a".repeat(64);
    const signed = signSessionToken(raw, SECRET);
    expect(signed.startsWith(`${raw}.`)).toBe(true);
    expect(verifySessionToken(signed, SECRET)).toBe(raw);
  });

  it("produces a 64-hex-char HMAC", () => {
    const signed = signSessionToken("abc", SECRET);
    const mac = signed.slice(signed.lastIndexOf(".") + 1);
    expect(mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a token signed with a different secret", () => {
    const signed = signSessionToken("abc", SECRET);
    expect(verifySessionToken(signed, "another-secret-0123456789abcdef")).toBeNull();
  });

  it("rejects a tampered raw token while keeping the original HMAC", () => {
    const raw = "a".repeat(64);
    const signed = signSessionToken(raw, SECRET);
    const tampered = `${"b".repeat(64)}.${signed.split(".")[1]}`;
    expect(verifySessionToken(tampered, SECRET)).toBeNull();
  });

  it("rejects a tampered HMAC while keeping the original raw token", () => {
    const raw = "a".repeat(64);
    const signed = signSessionToken(raw, SECRET);
    const mac = signed.split(".")[1];
    const forged = `${raw}.${"0".repeat(64)}`;
    expect(verifySessionToken(forged, SECRET)).toBeNull();
    expect(forged.split(".")[1]).not.toBe(mac);
  });

  it("rejects unsigned (legacy-style) cookies outright", () => {
    const raw = "a".repeat(64);
    expect(verifySessionToken(raw, SECRET)).toBeNull();
  });

  it("rejects malformed inputs without throwing", () => {
    expect(verifySessionToken("", SECRET)).toBeNull();
    expect(verifySessionToken(".", SECRET)).toBeNull();
    expect(verifySessionToken(".deadbeef", SECRET)).toBeNull();
    expect(verifySessionToken("raw.", SECRET)).toBeNull();
    expect(verifySessionToken("raw.nothex", SECRET)).toBeNull();
    expect(verifySessionToken(`raw.${"z".repeat(64)}`, SECRET)).toBeNull();
    expect(verifySessionToken(`raw.${"a".repeat(63)}`, SECRET)).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    expect(signSessionToken("abc", SECRET)).toBe(signSessionToken("abc", SECRET));
  });
});

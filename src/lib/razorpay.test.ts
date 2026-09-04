import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpayWebhookSignature } from "./razorpay";

const SECRET = "whsec_test_secret";
const rawBody = JSON.stringify({
  event: "payment.captured",
  payload: { payment: { entity: { order_id: "order_test_123" } } },
});

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyRazorpayWebhookSignature", () => {
  it("accepts a valid HMAC signature", () => {
    const signature = sign(rawBody, SECRET);
    expect(verifyRazorpayWebhookSignature(rawBody, signature, SECRET)).toBe(true);
  });

  it("rejects a tampered body against an otherwise valid signature", () => {
    const signature = sign(rawBody, SECRET);
    const tamperedBody = rawBody.replace("payment.captured", "payment.failed");
    expect(verifyRazorpayWebhookSignature(tamperedBody, signature, SECRET)).toBe(false);
  });

  it("rejects a signature produced with the wrong secret", () => {
    const signature = sign(rawBody, "whsec_attacker_secret");
    expect(verifyRazorpayWebhookSignature(rawBody, signature, SECRET)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyRazorpayWebhookSignature(rawBody, null, SECRET)).toBe(false);
  });

  it("rejects when no webhook secret is configured (fail closed)", () => {
    const signature = sign(rawBody, SECRET);
    expect(verifyRazorpayWebhookSignature(rawBody, signature, null)).toBe(false);
  });
});

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

/**
 * Constant-time HMAC-SHA256 verification of a Razorpay webhook signature.
 * Extracted so the webhook route's security check is unit-testable.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string | null,
): boolean {
  if (!webhookSecret || !signature) return false;

  const expectedSignature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  return sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
}

// 1. Initialize the official Razorpay SDK
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_mock",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "mock_secret",
});

// 2. Gateway Circuit Breaker State Machine
export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

class GatewayCircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private readonly failureThreshold = 5;
  private readonly cooldownPeriodMs = 30000; // 30 seconds
  private lastFailureTime = 0;

  getStatus() {
    this.checkCooldownTransition();
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      cooldownPeriodMs: this.cooldownPeriodMs,
    };
  }

  private checkCooldownTransition() {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.cooldownPeriodMs) {
        this.state = "HALF_OPEN";
      }
    }
  }

  canAttempt(): boolean {
    this.checkCooldownTransition();
    if (this.state === "OPEN") {
      const elapsed = Math.round((Date.now() - this.lastFailureTime) / 1000);
      const remaining = Math.max(0, Math.round(this.cooldownPeriodMs / 1000) - elapsed);
      throw new Error(
        `CIRCUIT_BREAKER_OPEN: Gateway circuit breaker TRIPPED after ${this.failureThreshold} consecutive banking failures. Halting outbound agent payment traffic (cooldown remaining: ${remaining}s).`,
      );
    }
    return true;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
  }

  recordFailure() {
    this.consecutiveFailures += 1;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  reset() {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}

export const CircuitBreaker = new GatewayCircuitBreaker();

// 3. Our Custom Gateway Wrapper with Circuit Breaker Interception
export const MandateOSPaymentGateway = {
  async createOrder(amountPaise: number, mandateId: string, simulateFailure?: string) {
    // 1. Guard check through circuit breaker
    CircuitBreaker.canAttempt();

    // 2. Chaos Console Interception
    if (simulateFailure === "BANK_TIMEOUT") {
      CircuitBreaker.recordFailure();
      throw new Error("GATEWAY_ERROR: Bank timed out during authorization");
    }
    if (simulateFailure === "INSUFFICIENT_FUNDS") {
      CircuitBreaker.recordFailure();
      throw new Error("GATEWAY_ERROR: Customer account has insufficient funds");
    }
    if (simulateFailure === "CARD_EXPIRED") {
      CircuitBreaker.recordFailure();
      throw new Error("GATEWAY_ERROR: The mandate card has expired");
    }

    // 3. Offline Mock Mode
    if (process.env.GATEWAY_MODE === "mock" || !process.env.RAZORPAY_KEY_ID) {
      CircuitBreaker.recordSuccess();
      return { id: `order_mock_${randomUUID()}` };
    }

    // 4. Real Razorpay API Call
    try {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `receipt_${mandateId.substring(0, 10)}`,
        notes: {
          mandateId,
          managedBy: "MandateOS",
        },
      });
      CircuitBreaker.recordSuccess();
      return order;
    } catch (error) {
      CircuitBreaker.recordFailure();
      console.error("Razorpay API Error:", error);
      throw new Error("Failed to create Razorpay Order");
    }
  },
};

import { randomUUID } from "node:crypto";
import Razorpay from "razorpay";

// 1. Initialize the official Razorpay SDK
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_mock",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "mock_secret",
});

// 2. Our Custom Wrapper (The Chaos Console Engine)
export const MandateOSPaymentGateway = {
  async createOrder(amountPaise: number, mandateId: string, simulateFailure?: string) {
    // --- CHAOS CONSOLE INTERCEPTION ---
    if (simulateFailure === "BANK_TIMEOUT") {
      throw new Error("GATEWAY_ERROR: Bank timed out during authorization");
    }
    if (simulateFailure === "INSUFFICIENT_FUNDS") {
      throw new Error("GATEWAY_ERROR: Customer account has insufficient funds");
    }
    if (simulateFailure === "CARD_EXPIRED") {
      throw new Error("GATEWAY_ERROR: The mandate card has expired");
    }

    // --- M0.8 OFFLINE MOCK MODE ---
    if (process.env.GATEWAY_MODE === "mock" || !process.env.RAZORPAY_KEY_ID) {
      return { id: `order_mock_${randomUUID()}` };
    }

    // --- REAL API CALL ---
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
      return order;
    } catch (error) {
      console.error("Razorpay API Error:", error);
      throw new Error("Failed to create Razorpay Order");
    }
  },
};

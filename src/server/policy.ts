// src/server/policy.ts
import type { mandates } from "./schema";

// Drizzle magic: This automatically grabs the exact TypeScript type of a row in your database!
type Mandate = typeof mandates.$inferSelect;

export function evaluateMandatePolicy(
  amountPaise: number,
  merchantCategory: string,
  mandate: Mandate,
  currentRetryCount: number,
): { allowed: boolean; reason: string } {
  // 1. Check Expiry Date
  // If the mandate is past its expiration, block immediately.
  if (new Date() > mandate.expiresAt) {
    return { allowed: false, reason: "MANDATE_EXPIRED" };
  }

  // 2. Check Status
  // If Priya clicked "Revoke" on her dashboard, block immediately.
  if (mandate.status !== "ACTIVE") {
    return { allowed: false, reason: `MANDATE_STATUS_${mandate.status}` };
  }

  // 3. Check Spending Limits
  if (amountPaise > mandate.maxAmountPerTransaction) {
    return {
      allowed: false,
      reason: `LIMIT_EXCEEDED: Tried to spend ₹${amountPaise / 100}, max is ₹${mandate.maxAmountPerTransaction / 100}`,
    };
  }

  // 4. Check Category Restrictions
  // "My agent is only allowed to buy Office Supplies, not Electronics"
  if (!mandate.allowedCategories.includes(merchantCategory)) {
    return {
      allowed: false,
      reason: `CATEGORY_BLOCKED: Merchant category '${merchantCategory}' is not authorized.`,
    };
  }

  // 5. Check Silent Retry Limits (Crucial for the Chaos Console!)
  // If Razorpay threw a BANK_TIMEOUT 3 times, but Priya only authorized 2 silent retries, block it.
  if (currentRetryCount >= mandate.maxSilentRetries) {
    return {
      allowed: false,
      reason: `MAX_RETRIES_EXCEEDED: Reached limit of ${mandate.maxSilentRetries} silent retries.`,
    };
  }

  // If it survives all of those checks, it is mathematically authorized!
  return { allowed: true, reason: "POLICY_PASSED" };
}

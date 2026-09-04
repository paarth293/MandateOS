// src/server/policy.ts
import type { mandates } from "./schema";

type Mandate = typeof mandates.$inferSelect;

export interface SpendTotals {
  spentTodayPaise: number;
  spentLifetimePaise: number;
}

export function evaluateMandatePolicy(
  amountPaise: number,
  merchantCategory: string,
  mandate: Mandate,
  currentRetryCount: number,
  totals?: SpendTotals,
): { allowed: boolean; reason: string } {
  // 1. Check Expiry Date
  if (new Date() > mandate.expiresAt) {
    return { allowed: false, reason: "MANDATE_EXPIRED" };
  }

  // 2. Check Status
  if (mandate.status !== "ACTIVE") {
    return { allowed: false, reason: `MANDATE_STATUS_${mandate.status}` };
  }

  // 3. Check Per-Transaction Spending Limit
  if (amountPaise > mandate.maxAmountPerTransaction) {
    return {
      allowed: false,
      reason: `LIMIT_EXCEEDED: Tried to spend ₹${amountPaise / 100}, max per transaction is ₹${mandate.maxAmountPerTransaction / 100}`,
    };
  }

  // 4. Check Daily Spend Cap
  if (mandate.dailyLimitPaise && totals) {
    if (totals.spentTodayPaise + amountPaise > mandate.dailyLimitPaise) {
      return {
        allowed: false,
        reason: `DAILY_LIMIT_EXCEEDED: Transaction of ₹${amountPaise / 100} exceeds daily spend ceiling of ₹${mandate.dailyLimitPaise / 100}`,
      };
    }
  }

  // 5. Check Lifetime Spend Cap
  if (mandate.lifetimeLimitPaise && totals) {
    if (totals.spentLifetimePaise + amountPaise > mandate.lifetimeLimitPaise) {
      return {
        allowed: false,
        reason: `LIFETIME_LIMIT_EXCEEDED: Transaction of ₹${amountPaise / 100} exceeds lifetime spend ceiling of ₹${mandate.lifetimeLimitPaise / 100}`,
      };
    }
  }

  // 6. Check Category Restrictions
  if (!mandate.allowedCategories.includes(merchantCategory)) {
    return {
      allowed: false,
      reason: `CATEGORY_BLOCKED: Merchant category '${merchantCategory}' is not authorized.`,
    };
  }

  // 7. Check Silent Retry Limits
  if (currentRetryCount >= mandate.maxSilentRetries) {
    return {
      allowed: false,
      reason: `MAX_RETRIES_EXCEEDED: Reached limit of ${mandate.maxSilentRetries} silent retries.`,
    };
  }

  return { allowed: true, reason: "POLICY_PASSED" };
}

/**
 * Resolves the merchant category a retried transaction must be re-evaluated
 * against. Prefers the category recorded on the transaction row at purchase
 * time; falls back to the merchant's business category for legacy rows that
 * predate the denormalized column. Returns null when neither is available so
 * the recovery path fails CLOSED (no retry) rather than guessing.
 */
export function resolveRetryCategory(
  tx: { merchantCategory: string | null },
  merchant: { businessCategory: string | null } | null,
): string | null {
  if (tx.merchantCategory) return tx.merchantCategory;
  if (merchant?.businessCategory) return merchant.businessCategory;
  return null;
}

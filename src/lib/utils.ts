// src/lib/utils.ts
/**
 * Utility functions for MandateOS
 */
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

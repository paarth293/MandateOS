// src/lib/utils.ts
/**
 * Utility functions for MandateOS
 */
/**
 * Standardized Fintech Formatter:
 * Accepts amount in PAISE (integer) and formats to INR currency string.
 */
export function formatCurrency(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

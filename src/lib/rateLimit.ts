// src/lib/rateLimit.ts
// Pure sliding-window rate-limit logic (no I/O) so the threshold semantics are
// unit-testable. The purchase route feeds it timestamps queried from the DB.
export function shouldRateLimit(
  recentTimestamps: number[],
  now: number,
  windowMs: number,
  maxRequests: number,
): boolean {
  const windowStart = now - windowMs;
  const count = recentTimestamps.filter((t) => t >= windowStart).length;
  return count >= maxRequests;
}

import { describe, expect, it } from "vitest";
import { shouldRateLimit } from "./rateLimit";

const WINDOW_MS = 60_000;
const MAX = 60;
const now = 1_000_000;

describe("shouldRateLimit", () => {
  it("allows requests below the threshold", () => {
    const timestamps = Array.from({ length: MAX - 1 }, () => now);
    expect(shouldRateLimit(timestamps, now, WINDOW_MS, MAX)).toBe(false);
  });

  it("trips exactly at the threshold boundary", () => {
    const timestamps = Array.from({ length: MAX }, () => now);
    expect(shouldRateLimit(timestamps, now, WINDOW_MS, MAX)).toBe(true);
  });

  it("trips above the threshold", () => {
    const timestamps = Array.from({ length: MAX + 1 }, () => now);
    expect(shouldRateLimit(timestamps, now, WINDOW_MS, MAX)).toBe(true);
  });

  it("ignores timestamps outside the sliding window", () => {
    // MAX - 1 requests inside the window + a flood of stale ones outside.
    const inside = Array.from({ length: MAX - 1 }, () => now - 1);
    const stale = Array.from({ length: 1000 }, () => now - WINDOW_MS - 1);
    expect(shouldRateLimit([...stale, ...inside], now, WINDOW_MS, MAX)).toBe(false);
  });

  it("treats an empty history as not rate limited", () => {
    expect(shouldRateLimit([], now, WINDOW_MS, MAX)).toBe(false);
  });

  it("respects a custom window and max", () => {
    expect(shouldRateLimit([1_000], 2_000, 1_000, 2)).toBe(false);
    expect(shouldRateLimit([1_000, 1_100, 1_200], 2_000, 1_000, 2)).toBe(true);
  });
});

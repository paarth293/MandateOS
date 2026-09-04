import { describe, expect, it } from "vitest";
import { resolveRetryCategory } from "./policy";

describe("resolveRetryCategory", () => {
  it("prefers the category denormalized on the transaction row", () => {
    expect(
      resolveRetryCategory(
        { merchantCategory: "Cloud Servers" },
        { businessCategory: "Office Supplies" },
      ),
    ).toBe("Cloud Servers");
  });

  it("falls back to the merchant business category for legacy rows", () => {
    expect(
      resolveRetryCategory({ merchantCategory: null }, { businessCategory: "Data Services" }),
    ).toBe("Data Services");
  });

  it("returns null when neither the row nor the merchant has a category (fail closed)", () => {
    expect(resolveRetryCategory({ merchantCategory: null }, null)).toBeNull();
    expect(resolveRetryCategory({ merchantCategory: null }, { businessCategory: null })).toBeNull();
  });

  it("ignores empty-string categories when falling back", () => {
    expect(
      resolveRetryCategory({ merchantCategory: "" }, { businessCategory: "Cloud Servers" }),
    ).toBe("Cloud Servers");
  });
});

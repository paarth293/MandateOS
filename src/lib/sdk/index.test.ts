// src/lib/sdk/index.test.ts
// Unit tests for the official MandateOSClient SDK — the "3-line integration"
// surface every agent framework is supposed to use. These tests run the client
// against a locally-stubbed fetch, asserting both the WIRE FORMAT (canonical
// payload, Ed25519 signature headers) and the response contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalStringify, generateKeypair, verifySignature } from "../crypto";
import { MandateOSClient } from "./index";

const BASE_URL = "http://localhost:3000";
const MANDATE_ID = "00000000-0000-0000-0000-000000000042";
const { publicKey, secretKey } = generateKeypair();

type RecordedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

let recorded: RecordedRequest | null = null;
let responseFactory: (req: RecordedRequest) => { status: number; json: unknown };

function stubFetch() {
  vi.stubGlobal("fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    const url = String(_input);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    recorded = { url, method: init?.method ?? "GET", headers, body };

    const res = responseFactory(recorded);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      statusText: `HTTP ${res.status}`,
      json: async () => res.json,
    } as Response;
  });
}

beforeEach(() => {
  recorded = null;
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeClient() {
  return new MandateOSClient({ baseUrl: BASE_URL, mandateId: MANDATE_ID, secretKey });
}

describe("MandateOSClient.purchase", () => {
  it("sends canonical, verifiable Ed25519-signed purchase requests", async () => {
    responseFactory = () => ({
      status: 200,
      json: {
        success: true,
        transactionId: "tx-1",
        razorpayOrderId: "order_1",
        amountPaise: 250000,
        category: "Cloud Servers",
        status: "ORDER_CREATED",
      },
    });

    const result = await makeClient().purchase({ amountPaise: 250000, category: "Cloud Servers" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(recorded?.url).toBe(`${BASE_URL}/api/agent/purchase`);
    expect(recorded?.method).toBe("POST");
    expect(recorded?.headers["content-type"]).toBe("application/json");
    expect(recorded?.headers["x-timestamp"]).toMatch(/^\d+$/);
    expect(recorded?.headers["x-nonce"]).toBeTruthy();
    expect(recorded?.body).toMatchObject({
      mandateId: MANDATE_ID,
      amountPaise: 250000,
      category: "Cloud Servers",
    });

    // The signature MUST verify against the canonical payload the server recomputes.
    const timestamp = Number(recorded?.headers["x-timestamp"]);
    const nonce = recorded?.headers["x-nonce"] ?? "";
    const canonicalPayload = canonicalStringify({
      amountPaise: 250000,
      category: "Cloud Servers",
      mandateId: MANDATE_ID,
      nonce,
      timestamp,
    });
    expect(
      verifySignature(canonicalPayload, recorded?.headers["x-mandate-signature"] ?? "", publicKey),
    ).toBe(true);
  });

  it("surfaces firewall blocks as a structured non-ok response", async () => {
    responseFactory = () => ({
      status: 403,
      json: {
        success: false,
        error: "Policy Violation Blocked by MandateOS",
        reason: "CATEGORY_BLOCKED: ...",
      },
    });

    const result = await makeClient().purchase({
      amountPaise: 100,
      category: "Luxury Sports Cars",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.data).toMatchObject({
      success: false,
      reason: expect.stringContaining("CATEGORY_BLOCKED"),
    });
  });

  it("returns a graceful failure object when the gateway returns malformed JSON", async () => {
    responseFactory = () => ({ status: 502, json: null });

    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    }));

    const result = await makeClient().purchase({ amountPaise: 1, category: "X" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.data).toMatchObject({ success: false, error: expect.stringContaining("502") });
  });
});

describe("MandateOSClient verification surfaces", () => {
  it("verifyChain hits the mandate-scoped verification endpoint", async () => {
    responseFactory = () => ({
      status: 200,
      json: { mandateId: MANDATE_ID, verified: true, blockCount: 7, brokenBlockIndex: null },
    });

    const result = await makeClient().verifyChain();

    expect(recorded?.url).toBe(`${BASE_URL}/api/verify/chain?mandateId=${MANDATE_ID}`);
    expect(result.verified).toBe(true);
    expect(result.blockCount).toBe(7);
  });

  it("getAnchors forwards the limit parameter", async () => {
    responseFactory = () => ({ status: 200, json: { anchors: [] } });

    await makeClient().getAnchors(20);

    expect(recorded?.url).toContain(`mandateId=${MANDATE_ID}`);
    expect(recorded?.url).toContain("limit=20");
  });

  it("publishAnchor POSTs the mandateId and returns the anchor", async () => {
    responseFactory = () => ({
      status: 200,
      json: { success: true, anchor: { id: "anchor-1", anchorHash: "deadbeef" } },
    });

    const result = await makeClient().publishAnchor();

    expect(recorded?.method).toBe("POST");
    expect(recorded?.body).toEqual({ mandateId: MANDATE_ID });
    expect(result.success).toBe(true);
  });

  it("throws a descriptive error on non-ok verification responses", async () => {
    responseFactory = () => ({ status: 500, json: { error: "boom" } });

    await expect(makeClient().verifyChain()).rejects.toThrow("HTTP 500");
  });
});

describe("MandateOSClient construction", () => {
  it("rejects missing mandateId", () => {
    expect(() => new MandateOSClient({ mandateId: "", secretKey })).toThrow(
      /mandateId is required/,
    );
  });

  it("rejects missing secretKey", () => {
    expect(() => new MandateOSClient({ mandateId: MANDATE_ID, secretKey: "" })).toThrow(
      /secretKey is required/,
    );
  });

  it("strips a trailing slash from baseUrl", async () => {
    responseFactory = () => ({ status: 200, json: { verified: true, blockCount: 0 } });
    const client = new MandateOSClient({
      baseUrl: `${BASE_URL}/`,
      mandateId: MANDATE_ID,
      secretKey,
    });
    await client.verifyChain();
    expect(recorded?.url).toBe(`${BASE_URL}/api/verify/chain?mandateId=${MANDATE_ID}`);
  });

  it("defaults baseUrl to localhost:3000", () => {
    const client = new MandateOSClient({ mandateId: MANDATE_ID, secretKey });
    // @ts-expect-error accessing private field for assertion
    expect(client.baseUrl).toBe("http://localhost:3000");
  });
});

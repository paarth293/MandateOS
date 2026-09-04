import crypto from "node:crypto";
import { canonicalStringify, signData } from "../crypto";

export interface MandateOSClientConfig {
  baseUrl?: string;
  mandateId: string;
  secretKey: string;
}

export interface PurchaseRequestOptions {
  amountPaise: number;
  category: string;
  merchantId?: string;
}

export interface PurchaseSuccessResponse {
  success: true;
  transactionId: string;
  razorpayOrderId: string;
  amountPaise: number;
  category: string;
  status: string;
}

export interface PurchaseBlockedResponse {
  success: false;
  error: string;
  reason?: string;
  policyViolation?: string;
}

export type PurchaseResponse = PurchaseSuccessResponse | PurchaseBlockedResponse;

export interface ChainVerificationResponse {
  mandateId: string;
  verified: boolean;
  blockCount: number;
  brokenBlockIndex: number | null;
  reason?: string;
  lastHash?: string | null;
}

export interface AnchorRecord {
  id: string;
  mandateId: string;
  anchorHash: string;
  previousAnchorHash: string;
  lastBlockHash: string;
  blockCount: number;
  anchoredAt: string;
}

/**
 * Official MandateOS Agent Client SDK.
 * Handles deterministic Ed25519 signature generation, timestamping,
 * anti-replay nonces, and policy firewall communication.
 */
export class MandateOSClient {
  private baseUrl: string;
  private mandateId: string;
  private secretKey: string;

  constructor(config: MandateOSClientConfig) {
    if (!config.mandateId) {
      throw new Error("MandateOSClient: mandateId is required");
    }
    if (!config.secretKey) {
      throw new Error("MandateOSClient: secretKey is required for Ed25519 signing");
    }

    this.baseUrl = config.baseUrl?.replace(/\/$/, "") || "http://localhost:3000";
    this.mandateId = config.mandateId;
    this.secretKey = config.secretKey;
  }

  /**
   * Executes a cryptographically signed purchase through MandateOS Policy Firewall.
   */
  async purchase(options: PurchaseRequestOptions): Promise<{
    ok: boolean;
    status: number;
    data: PurchaseResponse;
  }> {
    const nonce = `sdk_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)}`;
    const timestamp = Date.now();

    const canonicalPayload = canonicalStringify({
      amountPaise: options.amountPaise,
      category: options.category,
      mandateId: this.mandateId,
      nonce,
      timestamp,
    });

    const signature = signData(canonicalPayload, this.secretKey);

    const res = await fetch(`${this.baseUrl}/api/agent/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mandate-signature": signature,
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
      },
      body: JSON.stringify({
        mandateId: this.mandateId,
        amountPaise: options.amountPaise,
        category: options.category,
        merchantId: options.merchantId,
      }),
    });

    const data = (await res.json().catch(() => ({
      success: false,
      error: `HTTP ${res.status}: ${res.statusText}`,
    }))) as PurchaseResponse;

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  }

  /**
   * Cryptographically verifies the audit hash chain for the mandate.
   */
  async verifyChain(): Promise<ChainVerificationResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/verify/chain?mandateId=${encodeURIComponent(this.mandateId)}`,
    );
    if (!res.ok) {
      throw new Error(`Failed to verify chain: HTTP ${res.status}`);
    }
    return (await res.json()) as ChainVerificationResponse;
  }

  /**
   * Fetches published external anchors for this mandate.
   */
  async getAnchors(limit = 50): Promise<{ anchors: AnchorRecord[] }> {
    const res = await fetch(
      `${this.baseUrl}/api/anchors?mandateId=${encodeURIComponent(this.mandateId)}&limit=${limit}`,
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch anchors: HTTP ${res.status}`);
    }
    return (await res.json()) as { anchors: AnchorRecord[] };
  }

  /**
   * Publishes an immutable audit anchor checkpoint.
   */
  async publishAnchor(): Promise<{ success: boolean; anchor: AnchorRecord }> {
    const res = await fetch(`${this.baseUrl}/api/anchors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mandateId: this.mandateId }),
    });
    if (!res.ok) {
      throw new Error(`Failed to publish anchor: HTTP ${res.status}`);
    }
    return (await res.json()) as { success: boolean; anchor: AnchorRecord };
  }
}

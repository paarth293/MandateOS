// src/lib/chain.ts
// Pure SHA-256 audit-chain verification. Kept free of DB/HTTP imports so it is
// trivially unit-testable and reusable by third-party auditors.
import { generateAuditHash } from "./crypto";

export interface ChainVerificationResult {
  verified: boolean;
  blockCount: number;
  brokenBlockIndex: number | null;
  reason?: string;
  lastHash?: string | null;
}

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export function verifyAuditChain(
  blocks: Array<{
    action: string;
    details: unknown;
    previousHash: string;
    currentHash: string;
  }>,
): ChainVerificationResult {
  if (blocks.length === 0) {
    return {
      verified: true,
      blockCount: 0,
      brokenBlockIndex: null,
      lastHash: null,
    };
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Check genesis condition for first block
    if (i === 0 && block.previousHash !== GENESIS_HASH) {
      return {
        verified: false,
        blockCount: blocks.length,
        brokenBlockIndex: 0,
        reason: `Genesis block previousHash must be 64 zeros, found ${block.previousHash}`,
        lastHash: null,
      };
    }

    // Check chain link to previous block
    if (i > 0 && block.previousHash !== blocks[i - 1].currentHash) {
      return {
        verified: false,
        blockCount: blocks.length,
        brokenBlockIndex: i,
        reason: `Block ${i} previousHash does not match block ${i - 1} currentHash`,
        lastHash: blocks[i - 1].currentHash,
      };
    }

    // Recompute currentHash
    const expectedHash = generateAuditHash(
      block.action,
      (block.details || {}) as Record<string, unknown>,
      block.previousHash,
    );

    if (expectedHash !== block.currentHash) {
      return {
        verified: false,
        blockCount: blocks.length,
        brokenBlockIndex: i,
        reason: `Cryptographic hash mismatch at block ${i}: computed ${expectedHash}, recorded ${block.currentHash}`,
        lastHash: i > 0 ? blocks[i - 1].currentHash : null,
      };
    }
  }

  return {
    verified: true,
    blockCount: blocks.length,
    brokenBlockIndex: null,
    lastHash: blocks[blocks.length - 1].currentHash,
  };
}

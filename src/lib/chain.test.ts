import { describe, expect, it } from "vitest";
import { type ChainVerificationResult, GENESIS_HASH, verifyAuditChain } from "./chain";
import { generateAuditHash } from "./crypto";

type Block = Parameters<typeof verifyAuditChain>[0][number];

function makeBlock(action: string, details: Record<string, unknown>, previousHash: string): Block {
  return {
    action,
    details,
    previousHash,
    currentHash: generateAuditHash(action, details, previousHash),
  };
}

function buildValidChain(length = 3): Block[] {
  const blocks: Block[] = [];
  let previous = GENESIS_HASH;
  for (let i = 0; i < length; i++) {
    const block = makeBlock(`ACTION_${i}`, { summary: `Block ${i}` }, previous);
    blocks.push(block);
    previous = block.currentHash;
  }
  return blocks;
}

describe("verifyAuditChain", () => {
  it("verifies an empty chain as intact", () => {
    const result = verifyAuditChain([]);
    expect(result.verified).toBe(true);
    expect(result.blockCount).toBe(0);
    expect(result.brokenBlockIndex).toBeNull();
    expect(result.lastHash).toBeNull();
  });

  it("verifies a valid multi-block chain", () => {
    const blocks = buildValidChain(4);
    const result = verifyAuditChain(blocks);
    expect(result.verified).toBe(true);
    expect(result.blockCount).toBe(4);
    expect(result.brokenBlockIndex).toBeNull();
    expect(result.lastHash).toBe(blocks[3].currentHash);
  });

  it("rejects a first block that does not link to the genesis hash", () => {
    const blocks = [makeBlock("ACTION_0", { summary: "X" }, "abcd1234")];
    const result = verifyAuditChain(blocks);
    expect(result.verified).toBe(false);
    expect(result.brokenBlockIndex).toBe(0);
    expect(result.reason).toContain("Genesis block");
  });

  it("detects a broken link between consecutive blocks", () => {
    const blocks = buildValidChain(3);
    // Tamper: point block 2 at a forged predecessor.
    const forged = { ...blocks[2], previousHash: "0".repeat(64) };
    const result = verifyAuditChain([blocks[0], blocks[1], forged]);
    expect(result.verified).toBe(false);
    expect(result.brokenBlockIndex).toBe(2);
    expect(result.reason).toContain("previousHash");
  });

  it("detects a tampered block whose recomputed hash no longer matches", () => {
    const blocks = buildValidChain(3);
    // Tamper: mutate block 1's details WITHOUT recomputing its currentHash.
    const tampered = { ...blocks[1], details: { summary: "Attacker rewrote history" } };
    const result = verifyAuditChain([blocks[0], tampered, blocks[2]]);
    expect(result.verified).toBe(false);
    expect(result.brokenBlockIndex).toBe(1);
    expect(result.reason).toContain("hash mismatch");
  });

  it("reports the correct brokenBlockIndex for a mismatch deep in the chain", () => {
    const blocks = buildValidChain(5);
    const tampered = { ...blocks[3], details: { summary: "mid-chain tamper" } };
    const result: ChainVerificationResult = verifyAuditChain([
      blocks[0],
      blocks[1],
      blocks[2],
      tampered,
      blocks[4],
    ]);
    expect(result.verified).toBe(false);
    expect(result.brokenBlockIndex).toBe(3);
  });
});

import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { generateAuditHash } from "@/lib/crypto";
import { db } from "@/server/db";
import { auditLogs } from "@/server/schema";

export const dynamic = "force-dynamic";

export interface ChainVerificationResult {
  verified: boolean;
  blockCount: number;
  brokenBlockIndex: number | null;
  reason?: string;
  lastHash?: string | null;
}

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

  const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let mandateId = searchParams.get("mandateId");

    // If no mandateId specified, pick the first active mandate
    if (!mandateId) {
      const firstMandate = await db.query.mandates.findFirst({
        orderBy: (mandates, { desc }) => [desc(mandates.createdAt)],
      });
      mandateId = firstMandate?.id ?? null;
    }

    if (!mandateId) {
      return NextResponse.json({
        verified: true,
        blockCount: 0,
        brokenBlockIndex: null,
        message: "No mandates found in system",
      });
    }

    const logs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.mandateId, mandateId),
      orderBy: [asc(auditLogs.createdAt)],
    });

    const verification = verifyAuditChain(logs);

    return NextResponse.json({
      mandateId,
      ...verification,
    });
  } catch (error) {
    console.error("Chain verification error:", error);
    return NextResponse.json(
      { error: "Internal server error during chain verification" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mandateId = body.mandateId;

    if (!mandateId) {
      return NextResponse.json({ error: "mandateId is required in request body" }, { status: 400 });
    }

    const logs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.mandateId, mandateId),
      orderBy: [asc(auditLogs.createdAt)],
    });

    const verification = verifyAuditChain(logs);

    return NextResponse.json({
      mandateId,
      ...verification,
    });
  } catch (error) {
    console.error("Chain verification error:", error);
    return NextResponse.json(
      { error: "Internal server error during chain verification" },
      { status: 500 },
    );
  }
}

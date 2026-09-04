import crypto from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { canonicalStringify } from "@/lib/crypto";
import { db } from "@/server/db";
import { anchors, auditLogs, mandates } from "@/server/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mandateId = searchParams.get("mandateId");
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);

    const rows = await db.query.anchors.findMany({
      where: mandateId ? eq(anchors.mandateId, mandateId) : undefined,
      orderBy: [desc(anchors.anchoredAt)],
      limit: Math.min(limit, 100),
    });

    return NextResponse.json({ anchors: rows });
  } catch (error) {
    console.error("Anchors GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve audit anchors" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mandateId = body.mandateId;

    if (!mandateId) {
      return NextResponse.json(
        { error: "mandateId is required to publish an anchor" },
        { status: 400 },
      );
    }

    // Verify mandate exists
    const mandate = await db.query.mandates.findFirst({
      where: eq(mandates.id, mandateId),
    });

    if (!mandate) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
    }

    // Fetch audit logs for mandate to get latest block and count
    const logs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.mandateId, mandateId),
      orderBy: [asc(auditLogs.createdAt)],
    });

    if (logs.length === 0) {
      return NextResponse.json(
        { error: "No audit logs exist for this mandate to anchor" },
        { status: 400 },
      );
    }

    const lastBlock = logs[logs.length - 1];
    const blockCount = logs.length;
    const lastBlockHash = lastBlock.currentHash;

    // Fetch previous anchor
    const lastAnchor = await db.query.anchors.findFirst({
      where: eq(anchors.mandateId, mandateId),
      orderBy: (anchors, { desc }) => [desc(anchors.anchoredAt)],
    });

    // If already anchored at the exact same block, return current anchor
    if (
      lastAnchor &&
      lastAnchor.lastBlockHash === lastBlockHash &&
      lastAnchor.blockCount === blockCount
    ) {
      return NextResponse.json({
        success: true,
        message: "Mandate audit chain is already anchored at current head",
        anchor: lastAnchor,
      });
    }

    const previousAnchorHash = lastAnchor
      ? lastAnchor.anchorHash
      : "0000000000000000000000000000000000000000000000000000000000000000";

    const timestamp = new Date();
    const payload = canonicalStringify({
      blockCount,
      lastBlockHash,
      mandateId,
      previousAnchorHash,
      timestamp: timestamp.toISOString(),
    });

    const anchorHash = crypto.createHash("sha256").update(payload).digest("hex");

    const [newAnchor] = await db
      .insert(anchors)
      .values({
        mandateId,
        anchorHash,
        previousAnchorHash,
        lastBlockHash,
        blockCount,
        anchoredAt: timestamp,
      })
      .returning();

    return NextResponse.json({
      success: true,
      anchor: newAnchor,
    });
  } catch (error) {
    console.error("Anchors POST error:", error);
    return NextResponse.json({ error: "Failed to publish audit anchor" }, { status: 500 });
  }
}

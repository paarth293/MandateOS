import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { publishAnchorForMandate } from "@/server/anchoring";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { anchors, mandates } from "@/server/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/anchors
 * Public read registry by design: anchors are the externally verifiable
 * checkpoints that third-party auditors query with zero credentials
 * (see threat model §3.2 "Merkle State Anchors"). Read access stays open;
 * only PUBLISHING is restricted to the mandate owner.
 */
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

/**
 * POST /api/anchors
 * Publishes an on-demand anchor. Requires an authenticated session and
 * ownership of the mandate — nobody may write anchors into another user's
 * audit chain (multi-tenancy consistency).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const mandateId = body.mandateId;

    if (!mandateId) {
      return NextResponse.json(
        { error: "mandateId is required to publish an anchor" },
        { status: 400 },
      );
    }

    // Ownership: the mandate must belong to the authenticated user.
    const mandate = await db.query.mandates.findFirst({
      where: eq(mandates.id, mandateId),
    });

    if (!mandate || mandate.userId !== user.id) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
    }

    const result = await publishAnchorForMandate(mandateId);

    if (!result.published && result.reason === "NO_AUDIT_BLOCKS") {
      return NextResponse.json(
        { error: "No audit logs exist for this mandate to anchor" },
        { status: 400 },
      );
    }

    if (!result.published && result.reason === "ALREADY_ANCHORED") {
      return NextResponse.json({
        success: true,
        message: "Mandate audit chain is already anchored at current head",
        anchor: result.anchor,
      });
    }

    return NextResponse.json({
      success: true,
      anchor: result.anchor,
    });
  } catch (error) {
    console.error("Anchors POST error:", error);
    return NextResponse.json({ error: "Failed to publish audit anchor" }, { status: 500 });
  }
}

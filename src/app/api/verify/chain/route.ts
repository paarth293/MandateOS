import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { type ChainVerificationResult, verifyAuditChain } from "@/lib/chain";
import { db } from "@/server/db";
import { auditLogs } from "@/server/schema";

export const dynamic = "force-dynamic";

export { type ChainVerificationResult, verifyAuditChain };

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

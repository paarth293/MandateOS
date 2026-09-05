import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { generateAuditHash, generateKeypair, signData } from "@/lib/crypto";
import { appendAuditBlock } from "@/server/audit";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { auditLogs, mandates } from "@/server/schema";
import { createMandateSchema, updateMandateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/mandates
 * Lists all mandates with their current status and spend parameters.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Multi-tenancy: only return mandates owned by the authenticated user.
    const list = await db.query.mandates.findMany({
      where: eq(mandates.userId, user.id),
      orderBy: [desc(mandates.createdAt)],
    });

    return NextResponse.json({ mandates: list });
  } catch (error) {
    console.error("GET /api/mandates error:", error);
    return NextResponse.json({ error: "Failed to fetch mandates" }, { status: 500 });
  }
}

/**
 * POST /api/mandates
 * Issues a new mandate, generates an Ed25519 keypair, and seeds the genesis audit block.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "VIEWER") {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot issue mandates" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = createMandateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid mandate parameters", details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const data = parseResult.data;

    // 1. Generate Ed25519 Keypair for cryptographic spend authorization
    const keypair = generateKeypair();
    const signature = signData(data.agentName, keypair.secretKey);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year validity

    // 2. Insert mandate into database
    const [newMandate] = await db
      .insert(mandates)
      .values({
        userId: user.id,
        agentName: data.agentName,
        publicKey: keypair.publicKey,
        signature,
        maxAmountPerTransaction: data.maxAmountPerTransaction,
        dailyLimitPaise: data.dailyLimitPaise,
        lifetimeLimitPaise: data.lifetimeLimitPaise,
        allowedCategories: data.allowedCategories,
        maxSilentRetries: data.maxSilentRetries,
        retryDelaySeconds: data.retryDelaySeconds,
        notifyUrl: data.notifyUrl,
        status: "ACTIVE",
        expiresAt,
      })
      .returning();

    // 3. Write Genesis Block to Cryptographic Audit Chain
    const genesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const auditDetails = {
      summary: `Mandate policy issued for agent ${data.agentName} by ${user.name}.`,
      confidenceScore: 1.0,
      publicKey: keypair.publicKey,
    };
    const currentHash = generateAuditHash("MANDATE_INITIALIZED", auditDetails, genesisHash);

    await db.insert(auditLogs).values({
      mandateId: newMandate.id,
      action: "MANDATE_INITIALIZED",
      details: auditDetails,
      previousHash: genesisHash,
      currentHash,
    });

    return NextResponse.json(
      {
        success: true,
        mandate: newMandate,
        credentials: {
          publicKey: keypair.publicKey,
          secretKey: keypair.secretKey,
          instructions:
            "Save this secret key securely. It will not be shown again and is required by the agent to sign purchase requests.",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/mandates error:", error);
    return NextResponse.json({ error: "Failed to create mandate" }, { status: 500 });
  }
}

/**
 * PATCH /api/mandates
 * Updates an existing mandate (status, spend limits, retries, etc.).
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "VIEWER") {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot modify mandates" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const id = searchParams.get("id") || body.id;

    if (!id) {
      return NextResponse.json(
        { error: "Mandate ID is required (via ?id= or request body)" },
        { status: 400 },
      );
    }

    const existing = await db.query.mandates.findFirst({
      where: eq(mandates.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
    }

    // Multi-tenancy: a user may only modify their own mandates.
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.status && ["ACTIVE", "REVOKED", "EXPIRED"].includes(body.status)) {
      updatePayload.status = body.status;
    }

    const validation = updateMandateSchema.safeParse(body);
    if (validation.success) {
      Object.assign(updatePayload, validation.data);
    }

    const [updated] = await db
      .update(mandates)
      .set(updatePayload)
      .where(eq(mandates.id, id))
      .returning();

    // If revoked, append a tamper-evident audit block
    if (body.status === "REVOKED" && existing.status !== "REVOKED") {
      await appendAuditBlock(id, "MANDATE_REVOKED", {
        summary: `Mandate policy ${id} was revoked. Agent purchases are now hard-blocked.`,
        confidenceScore: 1.0,
      });
    }

    return NextResponse.json({ success: true, mandate: updated });
  } catch (error) {
    console.error("PATCH /api/mandates error:", error);
    return NextResponse.json({ error: "Failed to update mandate" }, { status: 500 });
  }
}

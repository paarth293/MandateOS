import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { canonicalStringify, generateAuditHash, signData } from "@/lib/crypto";
import { db } from "@/server/db";
import { auditLogs, mandates } from "@/server/schema";

export const dynamic = "force-dynamic";

/**
 * Resolves the Ed25519 secret key used to sign export manifests.
 * Returns null when no key is configured: the export is then emitted as
 * explicitly UNSIGNED rather than silently "signed" with a hardcoded key
 * that anyone could read from source code (forgery risk).
 */
function getAgentSecretKey(): string | null {
  const keyPath = process.env.AGENT_KEY_PATH || path.resolve(process.cwd(), "agent.key");
  // Runtime-only file read (agent.key lives beside the running process, never
  // bundled): opt out of Turbopack's whole-project tracing for this call.
  if (fs.existsSync(/* turbopackIgnore: true */ keyPath)) {
    try {
      const key = fs.readFileSync(/* turbopackIgnore: true */ keyPath, "utf8").trim();
      if (key) return key;
    } catch (_e) {}
  }
  const envKey = process.env.AGENT_SECRET_KEY;
  return envKey && envKey.trim().length > 0 ? envKey.trim() : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mandateId = searchParams.get("mandateId");
    const format = (searchParams.get("format") || "json").toLowerCase();

    // 1. Fetch Mandate if specified
    let targetMandate = null;
    if (mandateId) {
      targetMandate = await db.query.mandates.findFirst({
        where: eq(mandates.id, mandateId),
      });
      if (!targetMandate) {
        return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
      }
    }

    // 2. Fetch all audit logs in chronological order
    const logs = await db.query.auditLogs.findMany({
      where: mandateId ? eq(auditLogs.mandateId, mandateId) : undefined,
      orderBy: [asc(auditLogs.createdAt)],
    });

    // 3. Cryptographic Chain Verification on export
    let isChainValid = true;
    let verifiedCount = 0;

    for (let i = 0; i < logs.length; i++) {
      const block = logs[i];
      const computedHash = generateAuditHash(
        block.action,
        block.details as Record<string, unknown>,
        block.previousHash,
      );

      if (computedHash !== block.currentHash) {
        isChainValid = false;
        break;
      }

      if (i > 0 && block.previousHash !== logs[i - 1].currentHash) {
        isChainValid = false;
        break;
      }

      verifiedCount++;
    }

    const headBlockHash =
      logs.length > 0
        ? logs[logs.length - 1].currentHash
        : "0000000000000000000000000000000000000000000000000000000000000000";

    // 4. Generate Tamper-Evident Export Manifest
    const timestamp = new Date().toISOString();
    const manifestBody = {
      exportedAt: timestamp,
      mandateId: mandateId || "ALL_MANDATES",
      agentName: targetMandate?.agentName || "System Wide",
      publicKey: targetMandate?.publicKey || "N/A",
      recordCount: logs.length,
      verifiedBlocks: verifiedCount,
      headBlockHash,
      chainIntegrity: isChainValid ? "VERIFIED_INTACT" : "INTEGRITY_COMPROMISED",
    };

    const manifestCanonical = canonicalStringify(manifestBody);
    const manifestHash = crypto.createHash("sha256").update(manifestCanonical).digest("hex");

    // Sign manifest hash with Ed25519 key (only when a real key is configured)
    let manifestSignature: string | null = null;
    let signatureStatus: "SIGNED" | "UNSIGNED" = "UNSIGNED";
    const secretKey = getAgentSecretKey();
    if (secretKey) {
      try {
        manifestSignature = signData(manifestHash, secretKey);
        signatureStatus = "SIGNED";
      } catch (_e) {
        // Leave UNSIGNED rather than emitting a forged signature.
        manifestSignature = null;
      }
    }

    const exportManifest = {
      ...manifestBody,
      manifestHash,
      signatureAlgorithm: "Ed25519",
      signature: manifestSignature,
      signatureStatus,
    };

    // 5. Format response as CSV or JSON
    if (format === "csv") {
      const csvHeader =
        "# MandateOS Tamper-Evident Signed Audit Chain Export\n" +
        `# Manifest Hash: ${manifestHash}\n` +
        `# Signature: ${manifestSignature ?? "UNSIGNED"}\n` +
        `# Signature Status: ${signatureStatus}\n` +
        `# Exported At: ${timestamp}\n` +
        `# Chain Integrity: ${isChainValid ? "VERIFIED_INTACT" : "INTEGRITY_COMPROMISED"}\n` +
        "index,id,mandate_id,transaction_id,action,previous_hash,current_hash,details_json,created_at\n";

      const csvRows = logs.map((log, idx) => {
        const detailsEscaped = `"${JSON.stringify(log.details).replace(/"/g, '""')}"`;
        return [
          idx + 1,
          log.id,
          log.mandateId,
          log.transactionId || "",
          log.action,
          log.previousHash,
          log.currentHash,
          detailsEscaped,
          log.createdAt.toISOString(),
        ].join(",");
      });

      const csvContent = csvHeader + csvRows.join("\n");
      const filename = `mandate-chain-${mandateId ? mandateId.slice(0, 8) : "all"}-${Date.now()}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "x-manifest-hash": manifestHash,
          "x-chain-signature": manifestSignature ?? "UNSIGNED",
          "x-chain-signature-status": signatureStatus,
        },
      });
    }

    // Default JSON format
    const filename = `mandate-chain-${mandateId ? mandateId.slice(0, 8) : "all"}-${Date.now()}.json`;

    return new NextResponse(
      JSON.stringify(
        {
          manifest: exportManifest,
          records: logs,
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "x-manifest-hash": manifestHash,
          "x-chain-signature": manifestSignature ?? "UNSIGNED",
          "x-chain-signature-status": signatureStatus,
        },
      },
    );
  } catch (error) {
    console.error("Audit chain export error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed audit chain export" },
      { status: 500 },
    );
  }
}

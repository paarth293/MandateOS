import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { getUserMandateIds } from "@/server/authz";
import { db } from "@/server/db";
import { auditLogs, mandates, transactions } from "@/server/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let user: Awaited<ReturnType<typeof requireUser>>;
    try {
      user = await requireUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Multi-tenancy: scope every dataset to the user's own mandates.
    const mandateIds = await getUserMandateIds(user.id);

    const activeMandates = await db.query.mandates.findMany({
      where: inArray(mandates.id, mandateIds),
      orderBy: [desc(mandates.createdAt)],
    });

    const recentTransactions = await db.query.transactions.findMany({
      where: inArray(transactions.mandateId, mandateIds),
      orderBy: [desc(transactions.createdAt)],
      limit: 50,
    });

    const secureAuditLogs = await db.query.auditLogs.findMany({
      where: inArray(auditLogs.mandateId, mandateIds),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 20,
    });

    return NextResponse.json({
      mandates: activeMandates,
      transactions: recentTransactions,
      auditLogs: secureAuditLogs,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}

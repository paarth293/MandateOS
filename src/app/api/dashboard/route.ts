import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { auditLogs, mandates, transactions } from "@/server/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    try {
      await requireUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeMandates = await db.query.mandates.findMany({
      orderBy: [desc(mandates.createdAt)],
    });

    const recentTransactions = await db.query.transactions.findMany({
      orderBy: [desc(transactions.createdAt)],
      limit: 50,
    });

    const secureAuditLogs = await db.query.auditLogs.findMany({
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

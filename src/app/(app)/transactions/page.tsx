import { desc, eq, inArray } from "drizzle-orm";
import { ArrowUpRight, CheckCircle2, Clock, Receipt, RefreshCcw, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { getSessionUser } from "@/server/auth";
import { getUserMandateIds } from "@/server/authz";
import { db } from "@/server/db";
import { mandates, transactions } from "@/server/schema";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  // Multi-tenancy: only the authenticated user's own transactions.
  const mandateIds = await getUserMandateIds(user.id);

  const txsWithMandates = await db
    .select({
      transaction: transactions,
      mandate: mandates,
    })
    .from(transactions)
    .leftJoin(mandates, eq(transactions.mandateId, mandates.id))
    .where(inArray(transactions.mandateId, mandateIds))
    .orderBy(desc(transactions.createdAt))
    .limit(100);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return { color: "text-green-700 bg-green-50 ring-green-600/20", icon: CheckCircle2 };
      case "ORDER_CREATED":
        return { color: "text-amber-700 bg-amber-50 ring-amber-600/20", icon: Clock };
      case "FAILED":
        return { color: "text-red-700 bg-red-50 ring-red-600/10", icon: XCircle };
      case "RECOVERED":
        return { color: "text-blue-700 bg-blue-50 ring-blue-600/20", icon: RefreshCcw };
      default:
        return { color: "text-slate-700 bg-slate-50 ring-slate-600/20", icon: ArrowUpRight };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="h-7 w-7 text-blue-600" />
            Transactions Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive history of all agent purchases and recovery attempts.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Transaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Reason / Retry
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {txsWithMandates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                txsWithMandates.map(({ transaction: tx, mandate }) => {
                  const display = getStatusDisplay(tx.status);
                  const Icon = display.icon;
                  const date = new Date(tx.createdAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-medium text-slate-900">
                            {tx.id.substring(0, 8)}...
                          </span>
                          <span className="text-xs text-slate-500">{date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">
                          {mandate?.agentName || "Unknown"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${display.color}`}
                        >
                          <Icon className="mr-1 h-3.5 w-3.5" />
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          {tx.failureReason ? (
                            <span
                              className="text-xs text-red-600 max-w-[200px] truncate"
                              title={tx.failureReason}
                            >
                              {tx.failureReason}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                          {tx.retryCount > 0 && (
                            <span className="text-xs text-slate-500 mt-0.5">
                              Retries: {tx.retryCount}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

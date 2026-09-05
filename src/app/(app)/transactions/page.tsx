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
        return {
          color: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20",
          icon: CheckCircle2,
        };
      case "ORDER_CREATED":
        return { color: "text-amber-400 bg-amber-500/10 ring-amber-600/20", icon: Clock };
      case "FAILED":
        return { color: "text-rose-400 bg-rose-500/10 ring-rose-500/10", icon: XCircle };
      case "RECOVERED":
        return { color: "text-indigo-300 bg-indigo-500/10 ring-indigo-500/20", icon: RefreshCcw };
      default:
        return {
          color: "text-slate-200 bg-slate-900/60/[0.03] ring-slate-600/20",
          icon: ArrowUpRight,
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Receipt className="h-7 w-7 text-indigo-400" />
            Transactions Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive history of all agent purchases and recovery attempts.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-slate-900/60/[0.03]">
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
            <tbody className="bg-slate-900/60 divide-y divide-white/10">
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
                    <tr key={tx.id} className="hover:bg-slate-900/60/[0.03] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-medium text-white">
                            {tx.id.substring(0, 8)}...
                          </span>
                          <span className="text-xs text-slate-500">{date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-white">
                          {mandate?.agentName || "Unknown"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-white">
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
                              className="text-xs text-rose-400 max-w-[200px] truncate"
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

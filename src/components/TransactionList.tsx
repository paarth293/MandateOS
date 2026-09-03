"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, RefreshCcw, XCircle } from "lucide-react";

export interface Transaction {
  id: string;
  amount: number;
  status: string;
  failureReason: string | null;
  retryCount: number;
  createdAt: string | Date;
}

interface TransactionListProps {
  transactions: Transaction[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return { color: "text-green-700 bg-green-50 ring-green-600/20", icon: CheckCircle2 };
      case "FAILED":
        return { color: "text-red-700 bg-red-50 ring-red-600/10", icon: XCircle };
      case "RECOVERED":
        return { color: "text-blue-700 bg-blue-50 ring-blue-600/20", icon: RefreshCcw };
      default:
        return { color: "text-slate-700 bg-slate-50 ring-slate-600/20", icon: ArrowUpRight };
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4">
        <h3 className="font-semibold text-slate-900">Recent Agent Transactions</h3>
      </div>

      <ul className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
        {transactions.length === 0 ? (
          <li className="px-6 py-8 text-center text-sm text-slate-500">
            No transactions found for this agent yet.
          </li>
        ) : (
          <AnimatePresence initial={false}>
            {transactions.map((tx) => {
              const display = getStatusDisplay(tx.status);
              const Icon = display.icon;

              const formattedAmount = (tx.amount / 100).toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
              });

              const date = new Date(tx.createdAt).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <motion.li
                  key={tx.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-medium text-slate-900">
                      {tx.id.substring(0, 14)}...
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      {date} {tx.failureReason && `• ${tx.failureReason}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-slate-900">{formattedAmount}</span>

                    <motion.span
                      key={tx.status}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${display.color}`}
                    >
                      <Icon className="mr-1 h-3.5 w-3.5" />
                      {tx.status}
                      {tx.retryCount > 0 && ` (${tx.retryCount})`}
                    </motion.span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        )}
      </ul>
    </div>
  );
}

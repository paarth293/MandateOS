"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Clock, RefreshCcw, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
        return {
          color: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
          icon: CheckCircle2,
        };
      case "ORDER_CREATED":
        return { color: "text-amber-300 bg-amber-500/10 ring-amber-500/20", icon: Clock };
      case "FAILED":
        return { color: "text-rose-300 bg-rose-500/10 ring-rose-500/20", icon: XCircle };
      case "RECOVERED":
        return { color: "text-indigo-300 bg-indigo-500/10 ring-indigo-500/20", icon: RefreshCcw };
      default:
        return { color: "text-slate-300 bg-white/[0.05] ring-white/10", icon: ArrowUpRight };
    }
  };

  return (
    <div className="mos-card overflow-hidden">
      <div className="border-b border-white/10 bg-white/[0.02] px-6 py-4">
        <h3 className="font-semibold text-white">Recent Agent Transactions</h3>
      </div>

      <ul className="divide-y divide-white/[0.06] max-h-[500px] overflow-y-auto">
        {transactions.length === 0 ? (
          <li className="px-6 py-8 text-center text-sm text-slate-500">
            No transactions found for this agent yet.
          </li>
        ) : (
          <AnimatePresence initial={false}>
            {transactions.map((tx) => {
              const display = getStatusDisplay(tx.status);
              const Icon = display.icon;

              const formattedAmount = formatCurrency(tx.amount);

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
                  className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-medium text-slate-200">
                      {tx.id.substring(0, 14)}...
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      {date} {tx.failureReason && `• ${tx.failureReason}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-white">{formattedAmount}</span>

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

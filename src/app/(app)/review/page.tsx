"use client";

import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  RefreshCw,
  RotateCw,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface QuarantinedTransaction {
  id: string;
  mandateId: string;
  amount: number;
  status: string;
  failureReason: string | null;
  retryCount: number;
  razorpayOrderId: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  mandate?: {
    agentName: string;
    allowedCategories: string[];
    maxSilentRetries: number;
  };
}

export default function ReviewQueuePage() {
  const [items, setItems] = useState<QuarantinedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "reviewed" | "all">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/review?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load review items:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAction = async (
    transactionId: string,
    action: "ACKNOWLEDGE" | "APPROVE_RETRY" | "DISMISS",
  ) => {
    setProcessingId(transactionId);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, action }),
      });

      if (res.ok) {
        const _data = await res.json();
        setSuccessMessage(
          action === "APPROVE_RETRY"
            ? "Retry approved! Autonomous Inngest recovery workflow re-dispatched."
            : "Incident acknowledged and marked reviewed.",
        );
        setTimeout(() => setSuccessMessage(null), 4000);
        fetchItems();
      }
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = items.filter((i) => !i.reviewedAt).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-amber-400" />
            Human Review & Quarantine Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and resolve transactions quarantined after exhausting autonomous retries, policy
            breaches, or gateway failures.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchItems}
          title="Refresh review queue"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-xs hover:bg-slate-900/60/[0.03] transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Queue
        </button>
      </div>

      {successMessage && (
        <div className="rounded-lg bg-emerald-500/10 p-4 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Pending Review</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{pendingCount}</p>
          <p className="text-xs text-slate-400 mt-1">Awaiting human sign-off</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Quarantine Protection</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">Active</p>
          <p className="text-xs text-slate-400 mt-1">Exhausted retries halted automatically</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Recovery Channel</span>
            <RotateCw className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">Inngest-Backed</p>
          <p className="text-xs text-slate-400 mt-1">Approved retries resume state machine</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filter === "pending"
              ? "bg-amber-500/15 text-amber-400"
              : "text-slate-300 hover:bg-slate-900/60/[0.06]"
          }`}
        >
          Pending Review ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("reviewed")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filter === "reviewed"
              ? "bg-slate-900 text-white"
              : "text-slate-300 hover:bg-slate-900/60/[0.06]"
          }`}
        >
          Acknowledged
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filter === "all"
              ? "bg-slate-900 text-white"
              : "text-slate-300 hover:bg-slate-900/60/[0.06]"
          }`}
        >
          All Incidents
        </button>
      </div>

      {/* Incident List */}
      <div className="rounded-xl border border-white/10 bg-slate-900/60 shadow-xs overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Loading quarantine records...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
            No quarantined transactions in this queue. Everything is running smoothly!
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {items.map((tx) => {
              const isReviewed = Boolean(tx.reviewedAt);
              const isProcessing = processingId === tx.id;

              return (
                <div key={tx.id} className="p-6 hover:bg-slate-900/60/[0.03] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-white">
                          {formatCurrency(tx.amount)}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
                          {tx.failureReason || "QUARANTINED"}
                        </span>
                        {isReviewed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                            <Check className="h-3 w-3" /> Reviewed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
                            <Clock className="h-3 w-3" /> Awaiting Review
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500">
                        Agent:{" "}
                        <strong className="text-slate-200">
                          {tx.mandate?.agentName || "Autonomous Agent"}
                        </strong>{" "}
                        &bull; Retries Attempted: <strong>{tx.retryCount}</strong>
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">Tx ID: {tx.id}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!isReviewed ? (
                        <>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleAction(tx.id, "APPROVE_RETRY")}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-600 transition disabled:opacity-50"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            Approve Retry
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleAction(tx.id, "ACKNOWLEDGE")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900/60/[0.03] transition disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Acknowledge
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Acknowledged at {new Date(tx.reviewedAt!).toLocaleDateString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Incident Diagnosis Box */}
                  <div className="mt-4 rounded-lg bg-amber-500/10 p-3 border border-amber-500/20 text-xs text-amber-400 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-semibold">Autonomous Guardrail Notice</p>
                      <p className="mt-0.5 text-amber-400 leading-relaxed">
                        Transaction was quarantined to prevent duplicate charges or cascading bank
                        failures. Approving retry will reset the retry counter and safely resume
                        execution through Inngest.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

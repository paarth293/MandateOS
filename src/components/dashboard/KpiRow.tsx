"use client";

import { CheckCircle2, DollarSign, RefreshCw, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface AnalyticsSummary {
  totalSettledPaise: number;
  totalTransactions: number;
  successCount: number;
  recoveredCount: number;
  failedCount: number;
  blockedAttemptsCount: number;
  blockedVolumePaise: number;
  recoveredVolumePaise: number;
  recoveryRatePercent: number;
}

interface KpiRowProps {
  summary: AnalyticsSummary;
}

export default function KpiRow({ summary }: KpiRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Settled Volume */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Settled Spend</span>
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <DollarSign className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          {formatCurrency(summary.totalSettledPaise)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Across {summary.totalTransactions} agent transaction
          {summary.totalTransactions === 1 ? "" : "s"}
        </p>
      </div>

      {/* 2. Blocked Policy Volume (Firewall Saved) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Firewall Intercepted</span>
          <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
            <ShieldAlert className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-rose-600">
          {formatCurrency(summary.blockedVolumePaise)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {summary.blockedAttemptsCount} malicious/cap breach
          {summary.blockedAttemptsCount === 1 ? "" : "es"} blocked
        </p>
      </div>

      {/* 3. Autonomous Recovery Rate */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Autonomous Recovery</span>
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <RefreshCw className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {summary.recoveryRatePercent}%
          </span>
          <span className="text-xs text-emerald-600 font-medium">
            {formatCurrency(summary.recoveredVolumePaise)} saved
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {summary.recoveredCount} silent recoveries, {summary.failedCount} quarantined
        </p>
      </div>

      {/* 4. Policy Health */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Policy Health</span>
          <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          {summary.successCount + summary.recoveredCount} Valid
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {summary.failedCount === 0
            ? "Zero unhandled faults"
            : `${summary.failedCount} awaiting review`}
        </p>
      </div>
    </div>
  );
}

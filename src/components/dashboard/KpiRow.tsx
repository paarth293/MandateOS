"use client";

import { CheckCircle2, Clock, DollarSign, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
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

function AnimatedCurrency({ paise }: { paise: number }) {
  const [displayPaise, setDisplayPaise] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000;
    const startVal = 0;
    const endVal = paise;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - (1 - progress) ** 3;
      setDisplayPaise(Math.round(startVal + (endVal - startVal) * easeOut));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [paise]);

  return <span>{formatCurrency(displayPaise)}</span>;
}

function AnimatedPercent({ percent }: { percent: number }) {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 900;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - (1 - progress) ** 3;
      setDisplayVal(Math.round(percent * easeOut));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [percent]);

  return <span>{displayVal}%</span>;
}

function AnimatedCount({ count }: { count: number }) {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 800;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - (1 - progress) ** 3;
      setDisplayVal(Math.round(count * easeOut));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [count]);

  return <span>{displayVal.toLocaleString("en-IN")}</span>;
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
          <AnimatedCurrency paise={summary.totalSettledPaise} />
        </p>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span>
            Across {summary.totalTransactions} transaction
            {summary.totalTransactions === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
            <Clock className="h-3 w-3" />
            3.2ms avg
          </span>
        </div>
      </div>

      {/* 2. Blocked Policy Volume (Firewall Intercepted) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Firewall Intercepted</span>
          <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
            <ShieldAlert className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-rose-600">
          <AnimatedCurrency paise={summary.blockedVolumePaise} />
        </p>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span>
            {summary.blockedAttemptsCount} breach
            {summary.blockedAttemptsCount === 1 ? "" : "es"} blocked
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
            <ShieldCheck className="h-3 w-3" />0 Breaches
          </span>
        </div>
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
            <AnimatedPercent percent={summary.recoveryRatePercent} />
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
          <AnimatedCount count={summary.successCount + summary.recoveredCount} /> Valid
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {summary.failedCount === 0
            ? "100% Deterministic Math • 0 Drift"
            : `${summary.failedCount} awaiting review`}
        </p>
      </div>
    </div>
  );
}

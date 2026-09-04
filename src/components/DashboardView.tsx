"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import AuditTrail from "@/components/AuditTrail";
import ChaosConsole from "@/components/ChaosConsole";
import BudgetBars, { type AgentMetric } from "@/components/dashboard/BudgetBars";
import CategoryDonut, { type CategoryStat } from "@/components/dashboard/CategoryDonut";
import HealthStrip from "@/components/dashboard/HealthStrip";
import KpiRow, { type AnalyticsSummary } from "@/components/dashboard/KpiRow";
import VolumeChart, { type DailyVolumePoint } from "@/components/dashboard/VolumeChart";
import MandateCard from "@/components/MandateCard";
import TransactionList from "@/components/TransactionList";

interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DashboardViewProps {
  user: DashboardUser;
}

interface MandateData {
  id: string;
  agentName: string;
  maxAmountPerTransaction: number;
  maxSilentRetries: number;
  allowedCategories: string[];
  status: string;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  dailyVolume: DailyVolumePoint[];
  categoryStats: CategoryStat[];
  agentMetrics: AgentMetric[];
}

async function fetchDashboardData() {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const res = await fetch("/api/analytics");
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export default function DashboardView({ user }: DashboardViewProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    refetchInterval: 2000,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalyticsData,
    refetchInterval: 3000,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        Error loading dashboard data. Make sure your database is running!
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. System Health Strip */}
      <HealthStrip />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Agent Financial Command Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cryptographically bounded policy firewall & recovery operations for autonomous AI.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          Operator:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{user.name}</span> (
          {user.role})
        </div>
      </div>

      {/* 2. Operations KPI Row */}
      {analyticsData?.summary && <KpiRow summary={analyticsData.summary} />}

      {/* 3. Analytics Visualizations Grid */}
      {analyticsData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VolumeChart data={analyticsData.dailyVolume} />
          </div>
          <div className="lg:col-span-1">
            <CategoryDonut data={analyticsData.categoryStats} />
          </div>
        </div>
      )}

      {/* 4. Per-Agent Budget Utilization Bars */}
      {analyticsData?.agentMetrics && <BudgetBars agents={analyticsData.agentMetrics} />}

      {/* 5. Chaos Injection Console */}
      {data.mandates.length > 0 && <ChaosConsole activeMandateId={data.mandates[0].id} />}

      {/* 6. Active Policies Summary */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          Provisioned Agent Policies
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.mandates.map((mandate: MandateData) => (
            <MandateCard key={mandate.id} mandate={mandate} />
          ))}
        </div>
      </section>

      {/* 7. Event Stream & Cryptographic Audit Chain */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Live Transaction Feed
          </h2>
          <TransactionList transactions={data.transactions} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Cryptographic Audit Chain
          </h2>
          <AuditTrail logs={data.auditLogs} />
        </div>
      </section>
    </div>
  );
}

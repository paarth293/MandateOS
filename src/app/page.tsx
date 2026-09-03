"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import AuditTrail from "@/components/AuditTrail";
import ChaosConsole from "@/components/ChaosConsole";
import MandateCard from "@/components/MandateCard";
import TransactionList from "@/components/TransactionList";

async function fetchDashboardData() {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    refetchInterval: 2000,
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {data.mandates.length > 0 && <ChaosConsole activeMandateId={data.mandates[0].id} />}

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Active Agent Policies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.mandates.map((mandate: any) => (
            <MandateCard key={mandate.id} mandate={mandate} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Live Transaction Feed</h2>
          <TransactionList transactions={data.transactions} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Security Verification</h2>
          <AuditTrail logs={data.auditLogs} />
        </div>
      </section>
    </div>
  );
}

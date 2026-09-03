// src/app/page.tsx
"use client"; // We need this because useQuery is a React hook!

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import AuditTrail from "@/components/AuditTrail";
import MandateCard from "@/components/MandateCard";
import TransactionList from "@/components/TransactionList";

// 1. THE FETCH FUNCTION
// This simple function hits the BFF (Backend-For-Frontend) API we built in Phase 7.
async function fetchDashboardData() {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export default function Dashboard() {
  // 2. THE SMART HOOK
  // React Query handles loading states, error states, and background polling for us automatically.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    refetchInterval: 2000, // MAGIC: Silently update the UI every 2 seconds!
  });

  // 3. HANDLING LOADING & ERRORS
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

  // 4. RENDERING THE DUMB COMPONENTS
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Section: Active Mandates */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Active Agent Policies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* We map over the mandates and stamp out a card for each one */}
          {data.mandates.map((mandate: any) => (
            <MandateCard key={mandate.id} mandate={mandate} />
          ))}
        </div>
      </section>

      {/* Bottom Section: 2-Column Grid for Transactions and Audit Log */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Live Transaction Feed</h2>
          <TransactionList transactions={data.transactions} />
        </div>

        {/* Right Column */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Security Verification</h2>
          <AuditTrail logs={data.auditLogs} />
        </div>
      </section>
    </div>
  );
}

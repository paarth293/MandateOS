"use client";

import { useQuery } from "@tanstack/react-query";
import { Cpu, Database, Server, ShieldCheck } from "lucide-react";

interface HealthData {
  status: "HEALTHY" | "DEGRADED";
  uptimeSeconds: number;
  checkLatencyMs: number;
  services: {
    database: {
      status: string;
      latencyMs: number;
      provider: string;
    };
    gateway: {
      status: string;
      mode: string;
      configured: boolean;
    };
    inngest: {
      status: string;
      appId: string;
    };
    policyEngine: {
      status: string;
      replayShield: string;
      signatureAlgorithm: string;
      auditVerification: string;
    };
  };
}

async function fetchHealth(): Promise<HealthData> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export default function HealthStrip() {
  const { data, isError } = useQuery({
    queryKey: ["system-health"],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
  });

  const isHealthy = !isError && data?.status === "HEALTHY";

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* System Status Indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                isHealthy ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                isHealthy ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </span>
          <span className="font-bold uppercase tracking-wider text-slate-900">
            {isHealthy ? "All Systems Operational" : "System Degraded"}
          </span>
        </div>

        {/* Database */}
        <div className="flex items-center gap-1.5 text-slate-600">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          <span>Postgres:</span>
          <span className="font-mono font-medium text-slate-900">
            {data?.services.database.latencyMs ?? 0}ms
          </span>
        </div>

        {/* Gateway */}
        <div className="flex items-center gap-1.5 text-slate-600">
          <Server className="h-3.5 w-3.5 text-slate-400" />
          <span>Gateway:</span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 uppercase">
            {data?.services.gateway.mode ?? "mock"}
          </span>
        </div>

        {/* Policy Firewall */}
        <div className="flex items-center gap-1.5 text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Trust:</span>
          <span className="font-mono text-slate-900">
            {data?.services.policyEngine.signatureAlgorithm ?? "Ed25519"}
          </span>
        </div>

        {/* Orchestrator */}
        <div className="flex items-center gap-1.5 text-slate-600">
          <Cpu className="h-3.5 w-3.5 text-purple-600" />
          <span>Recovery:</span>
          <span className="font-mono text-slate-900">Inngest v4</span>
        </div>
      </div>
    </div>
  );
}

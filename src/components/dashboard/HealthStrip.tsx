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
    <div className="mos-card px-4 py-3">
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
          <span className="font-bold uppercase tracking-wider text-slate-100">
            {isHealthy ? "All Systems Operational" : "System Degraded"}
          </span>
        </div>

        {/* Database */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <Database className="h-3.5 w-3.5 text-slate-500" />
          <span>Postgres:</span>
          <span className="font-mono font-medium text-slate-200">
            {data?.services.database.latencyMs ?? 0}ms
          </span>
        </div>

        {/* Gateway */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <Server className="h-3.5 w-3.5 text-slate-500" />
          <span>Gateway:</span>
          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-300 uppercase">
            {data?.services.gateway.mode ?? "mock"}
          </span>
        </div>

        {/* Policy Firewall */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Trust:</span>
          <span className="font-mono text-slate-200">
            {data?.services.policyEngine.signatureAlgorithm ?? "Ed25519"}
          </span>
        </div>

        {/* Orchestrator */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <Cpu className="h-3.5 w-3.5 text-violet-400" />
          <span>Recovery:</span>
          <span className="font-mono text-slate-200">Inngest v4</span>
        </div>
      </div>
    </div>
  );
}

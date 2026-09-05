"use client";

import {
  AlertOctagon,
  CheckCircle2,
  Flame,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface StreamEvent {
  id: string;
  type: "PURCHASE_ATTEMPT" | "TRANSACTION_UPDATE";
  amountPaise: number;
  category?: string;
  outcome?: string; // ALLOWED, BLOCKED, REPLAY
  reason?: string;
  status?: string;
  createdAt: string;
}

export default function ArenaPage() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [allowedCount, setAllowedCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const [circuitBreakerState, setCircuitBreakerState] = useState<"CLOSED" | "OPEN" | "HALF_OPEN">(
    "CLOSED",
  );

  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource("/api/events/stream");

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.addEventListener("attempt", (e) => {
        try {
          const item = JSON.parse(e.data);
          setEvents((prev) => [item, ...prev.slice(0, 49)]);

          if (item.outcome === "ALLOWED") {
            setAllowedCount((c) => c + 1);
          } else if (item.reason?.includes("REPLAY")) {
            setReplayCount((c) => c + 1);
          } else {
            setBlockedCount((c) => c + 1);
          }
        } catch (_err) {}
      });

      eventSource.addEventListener("transaction", (e) => {
        try {
          const item = JSON.parse(e.data);
          setEvents((prev) => [item, ...prev.slice(0, 49)]);
        } catch (_err) {}
      });

      eventSource.onerror = () => {
        setConnected(false);
      };
    } catch (_err) {
      setConnected(false);
    }

    // Check circuit breaker status periodically
    const checkCircuit = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          if (data.services?.gateway?.status) {
            setCircuitBreakerState(
              data.services.gateway.status === "OPERATIONAL" ? "CLOSED" : "OPEN",
            );
          }
        }
      } catch (_e) {}
    };

    checkCircuit();
    const interval = setInterval(checkCircuit, 5000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-950/80 border border-blue-600/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-950/50">
            <Swords className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Security Battle Arena
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-800/60">
                <Radio
                  className={`h-3 w-3 ${connected ? "text-emerald-400 animate-pulse" : "text-slate-500"}`}
                />
                {connected ? "LIVE SSE STREAM" : "CONNECTING..."}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live cryptographic policy evaluation, nonce replay interception & autonomous gateway
              resilience.
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-emerald-950 bg-emerald-950/20 px-3 py-1.5 text-center">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 block">
              Authorized
            </span>
            <span className="text-lg font-bold text-emerald-300">{allowedCount}</span>
          </div>
          <div className="rounded-lg border border-rose-950 bg-rose-950/20 px-3 py-1.5 text-center">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-400 block">
              Blocked
            </span>
            <span className="text-lg font-bold text-rose-300">{blockedCount}</span>
          </div>
          <div className="rounded-lg border border-amber-950 bg-amber-950/20 px-3 py-1.5 text-center">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 block">
              Replays Defended
            </span>
            <span className="text-lg font-bold text-amber-300">{replayCount}</span>
          </div>
        </div>
      </div>

      {/* Arena Battlefield Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Stream Rail */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0D1424] p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              Live Security Telemetry Stream
            </h2>
            <span className="text-xs font-mono text-slate-500">Auto-tailing recent verdicts</span>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-500 font-mono">
                Awaiting incoming signed agent purchase events...
                <br />
                {!connected ? (
                  <span className="text-amber-400/90 mt-2 inline-block">
                    Stream requires an authenticated session — the events you see are scoped to your
                    own mandates.
                  </span>
                ) : (
                  <span className="text-slate-600 mt-1 inline-block">
                    Run <code className="text-blue-400">npm run agent:simulate</code> in your
                    terminal to trigger live attacks.
                  </span>
                )}
              </div>
            ) : (
              events.map((evt) => {
                const isAllowed = evt.outcome === "ALLOWED";
                const isReplay = evt.reason?.includes("REPLAY");

                return (
                  <div
                    key={evt.id}
                    className={`rounded-lg border p-3 transition-all ${
                      isAllowed
                        ? "border-emerald-950/80 bg-emerald-950/20"
                        : isReplay
                          ? "border-amber-950/80 bg-amber-950/20"
                          : "border-rose-950/80 bg-rose-950/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isAllowed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : isReplay ? (
                          <ShieldAlert className="h-4 w-4 text-amber-400" />
                        ) : (
                          <AlertOctagon className="h-4 w-4 text-rose-400" />
                        )}
                        <span className="font-semibold text-xs text-slate-200">
                          {isAllowed
                            ? "POLICY VERDICT: ALLOWED"
                            : isReplay
                              ? "REPLAY ATTACK INTERCEPTED"
                              : "POLICY FIREWALL BLOCKED"}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-slate-400">
                        {evt.amountPaise ? formatCurrency(evt.amountPaise) : "-"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Category: {evt.category || "General"}</span>
                      {evt.reason && (
                        <span className="text-rose-400 truncate max-w-[280px]">{evt.reason}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Col: Defensive Perimeter State */}
        <div className="space-y-6">
          {/* Gateway Circuit Breaker */}
          <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-yellow-500" />
              Gateway Circuit Breaker
            </h3>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Breaker State</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                    circuitBreakerState === "CLOSED"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-rose-950 text-rose-400 border border-rose-800"
                  }`}
                >
                  {circuitBreakerState}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Protects upstream gateway (Razorpay) from cascade failures. Trips after 5
                consecutive faults.
              </p>
            </div>
          </div>

          {/* Cryptographic Trust Pillars */}
          <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Cryptographic Enforcements
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="text-slate-400">Signature Alg</span>
                <span className="font-mono text-emerald-400 font-semibold">Ed25519 Detached</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="text-slate-400">Replay Shield</span>
                <span className="font-mono text-blue-400 font-semibold">DB Unique Nonce</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="text-slate-400">Max Clock Drift</span>
                <span className="font-mono text-purple-400 font-semibold">±300 Seconds</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="text-slate-400">Audit Proof</span>
                <span className="font-mono text-amber-400 font-semibold">SHA-256 Chain</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

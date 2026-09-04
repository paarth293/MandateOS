"use client";

import {
  AlertOctagon,
  CheckCircle2,
  KeyRound,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  Swords,
  Zap,
} from "lucide-react";
import { useState } from "react";
import nacl from "tweetnacl";
import { formatCurrency } from "@/lib/utils";

interface ScenarioResult {
  scenarioId: string;
  status: number;
  outcome: "ALLOWED" | "BLOCKED" | "REPLAY" | "ERROR";
  reason?: string;
  latencyMs: number;
  timestamp: string;
}

interface AttackScenario {
  id: string;
  title: string;
  category: string;
  amountPaise: number;
  expectedVerdict:
    | "ALLOWED"
    | "POLICY_BLOCKED"
    | "REPLAY_INTERCEPTED"
    | "STALE_TIMESTAMP"
    | "SIGNATURE_REJECTED"
    | "GATEWAY_ERROR";
  description: string;
  anomalyType:
    | "NONE"
    | "CAP_BREACH"
    | "CATEGORY_HIJACK"
    | "NONCE_REPLAY"
    | "STALE_TIMESTAMP"
    | "TAMPERED_SIG"
    | "CHAOS_TIMEOUT"
    | "CHAOS_EXPIRED";
}

const SCENARIOS: AttackScenario[] = [
  {
    id: "legit-purchase",
    title: "1. Legitimate Purchase",
    category: "Cloud Servers",
    amountPaise: 25000, // ₹250
    expectedVerdict: "ALLOWED",
    description: "Approved category within limits with valid Ed25519 signature & fresh nonce.",
    anomalyType: "NONE",
  },
  {
    id: "cap-breach",
    title: "2. Single-Txn Cap Breach",
    category: "Cloud Servers",
    amountPaise: 1500000, // ₹15,000 (exceeds ₹5,000 single txn cap)
    expectedVerdict: "POLICY_BLOCKED",
    description: "Amount exceeds single-transaction cap defined in mandate spend policy.",
    anomalyType: "CAP_BREACH",
  },
  {
    id: "category-hijack",
    title: "3. Category Hijack (Luxury)",
    category: "Luxury Watches",
    amountPaise: 50000, // ₹500
    expectedVerdict: "POLICY_BLOCKED",
    description: "Agent attempts spending on unauthorized, non-whitelisted merchant category.",
    anomalyType: "CATEGORY_HIJACK",
  },
  {
    id: "nonce-replay",
    title: "4. Cryptographic Replay Attack",
    category: "Cloud Servers",
    amountPaise: 10000, // ₹100
    expectedVerdict: "REPLAY_INTERCEPTED",
    description: "Malicious actor replays previously captured signature and unique nonce.",
    anomalyType: "NONCE_REPLAY",
  },
  {
    id: "stale-timestamp",
    title: "5. Expired Clock Drift (>5m)",
    category: "Cloud Servers",
    amountPaise: 10000, // ₹100
    expectedVerdict: "STALE_TIMESTAMP",
    description: "Signature generated with stale timestamp older than 300s window.",
    anomalyType: "STALE_TIMESTAMP",
  },
  {
    id: "tampered-sig",
    title: "6. Forged Ed25519 Signature",
    category: "Cloud Servers",
    amountPaise: 10000, // ₹100
    expectedVerdict: "SIGNATURE_REJECTED",
    description: "Tampered cryptogram with mutated signature bytes failing verification.",
    anomalyType: "TAMPERED_SIG",
  },
  {
    id: "chaos-timeout",
    title: "7. Gateway Timeout (Bank 504)",
    category: "Cloud Servers",
    amountPaise: 50000, // ₹500
    expectedVerdict: "GATEWAY_ERROR",
    description: "Simulates upstream banking gateway timeout triggering autonomous retries.",
    anomalyType: "CHAOS_TIMEOUT",
  },
  {
    id: "chaos-expired",
    title: "8. Card Expired (Quarantine)",
    category: "Cloud Servers",
    amountPaise: 50000, // ₹500
    expectedVerdict: "GATEWAY_ERROR",
    description: "Simulates unrecoverable payment instrument fault escalating to human review.",
    anomalyType: "CHAOS_EXPIRED",
  },
];

const DEFAULT_MANDATE_ID = "00000000-0000-0000-0000-000000000003";
const DEFAULT_SECRET_KEY =
  "98fbea28cd0e3585684023ec1decae60ec0ef4d7060eb5cf8dac3b47103088a399be9a9d65d34abfe9af0bdb87ee3395c39a690e750969b48420ce2dee272254";

function hexToUint8(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function uint8ToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
  return `{${entries.join(",")}}`;
}

function generateClientUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sim_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
}

export default function AttackLibrary({ mandateId = DEFAULT_MANDATE_ID }: { mandateId?: string }) {
  const [selectedMandate, setSelectedMandate] = useState(mandateId);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET_KEY);
  const [showKey, setShowKey] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [results, setResults] = useState<Record<string, ScenarioResult>>({});
  const [lastReplayNonce, setLastReplayNonce] = useState<string | null>(null);
  const [lastReplaySig, setLastReplaySig] = useState<string | null>(null);

  const executeScenario = async (scenario: AttackScenario): Promise<ScenarioResult> => {
    const start = performance.now();
    const timestamp = Date.now();
    const nonce = `atk_${generateClientUuid()}`;

    try {
      if (scenario.anomalyType === "CHAOS_TIMEOUT" || scenario.anomalyType === "CHAOS_EXPIRED") {
        const failureReason =
          scenario.anomalyType === "CHAOS_TIMEOUT" ? "BANK_TIMEOUT" : "CARD_EXPIRED";

        const chaosRes = await fetch("/api/chaos/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mandateId: selectedMandate,
            failureReason,
          }),
        });

        const chaosData = await chaosRes.json().catch(() => ({}));
        const duration = Math.round(performance.now() - start);

        return {
          scenarioId: scenario.id,
          status: chaosRes.status,
          outcome: chaosRes.ok ? "ALLOWED" : "ERROR",
          reason: chaosData.message || chaosData.error || failureReason,
          latencyMs: duration,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      let requestNonce = nonce;
      let requestTimestamp = timestamp;

      if (scenario.anomalyType === "STALE_TIMESTAMP") {
        requestTimestamp = timestamp - 600_000; // 10 minutes ago
      }

      const canonicalPayload = canonicalStringify({
        amountPaise: scenario.amountPaise,
        category: scenario.category,
        mandateId: selectedMandate,
        nonce: requestNonce,
        timestamp: requestTimestamp,
      });

      let signature = "";
      try {
        const messageBytes = new TextEncoder().encode(canonicalPayload);
        const secretKeyBytes = hexToUint8(secretKey);
        const sigBytes = nacl.sign.detached(messageBytes, secretKeyBytes);
        signature = uint8ToHex(sigBytes);
      } catch (_err) {
        signature = "0000000000000000000000000000000000000000000000000000000000000000";
      }

      if (scenario.anomalyType === "NONCE_REPLAY") {
        if (lastReplayNonce && lastReplaySig) {
          requestNonce = lastReplayNonce;
          signature = lastReplaySig;
        } else {
          setLastReplayNonce(requestNonce);
          setLastReplaySig(signature);
        }
      } else if (scenario.anomalyType === "TAMPERED_SIG") {
        signature =
          "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
      } else {
        setLastReplayNonce(requestNonce);
        setLastReplaySig(signature);
      }

      const res = await fetch("/api/agent/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mandate-signature": signature,
          "x-timestamp": String(requestTimestamp),
          "x-nonce": requestNonce,
        },
        body: JSON.stringify({
          mandateId: selectedMandate,
          amountPaise: scenario.amountPaise,
          category: scenario.category,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const duration = Math.round(performance.now() - start);

      let outcome: "ALLOWED" | "BLOCKED" | "REPLAY" | "ERROR" = "ERROR";
      if (res.ok) {
        outcome = "ALLOWED";
      } else if (res.status === 409 || data.reason?.includes("REPLAY")) {
        outcome = "REPLAY";
      } else {
        outcome = "BLOCKED";
      }

      return {
        scenarioId: scenario.id,
        status: res.status,
        outcome,
        reason:
          data.reason || data.error || (res.ok ? "Authorized by MandateOS Firewall" : "Blocked"),
        latencyMs: duration,
        timestamp: new Date().toLocaleTimeString(),
      };
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - start);
      return {
        scenarioId: scenario.id,
        status: 500,
        outcome: "ERROR",
        reason: err instanceof Error ? err.message : "Network/Connection error",
        latencyMs: duration,
        timestamp: new Date().toLocaleTimeString(),
      };
    }
  };

  const handleRunSingle = async (scenario: AttackScenario) => {
    setRunningId(scenario.id);
    const res = await executeScenario(scenario);
    setResults((prev) => ({ ...prev, [scenario.id]: res }));
    setRunningId(null);
  };

  const handleRunAll = async () => {
    setIsBatchRunning(true);
    for (const scenario of SCENARIOS) {
      setRunningId(scenario.id);
      const res = await executeScenario(scenario);
      setResults((prev) => ({ ...prev, [scenario.id]: res }));
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    setRunningId(null);
    setIsBatchRunning(false);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6 shadow-2xl text-slate-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-950/70 border border-red-700/40 flex items-center justify-center text-red-400 shadow-md">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Attack Library & Scenario Runner
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-950 border border-red-800/60 text-red-300">
                Live Browser Injector
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute authentic cryptographic vectors and policy violations against the MandateOS
              firewall in real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunAll}
            disabled={isBatchRunning || runningId !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 px-4 py-2 text-xs font-semibold text-white shadow transition-all"
          >
            {isBatchRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            {isBatchRunning ? "Running Attack Pack..." : "Run All Scenarios in Sequence"}
          </button>
          <button
            type="button"
            onClick={() => setResults({})}
            className="p-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset telemetry results"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg border border-slate-800/80 bg-slate-900/50 text-xs">
        <div>
          <label htmlFor="mandate-id-input" className="text-slate-400 font-medium block mb-1">
            Target Mandate UUID
          </label>
          <input
            id="mandate-id-input"
            type="text"
            value={selectedMandate}
            onChange={(e) => setSelectedMandate(e.target.value)}
            className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-red-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 font-medium">Agent Ed25519 Secret Key</span>
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="text-[10px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
            >
              <KeyRound className="h-3 w-3" />
              {showKey ? "Hide Key" : "Show Key"}
            </button>
          </div>
          <input
            type={showKey ? "text" : "password"}
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        {SCENARIOS.map((scenario) => {
          const isRunning = runningId === scenario.id;
          const result = results[scenario.id];

          return (
            <div
              key={scenario.id}
              className={`rounded-lg border p-3.5 transition-all ${
                isRunning
                  ? "border-amber-500/60 bg-amber-950/20"
                  : result
                    ? result.outcome === "ALLOWED"
                      ? "border-emerald-950/80 bg-emerald-950/10"
                      : result.outcome === "REPLAY"
                        ? "border-amber-950/80 bg-amber-950/10"
                        : "border-rose-950/80 bg-rose-950/10"
                    : "border-slate-800/80 bg-slate-900/30 hover:border-slate-700"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-white">{scenario.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {scenario.category} • {formatCurrency(scenario.amountPaise)}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        scenario.expectedVerdict === "ALLOWED"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                          : scenario.expectedVerdict === "REPLAY_INTERCEPTED"
                            ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                            : "bg-rose-950 text-rose-400 border border-rose-800/60"
                      }`}
                    >
                      Target: {scenario.expectedVerdict}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{scenario.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {result && (
                    <div className="flex items-center gap-2 text-right">
                      <div className="flex items-center gap-1 text-[11px] font-mono">
                        {result.outcome === "ALLOWED" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : result.outcome === "REPLAY" ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
                        )}
                        <span
                          className={
                            result.outcome === "ALLOWED"
                              ? "text-emerald-400"
                              : result.outcome === "REPLAY"
                                ? "text-amber-400"
                                : "text-rose-400"
                          }
                        >
                          HTTP {result.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {result.latencyMs}ms
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRunSingle(scenario)}
                    disabled={isRunning || isBatchRunning}
                    className="inline-flex items-center gap-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors"
                  >
                    {isRunning ? (
                      <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                    ) : (
                      <Zap className="h-3 w-3 text-red-400" />
                    )}
                    {isRunning ? "Simulating..." : "Launch"}
                  </button>
                </div>
              </div>

              {result?.reason && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span className="truncate max-w-[500px]">Verdict Detail: {result.reason}</span>
                  <span className="text-slate-500">{result.timestamp}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

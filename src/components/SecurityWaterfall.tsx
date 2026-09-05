"use client";

import {
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Fingerprint,
  Layers,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Tag,
  XCircle,
  Zap,
} from "lucide-react";

export interface WaterfallLayer {
  id: number;
  name: string;
  code: string;
  description: string;
  cryptoDetail: string;
  avgLatencyMs: number;
}

export const WATERFALL_LAYERS: WaterfallLayer[] = [
  {
    id: 1,
    name: "Ed25519 Detached Signature",
    code: "GATE_CRYPTO_SIGNATURE",
    description: "Verifies 64-byte detached Edwards-curve signature against agent public key.",
    cryptoDetail: "crypto.verify(null, canonicalMessage, publicKey, sig)",
    avgLatencyMs: 0.82,
  },
  {
    id: 2,
    name: "Nonce Replay Prevention",
    code: "GATE_NONCE_UNIQUENESS",
    description: "Enforces PostgreSQL UNIQUE constraint on (mandate_id, nonce).",
    cryptoDetail: "UNIQUE INDEX ON transactions(mandate_id, nonce)",
    avgLatencyMs: 0.61,
  },
  {
    id: 3,
    name: "Timestamp Drift Window",
    code: "GATE_DRIFT_VALIDATION",
    description: "Rejects packet if server time drift exceeds ±300s window.",
    cryptoDetail: "|t_server - t_packet| <= 300 seconds",
    avgLatencyMs: 0.05,
  },
  {
    id: 4,
    name: "Per-Transaction Spending Cap",
    code: "GATE_PER_TX_CAP",
    description: "Strict integer cap on the maximum paise per single agent dispatch.",
    cryptoDetail: "amount_paise <= mandate.per_tx_cap_paise",
    avgLatencyMs: 0.02,
  },
  {
    id: 5,
    name: "Daily UTC Spend Ceiling",
    code: "GATE_DAILY_ROLLING_CAP",
    description: "Calculates cumulative rolling UTC daily spend against ceiling.",
    cryptoDetail: "sum(paise for today) + amount_paise <= daily_cap_paise",
    avgLatencyMs: 0.78,
  },
  {
    id: 6,
    name: "Lifetime Budget Ceiling",
    code: "GATE_LIFETIME_BUDGET",
    description: "Prevents runaway loops by enforcing absolute maximum mandate life limit.",
    cryptoDetail: "mandate.total_spent_paise + amount_paise <= lifetime_cap_paise",
    avgLatencyMs: 0.02,
  },
  {
    id: 7,
    name: "Merchant Category Whitelist",
    code: "GATE_CATEGORY_WHITELIST",
    description: "Deterministic category match. Immune to prompt injection & jailbreaks.",
    cryptoDetail: "mandate.allowed_categories.includes(merchant.category)",
    avgLatencyMs: 0.05,
  },
  {
    id: 8,
    name: "Circuit Breaker & Gateway Call",
    code: "GATE_CIRCUIT_GATEWAY",
    description: "Ensures error threshold < 5; captures payment via Razorpay Orders API.",
    cryptoDetail: "circuitBreaker.state === 'CLOSED' -> Razorpay.createOrder()",
    avgLatencyMs: 0.54,
  },
];

interface SecurityWaterfallProps {
  verdict?: "ALLOWED" | "BLOCKED" | "REPLAY_DETECTED" | null;
  attackKind?: string | null;
  reason?: string | null;
  activeLayer?: number;
}

export function SecurityWaterfall({
  verdict,
  attackKind,
  reason,
  activeLayer,
}: SecurityWaterfallProps) {
  // Determine which layer failed based on attack kind or explicit prop
  const getFailedLayerId = (): number | null => {
    if (activeLayer !== undefined) return activeLayer;
    if (!attackKind && !verdict) return null;
    if (verdict === "ALLOWED") return null;

    switch (attackKind) {
      case "FORGED_SIGNATURE":
        return 1;
      case "REPLAY_NOMINAL":
      case "REPLAY_FRAUD_OWNER":
        return 2;
      case "STALE_TIMESTAMP":
        return 3;
      case "CAP_BREACH":
        return 4;
      case "CATEGORY_BREACH":
        return 7;
      default:
        // Attempt parsing from reason string
        if (reason?.includes("signature") || reason?.includes("Ed25519")) return 1;
        if (reason?.includes("replay") || reason?.includes("nonce")) return 2;
        if (reason?.includes("drift") || reason?.includes("timestamp")) return 3;
        if (reason?.includes("per-transaction") || reason?.includes("cap")) return 4;
        if (reason?.includes("daily")) return 5;
        if (reason?.includes("lifetime")) return 6;
        if (reason?.includes("category")) return 7;
        if (reason?.includes("circuit")) return 8;
        return 4;
    }
  };

  const failedLayerId = getFailedLayerId();
  const isEvaluated = verdict !== undefined && verdict !== null;

  const getLayerStatus = (layerId: number): "passed" | "failed" | "skipped" | "idle" => {
    if (!isEvaluated) return "idle";
    if (verdict === "ALLOWED") return "passed";

    if (failedLayerId === null) return "passed";

    if (layerId < failedLayerId) return "passed";
    if (layerId === failedLayerId) return "failed";
    return "skipped";
  };

  const getLayerIcon = (id: number) => {
    switch (id) {
      case 1:
        return Fingerprint;
      case 2:
        return Repeat;
      case 3:
        return Clock;
      case 4:
        return Coins;
      case 5:
        return Layers;
      case 6:
        return ShieldCheck;
      case 7:
        return Tag;
      case 8:
        return Zap;
      default:
        return Cpu;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              MandateOS Deterministic 8-Layer Security Waterfall
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
                Zero LLM Drift
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated in real-time on every transaction packet before gateway execution.
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono text-slate-400">P99 SLA: &lt;5.0ms</span>
          <div className="text-xs font-semibold text-emerald-400">Avg 3.18ms</div>
        </div>
      </div>

      {/* Waterfall Visualizer */}
      <div className="divide-y divide-slate-100 p-2 sm:p-4">
        {WATERFALL_LAYERS.map((layer) => {
          const status = getLayerStatus(layer.id);
          const Icon = getLayerIcon(layer.id);

          return (
            <div
              key={layer.id}
              className={`flex items-start justify-between rounded-lg p-3 transition-all ${
                status === "passed"
                  ? "bg-emerald-50/50 border border-emerald-200/60"
                  : status === "failed"
                    ? "bg-rose-50 border border-rose-300 ring-1 ring-rose-300 shadow-sm"
                    : status === "skipped"
                      ? "opacity-40 bg-slate-50/30"
                      : "hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Gate Number Badge */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${
                    status === "passed"
                      ? "bg-emerald-600 text-white"
                      : status === "failed"
                        ? "bg-rose-600 text-white"
                        : status === "skipped"
                          ? "bg-slate-200 text-slate-500"
                          : "bg-slate-100 text-slate-700 border border-slate-300"
                  }`}
                >
                  G{layer.id}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`h-4 w-4 ${
                        status === "passed"
                          ? "text-emerald-600"
                          : status === "failed"
                            ? "text-rose-600"
                            : "text-slate-400"
                      }`}
                    />
                    <span
                      className={`text-sm font-semibold ${
                        status === "failed"
                          ? "text-rose-900"
                          : status === "passed"
                            ? "text-slate-900"
                            : "text-slate-700"
                      }`}
                    >
                      {layer.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">
                      [{layer.code}]
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-0.5">{layer.description}</p>
                  <code className="text-[10px] font-mono text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded mt-1 inline-block">
                    {layer.cryptoDetail}
                  </code>
                </div>
              </div>

              {/* Status Outcome */}
              <div className="text-right shrink-0 ml-3">
                {status === "passed" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Passed ({layer.avgLatencyMs}ms)
                  </span>
                )}
                {status === "failed" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-900 border border-rose-300">
                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                    BLOCKED
                  </span>
                )}
                {status === "skipped" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">
                    Skipped
                  </span>
                )}
                {status === "idle" && (
                  <span className="text-[11px] font-mono text-slate-400">
                    ~{layer.avgLatencyMs}ms
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Summary Note */}
      {isEvaluated && (
        <div
          className={`border-t px-6 py-3 text-xs flex items-center justify-between ${
            verdict === "ALLOWED"
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {verdict === "ALLOWED" ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>All 8 cryptographic gates passed.</strong> Dispatched to Razorpay Payment
                  Rails.
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Blocked at Gate {failedLayerId}:</strong> {reason || "Policy Violation"}
                </span>
              </>
            )}
          </div>
          <span className="font-mono text-[11px] font-semibold">
            {verdict === "ALLOWED" ? "3.2ms TOTAL" : "0.8ms REJECT TIME"}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { SecurityWaterfall } from "@/components/SecurityWaterfall";

interface AttackResult {
  mandateId: string;
  agentName: string;
  attackKind: string;
  category: string;
  amountPaise: number;
  timestamp: number;
  nonce: string;
  signature: string;
  signatureDescription: string;
  verdict: "ALLOWED" | "BLOCKED" | "REPLAY_DETECTED";
  reason: string;
  policyPass: boolean;
  httpStatus: number;
  details: {
    perTxCapPaise: number;
    dailyCapPaise: number | null;
    lifetimeCapPaise: number | null;
    spentTodayPaise: number;
    spentLifetimePaise: number;
    allowedCategories: string[];
    malformedFields?: { timestampDriftSeconds: number };
  };
}

interface AttackConsoleProps {
  /** A valid ACTIVE mandate the attacks will target. If absent, show an empty state. */
  mandateId?: string;
  agentName?: string;
}

const ATTACK_SCENARIOS: {
  value: AttackResult["attackKind"];
  label: string;
  description: string;
}[] = [
  {
    value: "FORGED_SIGNATURE",
    label: "Forged Signature ⚠",
    description:
      "Submit a packet signed with a garbage 64-byte hex string instead of an Ed25519 signature. The firewall verifies the detached signature against the mandate's public key and rejects it.",
  },
  {
    value: "CAP_BREACH",
    label: "Spending Cap Breach 💸",
    description:
      "Attempt a purchase that exceeds the mandate's per-transaction spending cap. Deterministic integer math enforces the limit — prompt injection cannot change it.",
  },
  {
    value: "CATEGORY_BREACH",
    label: "Unauthorized Category 🚫",
    description:
      "Try to buy from a merchant category not whitelisted on the mandate (e.g. luxury watches when only Cloud Servers is allowed). The firewall blocks it cold before any gateway call.",
  },
  {
    value: "STALE_TIMESTAMP",
    label: "Stale Timestamp ⏰",
    description:
      "Submit a validly-signed packet with a timestamp 400 seconds in the past — outside the 300-second drift window. Replay and delayed-playback attacks are blocked.",
  },
  {
    value: "REPLAY_NOMINAL",
    label: "Replay Attack 🔁",
    description:
      "Submit a signed packet, then immediately re-submit the SAME packet (same nonce, same signature) to simulate a man-in-the-middle replay. The database unique-nonce constraint detects the replay and returns 409 REPLAY_DETECTED.",
  },
  {
    value: "REPLAY_FRAUD_OWNER",
    label: "Malicious Owner Replay 🕵️",
    description:
      "A rogue mandate owner re-submits a previously-approved packet using the owner's own Ed25519 key but a reused nonce. The firewall still detects the replay — even the owner cannot double-spend.",
  },
];

export default function AttackConsole({ mandateId, agentName }: AttackConsoleProps) {
  const [selectedAttack, setSelectedAttack] =
    useState<AttackResult["attackKind"]>("FORGED_SIGNATURE");
  const [amountInput, setAmountInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<AttackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [launchCount, setLaunchCount] = useState(0);

  const selectedScenario = ATTACK_SCENARIOS.find((s) => s.value === selectedAttack);

  const handleLaunch = async () => {
    if (!mandateId) return;
    setLaunching(true);
    setError(null);
    setResult(null);

    try {
      const amountPaise =
        selectedAttack === "CAP_BREACH"
          ? Math.round(parseFloat(amountInput || "99999999") * 100)
          : undefined;

      const category =
        selectedAttack === "CATEGORY_BREACH" ? categoryInput || "Luxury Sports Cars" : undefined;

      const res = await fetch("/api/agent/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mandateId,
          kind: selectedAttack,
          amountPaise,
          category,
        }),
      });

      const data = await res.json();

      if (!res.ok && res.status !== 503) {
        throw new Error((data.error as string) || `Attack failed (HTTP ${res.status})`);
      }

      if (res.status === 503) {
        setError(
          "agent.key is required for this attack. Run `npm run seed` (writes agent.key " +
            "with the mandate's Ed25519 secret key) and try again.",
        );
        setResult(null);
        return;
      }

      setResult(data);
      setLaunchCount((c) => c + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attack launch failed");
    } finally {
      setLaunching(false);
    }
  };

  if (!mandateId) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Crosshair className="mx-auto h-10 w-10 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-800">Attack Console</h3>
        <p className="text-sm text-slate-500 mt-1">
          No active mandate selected. Issue a mandate first (
          <strong>Mandates → Issue New Mandate</strong>) and the attack console will appear here
          with a live target.
        </p>
      </div>
    );
  }

  const verdictColor = (v: AttackResult["verdict"]) => {
    switch (v) {
      case "ALLOWED":
        return {
          bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
          icon: CheckCircle2,
          label: "ALLOWED",
        };
      case "BLOCKED":
        return {
          bg: "bg-rose-50 border-rose-200 text-rose-800",
          icon: XCircle,
          label: "BLOCKED",
        };
      case "REPLAY_DETECTED":
        return {
          bg: "bg-amber-50 border-amber-200 text-amber-800",
          icon: AlertTriangle,
          label: "REPLAY_DETECTED",
        };
      default:
        return {
          bg: "bg-slate-50 border-slate-200 text-slate-800",
          icon: ShieldAlert,
          label: v,
        };
    }
  };

  const isReplayScenario =
    selectedAttack === "REPLAY_NOMINAL" || selectedAttack === "REPLAY_FRAUD_OWNER";
  const requiresKey =
    selectedScenario?.value === "REPLAY_FRAUD_OWNER" ||
    selectedAttack === "FORGED_SIGNATURE" ||
    selectedAttack === "STALE_TIMESTAMP";
  const requiresKeyNote = requiresKey
    ? "Requires `agent.key` (run `npm run seed` to write it)."
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Crosshair className="h-4.5 w-4.5 text-rose-600" />
            Attack Console — Try to Break It
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pick an attack above and launch it against the live mandate. Watch the firewall's
            verdict appear in real time.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500">Target: {agentName || mandateId}</span>
      </div>

      {/* Scenario picker */}
      <div className="p-6">
        <div className="space-y-2">
          {ATTACK_SCENARIOS.map((scenario) => {
            const active = selectedAttack === scenario.value;
            return (
              <button
                key={scenario.value}
                type="button"
                onClick={() => {
                  setSelectedAttack(scenario.value);
                  setResult(null);
                  setError(null);
                }}
                className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-all ${
                  active
                    ? "border-rose-300 bg-rose-50/60 ring-1 ring-rose-300"
                    : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-900">{scenario.label}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{scenario.description}</p>
                  </div>
                  {active && <div className="text-rose-600">▶</div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Key requirement note */}
        {requiresKeyNote && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{requiresKeyNote}</span>
          </div>
        )}

        {/* Launch area */}
        <div className="mt-5 flex flex-wrap items-end gap-3">
          {/* Amount override for cap-breach */}
          {selectedAttack === "CAP_BREACH" && (
            <div className="flex-1 min-w-[180px]">
              <label
                htmlFor="cap-breach-amount"
                className="block text-xs font-semibold text-slate-600 mb-1"
              >
                Amount (₹) — will exceed cap
              </label>
              <input
                id="cap-breach-amount"
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                defaultValue="999999.99"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-800 focus:border-rose-500 focus:outline-none"
              />
            </div>
          )}

          {/* Category override for category-breach */}
          {selectedAttack === "CATEGORY_BREACH" && (
            <div className="flex-1 min-w-[180px]">
              <label
                htmlFor="category-breach-category"
                className="block text-xs font-semibold text-slate-600 mb-1"
              >
                Category — must not be whitelisted
              </label>
              <input
                id="category-breach-category"
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                defaultValue="Luxury Sports Cars"
                placeholder="e.g. Luxury Sports Cars"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-rose-500 focus:outline-none"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching || isReplayScenario}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {launching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Launching…
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                Launch Attack
              </>
            )}
          </button>

          {isReplayScenario && (
            <p className="text-xs text-rose-600 italic">
              Replay scenarios run twice automatically — launch once to fire both the nominal packet
              and its replay.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Result card */}
        {result && (
          <div className="mt-5">
            <div
              className={`rounded-lg border p-5 space-y-3 transition-all ${
                result.verdict === "ALLOWED"
                  ? "bg-emerald-50/60 border-emerald-200"
                  : "bg-rose-50/60 border-rose-200"
              }`}
            >
              {/* Verdict badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                      verdictColor(result.verdict).bg
                    }`}
                  >
                    {(() => {
                      const _vc = verdictColor(result.verdict);
                      const _Icon = _vc.icon;
                      return <_Icon className="h-3.5 w-3.5" />;
                    })()}
                    {verdictColor(result.verdict).label}
                  </span>
                  <span className="text-xs text-slate-500">HTTP {result.httpStatus}</span>
                </div>
                <span className="text-xs font-mono text-slate-400">Attack #{launchCount}</span>
              </div>

              {/* Attack summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Attack type:</span>
                  <span className="font-semibold text-slate-800 ml-1">{result.attackKind}</span>
                </div>
                <div>
                  <span className="text-slate-500">Category:</span>
                  <span className="font-semibold text-slate-800 ml-1">{result.category}</span>
                </div>
                <div>
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-semibold text-slate-800 ml-1">
                    ₹{(result.amountPaise / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Nonce:</span>
                  <span className="font-mono text-slate-700 ml-1 truncate max-w-[160px]">
                    {result.nonce}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Signature:</span>
                  <span
                    className={`font-mono ml-1 ${
                      result.verdict === "ALLOWED" ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {result.signature}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Sig kind:</span>
                  <span className="text-slate-700 ml-1">{result.signatureDescription}</span>
                </div>
              </div>

              {/* Why it was blocked / allowed */}
              <div
                className={`rounded-lg p-3 text-xs ${
                  result.verdict === "ALLOWED"
                    ? "bg-white/60 border border-emerald-200"
                    : "bg-white/60 border border-rose-200"
                }`}
              >
                <p className="font-semibold text-slate-800 mb-1">Verdict</p>
                <p className="text-slate-700 leading-relaxed">{result.reason}</p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-slate-500 cursor-pointer hover:text-slate-700">
                      Policy detail
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-600">
                      <span>
                        Per-tx cap: ₹{(result.details.perTxCapPaise / 100).toLocaleString("en-IN")}
                      </span>
                      {result.details.dailyCapPaise && (
                        <span>
                          Daily cap: ₹{(result.details.dailyCapPaise / 100).toLocaleString("en-IN")}
                        </span>
                      )}
                      {result.details.lifetimeCapPaise && (
                        <span>
                          Lifetime cap: ₹
                          {(result.details.lifetimeCapPaise / 100).toLocaleString("en-IN")}
                        </span>
                      )}
                      <span>
                        Spent today: ₹
                        {(result.details.spentTodayPaise / 100).toLocaleString("en-IN")}
                      </span>
                      <span>
                        Spent lifetime: ₹
                        {(result.details.spentLifetimePaise / 100).toLocaleString("en-IN")}
                      </span>
                      <span>Allowed: {result.details.allowedCategories.join(", ")}</span>
                      {result.details.malformedFields?.timestampDriftSeconds && (
                        <span>
                          Timestamp drift: {result.details.malformedFields.timestampDriftSeconds}s
                          (limit 300s)
                        </span>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {/* Live-feed hint */}
            <p className="mt-3 text-xs text-slate-500 text-center">
              ⚡ This verdict was persisted to the firewall telemetry store and will appear in the
              dashboard's live transaction feed and the Battle Arena stream within a few seconds.
            </p>
          </div>
        )}

        {/* 8-Layer Security Waterfall Inspector */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <SecurityWaterfall
            verdict={result?.verdict ?? null}
            attackKind={result?.attackKind ?? (launching ? selectedAttack : null)}
            reason={result?.reason ?? null}
          />
        </div>
      </div>
    </div>
  );
}

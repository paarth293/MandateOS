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
  const [amountInput, setAmountInput] = useState("999999.99");
  const [categoryInput, setCategoryInput] = useState("Luxury Sports Cars");
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

      const fireAttack = async (nonce?: string) => {
        const res = await fetch("/api/agent/attack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mandateId,
            kind: selectedAttack,
            amountPaise,
            category,
            nonce,
          }),
        });
        const data = await res.json();
        return { res, data };
      };

      // The attack route deliberately mirrors the REAL purchase firewall's
      // HTTP status codes: a successfully-blocked attack comes back as 401
      // (invalid signature / stale timestamp), 403 (cap/category breach), or
      // 409 (replay detected) — not 200. `fetch`'s `res.ok` is only true for
      // 2xx, so treating "not ok" as a failure would (and did) misreport
      // every one of those correct BLOCKED/REPLAY_DETECTED verdicts as a
      // console error. A response is a genuine attack verdict whenever it
      // carries a `verdict` field; only a response WITHOUT one (bad request,
      // mandate not found, unhandled server error) is an actual failure.
      const isVerdictResponse = (data: unknown): data is AttackResult =>
        !!data && typeof data === "object" && "verdict" in data;

      if (selectedAttack === "REPLAY_NOMINAL") {
        // Simulate an eavesdropper: fire the SAME signed packet (same nonce)
        // twice. The first call is the legitimate authorized purchase; the
        // second is the byte-perfect replay, which the unique-nonce
        // constraint rejects with REPLAY_DETECTED.
        const nonce = `replay_nominal_${crypto.randomUUID()}`;

        const first = await fireAttack(nonce);
        if (first.res.status === 503) {
          setError(
            "agent.key is required for this attack. Run `npm run seed` (writes agent.key " +
              "with the mandate's Ed25519 secret key) and try again.",
          );
          return;
        }
        if (!isVerdictResponse(first.data)) {
          throw new Error(
            (first.data?.error as string) || `Attack failed (HTTP ${first.res.status})`,
          );
        }

        // Brief pause so the "nominal" verdict is visibly distinct from the replay.
        await new Promise((r) => setTimeout(r, 500));

        const replay = await fireAttack(nonce);
        if (!isVerdictResponse(replay.data)) {
          throw new Error(
            (replay.data?.error as string) || `Attack failed (HTTP ${replay.res.status})`,
          );
        }

        setResult(replay.data);
        setLaunchCount((c) => c + 1);
        return;
      }

      const { res, data } = await fireAttack();

      if (res.status === 503) {
        setError(
          "agent.key is required for this attack. Run `npm run seed` (writes agent.key " +
            "with the mandate's Ed25519 secret key) and try again.",
        );
        setResult(null);
        return;
      }

      if (!isVerdictResponse(data)) {
        throw new Error((data?.error as string) || `Attack failed (HTTP ${res.status})`);
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
      <div className="mos-card border-dashed p-8 text-center">
        <Crosshair className="mx-auto h-10 w-10 text-slate-600 mb-3" />
        <h3 className="text-base font-semibold text-slate-200">Attack Console</h3>
        <p className="text-sm text-slate-400 mt-1">
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
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
          icon: CheckCircle2,
          label: "ALLOWED",
        };
      case "BLOCKED":
        return {
          bg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
          icon: XCircle,
          label: "BLOCKED",
        };
      case "REPLAY_DETECTED":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
          icon: AlertTriangle,
          label: "REPLAY_DETECTED",
        };
      default:
        return {
          bg: "bg-white/[0.05] border-white/10 text-slate-300",
          icon: ShieldAlert,
          label: v,
        };
    }
  };

  const requiresKey =
    selectedScenario?.value === "REPLAY_FRAUD_OWNER" ||
    selectedAttack === "FORGED_SIGNATURE" ||
    selectedAttack === "STALE_TIMESTAMP";
  const requiresKeyNote = requiresKey
    ? "Requires `agent.key` (run `npm run seed` to write it)."
    : null;

  return (
    <div className="mos-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Crosshair className="h-4.5 w-4.5 text-rose-400" />
            Attack Console — Try to Break It
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
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
                    ? "border-rose-500/40 bg-rose-500/[0.08] ring-1 ring-rose-500/40"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-white">{scenario.label}</span>
                    <p className="text-xs text-slate-400 mt-0.5">{scenario.description}</p>
                  </div>
                  {active && <div className="text-rose-400">▶</div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Key requirement note */}
        {requiresKeyNote && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
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
                className="block text-xs font-semibold text-slate-400 mb-1"
              >
                Amount (₹) — will exceed cap
              </label>
              <input
                id="cap-breach-amount"
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-mono text-slate-200 focus:border-rose-500/50 focus:outline-none"
              />
            </div>
          )}

          {/* Category override for category-breach */}
          {selectedAttack === "CATEGORY_BREACH" && (
            <div className="flex-1 min-w-[180px]">
              <label
                htmlFor="category-breach-category"
                className="block text-xs font-semibold text-slate-400 mb-1"
              >
                Category — must not be whitelisted
              </label>
              <input
                id="category-breach-category"
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="e.g. Luxury Sports Cars"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:border-rose-500/50 focus:outline-none"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_16px_-4px_rgba(244,63,94,0.6)] transition-colors hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {selectedAttack === "REPLAY_NOMINAL" && (
            <p className="text-xs text-rose-400 italic">
              Fires the same signed packet twice automatically — the first call is the legitimate
              purchase, the second is the replay.
            </p>
          )}
          {selectedAttack === "REPLAY_FRAUD_OWNER" && (
            <p className="text-xs text-rose-400 italic">
              Reuses the nonce from this mandate's most recent ALLOWED purchase — run a legitimate
              purchase first (e.g. the SDK simulation) if none exists yet.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
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
                  ? "bg-emerald-500/[0.06] border-emerald-500/25"
                  : "bg-rose-500/[0.06] border-rose-500/25"
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
                <span className="text-xs font-mono text-slate-500">Attack #{launchCount}</span>
              </div>

              {/* Attack summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Attack type:</span>
                  <span className="font-semibold text-slate-200 ml-1">{result.attackKind}</span>
                </div>
                <div>
                  <span className="text-slate-500">Category:</span>
                  <span className="font-semibold text-slate-200 ml-1">{result.category}</span>
                </div>
                <div>
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-semibold text-slate-200 ml-1">
                    ₹{(result.amountPaise / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Nonce:</span>
                  <span className="font-mono text-slate-300 ml-1 truncate max-w-[160px]">
                    {result.nonce}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Signature:</span>
                  <span
                    className={`font-mono ml-1 ${
                      result.verdict === "ALLOWED" ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {result.signature}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Sig kind:</span>
                  <span className="text-slate-300 ml-1">{result.signatureDescription}</span>
                </div>
              </div>

              {/* Why it was blocked / allowed */}
              <div
                className={`rounded-lg p-3 text-xs ${
                  result.verdict === "ALLOWED"
                    ? "bg-white/[0.03] border border-emerald-500/20"
                    : "bg-white/[0.03] border border-rose-500/20"
                }`}
              >
                <p className="font-semibold text-slate-200 mb-1">Verdict</p>
                <p className="text-slate-300 leading-relaxed">{result.reason}</p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-slate-500 cursor-pointer hover:text-slate-300">
                      Policy detail
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
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
        <div className="mt-6 pt-6 border-t border-white/10">
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

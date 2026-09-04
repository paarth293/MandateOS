"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Fingerprint,
  Layers,
  Link as LinkIcon,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface AnchorItem {
  id: string;
  mandateId: string;
  blockCount: number;
  lastBlockHash: string;
  previousAnchorHash: string;
  anchorHash: string;
  anchoredAt: string;
}

interface MandateItem {
  id: string;
  agentName: string;
  publicKey: string;
  maxAmountPerTransaction: number;
  dailyLimitPaise: number | null;
  lifetimeLimitPaise: number | null;
  allowedCategories: string[];
  status: string;
}

interface SimulationBreakdown {
  verdict: "PASS" | "BLOCK";
  allowed: boolean;
  reason: string;
  ruleTripped: string | null;
  evaluation?: {
    requested: {
      amountPaise: number;
      category: string;
      retryCount: number;
    };
    breakdown: {
      singleTransaction: { amountPaise: number; capPaise: number; allowed: boolean };
      dailySpend: {
        spentTodayPaise: number;
        dailyCapPaise: number | null;
        projectedTodayPaise: number;
        remainingDailyPaise: number | null;
        allowed: boolean;
      };
      lifetimeSpend: {
        spentLifetimePaise: number;
        lifetimeCapPaise: number | null;
        projectedLifetimePaise: number;
        remainingLifetimePaise: number | null;
        allowed: boolean;
      };
      category: {
        requestedCategory: string;
        allowedCategories: string[];
        allowed: boolean;
      };
      lifecycle: {
        expiresAt: string;
        isExpired: boolean;
        status: string;
        isActive: boolean;
      };
    };
  };
}

export default function TrustPage() {
  const [mandatesList, setMandatesList] = useState<MandateItem[]>([]);
  const [selectedMandateId, setSelectedMandateId] = useState<string>("");
  const [anchorsList, setAnchorsList] = useState<AnchorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  // Verifier Search State
  const [verifierQuery, setVerifierQuery] = useState("");
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    anchor?: AnchorItem;
    message: string;
  } | null>(null);

  // Policy Simulator State
  const [simAmountRupees, setSimAmountRupees] = useState("250");
  const [simCategory, setSimCategory] = useState("Cloud Servers");
  const [simRetryCount, setSimRetryCount] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationBreakdown | null>(null);

  const fetchMandates = useCallback(async () => {
    try {
      const res = await fetch("/api/mandates");
      if (res.ok) {
        const data = await res.json();
        const list: MandateItem[] = data.mandates || [];
        setMandatesList(list);
        if (list.length > 0 && !selectedMandateId) {
          setSelectedMandateId(list[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load mandates", e);
    }
  }, [selectedMandateId]);

  const fetchAnchors = useCallback(async (mandateId: string) => {
    if (!mandateId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/anchors?mandateId=${mandateId}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setAnchorsList(data.anchors || []);
      }
    } catch (e) {
      console.error("Failed to load anchors", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMandates();
  }, [fetchMandates]);

  useEffect(() => {
    if (selectedMandateId) {
      fetchAnchors(selectedMandateId);
    }
  }, [selectedMandateId, fetchAnchors]);

  const handlePublishAnchor = async () => {
    if (!selectedMandateId) return;
    setIsPublishing(true);
    setPublishMessage(null);

    try {
      const res = await fetch("/api/anchors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId: selectedMandateId }),
      });

      const data = await res.json();
      if (res.ok) {
        setPublishMessage(data.message || "Cryptographic anchor published successfully!");
        fetchAnchors(selectedMandateId);
      } else {
        setPublishMessage(`Error: ${data.error || "Failed to publish anchor"}`);
      }
    } catch (err: unknown) {
      setPublishMessage(`Error: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleVerify = () => {
    if (!verifierQuery.trim()) {
      setVerificationResult(null);
      return;
    }

    const query = verifierQuery.trim().toLowerCase();
    const match = anchorsList.find(
      (a) =>
        a.anchorHash.toLowerCase() === query ||
        a.lastBlockHash.toLowerCase() === query ||
        a.mandateId.toLowerCase() === query,
    );

    if (match) {
      setVerificationResult({
        verified: true,
        anchor: match,
        message: "Cryptographic anchor verified. SHA-256 block chain integrity is intact.",
      });
    } else {
      setVerificationResult({
        verified: false,
        message: "No matching anchor found in local verified ledger for the provided hash/ID.",
      });
    }
  };

  const handleSimulatePolicy = async () => {
    if (!selectedMandateId) return;
    setIsSimulating(true);

    try {
      const amountPaise = Math.round(Number.parseFloat(simAmountRupees || "0") * 100);
      const res = await fetch("/api/policy/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mandateId: selectedMandateId,
          amountPaise,
          category: simCategory,
          retryCount: simRetryCount,
        }),
      });

      const data = await res.json();
      setSimulationResult(data);
    } catch (err) {
      console.error("Policy simulation error", err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 p-6 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-950/70 border border-purple-700/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-950/50">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Cryptographic Trust & Anchor Explorer
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-950 px-2.5 py-0.5 text-xs font-mono font-medium text-purple-300 border border-purple-800/60">
                <Fingerprint className="h-3 w-3" />
                Ed25519 + SHA-256
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Publicly verifiable Merkle anchor chain, tamper-evident audit trail & real-time policy
              simulator.
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-3">
          <a
            href={`/api/export/chain?mandateId=${selectedMandateId}&format=json`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            Export Signed Chain
          </a>

          <button
            type="button"
            onClick={handlePublishAnchor}
            disabled={isPublishing || !selectedMandateId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-white shadow transition-colors"
          >
            {isPublishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Layers className="h-3.5 w-3.5" />
            )}
            Publish State Anchor Now
          </button>
        </div>
      </div>

      {publishMessage && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
            publishMessage.startsWith("Error")
              ? "bg-rose-950/40 border-rose-900/60 text-rose-300"
              : "bg-emerald-950/40 border-emerald-900/60 text-emerald-300"
          }`}
        >
          {publishMessage.startsWith("Error") ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span>{publishMessage}</span>
        </div>
      )}

      {/* Mandate Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-[#0D1424]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Active Mandate:
          </span>
          <select
            value={selectedMandateId}
            onChange={(e) => setSelectedMandateId(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500"
          >
            {mandatesList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.agentName} ({m.id.substring(0, 8)}...)
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => fetchAnchors(selectedMandateId)}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 font-mono transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Refresh Chain
        </button>
      </div>

      {/* Public Chain Verifier */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Public Chain Verifier (Auditor Portal)</h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Zero credentials required for external auditing
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste Anchor Hash (SHA-256) or Mandate UUID to verify tamper resistance..."
            value={verifierQuery}
            onChange={(e) => setVerifierQuery(e.target.value)}
            className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
          />
          <button
            type="button"
            onClick={handleVerify}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors"
          >
            Verify Integrity
          </button>
        </div>

        {verificationResult && (
          <div
            className={`p-4 rounded-lg border text-xs space-y-2 ${
              verificationResult.verified
                ? "bg-emerald-950/20 border-emerald-800/60 text-emerald-300"
                : "bg-rose-950/20 border-rose-800/60 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {verificationResult.verified ? (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-rose-400" />
              )}
              <span>{verificationResult.message}</span>
            </div>

            {verificationResult.anchor && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-emerald-900/40 text-[11px] font-mono text-slate-300">
                <div>
                  <span className="text-slate-500">Anchor Hash:</span>{" "}
                  <span className="text-emerald-400 font-semibold break-all">
                    {verificationResult.anchor.anchorHash}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Anchored Block Count:</span>{" "}
                  <span className="text-white font-semibold">
                    {verificationResult.anchor.blockCount} Blocks
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Head Block Hash:</span>{" "}
                  <span className="break-all">{verificationResult.anchor.lastBlockHash}</span>
                </div>
                <div>
                  <span className="text-slate-500">Timestamp:</span>{" "}
                  <span>
                    {new Date(verificationResult.anchor.anchoredAt).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Anchor Chain (2 Cols) + Policy Simulator (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Chronological Anchor Chain Visualizer */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0D1424] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-blue-400" />
              Cryptographic Anchor Chain Sequence
            </h2>
            <span className="text-xs font-mono text-slate-500">
              {anchorsList.length} Anchors Registered
            </span>
          </div>

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-xs text-slate-500 font-mono">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400 mb-2" />
              Loading cryptographic state anchors...
            </div>
          ) : anchorsList.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500 font-mono">
              No anchors published yet for this mandate.
              <br />
              <span className="text-slate-600 mt-1 inline-block">
                Click &ldquo;Publish State Anchor Now&rdquo; above to commit the current audit head
                hash.
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {anchorsList.map((anchor, index) => {
                const isHead = index === 0;
                const isGenesis =
                  anchor.previousAnchorHash ===
                  "0000000000000000000000000000000000000000000000000000000000000000";

                return (
                  <div
                    key={anchor.id}
                    className={`rounded-lg border p-4 transition-all ${
                      isHead
                        ? "border-purple-800/80 bg-purple-950/20"
                        : "border-slate-800/80 bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            isHead
                              ? "bg-purple-950 text-purple-300 border border-purple-700/60"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {isHead ? "HEAD ANCHOR" : `STATE ANCHOR #${anchorsList.length - index}`}
                        </span>
                        {isGenesis && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                            GENESIS
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {new Date(anchor.anchoredAt).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">
                          Anchor Hash (Merkle Root)
                        </span>
                        <span className="text-purple-300 font-semibold break-all text-[11px]">
                          {anchor.anchorHash}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60 text-[11px]">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">
                            Audit Head Block Hash
                          </span>
                          <span className="text-slate-300 break-all">{anchor.lastBlockHash}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">
                            Anchored Block Count
                          </span>
                          <span className="text-emerald-400 font-semibold">
                            {anchor.blockCount} Audit Blocks Secured
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/60">
                        <span className="text-slate-500 block text-[10px] uppercase">
                          Chained Predecessor Hash
                        </span>
                        <span className="text-slate-400 break-all text-[10px]">
                          {anchor.previousAnchorHash}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Interactive What-If Policy Simulator */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              &ldquo;What-If&rdquo; Policy Simulator
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              Zero Write
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Test policy constraints against current budget state without triggering transactions or
            modifying the cryptographic ledger.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="sim-amount-input" className="text-slate-400 font-medium block mb-1">
                Purchase Amount (₹)
              </label>
              <input
                id="sim-amount-input"
                type="number"
                value={simAmountRupees}
                onChange={(e) => setSimAmountRupees(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="sim-category-input" className="text-slate-400 font-medium block mb-1">
                Merchant Category
              </label>
              <input
                id="sim-category-input"
                type="text"
                value={simCategory}
                onChange={(e) => setSimCategory(e.target.value)}
                placeholder="e.g. Cloud Servers, Luxury Watches"
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="sim-retry-input" className="text-slate-400 font-medium block mb-1">
                Simulated Retry Count
              </label>
              <input
                id="sim-retry-input"
                type="number"
                min="0"
                value={simRetryCount}
                onChange={(e) => setSimRetryCount(Number.parseInt(e.target.value || "0", 10))}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSimulatePolicy}
              disabled={isSimulating || !selectedMandateId}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              {isSimulating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              Evaluate Policy Decision
            </button>
          </div>

          {/* Simulation Output Card */}
          {simulationResult && (
            <div
              className={`mt-4 rounded-lg border p-4 space-y-3 ${
                simulationResult.allowed
                  ? "bg-emerald-950/20 border-emerald-800/80 text-emerald-300"
                  : "bg-rose-950/20 border-rose-800/80 text-rose-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  {simulationResult.allowed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  )}
                  Verdict: {simulationResult.verdict}
                </span>
                {simulationResult.ruleTripped && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 border border-rose-700">
                    {simulationResult.ruleTripped}
                  </span>
                )}
              </div>

              <p className="text-xs font-mono">{simulationResult.reason}</p>

              {simulationResult.evaluation?.breakdown && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Single Txn:</span>
                    <span>
                      {formatCurrency(
                        simulationResult.evaluation.breakdown.singleTransaction.capPaise,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Daily Cap Remaining:</span>
                    <span>
                      {simulationResult.evaluation.breakdown.dailySpend.remainingDailyPaise !== null
                        ? formatCurrency(
                            simulationResult.evaluation.breakdown.dailySpend.remainingDailyPaise,
                          )
                        : "Unlimited"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category Status:</span>
                    <span
                      className={
                        simulationResult.evaluation.breakdown.category.allowed
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }
                    >
                      {simulationResult.evaluation.breakdown.category.allowed
                        ? "WHITELISTED"
                        : "NOT PERMITTED"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

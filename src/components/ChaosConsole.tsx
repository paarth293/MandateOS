"use client";

import { AlertOctagon, CheckCircle2, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { createPendingTransaction } from "@/app/(app)/actions";

interface ChaosConsoleProps {
  activeMandateId: string;
}

export default function ChaosConsole({ activeMandateId }: ChaosConsoleProps) {
  const [isInjecting, setIsInjecting] = useState(false);
  const [failureType, setFailureType] = useState("BANK_TIMEOUT");
  const [injectResult, setInjectResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleInjectChaos = async () => {
    setIsInjecting(true);
    setInjectResult(null);

    try {
      const txId = await createPendingTransaction(activeMandateId, 500000);

      const res = await fetch("/api/chaos/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          mandateId: activeMandateId,
          failureReason: failureType,
        }),
      });

      if (res.ok) {
        const recoveryNote =
          failureType === "BANK_TIMEOUT"
            ? "Inngest will silently retry it after a 30s backoff."
            : "It has been quarantined for human review.";
        setInjectResult({
          ok: true,
          message: `Failure injected on transaction ${txId.slice(0, 8)}… ${recoveryNote} Watch the live feed.`,
        });
        setTimeout(() => setInjectResult(null), 8000);
      } else {
        setInjectResult({
          ok: false,
          message: "Injection failed — check your session and try again.",
        });
      }
    } catch (error) {
      console.error("Failed to inject chaos", error);
      setInjectResult({ ok: false, message: "Injection failed — network error." });
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="mos-card border-rose-500/20 bg-rose-500/[0.03] p-6">
      <div className="flex items-center space-x-2 mb-4 text-rose-300">
        <AlertOctagon className="h-6 w-6" />
        <h2 className="text-lg font-bold">Chaos Console</h2>
      </div>

      <p className="text-sm text-rose-300/80 mb-6 leading-relaxed">
        Warning: This is for demonstration purposes. Clicking this button simulates an AI Agent
        attempting a purchase, followed immediately by a catastrophic gateway failure.
      </p>

      {injectResult && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs font-medium ${
            injectResult.ok
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          {injectResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertOctagon className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{injectResult.message}</span>
        </div>
      )}

      <div className="flex items-center space-x-4">
        <select
          className="block w-48 rounded-md border-0 bg-white/[0.04] py-2 pl-3 pr-10 text-slate-200 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-rose-500 sm:text-sm sm:leading-6"
          value={failureType}
          onChange={(e) => setFailureType(e.target.value)}
        >
          <option value="BANK_TIMEOUT" className="bg-[#0d1424] text-slate-200">
            Bank Timeout (504)
          </option>
          <option value="INSUFFICIENT_FUNDS" className="bg-[#0d1424] text-slate-200">
            Insufficient Funds (402)
          </option>
          <option value="CARD_EXPIRED" className="bg-[#0d1424] text-slate-200">
            Card Expired (Quarantine)
          </option>
        </select>

        <button
          type="button"
          onClick={handleInjectChaos}
          disabled={isInjecting}
          className="inline-flex items-center rounded-md bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_-4px_rgba(244,63,94,0.6)] hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isInjecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          Inject Catastrophic Failure
        </button>
      </div>
    </div>
  );
}

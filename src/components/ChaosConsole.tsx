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
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
      <div className="flex items-center space-x-2 mb-4 text-red-700">
        <AlertOctagon className="h-6 w-6" />
        <h2 className="text-lg font-bold">Chaos Console</h2>
      </div>

      <p className="text-sm text-red-600 mb-6 leading-relaxed">
        Warning: This is for demonstration purposes. Clicking this button simulates an AI Agent
        attempting a purchase, followed immediately by a catastrophic gateway failure.
      </p>

      {injectResult && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs font-medium ${
            injectResult.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {injectResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{injectResult.message}</span>
        </div>
      )}

      <div className="flex items-center space-x-4">
        <select
          className="block w-48 rounded-md border-0 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-red-600 sm:text-sm sm:leading-6"
          value={failureType}
          onChange={(e) => setFailureType(e.target.value)}
        >
          <option value="BANK_TIMEOUT">Bank Timeout (504)</option>
          <option value="INSUFFICIENT_FUNDS">Insufficient Funds (402)</option>
          <option value="CARD_EXPIRED">Card Expired (Quarantine)</option>
        </select>

        <button
          type="button"
          onClick={handleInjectChaos}
          disabled={isInjecting}
          className="inline-flex items-center rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

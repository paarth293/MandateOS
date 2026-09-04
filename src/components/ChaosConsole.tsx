"use client";

import { AlertOctagon, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { createPendingTransaction } from "@/app/actions";

interface ChaosConsoleProps {
  activeMandateId: string;
}

export default function ChaosConsole({ activeMandateId }: ChaosConsoleProps) {
  const [isInjecting, setIsInjecting] = useState(false);
  const [failureType, setFailureType] = useState("BANK_TIMEOUT");

  const handleInjectChaos = async () => {
    setIsInjecting(true);

    try {
      const txId = await createPendingTransaction(activeMandateId, 500000);

      await fetch("/api/chaos/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          mandateId: activeMandateId,
          failureReason: failureType,
        }),
      });
    } catch (error) {
      console.error("Failed to inject chaos", error);
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

      <div className="flex items-center space-x-4">
        <select
          className="block w-48 rounded-md border-0 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-red-600 sm:text-sm sm:leading-6"
          value={failureType}
          onChange={(e) => setFailureType(e.target.value)}
        >
          <option value="BANK_TIMEOUT">Bank Timeout (504)</option>
          <option value="INSUFFICIENT_FUNDS">Insufficient Funds (402)</option>
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

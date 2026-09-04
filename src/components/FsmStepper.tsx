"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Key,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

export interface FsmTransaction {
  status: string; // PENDING, ORDER_CREATED, SUCCESS, FAILED, RECOVERED
  retryCount: number;
  failureReason?: string | null;
}

interface FsmStepperProps {
  transaction: FsmTransaction;
}

export default function FsmStepper({ transaction }: FsmStepperProps) {
  const { status, retryCount, failureReason } = transaction;

  // Step 1: Cryptographic Signing
  const step1 = { title: "Signed", icon: Key, state: "completed" };

  // Step 2: Policy Firewall
  const step2 = { title: "Policy Check", icon: ShieldCheck, state: "completed" };

  // Step 3: Gateway Order
  const isOrderCreated = ["ORDER_CREATED", "SUCCESS", "FAILED", "RECOVERED"].includes(status);
  const step3 = {
    title: "Order Init",
    icon: Clock,
    state: isOrderCreated ? "completed" : "pending",
  };

  // Step 4: Resilience / Retry Loop
  let step4State: "completed" | "active" | "failed" | "skipped" = "skipped";
  if (retryCount > 0) {
    step4State = status === "RECOVERED" ? "completed" : "active";
  } else if (status === "FAILED") {
    step4State = "failed";
  }
  const step4 = {
    title: retryCount > 0 ? `Retried (×${retryCount})` : "Retry Loop",
    icon: RefreshCcw,
    state: step4State,
  };

  // Step 5: Final Settlement State
  let step5State: "success" | "failed" | "recovered" | "pending" = "pending";
  if (status === "SUCCESS") step5State = "success";
  else if (status === "RECOVERED") step5State = "recovered";
  else if (status === "FAILED") step5State = "failed";

  const getStep5Config = () => {
    switch (step5State) {
      case "success":
        return {
          title: "Settled",
          icon: CheckCircle2,
          color: "text-emerald-600 bg-emerald-50 border-emerald-200",
        };
      case "recovered":
        return {
          title: "Recovered",
          icon: RefreshCcw,
          color: "text-blue-600 bg-blue-50 border-blue-200",
        };
      case "failed":
        return {
          title: "Quarantined",
          icon: XCircle,
          color: "text-rose-600 bg-rose-50 border-rose-200",
        };
      default:
        return {
          title: "In Progress",
          icon: Clock,
          color: "text-amber-600 bg-amber-50 border-amber-200",
        };
    }
  };

  const step5 = getStep5Config();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
        <span className="font-semibold uppercase tracking-wider">Transaction Lifecycle FSM</span>
        {failureReason && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-rose-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {failureReason}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between relative">
        {/* Step 1: Signed */}
        <div className="flex flex-col items-center z-10">
          <div className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200">
            <step1.icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-700 mt-1">{step1.title}</span>
        </div>

        <div className="flex-1 h-0.5 bg-emerald-200 mx-2" />

        {/* Step 2: Policy Check */}
        <div className="flex flex-col items-center z-10">
          <div className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200">
            <step2.icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-700 mt-1">{step2.title}</span>
        </div>

        <div className="flex-1 h-0.5 bg-emerald-200 mx-2" />

        {/* Step 3: Order Created */}
        <div className="flex flex-col items-center z-10">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center ${
              step3.state === "completed"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-slate-100 text-slate-400 border border-slate-200"
            }`}
          >
            <step3.icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-700 mt-1">{step3.title}</span>
        </div>

        <div
          className={`flex-1 h-0.5 mx-2 ${
            retryCount > 0 || status === "FAILED" ? "bg-amber-200" : "bg-slate-200"
          }`}
        />

        {/* Step 4: Retry Loop */}
        <div className="flex flex-col items-center z-10">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center ${
              step4.state === "completed"
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : step4.state === "failed"
                  ? "bg-rose-50 text-rose-600 border border-rose-200"
                  : step4.state === "active"
                    ? "bg-amber-50 text-amber-600 border border-amber-200 animate-pulse"
                    : "bg-slate-50 text-slate-300 border border-slate-200"
            }`}
          >
            <step4.icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-700 mt-1">{step4.title}</span>
        </div>

        <div
          className={`flex-1 h-0.5 mx-2 ${
            step5State === "success" || step5State === "recovered"
              ? "bg-emerald-200"
              : step5State === "failed"
                ? "bg-rose-200"
                : "bg-slate-200"
          }`}
        />

        {/* Step 5: Final Result */}
        <div className="flex flex-col items-center z-10">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center border ${step5.color}`}
          >
            <step5.icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-semibold text-slate-900 mt-1">{step5.title}</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileCode,
  Key,
  Layers,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

export interface IncidentTransaction {
  id: string;
  mandateId: string;
  merchantId?: string;
  merchantName?: string;
  amount: number; // paise
  status: string; // PENDING, ORDER_CREATED, SUCCESS, FAILED, RECOVERED
  failureReason?: string | null;
  retryCount: number;
  razorpayOrderId?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  category?: string;
  agentName?: string;
}

export interface IncidentAuditBlock {
  id: string;
  action: string;
  details: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
  createdAt: string | Date;
}

interface IncidentTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: IncidentTransaction | null;
  auditBlocks?: IncidentAuditBlock[];
}

export default function IncidentTimeline({
  isOpen,
  onClose,
  transaction,
  auditBlocks = [],
}: IncidentTimelineProps) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showJsonRaw, setShowJsonRaw] = useState(false);

  if (!isOpen || !transaction) return null;

  const {
    id,
    mandateId,
    merchantName = "TechSupply India",
    amount,
    status,
    failureReason,
    retryCount,
    razorpayOrderId,
    createdAt,
    category = "Cloud Infrastructure",
  } = transaction;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const isSuccess = status === "SUCCESS";
  const isRecovered = status === "RECOVERED";
  const isFailed = status === "FAILED";

  const getStatusBadge = () => {
    if (isSuccess) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-800/60">
          <CheckCircle2 className="h-3 w-3" /> SETTLED
        </span>
      );
    }
    if (isRecovered) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-950 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-800/60">
          <RefreshCcw className="h-3 w-3" /> RECOVERED (x{retryCount})
        </span>
      );
    }
    if (isFailed) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-950 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-800/60">
          <AlertOctagon className="h-3 w-3" /> QUARANTINED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-800/60">
        <Clock className="h-3 w-3" /> {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close drawer backdrop"
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity w-full h-full cursor-default"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-[#0B1220] border-l border-slate-800 text-slate-100 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Incident Timeline Narrative</h2>
                {getStatusBadge()}
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Transaction UUID: <span className="text-slate-300">{id}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Summary Card */}
            <div className="rounded-xl border border-slate-800 bg-[#070B14] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                    Total Amount
                  </span>
                  <span className="text-xl font-mono font-bold text-white">
                    {formatCurrency(amount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                    Category
                  </span>
                  <span className="text-xs font-mono text-purple-300 font-medium">{category}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">Merchant:</span>
                  <span className="text-slate-300 truncate block">{merchantName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Razorpay Order:</span>
                  <span className="text-slate-300 truncate block">
                    {razorpayOrderId || "mock_order_init"}
                  </span>
                </div>
              </div>

              {failureReason && (
                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/60 flex items-center gap-2 text-xs font-mono text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>Fault Signature: {failureReason}</span>
                </div>
              )}
            </div>

            {/* Narrative Timeline */}
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-4 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-blue-400" />
                Execution Lifecycle Audit
              </h3>

              <div className="relative border-l border-slate-800 ml-4 space-y-6 pl-6 pb-2">
                {/* Step 1 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 h-5 w-5 rounded-full bg-emerald-950 border border-emerald-600 flex items-center justify-center text-emerald-400">
                    <Key className="h-2.5 w-2.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        1. Agent Ed25519 Cryptogram Verified
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Detached cryptographic signature validated against Mandate public key. Fresh
                      unique nonce recorded in replay shield database.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 h-5 w-5 rounded-full bg-emerald-950 border border-emerald-600 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="h-2.5 w-2.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        2. Mandate Policy Engine Verdict: ALLOWED
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        PASSED
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Evaluated transaction against spending caps (per-transaction, daily, lifetime)
                      and verified merchant category &ldquo;{category}&rdquo; is whitelisted.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 h-5 w-5 rounded-full bg-blue-950 border border-blue-600 flex items-center justify-center text-blue-400">
                    <Zap className="h-2.5 w-2.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        3. Gateway Order Initialized
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">Razorpay Direct</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Autonomous order submitted to Razorpay payment gateway API with idempotency
                      key.
                    </p>
                  </div>
                </div>

                {/* Step 4: Failure/Retry Step (if applicable) */}
                {(retryCount > 0 || failureReason) && (
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 h-5 w-5 rounded-full bg-amber-950 border border-amber-600 flex items-center justify-center text-amber-400">
                      <RefreshCcw className="h-2.5 w-2.5" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300">
                          4. Resilience & Silent Retry Execution
                        </span>
                        <span className="text-[10px] font-mono text-amber-400">
                          {retryCount} Retries
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Encountered gateway fault ({failureReason || "Transient timeout"}).
                        MandateOS autonomous retry worker executed progressive exponential backoff.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 5: Final Resolution */}
                <div className="relative">
                  <div
                    className={`absolute -left-[31px] top-0 h-5 w-5 rounded-full flex items-center justify-center ${
                      isSuccess
                        ? "bg-emerald-950 border border-emerald-600 text-emerald-400"
                        : isRecovered
                          ? "bg-blue-950 border border-blue-600 text-blue-400"
                          : "bg-rose-950 border border-rose-600 text-rose-400"
                    }`}
                  >
                    {isSuccess || isRecovered ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <ShieldAlert className="h-2.5 w-2.5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        {isSuccess
                          ? "5. Settlement Confirmed (SUCCESS)"
                          : isRecovered
                            ? "5. Autonomous Silent Recovery Confirmed"
                            : "5. Escalated to Human Review (QUARANTINED)"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {isSuccess || isRecovered
                        ? "Payment successfully settled. Funds transferred and cryptographic audit trail committed."
                        : "Retry quota exhausted or non-retryable instrument fault. Quarantined in operations review queue."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cryptographic Hash Chain Evidence */}
            <div className="rounded-xl border border-slate-800 bg-[#070B14] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-purple-400" />
                  Tamper-Evident SHA-256 Hash Chain
                </h4>
                <button
                  type="button"
                  onClick={() => setShowJsonRaw(!showJsonRaw)}
                  className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-mono"
                >
                  <FileCode className="h-3 w-3" />
                  {showJsonRaw ? "Hide Raw Blocks" : "View Raw Blocks"}
                </button>
              </div>

              {auditBlocks.length > 0 ? (
                <div className="space-y-2">
                  {auditBlocks.map((block, idx) => (
                    <div
                      key={block.id}
                      className="p-2.5 rounded bg-slate-900/60 border border-slate-800 text-[11px] font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-white font-semibold">
                          Block #{idx + 1}: {block.action}
                        </span>
                        <span>{new Date(block.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 text-slate-500">
                        <span className="truncate max-w-[280px]">
                          Current: <span className="text-purple-300">{block.currentHash}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(block.currentHash, block.id)}
                          className="text-slate-400 hover:text-slate-200"
                          title="Copy hash"
                        >
                          {copiedHash === block.id ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-mono">
                  Audit trail linked to Mandate: {mandateId.slice(0, 8)}...
                  <br />
                  Chained hash head verifiable in Trust Explorer.
                </p>
              )}

              {showJsonRaw && auditBlocks.length > 0 && (
                <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-48">
                  {JSON.stringify(auditBlocks, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

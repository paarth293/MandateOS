"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Link as LinkIcon,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface AuditLog {
  id: string;
  mandateId?: string;
  action: string;
  previousHash: string;
  currentHash: string;
  details: {
    summary?: string;
    confidenceScore?: number;
    requiresHumanIntervention?: boolean;
    [key: string]: unknown;
  };
  createdAt: string | Date;
}

interface AuditTrailProps {
  logs: AuditLog[];
  mandateId?: string;
}

interface VerificationState {
  status: "idle" | "verifying" | "verified" | "compromised" | "unavailable";
  blockCount: number;
  brokenBlockIndex: number | null;
  message?: string;
}

export default function AuditTrail({ logs, mandateId }: AuditTrailProps) {
  const [verification, setVerification] = useState<VerificationState>({
    status: "idle",
    blockCount: 0,
    brokenBlockIndex: null,
  });

  const verifyChain = useCallback(async () => {
    setVerification((prev) => ({ ...prev, status: "verifying" }));
    try {
      const activeMandateId = mandateId || logs[0]?.mandateId;
      const url = activeMandateId
        ? `/api/verify/chain?mandateId=${activeMandateId}`
        : "/api/verify/chain";
      const res = await fetch(url);
      const data = await res.json();

      if (data.verified) {
        setVerification({
          status: "verified",
          blockCount: data.blockCount ?? logs.length,
          brokenBlockIndex: null,
        });
      } else {
        setVerification({
          status: "compromised",
          blockCount: data.blockCount ?? logs.length,
          brokenBlockIndex: data.brokenBlockIndex ?? null,
          message: data.reason || "Cryptographic signature or hash mismatch detected.",
        });
      }
    } catch {
      // FAIL CLOSED: if verification cannot run (network/endpoint failure), we
      // must NEVER display "Chain Verified" — an unverifiable chain is not a
      // verified chain. Show an explicit unavailable state instead.
      setVerification((prev) => ({
        ...prev,
        status: "unavailable",
        message: "Verification service unreachable — chain integrity is NOT confirmed.",
      }));
    }
  }, [mandateId, logs]);

  useEffect(() => {
    if (logs.length > 0) {
      verifyChain();
    }
  }, [logs.length, verifyChain]);

  return (
    <div className="mos-card overflow-hidden">
      <div className="border-b border-white/10 bg-white/[0.03] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <LinkIcon className="h-4 w-4 text-indigo-400" />
          <h3 className="font-semibold text-white">Cryptographic Audit Trail</h3>
          <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-slate-400">
            SHA-256 Secured
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {verification.status === "verifying" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/20">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Verifying Chain...
            </span>
          )}

          {verification.status === "verified" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Chain Verified ✓ ({verification.blockCount} blocks)
            </span>
          )}

          {verification.status === "compromised" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300 border border-rose-500/20">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              Chain Compromised ⚠
            </span>
          )}

          {verification.status === "unavailable" && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/20"
              title={verification.message}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Verification Unavailable
            </span>
          )}

          <button
            type="button"
            onClick={verifyChain}
            title="Re-verify cryptographic chain"
            className="rounded p-1 text-slate-500 hover:text-white hover:bg-white/[0.08] transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {verification.status === "compromised" && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 flex items-center gap-2 text-xs text-rose-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            <strong>Integrity Alert:</strong> Block #{verification.brokenBlockIndex} failed hash
            integrity. {verification.message}
          </span>
        </div>
      )}

      <div className="divide-y divide-white/[0.06] max-h-[500px] overflow-y-auto overflow-x-hidden">
        {logs.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">
            No audit logs generated yet.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {logs.map((log) => {
              const shortCurrent = `${log.currentHash.substring(0, 8)}...${log.currentHash.substring(60)}`;
              const shortPrev = `${log.previousHash.substring(0, 8)}...`;

              const date = new Date(log.createdAt).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, type: "spring", bounce: 0.3 }}
                  className="p-6 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="inline-flex items-center rounded-md bg-white/[0.06] px-2 py-1 text-xs font-bold text-slate-300 font-mono">
                        {log.action}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">{date}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-mono text-slate-500 flex items-center justify-end">
                        Prev: {shortPrev}
                      </p>
                      <p className="text-xs font-mono font-medium text-indigo-400 flex items-center justify-end mt-0.5">
                        Hash: {shortCurrent}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-3 rounded-lg border p-3 flex items-start space-x-3
                    ${log.details?.requiresHumanIntervention ? "bg-rose-500/10 border-rose-500/20" : "bg-indigo-500/10 border-indigo-500/20"}`}
                  >
                    <div
                      className={`mt-0.5 ${log.details?.requiresHumanIntervention ? "text-rose-400" : "text-indigo-400"}`}
                    >
                      {log.details?.requiresHumanIntervention ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm text-slate-300 leading-snug">
                        {log.details?.summary || "Audit log entry"}
                      </p>
                      {log.details?.confidenceScore !== undefined && (
                        <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase">
                          AI Confidence:{" "}
                          {Math.round(
                            log.details.confidenceScore <= 1
                              ? log.details.confidenceScore * 100
                              : log.details.confidenceScore,
                          )}
                          %
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

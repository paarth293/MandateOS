"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, Link as LinkIcon } from "lucide-react";

export interface AuditLog {
  id: string;
  action: string;
  previousHash: string;
  currentHash: string;
  details: {
    summary: string;
    confidenceScore: number;
    requiresHumanIntervention: boolean;
  };
  createdAt: string | Date;
}

interface AuditTrailProps {
  logs: AuditLog[];
}

export default function AuditTrail({ logs }: AuditTrailProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center">
          <LinkIcon className="mr-2 h-4 w-4 text-blue-400" />
          Cryptographic Audit Trail
        </h3>
        <span className="text-xs font-mono text-slate-400">SHA-256 Secured</span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto overflow-x-hidden">
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
                  className="p-6 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 font-mono">
                        {log.action}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">{date}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-mono text-slate-400 flex items-center justify-end">
                        Prev: {shortPrev}
                      </p>
                      <p className="text-xs font-mono font-medium text-blue-600 flex items-center justify-end mt-0.5">
                        Hash: {shortCurrent}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-3 rounded-lg border p-3 flex items-start space-x-3 
                    ${log.details.requiresHumanIntervention ? "bg-red-50 border-red-100" : "bg-blue-50/50 border-blue-100"}`}
                  >
                    <div
                      className={`mt-0.5 ${log.details.requiresHumanIntervention ? "text-red-500" : "text-blue-500"}`}
                    >
                      {log.details.requiresHumanIntervention ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm text-slate-700 leading-snug">{log.details.summary}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase">
                        AI Confidence: {log.details.confidenceScore}%
                      </p>
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

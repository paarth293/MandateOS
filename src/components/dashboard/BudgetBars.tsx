"use client";

import { Bot, Gauge } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface AgentMetric {
  mandateId: string;
  agentName: string;
  status: string;
  maxAmountPerTransaction: number;
  dailyLimitPaise: number | null;
  lifetimeLimitPaise: number | null;
  spentTodayPaise: number;
  spentLifetimePaise: number;
  dailyUtilizationPercent: number | null;
  lifetimeUtilizationPercent: number | null;
}

interface BudgetBarsProps {
  agents: AgentMetric[];
}

function getProgressColor(percent: number | null): string {
  if (percent === null) return "bg-slate-600";
  if (percent >= 90) return "bg-rose-500";
  if (percent >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function BudgetBars({ agents }: BudgetBarsProps) {
  return (
    <div className="mos-card p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Gauge className="h-5 w-5 text-emerald-400" />
            Agent Budget Utilization
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time daily and lifetime spend tracking against cryptographic mandate limits.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {(agents || []).length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            No agent metrics currently available.
          </p>
        ) : (
          agents.map((agent) => {
            const dailyColor = getProgressColor(agent.dailyUtilizationPercent);
            const lifetimeColor = getProgressColor(agent.lifetimeUtilizationPercent);

            return (
              <div
                key={agent.mandateId}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">{agent.agentName}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        agent.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Max: {formatCurrency(agent.maxAmountPerTransaction)}/tx
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Daily Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Daily Limit</span>
                      <span className="font-semibold text-slate-300">
                        {formatCurrency(agent.spentTodayPaise)} /{" "}
                        {agent.dailyLimitPaise ? formatCurrency(agent.dailyLimitPaise) : "Uncapped"}
                        {agent.dailyUtilizationPercent !== null &&
                          ` (${agent.dailyUtilizationPercent}%)`}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${dailyColor}`}
                        style={{ width: `${agent.dailyUtilizationPercent ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Lifetime Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Lifetime Limit</span>
                      <span className="font-semibold text-slate-300">
                        {formatCurrency(agent.spentLifetimePaise)} /{" "}
                        {agent.lifetimeLimitPaise
                          ? formatCurrency(agent.lifetimeLimitPaise)
                          : "Uncapped"}
                        {agent.lifetimeUtilizationPercent !== null &&
                          ` (${agent.lifetimeUtilizationPercent}%)`}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${lifetimeColor}`}
                        style={{ width: `${agent.lifetimeUtilizationPercent ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

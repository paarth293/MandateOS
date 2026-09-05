"use client";

import { PieChart as PieIcon } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

export interface CategoryStat {
  category: string;
  attempts: number;
  totalPaise: number;
}

interface CategoryDonutProps {
  data: CategoryStat[];
}

const COLORS = ["#818cf8", "#34d399", "#a78bfa", "#fbbf24", "#fb7185", "#22d3ee"];

export default function CategoryDonut({ data }: CategoryDonutProps) {
  const chartData = (data || []).map((item) => ({
    name: item.category,
    value: item.totalPaise / 100, // in Rupees for clean sizing
    rawPaise: item.totalPaise,
    attempts: item.attempts,
  }));

  const totalSpentPaise = (data || []).reduce((acc, curr) => acc + curr.totalPaise, 0);

  return (
    <div className="mos-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PieIcon className="h-5 w-5 text-violet-400" />
            Category Allocation
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Distribution of agent spend across verified merchant verticals.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block uppercase font-semibold">
            Total Tracked
          </span>
          <span className="text-base font-bold text-white">{formatCurrency(totalSpentPaise)}</span>
        </div>
      </div>

      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            No merchant category data available yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                stroke="#05070d"
                strokeWidth={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload?.length) {
                    const item = payload[0].payload as {
                      name: string;
                      value: number;
                      rawPaise: number;
                      attempts: number;
                    };
                    return (
                      <div className="rounded-lg border border-white/10 bg-[#0d1424] p-3 shadow-xl text-xs">
                        <p className="font-semibold text-slate-200">{item.name}</p>
                        <p className="mt-1 text-violet-400 font-bold">
                          {formatCurrency(item.rawPaise)}
                        </p>
                        <p className="text-slate-500 text-[11px]">
                          {item.attempts} attempt{item.attempts === 1 ? "" : "s"}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

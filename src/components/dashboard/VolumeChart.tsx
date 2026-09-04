"use client";

import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export interface DailyVolumePoint {
  date: string;
  volumePaise: number;
  count: number;
}

interface VolumeChartProps {
  data: DailyVolumePoint[];
}

export default function VolumeChart({ data }: VolumeChartProps) {
  const chartData = (data || []).map((point) => ({
    ...point,
    displayVolume: point.volumePaise / 100, // Rupees for chart scaling
  }));

  const totalVolumePaise = (data || []).reduce((acc, curr) => acc + curr.volumePaise, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            7-Day Settlement Burn Rate
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily cleared transaction volume settled across autonomous agents.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block uppercase font-semibold">7-Day Total</span>
          <span className="text-base font-bold text-slate-900">
            {formatCurrency(totalVolumePaise)}
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No settled transactions recorded in the last 7 days.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(str) => {
                  const parts = str.split("-");
                  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : str;
                }}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `₹${val.toLocaleString("en-IN")}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload?.length) {
                    const item = payload[0].payload as DailyVolumePoint;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs">
                        <p className="font-semibold text-slate-800">{label}</p>
                        <p className="mt-1 text-blue-600 font-bold">
                          {formatCurrency(item.volumePaise)}
                        </p>
                        <p className="text-slate-500 text-[11px]">
                          {item.count} transaction{item.count === 1 ? "" : "s"}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="displayVolume"
                stroke="#2563EB"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorVolume)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

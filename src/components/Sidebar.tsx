"use client";

import {
  Anchor,
  Crosshair,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Swords,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Chaos Console", href: "/", icon: LayoutDashboard },
  { name: "Attack Console", href: "/attack", icon: Crosshair },
  { name: "Mandates", href: "/mandates", icon: ShieldCheck },
  { name: "Review Queue", href: "/review", icon: UserCheck },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "Battle Arena", href: "/arena", icon: Swords },
  { name: "Trust Explorer", href: "/trust", icon: Anchor },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-white/10 bg-[#070b14]/95 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-white/10">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 shadow-[0_0_20px_-4px_rgba(99,102,241,0.7)]">
          <ShieldCheck className="h-4.5 w-4.5 text-white" strokeWidth={2.3} />
        </div>
        <div className="leading-tight">
          <h1 className="text-[15px] font-bold tracking-tight mos-brand-text">MandateOS</h1>
          <p className="text-[10px] font-mono text-slate-500 tracking-wide">FIREWALL v3.0</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-300"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-400 to-emerald-400 shadow-[0_0_8px_1px_rgba(99,102,241,0.6)]" />
              )}
              <item.icon
                className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                  isActive ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer: system status */}
      <div className="border-t border-white/10 px-4 py-3.5">
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
          <span className="relative flex h-2 w-2">
            <span className="mos-live-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            8-Gate Waterfall <span className="text-emerald-400">ARMED</span>
          </span>
        </div>
      </div>
    </div>
  );
}

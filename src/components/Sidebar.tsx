"use client";

import {
  Anchor,
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
    <div className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      {/* App Logo/Title Area */}
      <div className="flex h-16 items-center px-6 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">MandateOS</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-slate-100 text-blue-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

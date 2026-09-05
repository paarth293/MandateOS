"use client";

import { Bell, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  useEffect(() => {
    // Fetch current user
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});

    // Fetch pending review incidents count
    fetch("/api/review?filter=pending")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setPendingReviewCount(data.items.length);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoggingOut(false);
    }
  };

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "M";

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#070b14]/80 backdrop-blur-xl px-6">
      {/* Search Bar Area */}
      <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-400 focus-within:border-indigo-500/40 transition-colors">
        <Search className="mr-2 h-3.5 w-3.5 text-slate-500" />
        <input
          type="text"
          placeholder="Search policies, mandates, transactions…"
          className="bg-transparent text-sm focus:outline-none w-72 placeholder:text-slate-600 text-slate-200"
        />
      </div>

      {/* User Profile & Actions */}
      <div className="flex items-center space-x-4">
        {/* Notifications with Live Badge */}
        <button
          type="button"
          onClick={() => router.push("/review")}
          className="relative rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 transition-colors cursor-pointer"
          title={`${pendingReviewCount} quarantined transaction(s) awaiting review`}
        >
          <Bell className="h-4 w-4" />
          {pendingReviewCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(244,63,94,0.6)]">
              {pendingReviewCount > 9 ? "9+" : pendingReviewCount}
            </span>
          )}
        </button>

        <div className="flex items-center space-x-3 border-l border-white/10 pl-4">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-[0_0_12px_-2px_rgba(99,102,241,0.7)]">
            {initial}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-100 leading-tight">
              {user?.name || "MandateOS User"}
            </span>
            <div className="flex items-center space-x-1 mt-0.5">
              <span className="inline-flex items-center rounded bg-indigo-500/10 px-1.5 py-0.2 text-[10px] font-mono font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/20">
                {user?.role || "OWNER"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="ml-2 inline-flex items-center text-xs font-medium text-slate-500 hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

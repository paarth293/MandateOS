"use client";

import { Bell, LogOut, Moon, Search, Sun } from "lucide-react";
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
  const [isDark, setIsDark] = useState(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  useEffect(() => {
    // Check system or saved dark mode
    if (
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }

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

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

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
    <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 transition-colors duration-200 dark:border-slate-800 dark:bg-[#0D1424]">
      {/* Search Bar Area */}
      <div className="flex items-center text-slate-500 dark:text-slate-400">
        <Search className="mr-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Search policies, mandates..."
          className="bg-transparent text-sm focus:outline-none w-64 placeholder:text-slate-400 text-slate-800 dark:text-slate-200 dark:placeholder:text-slate-600"
        />
      </div>

      {/* User Profile & Actions */}
      <div className="flex items-center space-x-4">
        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleDarkMode}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          title={isDark ? "Switch to light mode" : "Switch to dark ops mode"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications with Live Badge */}
        <button
          type="button"
          onClick={() => router.push("/review")}
          className="relative rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          title={`${pendingReviewCount} quarantined transaction(s) awaiting review`}
        >
          <Bell className="h-4 w-4" />
          {pendingReviewCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-xs">
              {pendingReviewCount > 9 ? "9+" : pendingReviewCount}
            </span>
          )}
        </button>

        <div className="flex items-center space-x-3 border-l border-slate-200 pl-4 dark:border-slate-800">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            {initial}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {user?.name || "MandateOS User"}
            </span>
            <div className="flex items-center space-x-1 mt-0.5">
              <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800">
                {user?.role || "OWNER"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="ml-2 inline-flex items-center text-xs font-medium text-slate-500 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer disabled:opacity-50"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

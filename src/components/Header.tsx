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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
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
    <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Search Bar Area */}
      <div className="flex items-center text-slate-500">
        <Search className="mr-2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search policies, mandates..."
          className="bg-transparent text-sm focus:outline-none w-64 placeholder:text-slate-400 text-slate-800"
        />
      </div>

      {/* User Profile & Actions */}
      <div className="flex items-center space-x-4">
        <button
          type="button"
          className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {initial}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-900 leading-tight">
              {user?.name || "MandateOS User"}
            </span>
            <div className="flex items-center space-x-1 mt-0.5">
              <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                {user?.role || "OWNER"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="ml-2 inline-flex items-center text-xs font-medium text-slate-500 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

import { Settings, User } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import DangerZone from "./DangerZone";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="h-7 w-7 text-indigo-400" />
            Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your profile and the destructive operations scoped to your account.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 shadow-sm overflow-hidden">
            <div className="border-b border-white/10 bg-slate-900/60/[0.03] px-6 py-4">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <User className="h-5 w-5 text-slate-500" />
                Profile Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="block text-sm font-medium text-slate-200">Name</span>
                <div className="mt-1 text-sm text-white bg-slate-900/60/[0.03] p-2 rounded border border-white/10">
                  {user.name}
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-200">Email address</span>
                <div className="mt-1 text-sm text-white bg-slate-900/60/[0.03] p-2 rounded border border-white/10">
                  {user.email}
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-200">Role</span>
                <div className="mt-1">
                  <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/20">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="col-span-1 space-y-6">
          <DangerZone canManage={user.role !== "VIEWER"} />
        </div>
      </div>
    </div>
  );
}

import { AlertOctagon, Settings, User } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="h-7 w-7 text-blue-600" />
            Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your profile, platform defaults, and danger zone actions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <User className="h-5 w-5 text-slate-500" />
                Profile Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="block text-sm font-medium text-slate-700">Name</span>
                <div className="mt-1 text-sm text-slate-900 bg-slate-50 p-2 rounded border border-slate-200">
                  {user.name}
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-700">Email address</span>
                <div className="mt-1 text-sm text-slate-900 bg-slate-50 p-2 rounded border border-slate-200">
                  {user.email}
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-700">Role</span>
                <div className="mt-1">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="col-span-1 space-y-6">
          <div className="rounded-xl border border-rose-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-rose-200 bg-rose-50/50 px-6 py-4">
              <h2 className="text-base font-semibold text-rose-800 flex items-center gap-2">
                <AlertOctagon className="h-5 w-5 text-rose-600" />
                Danger Zone
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-900">Revoke All Mandates</h3>
                <p className="text-xs text-slate-500 mt-1 mb-3">
                  Immediately revokes all active agent policies across the platform.
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition w-full"
                  disabled
                >
                  Revoke All Mandates
                </button>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-medium text-slate-900">Force Audit Anchor</h3>
                <p className="text-xs text-slate-500 mt-1 mb-3">
                  Manually trigger a cryptographic anchor publish for all chains.
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition w-full"
                  disabled
                >
                  Publish Anchor Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

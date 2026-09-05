"use client";

import { AlertCircle, ArrowRight, Loader2, Lock, Mail, Shield, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("priya@mandateos.dev");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await authenticate({ email, password });
  };

  // One-click demo sign-in: keeps judges in the flow during live presentations
  // instead of retyping credentials on stage.
  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    await authenticate({ email: demoEmail, password: demoPassword });
  };

  return (
    <div className="w-full max-w-md">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-500/20 mb-3">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-white">Sign in to MandateOS</h1>
        <p className="text-sm text-slate-500 mt-1">
          Access the autonomous agent security & policy console
        </p>
      </div>

      {/* Login Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-sm">
        {error && (
          <div className="mb-6 flex items-center space-x-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400 border border-rose-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="block w-full rounded-lg border border-white/10 bg-slate-900/60/[0.03] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 focus:border-indigo-500 focus:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-white/10 bg-slate-900/60/[0.03] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 focus:border-indigo-500 focus:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 rounded-lg bg-indigo-500 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Hint with one-click sign-in */}
        <div className="mt-6 border-t border-white/10 pt-4 space-y-2">
          <p className="text-xs text-slate-500 text-center">
            Demo credentials: <span className="font-mono text-slate-200">priya@mandateos.dev</span>
          </p>
          <button
            type="button"
            onClick={() => handleDemoLogin("priya@mandateos.dev", "MandateOS@2026")}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/60/[0.03] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900/60/[0.06] transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-amber-500" />
            )}
            One-Click Demo Login
          </button>
        </div>
      </div>
    </div>
  );
}

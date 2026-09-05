import { ShieldX } from "lucide-react";
import { redirect } from "next/navigation";
import AttackConsole from "@/components/AttackConsole";
import { getSessionUser } from "@/server/auth";
import { getUserMandateIds } from "@/server/authz";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function AttackPage() {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await getSessionUser();
  } catch {
    return redirect("/login");
  }

  if (!user) {
    return redirect("/login");
  }

  // Scope the attack console to the user's own mandates — a user can only
  // "try to break" a mandate they own, never someone else's financial policy.
  const mandateIds = await getUserMandateIds(user.id);
  const firstMandate =
    mandateIds.length > 0
      ? await db.query.mandates.findFirst({
          where: (m, { eq }) => eq(m.id, mandateIds[0]),
        })
      : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldX className="h-7 w-7 text-rose-400" />
            Attack Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Live-fire test harness: launch cryptographic policy attacks against an active mandate
            and watch MandateOS reject them at every layer — signature, replay, caps, category, and
            timestamp.
          </p>
        </div>
        {firstMandate && (
          <div className="text-xs text-slate-500">
            Live target:{" "}
            <span className="font-semibold text-slate-300">{firstMandate.agentName}</span>
          </div>
        )}
      </div>

      <AttackConsole
        mandateId={firstMandate?.id ?? undefined}
        agentName={firstMandate?.agentName ?? undefined}
      />

      {/* Quick explainer: what each layer protects */}
      <div className="mos-card p-6 text-xs text-slate-400">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Defense layers under test</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/10">
            <span className="font-semibold text-white">Signature verification</span>
            <p className="mt-0.5 text-slate-400">
              Ed25519 detached signature validated against the mandate's public key. Forged
              signatures = immediate reject.
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/10">
            <span className="font-semibold text-white">Replay shield</span>
            <p className="mt-0.5 text-slate-400">
              Every signed request carries a unique nonce inserted into the DB at first sight.
              Replays hit the unique constraint → 409.
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/10">
            <span className="font-semibold text-white">Spending caps</span>
            <p className="mt-0.5 text-slate-400">
              Per-transaction, daily, and lifetime limits evaluated in pure integer math (paise). No
              LLM, no prompt injection can change the limit.
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/10">
            <span className="font-semibold text-white">Category whitelist</span>
            <p className="mt-0.5 text-slate-400">
              Merchant category must be on the mandate's allowed list. Unauthorized categories
              blocked before any gateway call.
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/10">
            <span className="font-semibold text-white">Timestamp drift</span>
            <p className="mt-0.5 text-slate-400">
              Signed packets must be fresh (±300s). Stale or replayed timestamps are rejected to
              prevent playback attacks.
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/10">
            <span className="font-semibold text-white">Rate limiting</span>
            <p className="mt-0.5 text-slate-400">
              Per-mandate sliding-window rate limit (30 req/min for attack console). Flood attempts
              get throttled.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
